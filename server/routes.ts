import type { Express } from "express";
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { sendBroadcastSchema } from "../shared/schema";

// WATI credentials — must be provided via environment, never hardcoded here.
const WATI_BEARER = process.env.WATI_BEARER;
const WATI_BASE_URL = "https://live-mt-server.wati.io/8686";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Health check
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // WATI broadcast send — proxies through backend so the bearer token is never exposed to browser
  app.post("/api/wati/send-broadcast", async (req, res) => {
    if (!WATI_BEARER) {
      return res.status(500).json({
        ok: false,
        error: "WATI_BEARER is not configured on the server",
      });
    }
    const parsed = sendBroadcastSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        ok: false,
        error: "Invalid request",
        details: parsed.error.flatten(),
      });
    }
    const { templateName, broadcastName, contacts, mediaUrl } = parsed.data;
    // NOTE: WATI v1 sendTemplateMessage does NOT accept a top-level `mediaUrl`
    // for swapping a template's header image at send time. Templates with a
    // static image header use the image baked in at template-approval time.
    // To swap the banner per send, the WATI template must be re-approved with
    // a media VARIABLE in the header (e.g. {{1}}), and the URL must then be
    // passed inside `parameters` using that variable's name.
    // For now we accept mediaUrl in the schema (so the frontend can send it)
    // but do not forward it — the templates currently in use have a static
    // image header. Once the templates are re-approved with a header variable,
    // wire mediaUrl into the parameters array as `{ name: "<varName>", value: mediaUrl }`.

    // WATI single-message endpoint: /api/v1/sendTemplateMessage?whatsappNumber=...
    // Body: { template_name, broadcast_name, parameters: [{ name, value }] }
    // We loop through contacts and send one at a time. The bulk endpoint's payload
    // format is poorly documented and consistently rejects valid templates with
    // "doesn't have enough parameters" — the single endpoint works reliably.
    //
    // To keep the API responsive on large lists we send concurrently in batches.

    type SendOutcome = {
      whatsappNumber: string;
      name: string;
      ok: boolean;
      error?: string;
      response?: any;
    };

    async function sendOne(contact: typeof contacts[number]): Promise<SendOutcome> {
      const wa = `${contact.countryCode}${contact.phone}`.replace(/\D/g, "");
      const url = `${WATI_BASE_URL}/api/v1/sendTemplateMessage?whatsappNumber=${encodeURIComponent(
        wa
      )}`;
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_BEARER}`,
            "Content-Type": "application/json-patch+json",
            Accept: "*/*",
          },
          body: JSON.stringify({
            template_name: templateName,
            broadcast_name: broadcastName,
            parameters: [
              { name: "name", value: contact.name || "there" },
            ],
          }),
        });
        const text = await r.text();
        let body: any = text;
        try {
          body = JSON.parse(text);
        } catch {}

        const success = r.ok && body?.result === true;
        return {
          whatsappNumber: wa,
          name: contact.name,
          ok: success,
          error: success
            ? undefined
            : body?.info ||
              body?.errors?.error ||
              body?.error ||
              `HTTP ${r.status}`,
          response: body,
        };
      } catch (err: any) {
        return {
          whatsappNumber: wa,
          name: contact.name,
          ok: false,
          error: err?.message ?? "Network error",
        };
      }
    }

    const CONCURRENCY = 5;
    const results: SendOutcome[] = [];
    for (let i = 0; i < contacts.length; i += CONCURRENCY) {
      const slice = contacts.slice(i, i + CONCURRENCY);
      const batch = await Promise.all(slice.map(sendOne));
      results.push(...batch);
    }

    const successes = results.filter((r) => r.ok);
    const failures = results.filter((r) => !r.ok);

    return res.json({
      ok: failures.length === 0,
      sentCount: successes.length,
      failedCount: failures.length,
      total: results.length,
      templateName,
      broadcastName,
      mediaUrl: mediaUrl ?? null,
      failures: failures.slice(0, 50).map((f) => ({
        whatsappNumber: f.whatsappNumber,
        name: f.name,
        error: f.error,
      })),
    });
  });

  return httpServer;
}
