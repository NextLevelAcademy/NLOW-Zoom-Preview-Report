import type {
  CountryBreakdown,
  CountryGroup,
  OptInRow,
  PreviewMetrics,
  ReportData,
  SessionDetails,
  ShowUpMergeRow,
  ShowUpRegRow,
  SignUpRow,
  StudentListRow,
} from "../../../shared/schema";
import { parseCsv, parseCsvSkipRows, getVal } from "./csvParse";
import { deriveMetrics } from "./deriveMetrics";

// ============ Helpers ============

function digits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

/**
 * Parse a Keap / Zoom-style phone like:
 *   `'+65 87661449   `   → cc=65, phone=87661449
 *   `'+65 8915 9826   `  → cc=65, phone=89159826
 *   `81273350   `        → cc="", phone=81273350
 *   `60122974700   `     → cc="60", phone=22974700  (if starts with 60 and >=10 digits)
 *   `'+656594831160   `  → cc="65", phone=6594831160 (no space; cc inferred from prefix)
 */
function parseApostrophePhone(raw: string): { cc: string; local: string } {
  if (!raw) return { cc: "", local: "" };
  // Strip leading apostrophe (Excel text marker) and trailing whitespace/notes.
  let s = raw.replace(/^'+/, "").trim();
  // Remove trailing "(Work)" or similar annotations
  s = s.replace(/\s*\(.*\)\s*$/, "").trim();

  if (s.startsWith("+")) {
    // Format: "+65 87661449" or "+656594831160" (no space)
    const afterPlus = s.slice(1).trim();
    const firstSpace = afterPlus.indexOf(" ");
    if (firstSpace > 0) {
      const cc = digits(afterPlus.slice(0, firstSpace));
      const local = digits(afterPlus.slice(firstSpace + 1));
      return { cc, local };
    }
    // No space — try to split a known country code prefix
    const d = digits(afterPlus);
    if (d.startsWith("65") && d.length >= 10) return { cc: "65", local: d.slice(2) };
    if (d.startsWith("60") && d.length >= 11) return { cc: "60", local: d.slice(2) };
    if (d.startsWith("852") && d.length >= 11) return { cc: "852", local: d.slice(3) };
    if (d.startsWith("1") && d.length >= 11) return { cc: "1", local: d.slice(1) };
    // Fallback: treat as 1- or 2-digit cc (best-effort)
    if (d.length >= 10) return { cc: d.slice(0, 2), local: d.slice(2) };
    return { cc: "", local: d };
  }
  // No leading +: could be a raw 8-digit SG local, or country-code-included intl
  const d = digits(s);
  if (!d) return { cc: "", local: "" };
  // 8-digit SG local (starts with 6,8,9)
  if (d.length === 8 && /^[689]/.test(d)) return { cc: "65", local: d };
  // Starts with 65, length 10 → SG
  if (d.startsWith("65") && d.length === 10) return { cc: "65", local: d.slice(2) };
  // Starts with 60, length 11-12 → MY
  if (d.startsWith("60") && (d.length === 11 || d.length === 12))
    return { cc: "60", local: d.slice(2) };
  // Starts with 1, length 11 → USA (must come before bare MY check)
  if (d.startsWith("1") && d.length === 11) return { cc: "1", local: d.slice(1) };
  // Bare MY local (10 digits starting with 1) — e.g. 1XXXXXXXXX
  if (d.length === 10 && d.startsWith("1")) return { cc: "60", local: d };
  // Starts with 852, length 11 → HK
  if (d.startsWith("852") && d.length === 11) return { cc: "852", local: d.slice(3) };
  // Fallback: keep as local, no cc
  return { cc: "", local: d };
}

function buildFullPhone(cc: string, local: string): string {
  if (!cc && !local) return "";
  if (!cc) return local;
  if (!local) return cc;
  return cc + local;
}

function detectCountryFromCc(cc: string): CountryGroup {
  const c = digits(cc);
  if (!c) return "NA";
  if (c === "65") return "SG";
  if (c === "60") return "MY";
  if (c === "1") return "USA";
  if (c === "852") return "HK";
  // Any other valid cc → OTHERS
  return "OTHERS";
}

/**
 * Detect country for a row that has only a raw phone (no cc field).
 * If cc could not be determined AND phone has any digits → INVALID.
 * If both empty → NA.
 */
function detectCountry(cc: string, local: string): CountryGroup {
  const c = digits(cc);
  const l = digits(local);
  if (!c && !l) return "NA";
  if (!c && l) return "INVALID";
  return detectCountryFromCc(c);
}

// ============ Parsers ============

interface KeapRow {
  first: string;
  email: string;
  cc: string;
  local: string;
  fullPhone: string;
  country: CountryGroup;
}

function parseKeapRows(rows: Record<string, any>[]): KeapRow[] {
  return rows
    .map((r) => {
      const first = getVal(r, ["First Name", "FirstName"]);
      const phoneRaw = getVal(r, ["Phone 1", "Phone", "Mobile"]);
      const email = getVal(r, ["Email", "Email Address"]).toLowerCase();
      const { cc, local } = parseApostrophePhone(phoneRaw);
      const country = detectCountry(cc, local);
      return {
        first,
        email,
        cc,
        local,
        fullPhone: buildFullPhone(cc, local),
        country,
      };
    })
    .filter((r) => r.email);
}

// Flags opt-ins as INVALID when their phone number is a strong gibberish
// signal: shared identically across 3+ contacts, or contains a run of 6+
// of the same digit. Never flags on name/email — real people legitimately
// use their name as their email prefix.
function applyGibberishHeuristic(rows: KeapRow[]): void {
  const phoneCounts = new Map<string, number>();
  for (const r of rows) {
    if (r.fullPhone) {
      phoneCounts.set(r.fullPhone, (phoneCounts.get(r.fullPhone) || 0) + 1);
    }
  }
  const repeatedDigitRun = /(\d)\1{5,}/; // same digit 6+ times in a row
  for (const r of rows) {
    const sharedPhone = !!r.fullPhone && (phoneCounts.get(r.fullPhone) || 0) >= 3;
    const placeholderPhone = !!r.fullPhone && repeatedDigitRun.test(r.fullPhone);
    if (sharedPhone || placeholderPhone) {
      r.country = "INVALID";
    }
  }
}

interface RegRow {
  first: string;
  last: string;
  email: string;
  cc: string;
  local: string;
  fullPhone: string;
  country: CountryGroup;
}

function parseRegRows(rows: Record<string, any>[]): RegRow[] {
  return rows
    .map((r) => {
      const first = getVal(r, ["First Name", "FirstName"]);
      const last = getVal(r, ["Last Name", "LastName"]);
      const email = getVal(r, ["Email", "Email Address"]).toLowerCase();
      const phoneRaw = getVal(r, ["Phone", "Phone Number"]);
      const { cc, local } = parseApostrophePhone(phoneRaw);
      const country = detectCountry(cc, local);
      return {
        first,
        last,
        email,
        cc,
        local,
        fullPhone: buildFullPhone(cc, local),
        country,
      };
    })
    .filter((r) => r.email);
}

interface PartRow {
  name: string;
  email: string;
  durationMinutes: number;
}

function parsePartRows(rows: Record<string, any>[]): PartRow[] {
  return rows
    .map((r) => {
      const name = getVal(r, [
        "Name (original name)",
        "Name (Original Name)",
        "Name",
        "Original Name",
      ]);
      const email = getVal(r, ["Email", "User Email"]).toLowerCase();
      const dur =
        parseInt(
          getVal(r, ["Total duration (minutes)", "Duration (minutes)", "Total Duration"]),
          10
        ) || 0;
      return { name, email, durationMinutes: dur };
    })
    .filter((r) => r.email);
}

interface TCRow {
  first: string;
  last: string;
  email: string;
  phone: string;
  total: number;
  pricingOption: string;
  packageName: string;
  orderDate: string;
  processor: "Stripe" | "PayPal";
}

// ThriveCart's "processor" column names the actual payment gateway used for
// the sale. Anything not explicitly PayPal is treated as Stripe, since
// that's the processor ThriveCart uses for the vast majority of sales here.
function normalizeProcessor(raw: string): "Stripe" | "PayPal" {
  return raw.toLowerCase().includes("paypal") ? "PayPal" : "Stripe";
}

function parseTCRows(rows: Record<string, any>[]): TCRow[] {
  return rows
    .map((r) => {
      const totalStr = getVal(r, ["total", "Total", "amount"]);
      const total = parseFloat(totalStr.replace(/[^0-9.\-]/g, "")) || 0;
      return {
        first: getVal(r, [
          "customer_first_name",
          "first_name",
          "Customer First Name",
          "First Name",
        ]),
        last: getVal(r, [
          "customer_last_name",
          "last_name",
          "Customer Last Name",
          "Last Name",
        ]),
        email: getVal(r, [
          "customer_email",
          "email",
          "Customer Email",
          "Email",
        ]).toLowerCase(),
        phone: getVal(r, [
          "customer_phone",
          "phone",
          "Phone",
          "telephone",
          "Telephone",
          "customer_telephone",
        ]),
        total,
        pricingOption: getVal(r, [
          "relevant_item_pricing_option",
          "pricing_option",
          "Pricing Option",
        ]),
        packageName: getVal(r, [
          "relevant_item_name",
          "Product",
          "Item Name",
        ]),
        orderDate: getVal(r, ["order_date", "Order Date", "date"]),
        processor: normalizeProcessor(
          getVal(r, ["processor", "Processor", "payment_processor", "gateway"])
        ),
      };
    })
    .filter((r) => r.email);
}

interface BTRow {
  fullName: string;
  email: string;
  phone: string;
  intake: string; // "May", "June" — from the Date column
  price: number; // optional override; falls back to session.programPrice if 0
}

function parseBTRows(rows: Record<string, any>[]): BTRow[] {
  return rows
    .map((r) => {
      const first = getVal(r, ["First Name", "FirstName", "first_name"]);
      const last = getVal(r, ["Last Name", "LastName", "last_name"]);
      const fullNameDirect = getVal(r, [
        "Name",
        "Full Name",
        "FullName",
        "name",
      ]);
      const dateRaw = getVal(r, [
        "Date",
        "date",
        "Intake",
        "intake",
        "Intake Date",
        "Month",
        "month",
      ]);
      const priceRaw = getVal(r, [
        "Price",
        "price",
        "Amount",
        "amount",
        "Total",
        "total",
      ]);
      const priceNum = Number(
        String(priceRaw).replace(/[^0-9.\-]/g, "")
      );
      return {
        fullName: fullNameDirect || `${first} ${last}`.trim(),
        email: getVal(r, ["Email", "email", "Email Address"]).toLowerCase(),
        phone: getVal(r, [
          "Phone Number",
          "phone number",
          "Phone",
          "phone",
          "Mobile",
          "telephone",
          "Telephone",
        ]),
        intake: extractIntake(dateRaw),
        price: Number.isFinite(priceNum) ? priceNum : 0,
      };
    })
    .filter((r) => r.email || r.phone);
}

// ============ Main entry ============

export interface UploadedFiles {
  keapFile: File;
  registrationFile: File;
  participantsFile: File;
  thriveCartFile: File;
  bankTransferFile?: File | null;
  // Optional Tag 4 List (NLOW4) export from Keap. Same header format as the
  // main Keap opt-in CSV (First Name, Phone 1, Email). Contacts in this list
  // are excluded from the No Show Up broadcast.
  nlow4File?: File | null;
}

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const INTAKE_MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export function extractIntake(s: string): string {
  if (!s) return "";
  const lower = s.toLowerCase();
  for (const m of INTAKE_MONTHS) {
    if (lower.includes(m)) {
      return m.charAt(0).toUpperCase() + m.slice(1);
    }
  }
  return "";
}

function formatSessionDateLong(s: string, yearOffset = 0): string {
  if (!s) return "";
  const compact = s.replace(/\D/g, "");
  if (compact.length !== 6) return s;
  const dd = parseInt(compact.slice(0, 2), 10);
  const mm = parseInt(compact.slice(2, 4), 10);
  const yy = parseInt(compact.slice(4, 6), 10);
  if (mm < 1 || mm > 12) return s;
  return `${dd}-${MONTHS_SHORT[mm - 1]}-${2000 + yy + yearOffset}`;
}

function monthsToExpire(sessionDate: string): number {
  // Compute months between today and (sessionDate + 1 year). Simple month-diff.
  if (!sessionDate) return 12;
  const compact = sessionDate.replace(/\D/g, "");
  if (compact.length !== 6) return 12;
  const dd = parseInt(compact.slice(0, 2), 10);
  const mm = parseInt(compact.slice(2, 4), 10);
  const yy = parseInt(compact.slice(4, 6), 10);
  const expire = new Date(2000 + yy + 1, mm - 1, dd);
  const today = new Date();
  let m =
    (expire.getFullYear() - today.getFullYear()) * 12 +
    (expire.getMonth() - today.getMonth());
  if (expire.getDate() < today.getDate()) m -= 1;
  if (m < 0) m = 0;
  if (m > 12) m = 12;
  return m;
}

export async function generateReport(
  files: UploadedFiles,
  session: SessionDetails
): Promise<ReportData> {
  const [keapRaw, regRaw, partRaw, tcRaw, btRaw, nlow4Raw] = await Promise.all([
    parseCsv<Record<string, any>>(files.keapFile),
    parseCsvSkipRows<Record<string, any>>(files.registrationFile, 5),
    parseCsvSkipRows<Record<string, any>>(files.participantsFile, 3),
    parseCsv<Record<string, any>>(files.thriveCartFile),
    files.bankTransferFile
      ? parseCsv<Record<string, any>>(files.bankTransferFile)
      : Promise.resolve([]),
    files.nlow4File
      ? parseCsv<Record<string, any>>(files.nlow4File)
      : Promise.resolve([]),
  ]);

  const keap = parseKeapRows(keapRaw);
  applyGibberishHeuristic(keap);
  const reg = parseRegRows(regRaw);
  const part = parsePartRows(partRaw);
  const tc = parseTCRows(tcRaw);
  const bt = parseBTRows(btRaw);
  // Tag 4 List (NLOW4) — same Keap export format. Collect both normalized
  // phones and emails so buildBroadcasts can match by either.
  const nlow4Rows = parseKeapRows(nlow4Raw);
  const nlow4ExcludedPhones: string[] = [];
  const nlow4ExcludedEmails: string[] = [];
  for (const r of nlow4Rows) {
    if (r.fullPhone) nlow4ExcludedPhones.push(r.fullPhone.replace(/\D/g, ""));
    if (r.email) nlow4ExcludedEmails.push(r.email.toLowerCase());
  }

  const keapByEmail = new Map<string, KeapRow>();
  for (const k of keap) keapByEmail.set(k.email, k);
  // Phone-based lookup: handles people who use different emails across
  // Opt-In (Keap) and Show Up (Zoom) but the same phone number.
  // Key is the full phone (cc + local) once both are present.
  const keapByPhone = new Map<string, KeapRow>();
  for (const k of keap) {
    if (k.fullPhone) keapByPhone.set(k.fullPhone, k);
  }
  const regByEmail = new Map<string, RegRow>();
  for (const r of reg) regByEmail.set(r.email, r);
  const partByEmail = new Map<string, PartRow>();
  for (const p of part) partByEmail.set(p.email, p);

  // ===== Sign-ups (TC + BT) =====
  const signUpRows: SignUpRow[] = [];
  const seenSignupEmails = new Map<string, SignUpRow>();

  function resolvePhoneAndCountry(
    email: string,
    fallbackPhone: string
  ): { cc: string; local: string; fullPhone: string; country: CountryGroup } {
    const k = keapByEmail.get(email);
    if (k && (k.cc || k.local)) {
      return {
        cc: k.cc,
        local: k.local,
        fullPhone: k.fullPhone,
        country: k.country,
      };
    }
    const r = regByEmail.get(email);
    if (r && (r.cc || r.local)) {
      return {
        cc: r.cc,
        local: r.local,
        fullPhone: r.fullPhone,
        country: r.country,
      };
    }
    if (fallbackPhone) {
      const { cc, local } = parseApostrophePhone(fallbackPhone);
      return {
        cc,
        local,
        fullPhone: buildFullPhone(cc, local),
        country: detectCountry(cc, local),
      };
    }
    return { cc: "", local: "", fullPhone: "", country: "NA" };
  }

  for (const r of tc) {
    const fullName = `${r.first} ${r.last}`.trim() || r.email;
    const resolved = resolvePhoneAndCountry(r.email, r.phone);
    const showedUp = partByEmail.has(r.email);
    // Match Opt-In by email first, then by phone (same person, different
    // email between Opt-In and ThriveCart).
    const inOptIn =
      keapByEmail.has(r.email) ||
      (!!resolved.fullPhone && keapByPhone.has(resolved.fullPhone));
    const signUp: SignUpRow = {
      fullName,
      email: r.email,
      countryCode: resolved.cc,
      phoneNumber: resolved.local,
      fullPhone: resolved.fullPhone,
      country: resolved.country,
      source: r.processor,
      pricingOption: r.packageName || r.pricingOption,
      intake: extractIntake(`${r.packageName || ""} ${r.pricingOption || ""} ${r.orderDate || ""}`),
      total: r.total,
      orderDate: r.orderDate,
      showedUp,
      inOptIn,
    };
    seenSignupEmails.set(r.email, signUp);
    signUpRows.push(signUp);
  }

  for (const r of bt) {
    const existing = r.email ? seenSignupEmails.get(r.email) : undefined;
    if (existing) {
      // Already recorded via ThriveCart — keep their Stripe/PayPal source
      // rather than a separate combined category.
      continue;
    }
    const resolved = resolvePhoneAndCountry(r.email, r.phone);
    const showedUp = !!(r.email && partByEmail.has(r.email));
    const inOptIn =
      (!!r.email && keapByEmail.has(r.email)) ||
      (!!resolved.fullPhone && keapByPhone.has(resolved.fullPhone));
    const signUp: SignUpRow = {
      fullName: r.fullName || r.email,
      email: r.email,
      countryCode: resolved.cc,
      phoneNumber: resolved.local,
      fullPhone: resolved.fullPhone,
      country: resolved.country,
      source: "BT",
      pricingOption: "",
      intake: r.intake || "",
      total: r.price > 0 ? r.price : session.programPrice,
      orderDate: "",
      showedUp,
      inOptIn,
    };
    if (r.email) seenSignupEmails.set(r.email, signUp);
    signUpRows.push(signUp);
  }

  const signUpEmails = new Set(
    signUpRows.map((s) => s.email).filter(Boolean)
  );
  const partEmails = new Set(part.map((p) => p.email));

  // ===== Show up Merge (one row per UNIQUE participant email; sum durations) =====
  const partDedupMap = new Map<string, PartRow & { totalDuration: number }>();
  for (const p of part) {
    if (!p.email) continue;
    const ex = partDedupMap.get(p.email);
    if (ex) {
      ex.totalDuration = (ex.totalDuration || 0) + (p.durationMinutes || 0);
    } else {
      partDedupMap.set(p.email, { ...p, totalDuration: p.durationMinutes || 0 });
    }
  }
  const partDedup = Array.from(partDedupMap.values());
  const showUpMerge: ShowUpMergeRow[] = partDedup.map((p) => {
    let k = keapByEmail.get(p.email);
    const reg = regByEmail.get(p.email);
    // Fallback: if no Keap match by email, try matching by the registration
    // phone (some attendees use a different email for Opt-In vs Zoom signup
    // but keep the same phone number).
    if (!k && reg && reg.fullPhone) {
      const kByPhone = keapByPhone.get(reg.fullPhone);
      if (kByPhone) k = kByPhone;
    }
    let name = p.name;
    let cc = "", local = "", fullPhone = "", country: CountryGroup = "NA";
    let source: "Keap" | "Registration" | "Unknown" = "Unknown";
    if (k) {
      source = "Keap";
      name = k.first || p.name;
      cc = k.cc;
      local = k.local;
      fullPhone = k.fullPhone;
      country = k.country;
    } else if (reg) {
      source = "Registration";
      name = `${reg.first} ${reg.last}`.trim() || p.name;
      cc = reg.cc;
      local = reg.local;
      fullPhone = reg.fullPhone;
      country = reg.country;
    }
    const signed = signUpEmails.has(p.email);
    return {
      fullName: name,
      email: p.email,
      countryCode: cc,
      phoneNumber: local,
      fullPhone,
      country,
      durationMinutes: p.totalDuration,
      source,
      signedUp: signed,
      signedUpEmail: signed ? p.email : "",
    };
  });

  // ===== Show up REG (one row per registrant) =====
  const showUpReg: ShowUpRegRow[] = reg.map((r) => ({
    firstName: r.first,
    lastName: r.last,
    fullName: `${r.first} ${r.last}`.trim() || r.email,
    email: r.email,
    countryCode: r.cc,
    phoneNumber: r.local,
    fullPhone: r.fullPhone,
    country: r.country,
    showedUp: partEmails.has(r.email),
    signedUp: signUpEmails.has(r.email),
  }));

  // ===== Opt-Ins (Keap rows) =====
  // Start with the Keap opt-ins, then append any Show Up attendees that
  // weren't matched to Keap by either email OR phone. Country for the
  // appended rows comes from the registration phone's country code (never
  // "INVALID" / "NA" as long as the phone has a valid cc).
  const optInRows: OptInRow[] = keap.map((k) => ({
    firstName: k.first,
    fullName: k.first, // matches reference report which uses just first name
    email: k.email,
    countryCode: k.cc,
    phoneNumber: k.local,
    fullPhone: k.fullPhone,
    country: k.country,
    showedUp: partEmails.has(k.email),
    signedUp: signUpEmails.has(k.email),
    source: "keap",
  }));
  for (const s of showUpMerge) {
    if (s.source === "Keap") continue; // already in optInRows by email/phone
    optInRows.push({
      firstName: s.fullName,
      fullName: s.fullName,
      email: s.email,
      countryCode: s.countryCode,
      phoneNumber: s.phoneNumber,
      fullPhone: s.fullPhone,
      country: s.country,
      showedUp: true,
      signedUp: s.signedUp,
      source: "showup_only",
    });
  }

  // ===== Country breakdowns + metrics =====
  const { metrics, optInByCountry, showUpByCountry, signUpByCountry } =
    deriveMetrics(session, optInRows, showUpMerge, signUpRows);

  // ===== Student List =====
  const previewDate = formatSessionDateLong(session.sessionDate, 0);
  const expirationDate = formatSessionDateLong(session.sessionDate, 1);
  const mte = monthsToExpire(session.sessionDate);
  const fee = (session.programPrice || 0).toFixed(2);
  const studentList: StudentListRow[] = signUpRows.map((s) => {
    const gateway =
      s.source === "BT" ? "Bank Transfer" : s.source === "PayPal" ? "paypal" : "stripe";
    const ccLabel: CountryGroup = s.country;
    return {
      packageSold: s.pricingOption || "",
      name: s.fullName,
      email: s.email,
      mobile: s.fullPhone,
      mobileCountryCode: ccLabel === "NA" ? "" : ccLabel,
      expirationDate,
      monthsToExpire: mte,
      previewDate,
      speaker: `LIVE Zoom-${session.speaker || "Bjorn Ng"}`,
      affiliateId: "-",
      enrolmentDate: previewDate,
      currency: "SGD",
      courseFeeWGst: fee,
      amountPaid: (s.total || 0).toFixed(2),
      paymentGateway: gateway,
    };
  });

  return {
    sessionDetails: session,
    metrics,
    optInByCountry,
    showUpByCountry,
    signUpByCountry,
    optIns: optInRows,
    showUpMerge,
    showUpReg,
    signUps: signUpRows,
    studentList,
    generatedAt: new Date().toISOString(),
    nlow4ExcludedPhones,
    nlow4ExcludedEmails,
  };
}
