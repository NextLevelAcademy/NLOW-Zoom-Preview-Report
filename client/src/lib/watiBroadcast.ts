import * as XLSX from "xlsx";
import type {
  BroadcastType,
  ReportData,
  SignUpRow,
  ShowUpMergeRow,
  WatiContact,
} from "../../../shared/schema";
import { isValidForBroadcast, normalizePhone } from "./phone";

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
export const BROADCASTS: Record<"no_show_up", BroadcastDefinition> = {
  no_show_up: {
    type: "no_show_up",
    label: "No Show Up",
    description:
      "Sales follow-up for opt-ins who did NOT attend the live session.",
    templateName: "l1nlow_noshow_v1",
    defaultBroadcastName: "NLOW_NoShow_Followup",
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
  may: "nlow_welcome_wati_01",
  june: "nlow_welcome_wati_02",
};
const DEFAULT_WELCOME_TEMPLATE = "nlow_welcome_wati_01";

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
  excluded: { name: string; email: string; reason: string }[];
  // Populated only for no_show_up. Count of opt-ins filtered out via the
  // uploaded Tag 4 List CSV (NLOW4 contacts).
  nlow4ExcludedCount?: number;
  // For dynamic welcome builds: the VW label (month text) the user entered.
  vwLabel?: string;
}

export function buildBroadcasts(report: ReportData): {
  welcomes: BroadcastBuild[];
  no_show_up: BroadcastBuild;
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

  const noShowUpBuild = optInRowsToBroadcast(
    "no_show_up",
    optInNoShowFiltered.map((k) => ({
      fullName: k.fullName || k.email || "Customer",
      email: k.email,
      countryCode: k.countryCode,
      phoneNumber: k.phoneNumber,
      fullPhone: k.fullPhone,
    }))
  );
  noShowUpBuild.nlow4ExcludedCount = nlow4ExcludedCount;

  return {
    welcomes,
    no_show_up: noShowUpBuild,
  };
}

function signUpsToBroadcastWithDefinition(
  definition: BroadcastDefinition,
  rows: SignUpRow[]
): BroadcastBuild {
  const contacts: WatiContact[] = [];
  const excluded: { name: string; email: string; reason: string }[] = [];

  for (const r of rows) {
    const np = normalizePhone(r.phoneNumber || r.fullPhone, r.countryCode);
    if (!isValidForBroadcast(np)) {
      excluded.push({
        name: r.fullName,
        email: r.email,
        reason: !np.phone ? "Missing phone" : "Invalid country code",
      });
      continue;
    }
    contacts.push({
      name: r.fullName || r.email || "Customer",
      countryCode: np.countryCode,
      phone: np.phone,
      allowCampaign: true,
      allowSMS: true,
      email: r.email,
    });
  }

  const seen = new Set<string>();
  const dedup = contacts.filter((c) => {
    const key = `${c.countryCode}${c.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { type: definition.type, definition, contacts: dedup, excluded };
}

interface OptInLike {
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
}

function optInRowsToBroadcast(
  type: "no_show_up",
  rows: OptInLike[]
): BroadcastBuild {
  const definition = BROADCASTS[type];
  const contacts: WatiContact[] = [];
  const excluded: { name: string; email: string; reason: string }[] = [];

  for (const r of rows) {
    const np = normalizePhone(r.phoneNumber || r.fullPhone, r.countryCode);
    if (!isValidForBroadcast(np)) {
      excluded.push({
        name: r.fullName,
        email: r.email,
        reason: !np.phone ? "Missing phone" : "Invalid country code",
      });
      continue;
    }
    contacts.push({
      name: r.fullName || r.email || "Customer",
      countryCode: np.countryCode,
      phone: np.phone,
      allowCampaign: true,
      allowSMS: true,
      email: r.email,
    });
  }

  const seen = new Set<string>();
  const dedup = contacts.filter((c) => {
    const key = `${c.countryCode}${c.phone}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return { type, definition, contacts: dedup, excluded };
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
