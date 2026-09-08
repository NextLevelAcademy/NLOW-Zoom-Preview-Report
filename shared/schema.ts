import { z } from "zod";

// ===== WATI Broadcast types =====

export const watiContactSchema = z.object({
  name: z.string(),
  countryCode: z.string(),
  phone: z.string(),
  allowCampaign: z.boolean().default(true),
  allowSMS: z.boolean().default(true),
  email: z.string().optional(),
  intake: z.string().optional(),
});

export type WatiContact = z.infer<typeof watiContactSchema>;

export const broadcastTypeSchema = z.enum([
  "may_signups",
  "june_signups",
  "no_show_up",
  "showup_no_buy",
]);
export type BroadcastType = z.infer<typeof broadcastTypeSchema>;

// broadcastType accepts a static enum value OR a synthetic dynamic id like
// "welcome:july" so the frontend can send per-VW-date welcome broadcasts.
export const sendBroadcastSchema = z.object({
  broadcastType: z.string().optional(),
  templateName: z.string(),
  broadcastName: z.string(),
  contacts: z.array(watiContactSchema).min(1),
  mediaUrl: z.string().url().optional(),
});

export type SendBroadcastRequest = z.infer<typeof sendBroadcastSchema>;

// ===== Report data types =====

export type CountryGroup =
  | "SG"
  | "MY"
  | "USA"
  | "HK"
  | "OTHERS"
  | "INVALID"
  | "NA";

export interface VWDateEntry {
  label: string; // e.g. "May"
  pastSignups: number; // prior cumulative sign-ups from that VW date
}

export interface SessionDetails {
  sessionDate: string; // "DD/MM/YY" or "DDMMYY"
  attendanceAtPitch: number | null;
  programPrice: number; // default 297 (SGD) for NLOW Zoom Preview
  speaker: string; // default "Bjorn Ng" — the session's speaker/mentor (editable)
  vwDates: VWDateEntry[]; // repeatable date+count rows (e.g. May/June past sign-ups)
}

export interface PreviewMetrics {
  optInCount: number;
  optInWithoutInvalidCount: number;
  showUpCount: number;
  showUpPct: number; // % of opt-in
  attendanceAtPitch: number; // from session details
  attendanceAtPitchPct: number; // % of show-up
  signUpCount: number; // TC + BT (deduped by email)
  signUpPct: number; // % of attendance at pitch
  revenueTotal: number; // programPrice * signUpCount
  signUpsByIntakeForVW: Record<string, number>; // per-VW-date total = pastSignups + matching intake sign-ups
}

export interface OptInRow {
  firstName: string;
  fullName: string; // first name only for Keap rows (matches reference)
  email: string;
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
  country: CountryGroup;
  showedUp: boolean;
  signedUp: boolean;
  source: "keap" | "showup_only"; // showup_only = appended from Show Up, unmatched to a Keap opt-in
}

/** Show up Merge row — a row per participant joined with Keap/Registration. */
export interface ShowUpMergeRow {
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
  country: CountryGroup;
  durationMinutes: number;
  source: "Keap" | "Registration" | "Unknown";
  signedUp: boolean;
  signedUpEmail: string; // for the "Sign up" column display
}

/** Show up REG row — a row per Zoom registrant with a Showed Up flag. */
export interface ShowUpRegRow {
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
  country: CountryGroup;
  showedUp: boolean;
  signedUp: boolean;
}

export interface SignUpRow {
  fullName: string;
  email: string;
  countryCode: string;
  phoneNumber: string;
  fullPhone: string;
  country: CountryGroup;
  source: "Stripe" | "PayPal" | "BT"; // Stripe/PayPal = ThriveCart, by processor; BT = Bank Transfer (PayNow)
  pricingOption: string;
  intake: string; // "May", "June", or "" — derived from pricingOption / orderDate
  total: number;
  orderDate: string;
  showedUp: boolean;
  inOptIn: boolean;
}

export interface StudentListRow {
  packageSold: string;
  name: string;
  email: string;
  mobile: string;
  mobileCountryCode: string; // "SG", "MY", etc. (label not digits)
  expirationDate: string; // e.g. "7-May-2027"
  monthsToExpire: number;
  previewDate: string; // e.g. "7-May-2026"
  speaker: string; // "LIVE Zoom-<Speaker>"
  affiliateId: string; // "-"
  enrolmentDate: string; // same as preview date
  currency: string; // "SGD"
  courseFeeWGst: string; // "3997.00"
  amountPaid: string;
  paymentGateway: string; // "stripe" or "Bank Transfer"
}

export interface CountryBreakdown {
  SG: number;
  MY: number;
  USA: number;
  HK: number;
  OTHERS: number;
  INVALID: number;
  NA: number;
}

export interface ReportData {
  sessionDetails: SessionDetails;
  metrics: PreviewMetrics;
  optInByCountry: CountryBreakdown;
  showUpByCountry: CountryBreakdown;
  signUpByCountry: CountryBreakdown;
  optIns: OptInRow[];
  showUpMerge: ShowUpMergeRow[];
  showUpReg: ShowUpRegRow[];
  signUps: SignUpRow[];
  studentList: StudentListRow[];
  generatedAt: string;
  // Tag 4 List exclusion (NLOW4) — contacts in the uploaded Tag 4 CSV are
  // filtered out of the No Show Up broadcast. Match by normalized phone
  // (primary) with email fallback. Empty when no Tag 4 CSV was uploaded.
  nlow4ExcludedPhones?: string[];
  nlow4ExcludedEmails?: string[];
}
