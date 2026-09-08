import { useEffect, useMemo, useState } from "react";
import {
  ChartColumn,
  CheckCircle,
  Download,
  FileText,
  Moon,
  RefreshCw,
  Send,
  Sun,
  Upload,
  Users,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  generateReport,
  type UploadedFiles,
} from "@/lib/reportGenerator";
import { deriveMetrics } from "@/lib/deriveMetrics";
import { downloadExcelReport } from "@/lib/excelExport";
import {
  buildBroadcasts,
  type ContactPatch,
  type WatiSourceType,
} from "@/lib/watiBroadcast";
import { BroadcastPanel } from "@/components/BroadcastPanel";
import {
  CountrySelect,
  DeleteRowButton,
  EditableBool,
  EditableNumber,
  EditableText,
} from "@/components/EditableCell";
import type {
  CountryBreakdown,
  OptInRow,
  ReportData,
  SessionDetails,
  ShowUpMergeRow,
  SignUpRow,
  StudentListRow,
  VWDateEntry,
} from "../../../shared/schema";

// ============================================================================
// Header
// ============================================================================
function Header({
  showReportActions,
  onReset,
  onDownload,
  isDark,
  onToggleDark,
}: {
  showReportActions: boolean;
  onReset?: () => void;
  onDownload?: () => void;
  isDark: boolean;
  onToggleDark: () => void;
}) {
  return (
    <header className="border-b border-border px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center"
          data-testid="logo-box"
        >
          <ChartColumn className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <p className="font-bold text-sm leading-tight">NLOW Zoom Preview Report</p>
          <p className="text-xs text-muted-foreground leading-tight">
            Next Level Online Webinar
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          onClick={onToggleDark}
          data-testid="button-theme-toggle"
          aria-label="Toggle theme"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
        {showReportActions && (
          <>
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border hover:bg-muted text-sm font-medium transition-colors"
              data-testid="button-reset"
            >
              <RefreshCw className="w-4 h-4" /> Start Over
            </button>
            <button
              onClick={onDownload}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
              data-testid="button-download-excel"
            >
              <Download className="w-4 h-4" /> Download Excel
            </button>
          </>
        )}
      </div>
    </header>
  );
}

// ============================================================================
// Upload page
// ============================================================================
type FileSlotProps = {
  file: File | null;
  onFile: (f: File | null) => void;
  title: string;
  accept: string;
  testId: string;
  hint?: string;
};

function RequiredFileSlot({
  file,
  onFile,
  title,
  accept,
  testId,
  hint,
}: FileSlotProps) {
  const filled = !!file;
  return (
    <label
      className={[
        "relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all",
        filled
          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
          : "border-border hover:border-primary/50 hover:bg-muted/30",
      ].join(" ")}
      data-testid={`dropzone-${testId}`}
    >
      <input
        type="file"
        accept={accept}
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        data-testid={`input-file-${testId}`}
      />
      {filled ? (
        <CheckCircle className="w-6 h-6 text-green-500" />
      ) : (
        <Upload className="w-6 h-6 text-muted-foreground" />
      )}
      <div className="text-center">
        <p
          className={[
            "font-semibold text-sm",
            filled
              ? "text-green-700 dark:text-green-400"
              : "text-foreground",
          ].join(" ")}
        >
          {title}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {filled ? file!.name : hint ?? "Click to upload"}
        </p>
      </div>
    </label>
  );
}

// Tag 4 List (NLOW4) upload — optional Keap export. Contacts in this list
// are excluded from the No Show Up broadcast.
function OptionalNLOW4Slot({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const filled = !!file;
  return (
    <label
      className={[
        "relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all",
        filled
          ? "border-green-500 bg-green-50 dark:bg-green-950/20"
          : "border-border hover:border-primary/50 hover:bg-muted/30",
      ].join(" ")}
      data-testid="dropzone-nlow4"
    >
      <input
        type="file"
        accept=".csv"
        className="sr-only"
        onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        data-testid="input-file-nlow4"
      />
      {filled ? (
        <CheckCircle className="w-6 h-6 text-green-500" />
      ) : (
        <Upload className="w-6 h-6 text-muted-foreground" />
      )}
      <div className="text-center">
        <p
          className={[
            "font-semibold text-sm",
            filled
              ? "text-green-700 dark:text-green-400"
              : "text-foreground",
          ].join(" ")}
        >
          Tag 4 List{" "}
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-1">
            Optional
          </span>
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {filled
            ? file!.name
            : "Keap export (NLOW4) — excluded from No Show Up broadcast"}
        </p>
      </div>
    </label>
  );
}

function OptionalBTSlot({
  file,
  onFile,
}: {
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const filled = !!file;
  return (
    <div className="flex flex-col gap-2">
      <label
        className={[
          "relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed cursor-pointer transition-all",
          filled
            ? "border-green-500 bg-green-50 dark:bg-green-950/20"
            : "border-border hover:border-primary/50 hover:bg-muted/30",
        ].join(" ")}
        data-testid="dropzone-bt"
      >
        <input
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          data-testid="input-file-bt"
        />
        {filled ? (
          <CheckCircle className="w-6 h-6 text-green-500" />
        ) : (
          <Upload className="w-6 h-6 text-muted-foreground" />
        )}
        <div className="text-center">
          <p
            className={[
              "font-semibold text-sm",
              filled
                ? "text-green-700 dark:text-green-400"
                : "text-foreground",
            ].join(" ")}
          >
            Bank Transfer Sales{" "}
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground ml-1">
              Optional
            </span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {filled ? file!.name : "PayNow / bank transfer sign-ups"}
          </p>
        </div>
      </label>

      <div className="rounded-lg border border-border bg-muted/30 px-3 py-2.5">
        <p className="text-[11px] font-semibold text-foreground mb-1">
          Required columns
        </p>
        <ul className="text-[11px] text-muted-foreground space-y-0.5 leading-snug">
          <li>
            <span className="font-medium text-foreground">Name</span> ·{" "}
            <span className="font-medium text-foreground">email</span> ·{" "}
            <span className="font-medium text-foreground">phone number</span>
          </li>
          <li>
            <span className="font-medium text-foreground">Date</span>{" "}
            (e.g. May, June) — used to route into the May / June Welcome WATI
          </li>
          <li>
            <span className="font-medium text-foreground">Price</span> (e.g.
            297) — falls back to Program Price if blank
          </li>
        </ul>
        <a
          href="samples/bank-transfer-sample.csv"
          download="bank-transfer-sample.csv"
          data-testid="link-download-bt-sample"
          className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold text-primary hover:underline"
        >
          <FileText className="w-3 h-3" />
          Download sample file
        </a>
      </div>
    </div>
  );
}

function SessionDetailsCard({
  session,
  setSession,
}: {
  session: SessionDetails;
  setSession: (s: SessionDetails) => void;
}) {
  function update<K extends keyof SessionDetails>(
    key: K,
    val: SessionDetails[K]
  ) {
    setSession({ ...session, [key]: val });
  }

  function updateVw(idx: number, patch: Partial<VWDateEntry>) {
    const next = session.vwDates.map((v, i) =>
      i === idx ? { ...v, ...patch } : v
    );
    setSession({ ...session, vwDates: next });
  }

  function addVw() {
    setSession({
      ...session,
      vwDates: [...session.vwDates, { label: "", pastSignups: 0 }],
    });
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Users className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-foreground">
              Session Details
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Used for Keap tag suffix, Student List dates, and NLOW cumulative
            count.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Session Date
              </label>
              <input
                type="text"
                placeholder="07/05/26 or 070526"
                maxLength={8}
                value={session.sessionDate}
                onChange={(e) => update("sessionDate", e.target.value)}
                data-testid="input-session-date"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Attendance at Pitch
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 119"
                value={session.attendanceAtPitch ?? ""}
                onChange={(e) =>
                  update(
                    "attendanceAtPitch",
                    e.target.value === "" ? null : Number(e.target.value)
                  )
                }
                data-testid="input-attendance-pitch"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Speaker
              </label>
              <input
                type="text"
                placeholder="e.g. Bjorn Ng"
                value={session.speaker}
                onChange={(e) => update("speaker", e.target.value)}
                data-testid="input-speaker"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">
                Program Price (SGD)
              </label>
              <input
                type="number"
                min={0}
                placeholder="e.g. 297"
                value={session.programPrice}
                onChange={(e) =>
                  update("programPrice", Number(e.target.value) || 0)
                }
                data-testid="input-program-price"
                className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
              />
            </div>
            <div className="col-span-2 border-t border-border pt-3 mt-1">
              <label className="text-xs font-medium text-muted-foreground">
                VW Date Entries
              </label>
              <p className="text-[10px] text-muted-foreground mb-2">
                Add one row per upcoming VW date.
              </p>
              {session.vwDates.map((vw, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 mb-2"
                  data-testid={`vw-row-${i}`}
                >
                  <input
                    type="text"
                    placeholder="e.g. May"
                    value={vw.label}
                    onChange={(e) => updateVw(i, { label: e.target.value })}
                    className="w-28 px-2 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Past sign-ups"
                    value={vw.pastSignups}
                    onChange={(e) =>
                      updateVw(i, { pastSignups: Number(e.target.value) || 0 })
                    }
                    className="w-32 px-2 py-1.5 rounded-lg border border-border bg-background text-sm font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 tabular-nums"
                  />
                </div>
              ))}
              <button
                onClick={addVw}
                data-testid="button-add-vw"
                className="text-xs text-primary font-medium hover:underline mt-0.5"
              >
                + Add VW date
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FileChip({ label, present }: { label: string; present: boolean }) {
  if (!present) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border border-green-400 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400">
      <CheckCircle className="w-3 h-3" />
      {label}
    </span>
  );
}

function UploadView(props: {
  keapFile: File | null;
  regFile: File | null;
  partFile: File | null;
  tcFile: File | null;
  btFile: File | null;
  nlow4File: File | null;
  session: SessionDetails;
  generating: boolean;
  setKeapFile: (f: File | null) => void;
  setRegFile: (f: File | null) => void;
  setPartFile: (f: File | null) => void;
  setTcFile: (f: File | null) => void;
  setBtFile: (f: File | null) => void;
  setNlow4File: (f: File | null) => void;
  setSession: (s: SessionDetails) => void;
  onGenerate: () => void;
}) {
  const ready =
    !!props.keapFile &&
    !!props.regFile &&
    !!props.partFile &&
    !!props.tcFile &&
    !props.generating;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-2xl font-bold mb-1">Upload Files</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Upload the 4 required files, then optionally add bank transfer sales
        before generating the report.
      </p>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Required
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <RequiredFileSlot
          file={props.keapFile}
          onFile={props.setKeapFile}
          title="Keap Opt-In CSV"
          hint="Keap export — First Name, Phone 1, Email"
          accept=".csv"
          testId="keap"
        />
        <RequiredFileSlot
          file={props.regFile}
          onFile={props.setRegFile}
          title="Zoom Registration CSV"
          hint="registration_*.csv from Zoom"
          accept=".csv"
          testId="reg"
        />
        <RequiredFileSlot
          file={props.partFile}
          onFile={props.setPartFile}
          title="Zoom Participants CSV"
          hint="participants_*.csv — attendance source"
          accept=".csv"
          testId="part"
        />
        <RequiredFileSlot
          file={props.tcFile}
          onFile={props.setTcFile}
          title="ThriveCart Sales CSV"
          hint="Customer export from ThriveCart"
          accept=".csv"
          testId="tc"
        />
      </div>

      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Optional / Session
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="flex flex-col gap-4">
          <OptionalBTSlot file={props.btFile} onFile={props.setBtFile} />
          <OptionalNLOW4Slot
            file={props.nlow4File}
            onFile={props.setNlow4File}
          />
        </div>
        <SessionDetailsCard
          session={props.session}
          setSession={props.setSession}
        />
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        <FileChip label="Keap" present={!!props.keapFile} />
        <FileChip label="Registration" present={!!props.regFile} />
        <FileChip label="Participants" present={!!props.partFile} />
        <FileChip label="ThriveCart" present={!!props.tcFile} />
        {props.btFile && <FileChip label="Bank Transfer" present />}
        {props.nlow4File && <FileChip label="Tag 4 List" present />}
      </div>

      <button
        onClick={props.onGenerate}
        disabled={!ready}
        data-testid="button-generate"
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <FileText className="w-4 h-4" />
        {props.generating ? "Generating…" : "Generate Report"}
      </button>
    </main>
  );
}

// ============================================================================
// Report view
// ============================================================================
function StatCard({
  value,
  pct,
  label,
  subtext,
}: {
  value: string | number;
  pct?: string;
  label: string;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border p-5 flex flex-col gap-1 border-green-400 bg-green-50 dark:bg-green-950/20">
      <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
        {value}
      </p>
      {pct && (
        <p className="text-base font-bold text-green-600 dark:text-green-400">
          {pct}
        </p>
      )}
      <p className="text-sm text-muted-foreground font-medium">{label}</p>
      {subtext && (
        <p className="text-[11px] text-muted-foreground leading-snug">{subtext}</p>
      )}
    </div>
  );
}

function VWStatCard({
  entries,
}: {
  entries: Array<{ label: string; total: number }>;
}) {
  return (
    <div
      className="rounded-xl border p-5 border-green-400 bg-green-50 dark:bg-green-950/20 flex flex-col"
      data-testid="card-vw-signups"
    >
      <p className="text-sm text-muted-foreground font-medium mb-2">
        Total Signups for VW
      </p>
      <div className="space-y-1">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No VW dates</p>
        ) : (
          entries.map(({ label, total }) => (
            <div
              key={label}
              className="flex justify-between items-baseline text-sm"
            >
              <span className="font-medium text-foreground">{label}:</span>
              <span className="text-2xl font-bold tabular-nums text-green-600 dark:text-green-400">
                {total}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Display buckets for the on-screen country tables.
// USA, HK, INVALID, and NA are folded into OTHERS at render time.
// The underlying CountryBreakdown type and Excel export keep the original 7 buckets.
const DISPLAY_BUCKETS = ["SG", "MY", "OTHERS"] as const;

function CountryTable({
  title,
  data,
}: {
  title: string;
  data: CountryBreakdown;
}) {
  const display: Record<(typeof DISPLAY_BUCKETS)[number], number> = {
    SG: data.SG,
    MY: data.MY,
    OTHERS: data.OTHERS + data.USA + data.HK + data.INVALID + data.NA,
  };
  const total = display.SG + display.MY + display.OTHERS;
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h3 className="font-semibold text-sm text-foreground mb-3">{title}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted-foreground">
            <th className="text-left pb-2">Country</th>
            <th className="text-right pb-2">Count</th>
          </tr>
        </thead>
        <tbody>
          {DISPLAY_BUCKETS.map((b) => (
            <tr key={b} className="border-t border-border/50">
              <td className="py-1.5 text-foreground">{b}</td>
              <td className="py-1.5 text-right font-medium tabular-nums">
                {display[b]}
              </td>
            </tr>
          ))}
          <tr className="border-t border-border font-bold">
            <td className="pt-2 text-foreground">Grand Total</td>
            <td className="pt-2 text-right tabular-nums">{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const SIGN_UP_SOURCE_OPTIONS: SignUpRow["source"][] = ["Stripe", "PayPal", "BT"];

function sourceLabel(source: SignUpRow["source"]): string {
  if (source === "PayPal") return "ThriveCart – PayPal";
  if (source === "BT") return "Bank Transfer – PayNow";
  return "ThriveCart – Stripe";
}

function OptInTable({
  rows,
  onUpdate,
  onDelete,
}: {
  rows: OptInRow[];
  onUpdate: (idx: number, patch: Partial<OptInRow>) => void;
  onDelete: (idx: number) => void;
}) {
  const invalidCount = rows.filter((r) => r.country === "INVALID").length;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">
          Opt In ({rows.length})
        </h3>
        <span className="text-xs text-muted-foreground">
          {invalidCount > 0 && (
            <span className="text-red-600 dark:text-red-400 font-medium">
              {invalidCount} flagged invalid
            </span>
          )}{" "}
          · click any cell to edit
        </span>
      </div>
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">#</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Name</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Email</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Phone</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Country</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Show Up</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">Sign Up</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.email}-${i}`}
                className={[
                  "border-t border-border/50",
                  r.country === "INVALID" ? "bg-red-50/50 dark:bg-red-950/10" : "",
                ].join(" ")}
                data-testid={`optin-row-${i}`}
              >
                <td className="px-4 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-1 font-medium text-foreground">
                  <EditableText
                    value={r.fullName}
                    onCommit={(v) => onUpdate(i, { fullName: v, firstName: v })}
                    testId={`optin-name-${i}`}
                  />
                </td>
                <td className="px-4 py-1 text-muted-foreground">
                  <EditableText
                    value={r.email}
                    onCommit={(v) => onUpdate(i, { email: v })}
                    testId={`optin-email-${i}`}
                  />
                </td>
                <td className="px-4 py-1 tabular-nums">
                  <EditableText
                    value={r.fullPhone}
                    onCommit={(v) => onUpdate(i, { fullPhone: v })}
                    testId={`optin-phone-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <CountrySelect
                    value={r.country}
                    onCommit={(v) => onUpdate(i, { country: v as OptInRow["country"] })}
                    testId={`optin-country-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <EditableBool
                    checked={r.showedUp}
                    onCommit={(v) => onUpdate(i, { showedUp: v })}
                    testId={`optin-showedup-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <EditableBool
                    checked={r.signedUp}
                    onCommit={(v) => onUpdate(i, { signedUp: v })}
                    testId={`optin-signedup-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <DeleteRowButton onClick={() => onDelete(i)} testId={`optin-delete-${i}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const SHOW_UP_SOURCE_OPTIONS: ShowUpMergeRow["source"][] = [
  "Keap", "Registration", "Unknown",
];

function ShowUpMergeTable({
  rows,
  onUpdate,
  onDelete,
}: {
  rows: ShowUpMergeRow[];
  onUpdate: (idx: number, patch: Partial<ShowUpMergeRow>) => void;
  onDelete: (idx: number) => void;
}) {
  const signedUpCount = rows.filter((r) => r.signedUp).length;
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">
          Show Up Merge ({rows.length})
        </h3>
        <span className="text-xs text-primary font-medium">
          {signedUpCount} signed up · click any cell to edit
        </span>
      </div>
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                #
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Name
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Email
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Phone
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Country
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Duration (min)
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Source
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Signed Up
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.email}-${i}`}
                className={[
                  "border-t border-border/50",
                  r.signedUp ? "bg-green-50/50 dark:bg-green-950/10" : "",
                ].join(" ")}
                data-testid={`showup-row-${i}`}
              >
                <td className="px-4 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-1 font-medium text-foreground">
                  <EditableText
                    value={r.fullName}
                    onCommit={(v) => onUpdate(i, { fullName: v })}
                    testId={`showup-name-${i}`}
                  />
                </td>
                <td className="px-4 py-1 text-muted-foreground">
                  <EditableText
                    value={r.email}
                    onCommit={(v) => onUpdate(i, { email: v })}
                    testId={`showup-email-${i}`}
                  />
                </td>
                <td className="px-4 py-1 tabular-nums">
                  <EditableText
                    value={r.fullPhone}
                    onCommit={(v) => onUpdate(i, { fullPhone: v })}
                    testId={`showup-phone-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <CountrySelect
                    value={r.country}
                    onCommit={(v) => onUpdate(i, { country: v as ShowUpMergeRow["country"] })}
                    testId={`showup-country-${i}`}
                  />
                </td>
                <td className="px-4 py-1 tabular-nums">
                  <EditableNumber
                    value={r.durationMinutes}
                    onCommit={(v) => onUpdate(i, { durationMinutes: v })}
                    testId={`showup-duration-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <select
                    value={r.source}
                    data-testid={`showup-source-${i}`}
                    onChange={(e) =>
                      onUpdate(i, { source: e.target.value as ShowUpMergeRow["source"] })
                    }
                    className="text-[10px] font-medium rounded px-1 py-0.5 border border-transparent bg-muted hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {SHOW_UP_SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1">
                  <EditableBool
                    checked={r.signedUp}
                    onCommit={(v) => onUpdate(i, { signedUp: v })}
                    testId={`showup-signedup-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <DeleteRowButton onClick={() => onDelete(i)} testId={`showup-delete-${i}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignUpTable({
  rows,
  onUpdate,
  onDelete,
}: {
  rows: SignUpRow[];
  onUpdate: (idx: number, patch: Partial<SignUpRow>) => void;
  onDelete: (idx: number) => void;
}) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">
          Sign Up ({rows.length})
        </h3>
        <span className="text-xs text-muted-foreground">click any cell to edit</span>
      </div>
      <div className="overflow-x-auto max-h-[32rem] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                #
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Name
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Email
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Phone
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Country
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Sign Up Date
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Source
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap">
                Show Up
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.email}-${i}`} className="border-t border-border/50" data-testid={`signup-row-${i}`}>
                <td className="px-4 py-1 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-1 font-medium text-foreground">
                  <EditableText
                    value={r.fullName}
                    onCommit={(v) => onUpdate(i, { fullName: v })}
                    testId={`signup-name-${i}`}
                  />
                </td>
                <td className="px-4 py-1 text-muted-foreground">
                  <EditableText
                    value={r.email}
                    onCommit={(v) => onUpdate(i, { email: v })}
                    testId={`signup-email-${i}`}
                  />
                </td>
                <td className="px-4 py-1 tabular-nums">
                  <EditableText
                    value={r.fullPhone}
                    onCommit={(v) => onUpdate(i, { fullPhone: v })}
                    testId={`signup-phone-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <CountrySelect
                    value={r.country}
                    onCommit={(v) => onUpdate(i, { country: v as SignUpRow["country"] })}
                    testId={`signup-country-${i}`}
                  />
                </td>
                <td className="px-4 py-1 text-muted-foreground">
                  <EditableText
                    value={r.intake}
                    onCommit={(v) => onUpdate(i, { intake: v })}
                    placeholder="e.g. May"
                    testId={`signup-intake-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <select
                    value={r.source}
                    data-testid={`signup-source-${i}`}
                    onChange={(e) =>
                      onUpdate(i, { source: e.target.value as SignUpRow["source"] })
                    }
                    className="text-[10px] font-medium rounded px-1 py-0.5 border border-transparent bg-muted hover:border-border focus:outline-none focus:ring-1 focus:ring-primary/50"
                  >
                    {SIGN_UP_SOURCE_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {sourceLabel(s)}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-1">
                  <EditableBool
                    checked={r.showedUp}
                    onCommit={(v) => onUpdate(i, { showedUp: v })}
                    testId={`signup-showedup-${i}`}
                  />
                </td>
                <td className="px-4 py-1">
                  <DeleteRowButton onClick={() => onDelete(i)} testId={`signup-delete-${i}`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StudentListTable({ rows }: { rows: StudentListRow[] }) {
  const headers = [
    "Package Sold",
    "Name",
    "Email Address",
    "Mobile",
    "Mobile CC",
    "Welcome Msg WATI",
    "Added to TC",
    "Forex Portover",
    "1 mth WATI",
    "3 mth WATI",
    "6 Mths WATI",
    "Coaching Call",
    "Expiration",
    "Months",
    "TG Username",
    "Preview Date",
    "Speaker",
    "TM",
    "Aff ID",
    "Enrolment Date",
    "Currency",
    "Fee w GST",
    "Amount Paid",
    "Gateway",
  ];
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border">
        <h3 className="font-semibold text-sm text-foreground">
          Student List ({rows.length})
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Auto-filled from sign-ups · scroll horizontally to view all 24 columns
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="text-xs">
          <thead className="bg-muted/50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2.5 text-left font-medium text-muted-foreground whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={`${r.email}-${i}`}
                className="border-t border-border/50"
                data-testid={`student-row-${i}`}
              >
                <td className="px-3 py-2 text-foreground whitespace-nowrap">
                  {r.packageSold}
                </td>
                <td className="px-3 py-2 font-medium whitespace-nowrap">
                  {r.name}
                </td>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {r.email}
                </td>
                <td className="px-3 py-2 tabular-nums whitespace-nowrap">
                  {r.mobile}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.mobileCountryCode}
                </td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.expirationDate}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.monthsToExpire}</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.previewDate}</td>
                <td className="px-3 py-2 whitespace-nowrap">{r.speaker}</td>
                <td className="px-3 py-2 text-muted-foreground">—</td>
                <td className="px-3 py-2">{r.affiliateId}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.enrolmentDate}
                </td>
                <td className="px-3 py-2">{r.currency}</td>
                <td className="px-3 py-2 tabular-nums">{r.courseFeeWGst}</td>
                <td className="px-3 py-2 tabular-nums">{r.amountPaid}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {r.paymentGateway}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WatiSection({
  broadcasts,
  onUpdateContact,
  onDeleteContact,
}: {
  broadcasts: ReturnType<typeof buildBroadcasts>;
  onUpdateContact: (sourceType: WatiSourceType, currentEmail: string, patch: ContactPatch) => void;
  onDeleteContact: (sourceType: WatiSourceType, email: string) => void;
}) {
  // Dynamic tab keys: "welcome:<index>" for each VW date, or "no_show_up"/"showup_no_buy".
  const welcomeKeys = broadcasts.welcomes.map((_, i) => `welcome:${i}`);
  const initialTab = welcomeKeys[0] ?? "no_show_up";
  const [tab, setTab] = useState<string>(initialTab);

  // If the VW dates change (add/remove/rename), snap the active tab back to a
  // valid one instead of leaving a stale index selected.
  const validKeys = [...welcomeKeys, "no_show_up", "showup_no_buy"];
  useEffect(() => {
    if (!validKeys.includes(tab)) {
      setTab(initialTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [welcomeKeys.join("|")]);

  function tabBtn(key: string, label: string, count: number) {
    const active = tab === key;
    return (
      <button
        onClick={() => setTab(key)}
        data-testid={`tab-${key}`}
        className={[
          "flex-1 px-4 py-2.5 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2",
          active
            ? "bg-card text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground",
        ].join(" ")}
      >
        <span>{label}</span>
        <span
          className={[
            "px-1.5 py-0.5 rounded text-[10px] font-medium tabular-nums",
            active
              ? "bg-primary/10 text-primary"
              : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {count}
        </span>
      </button>
    );
  }

  return (
    <div className="mt-8">
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Send className="w-4 h-4 text-primary" />
          <h3 className="font-semibold text-sm text-foreground">
            Send WATI Broadcasts
          </h3>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex bg-muted/50 p-1 rounded-lg gap-1">
            {broadcasts.welcomes.map((w, i) => {
              const label = w.vwLabel
                ? `${w.vwLabel.charAt(0).toUpperCase() + w.vwLabel.slice(1).toLowerCase()} Welcome`
                : "Welcome";
              return (
                <span key={`welcome:${i}`}>
                  {tabBtn(`welcome:${i}`, label, w.contacts.length)}
                </span>
              );
            })}
            {tabBtn(
              "no_show_up",
              "No-Show Follow-Up",
              broadcasts.no_show_up.contacts.length
            )}
            {tabBtn(
              "showup_no_buy",
              "Sales Follow-Up",
              broadcasts.showup_no_buy.contacts.length
            )}
          </div>
          {tab.startsWith("welcome:") && (() => {
            const idx = parseInt(tab.split(":")[1] ?? "0", 10);
            const build = broadcasts.welcomes[idx];
            return build ? (
              <BroadcastPanel
                key={`welcome:${idx}:${build.vwLabel ?? ""}`}
                build={build}
                sourceType="signUps"
                onUpdateContact={onUpdateContact}
                onDeleteContact={onDeleteContact}
              />
            ) : null;
          })()}
          {tab === "no_show_up" && (
            <BroadcastPanel
              key="no_show_up"
              build={broadcasts.no_show_up}
              sourceType="optIns"
              onUpdateContact={onUpdateContact}
              onDeleteContact={onDeleteContact}
            />
          )}
          {tab === "showup_no_buy" && (
            <BroadcastPanel
              key="showup_no_buy"
              build={broadcasts.showup_no_buy}
              sourceType="showUps"
              onUpdateContact={onUpdateContact}
              onDeleteContact={onDeleteContact}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ReportView({
  report,
  broadcasts,
  onReportChange,
}: {
  report: ReportData;
  broadcasts: ReturnType<typeof buildBroadcasts>;
  onReportChange: (next: ReportData) => void;
}) {
  const m = report.metrics;
  const session = report.sessionDetails;
  const [editingSession, setEditingSession] = useState(false);

  // Recomputes every derived metric/breakdown from whatever Opt-In / Show Up
  // / Sign Up rows and session details are current after an edit, so the
  // on-screen numbers (and the Excel export, which reads this same state)
  // always match what's in the tables.
  function recompute(next: {
    optIns?: OptInRow[];
    showUpMerge?: ShowUpMergeRow[];
    signUps?: SignUpRow[];
    sessionDetails?: SessionDetails;
  }) {
    const optIns = next.optIns ?? report.optIns;
    const showUpMerge = next.showUpMerge ?? report.showUpMerge;
    const signUps = next.signUps ?? report.signUps;
    const sessionDetails = next.sessionDetails ?? report.sessionDetails;
    const derived = deriveMetrics(sessionDetails, optIns, showUpMerge, signUps);
    onReportChange({
      ...report,
      sessionDetails,
      optIns,
      showUpMerge,
      signUps,
      ...derived,
    });
  }

  function updateOptIn(idx: number, patch: Partial<OptInRow>) {
    recompute({ optIns: report.optIns.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }
  function deleteOptIn(idx: number) {
    recompute({ optIns: report.optIns.filter((_, i) => i !== idx) });
  }
  function updateShowUp(idx: number, patch: Partial<ShowUpMergeRow>) {
    recompute({ showUpMerge: report.showUpMerge.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }
  function deleteShowUp(idx: number) {
    recompute({ showUpMerge: report.showUpMerge.filter((_, i) => i !== idx) });
  }
  function updateSignUp(idx: number, patch: Partial<SignUpRow>) {
    recompute({ signUps: report.signUps.map((r, i) => (i === idx ? { ...r, ...patch } : r)) });
  }
  function deleteSignUp(idx: number) {
    recompute({ signUps: report.signUps.filter((_, i) => i !== idx) });
  }

  // WATI broadcast contact editing. Each broadcast tab's contact list is a
  // derived, filtered/deduped view over report.optIns / report.showUpMerge /
  // report.signUps (see buildBroadcasts in watiBroadcast.ts) — there's no
  // separate storage for it. So editing a contact here looks the person up
  // by email in the matching source table and writes the edit through the
  // same updateX/deleteX used by the main tables, exactly like editing them
  // there directly. The broadcast list then re-derives on next render.
  function updateBroadcastContact(
    sourceType: WatiSourceType,
    currentEmail: string,
    patch: ContactPatch
  ) {
    const emailLc = currentEmail.toLowerCase();
    if (sourceType === "optIns") {
      const idx = report.optIns.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx === -1) return;
      const cur = report.optIns[idx];
      const rowPatch: Partial<OptInRow> = {};
      if (patch.name !== undefined) {
        rowPatch.fullName = patch.name;
        rowPatch.firstName = patch.name;
      }
      if (patch.email !== undefined) rowPatch.email = patch.email;
      if (patch.countryCode !== undefined || patch.phone !== undefined) {
        const cc = patch.countryCode ?? cur.countryCode;
        const ph = patch.phone ?? cur.phoneNumber;
        rowPatch.countryCode = cc;
        rowPatch.phoneNumber = ph;
        rowPatch.fullPhone = `${cc}${ph}`;
      }
      updateOptIn(idx, rowPatch);
    } else if (sourceType === "showUps") {
      const idx = report.showUpMerge.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx === -1) return;
      const cur = report.showUpMerge[idx];
      const rowPatch: Partial<ShowUpMergeRow> = {};
      if (patch.name !== undefined) rowPatch.fullName = patch.name;
      if (patch.email !== undefined) rowPatch.email = patch.email;
      if (patch.countryCode !== undefined || patch.phone !== undefined) {
        const cc = patch.countryCode ?? cur.countryCode;
        const ph = patch.phone ?? cur.phoneNumber;
        rowPatch.countryCode = cc;
        rowPatch.phoneNumber = ph;
        rowPatch.fullPhone = `${cc}${ph}`;
      }
      updateShowUp(idx, rowPatch);
    } else {
      const idx = report.signUps.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx === -1) return;
      const cur = report.signUps[idx];
      const rowPatch: Partial<SignUpRow> = {};
      if (patch.name !== undefined) rowPatch.fullName = patch.name;
      if (patch.email !== undefined) rowPatch.email = patch.email;
      if (patch.countryCode !== undefined || patch.phone !== undefined) {
        const cc = patch.countryCode ?? cur.countryCode;
        const ph = patch.phone ?? cur.phoneNumber;
        rowPatch.countryCode = cc;
        rowPatch.phoneNumber = ph;
        rowPatch.fullPhone = `${cc}${ph}`;
      }
      updateSignUp(idx, rowPatch);
    }
  }
  function deleteBroadcastContact(sourceType: WatiSourceType, email: string) {
    const emailLc = email.toLowerCase();
    if (sourceType === "optIns") {
      const idx = report.optIns.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx !== -1) deleteOptIn(idx);
    } else if (sourceType === "showUps") {
      const idx = report.showUpMerge.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx !== -1) deleteShowUp(idx);
    } else {
      const idx = report.signUps.findIndex((r) => (r.email || "").toLowerCase() === emailLc);
      if (idx !== -1) deleteSignUp(idx);
    }
  }

  function updateSessionDetails(next: SessionDetails) {
    recompute({ sessionDetails: next });
  }

  const revenue = m.revenueTotal.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const sessionLong = (() => {
    const compact = (session.sessionDate || "").replace(/\D/g, "");
    if (compact.length !== 6) return session.sessionDate;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    const dd = parseInt(compact.slice(0, 2), 10);
    const mm = parseInt(compact.slice(2, 4), 10);
    const yy = parseInt(compact.slice(4, 6), 10);
    if (mm < 1 || mm > 12) return session.sessionDate;
    return `${dd}-${months[mm - 1]}-${2000 + yy}`;
  })();

  return (
    <main className="max-w-6xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Next Level Online Webinar
          {sessionLong ? ` | ${sessionLong}` : ""}
        </h1>
        <p className="text-base text-muted-foreground">
          Speaker: {session.speaker || "—"}
        </p>
        <p className="text-sm font-bold text-primary mt-1">
          Program Price: SGD{" "}
          {session.programPrice.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </p>
        <button
          onClick={() => setEditingSession((v) => !v)}
          data-testid="button-toggle-edit-session"
          className="mt-3 text-xs font-medium text-primary hover:underline"
        >
          {editingSession ? "Done editing session details" : "Edit session details"}
        </button>
      </div>

      {editingSession && (
        <div className="mb-8">
          <SessionDetailsCard session={session} setSession={updateSessionDetails} />
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard value={m.optInCount} label="Opt In" />
        <StatCard
          value={m.showUpCount}
          pct={`${m.showUpPct.toFixed(1)}%`}
          label="Show Up"
          subtext={
            report.optInByCountry.INVALID > 0
              ? `% of ${m.optInWithoutInvalidCount} valid opt-ins (${report.optInByCountry.INVALID} invalid excluded)`
              : undefined
          }
        />
        <StatCard
          value={m.attendanceAtPitch}
          pct={`${m.attendanceAtPitchPct.toFixed(1)}%`}
          label="Attendance at Pitch"
        />
        <div className="rounded-xl border p-5 flex flex-col gap-1 border-green-400 bg-green-50 dark:bg-green-950/20 md:col-span-2 lg:col-span-2">
          <p className="text-3xl font-bold tabular-nums text-green-600 dark:text-green-400">
            {m.signUpCount}
          </p>
          <div className="mt-1 space-y-2">
            <div>
              <span className="text-xs text-muted-foreground block leading-snug">Speakers’ Conversion (Sales / attendance at Pitch)</span>
              <span className="text-base font-bold tabular-nums text-green-600 dark:text-green-400">
                {m.attendanceAtPitch && m.attendanceAtPitch > 0
                  ? `${((m.signUpCount / m.attendanceAtPitch) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div>
              <span className="text-xs text-muted-foreground block leading-snug">Preview Conversion (Sales / Show Ups)</span>
              <span className="text-base font-bold tabular-nums text-green-600 dark:text-green-400">
                {m.showUpCount && m.showUpCount > 0
                  ? `${((m.signUpCount / m.showUpCount) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground font-medium mt-1">Sign Up</p>
        </div>
        <StatCard value={`$${revenue}`} label="Total Revenue" />
        {session.vwDates.length > 0 && (
          <VWStatCard
            entries={Object.entries(m.signUpsByIntakeForVW).map(
              ([label, total]) => ({ label, total })
            )}
          />
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <CountryTable
          title="Opt In by Country"
          data={report.optInByCountry}
        />
        <CountryTable
          title="Show Up by Country"
          data={report.showUpByCountry}
        />
        <CountryTable
          title="Sign Up by Country"
          data={report.signUpByCountry}
        />
      </div>

      <div className="mb-6">
        <OptInTable rows={report.optIns} onUpdate={updateOptIn} onDelete={deleteOptIn} />
      </div>

      <div className="mb-6">
        <ShowUpMergeTable rows={report.showUpMerge} onUpdate={updateShowUp} onDelete={deleteShowUp} />
      </div>

      <div className="mb-6">
        <SignUpTable rows={report.signUps} onUpdate={updateSignUp} onDelete={deleteSignUp} />
      </div>

      <WatiSection
        broadcasts={broadcasts}
        onUpdateContact={updateBroadcastContact}
        onDeleteContact={deleteBroadcastContact}
      />
    </main>
  );
}

// ============================================================================
// Page wrapper
// ============================================================================
export default function Home() {
  const { toast } = useToast();
  const [keapFile, setKeapFile] = useState<File | null>(null);
  const [regFile, setRegFile] = useState<File | null>(null);
  const [partFile, setPartFile] = useState<File | null>(null);
  const [tcFile, setTcFile] = useState<File | null>(null);
  const [btFile, setBtFile] = useState<File | null>(null);
  const [nlow4File, setNlow4File] = useState<File | null>(null);
  const [session, setSession] = useState<SessionDetails>({
    sessionDate: "",
    attendanceAtPitch: null,
    programPrice: 297,
    speaker: "Bjorn Ng",
    vwDates: [],
  });
  const [report, setReport] = useState<ReportData | null>(null);
  const [generating, setGenerating] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add("dark");
    else root.classList.remove("dark");
  }, [isDark]);

  const broadcasts = useMemo(
    () => (report ? buildBroadcasts(report) : null),
    [report]
  );

  async function handleGenerate() {
    if (!keapFile || !regFile || !partFile || !tcFile) {
      toast({
        title: "Missing files",
        description: "Please upload all 4 required CSVs.",
        variant: "destructive",
      });
      return;
    }
    setGenerating(true);
    try {
      const files: UploadedFiles = {
        keapFile,
        registrationFile: regFile,
        participantsFile: partFile,
        thriveCartFile: tcFile,
        bankTransferFile: btFile,
        nlow4File,
      };
      const r = await generateReport(files, session);
      setReport(r);
      toast({
        title: "Report generated",
        description: `${r.metrics.optInCount} opt-ins · ${r.metrics.showUpCount} show-ups · ${r.metrics.signUpCount} sign-ups`,
      });
    } catch (err: any) {
      console.error(err);
      toast({
        title: "Failed to generate report",
        description: err?.message ?? "Unknown error",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  }

  function handleReset() {
    setReport(null);
    setKeapFile(null);
    setRegFile(null);
    setPartFile(null);
    setTcFile(null);
    setBtFile(null);
    setNlow4File(null);
    setSession({
      sessionDate: "",
      attendanceAtPitch: null,
      programPrice: 297,
      speaker: "Bjorn Ng",
      vwDates: [],
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header
        showReportActions={!!report}
        onReset={handleReset}
        onDownload={() => report && downloadExcelReport(report)}
        isDark={isDark}
        onToggleDark={() => setIsDark((d) => !d)}
      />
      {!report && (
        <UploadView
          keapFile={keapFile}
          regFile={regFile}
          partFile={partFile}
          tcFile={tcFile}
          btFile={btFile}
          nlow4File={nlow4File}
          session={session}
          generating={generating}
          setKeapFile={setKeapFile}
          setRegFile={setRegFile}
          setPartFile={setPartFile}
          setTcFile={setTcFile}
          setBtFile={setBtFile}
          setNlow4File={setNlow4File}
          setSession={setSession}
          onGenerate={handleGenerate}
        />
      )}
      {report && broadcasts && (
        <ReportView report={report} broadcasts={broadcasts} onReportChange={setReport} />
      )}
    </div>
  );
}
