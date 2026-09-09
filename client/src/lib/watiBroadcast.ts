import * as XLSX from "xlsx";
import type {
  BroadcastType,
  OptInRow,
  ReportData,
  ShowUpMergeRow,
  SignUpRow,
  WatiContact,
} from "../../../shared/schema";
import { normalizePhone } from "./phone";

// Which report.* array a WATI broadcast tab's contacts are derived from —
// used to route contact edits/deletes back to the right source table (see
// updateBroadcastContact/deleteBroadcastContact in pages/home.tsx).
export type WatiSourceType = "optIns" | "showUps" | "signUps";
export type ContactPatch = {
  name?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
};

export interface BroadcastDefinition {
  type: BroadcastType | string; // welcome builds use synthetic ids like "welcome:july"
  label: string;
  description: string;
  templateName: string;
  defaultBroadcastName: string;
  bannerPath?: string;
  bannerLabel?: string;
}

// Only static (non-welcome) broadcast definitions live in this map.
// Welcome broadcasts are generated dynamically from the VW Date Entries.
export const BROADCASTS: Record<"no_show_up" | "showup_no_buy", BroadcastDefinition> = {
  no_show_up: {
    type: "no_show_up",
    label: "No Show Up",
    description:
      "Sales follow-up for opt-ins who did NOT attend the live session.",
    templateName: "l1nlow_noshow_v1",
    defaultBroadcastName: "NLOW_NoShow_Followup",
  },
  showup_no_buy: {
    type: "showup_no_buy",
    label: "Showed Up — No Sign-Up",
    description:
      "Attended live but did not sign up. Sales follow-up template.",
    templateName: "Drip Campaign",
    defaultBroadcastName: "NLOW_ShowUp_NoBuy_Followup",
  },
};

function titleCase(s: string): string {
  const t = (s || "").trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

// Per-month WATI template override. Months not listed here fall back to the
// default welcome template.
const WELCOME_TEMPLATE_OVERRIDES: Record<string, string> = {
  june: "nlow_welcome_wati_02",
};
const DEFAULT_WELCOME_TEMPLATE = "l2nlmba_tgreminder_update_v1";

function synthWelcomeDefinition(vwLabel: string): BroadcastDefinition {
  const month = titleCase(vwLabel);
  const slug = month.toLowerCase().replace(/[^a-z0-9]+/g, "_");
  const templateName =
    WELCOME_TEMPLATE_OVERRIDES[slug] ?? DEFAULT_WELCOME_TEMPLATE;
  return {
    type: `welcome:${slug}`,
    label: `${month} Welcome`,
    description: `Sign-ups whose pricing option indicates the ${month} intake. Welcome message + TG group reminder.`,
    templateName,
    defaultBroadcastName: `NLOW_${month}_Intake_Welcome`,
    bannerPath: `/banners/${slug}.jpg`,
    bannerLabel: `${month} intake banner`,
  };
}

export interface BroadcastBuild {
  type: BroadcastType | string;
  definition: BroadcastDefinition;
  contacts: WatiContact[];
  // Populated only for no_show_up. Count of opt-ins filtered out via the
  // uploaded Tag 4 List CSV (NLOW4 contacts).
  nlow4ExcludedCount?: number;
  // For dynamic welcome builds: the VW label (month text) the user entered.
  vwLabel?: string;
}

export function buildBroadcasts(report: ReportData): {
  welcomes: BroadcastBuild[];
  no_show_up: BroadcastBuild;
  showup_no_buy: BroadcastBuild;
} {
  const allSignUps: SignUpRow[] = report.signUps;

  // Build one welcome broadcast per VW Date Entry (matched by month text
  // against each sign-up's intake column, case-insensitive).
  const effectiveVwDates = (report.sessionDetails?.vwDates ?? []).filter(
    (v) => v && (v.label || "").trim().length > 0
  );
  const welcomes: BroadcastBuild[] = effectiveVwDates.map((vw) => {
    const monthKey = vw.label.trim().toLowerCase();
    const rows = allSignUps.filter(
      (s) => (s.intake || "").trim().toLowerCase() === monthKey
    );
    const definition = synthWelcomeDefinition(vw.label);
    const build = signUpsToBroadcastWithDefinition(definition, rows);
    build.vwLabel = vw.label.trim();
    return build;
  });
  const participantEmails = new Set(
    report.showUpMerge.map((r) => (r.email || "").toLowerCase()).filter(Boolean)
  );
  const optInNoShow = report.optIns.filter(
    (k) =>
      k.email &&
      !participantEmails.has(k.email.toLowerCase())
  );

  // Tag 4 List exclusion (NLOW4) — filter out anyone whose phone (digits-only)
  // or email is in the uploaded Tag 4 List CSV. Empty sets when no CSV uploaded.
  const nlow4Phones = new Set(
    (report.nlow4ExcludedPhones ?? []).map((p) => p.replace(/\D/g, "")).filter(Boolean)
  );
  const nlow4Emails = new Set(
    (report.nlow4ExcludedEmails ?? []).map((e) => e.toLowerCase()).filter(Boolean)
  );
  const optInNoShowFiltered = optInNoShow.filter((k) => {
    const phoneDigits = (k.fullPhone || "").replace(/\D/g, "");
    const emailLower = (k.email || "").toLowerCase();
    if (phoneDigits && nlow4Phones.has(phoneDigits)) return false;
    if (emailLower && nlow4Emails.has(emailLower)) return false;
    return true;
  });
  const nlow4ExcludedCount = optInNoShow.length - optInNoShowFiltered.length;

  const noShowUpBuild = optInsToBroadcast("no_show_up", optInNoShowFiltered);
  noShowUpBuild.nlow4ExcludedCount = nlow4ExcludedCount;

  // Sales Follow-Up: showed up live but never signed up.
  const showUpNoBuy: ShowUpMergeRow[] = report.showUpMerge.filter(
    (r) => !r.signedUp
  );

  return {
    welcomes,
    no_show_up: noShowUpBuild,
    showup_no_buy: showUpsToBroadcast("showup_no_buy", showUpNoBuy),
  };
}

function signUpsToBroadcastWithDefinition(
  definition: BroadcastDefinition,
  rows: SignUpRow[]
): BroadcastBuild {
  const contacts: WatiContact[] = [];

  for (const r of rows) {
    const np = normalizePhone(r.phoneNumber || r.fullPhone, r.countryCode);
    contacts.push({
      name: r.fullName || r.email || "Customer",
      countryCode: np.countryCode,
      phone: np.phone,
      allowCampaign: true,
      allowSMS: true,
      email: r.email,
    });
  }

  // Dedupe by full phone — avoids double-messaging the same WhatsApp number
  // within one broadcast. Not a validity check: rows with no/invalid phone
  // are still included so they can be reviewed and fixed manually.
  const seen = new Set<string>();
  const dedup = contacts.filter((c) => {
    const key = `${c.countryCode}${c.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { type: definition.type, definition, contacts: dedup };
}

function optInsToBroadcast(
  type: "no_show_up",
  rows: OptInRow[]
): BroadcastBuild {
  const definition = BROADCASTS[type];
  const contacts: WatiContact[] = [];

  for (const r of rows) {
    const np = normalizePhone(r.phoneNumber || r.fullPhone, r.countryCode);
    contacts.push({
      name: r.fullName || r.email || "Customer",
      countryCode: np.countryCode,
      phone: np.phone,
      allowCampaign: true,
      allowSMS: true,
      email: r.email,
    });
  }

  // Dedupe by full phone (see note above).
  const seen = new Set<string>();
  const dedup = contacts.filter((c) => {
    const key = `${c.countryCode}${c.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { type, definition, contacts: dedup };
}

function showUpsToBroadcast(
  type: "showup_no_buy",
  rows: ShowUpMergeRow[]
): BroadcastBuild {
  const definition = BROADCASTS[type];
  const contacts: WatiContact[] = [];

  for (const r of rows) {
    const np = normalizePhone(r.phoneNumber || r.fullPhone, r.countryCode);
    contacts.push({
      name: r.fullName || r.email || "Attendee",
      countryCode: np.countryCode,
      phone: np.phone,
      allowCampaign: true,
      allowSMS: true,
      email: r.email,
    });
  }

  // Dedupe by full phone (see note above).
  const seen = new Set<string>();
  const dedup = contacts.filter((c) => {
    const key = `${c.countryCode}${c.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { type, definition, contacts: dedup };
}

export function downloadWatiCsv(build: BroadcastBuild): void {
  const rows: any[][] = [
    ["Name", "CountryCode", "Phone", "AllowCampaign", "AllowSMS"],
    ...build.contacts.map((c) => [
      c.name,
      c.countryCode,
      c.phone,
      c.allowCampaign ? "TRUE" : "FALSE",
      c.allowSMS ? "TRUE" : "FALSE",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ds = new Date().toISOString().split("T")[0];
  a.download = `wati-${build.type}-${ds}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
