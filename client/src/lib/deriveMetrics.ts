import type {
  CountryBreakdown,
  CountryGroup,
  OptInRow,
  PreviewMetrics,
  SessionDetails,
  ShowUpMergeRow,
  SignUpRow,
} from "../../../shared/schema";

export interface DerivedReportSlice {
  metrics: PreviewMetrics;
  optInByCountry: CountryBreakdown;
  showUpByCountry: CountryBreakdown;
  signUpByCountry: CountryBreakdown;
}

/**
 * Recomputes every metric and country breakdown from the current Opt-In /
 * Show Up / Sign Up row lists and session details. Used both by the initial
 * report generation and by the report page's inline editing (row edits,
 * country reclassification, session detail changes) so counts and totals
 * always stay in sync with what's on screen.
 */
export function deriveMetrics(
  session: SessionDetails,
  optInRows: OptInRow[],
  showUpMerge: ShowUpMergeRow[],
  signUpRows: SignUpRow[]
): DerivedReportSlice {
  const tally = (rows: { country: CountryGroup }[]): CountryBreakdown => {
    const out: CountryBreakdown = {
      SG: 0,
      MY: 0,
      USA: 0,
      HK: 0,
      OTHERS: 0,
      INVALID: 0,
      NA: 0,
    };
    for (const r of rows) out[r.country]++;
    return out;
  };

  const optInByCountry = tally(optInRows);
  const showUpByCountry = tally(showUpMerge);
  const signUpByCountry = tally(signUpRows);

  const optInCount = optInRows.length;
  const invalidCount = optInByCountry.INVALID;
  const naCount = optInByCountry.NA;
  const optInWithoutInvalidCount = optInCount - invalidCount - naCount;
  const showUpCount = showUpMerge.length;
  // Excludes flagged-invalid (and NA) opt-ins from the denominator — a
  // fake/placeholder contact was never a real shot at showing up, so it
  // shouldn't drag the percentage down.
  const showUpPct =
    optInWithoutInvalidCount > 0
      ? (showUpCount / optInWithoutInvalidCount) * 100
      : 0;
  const attendanceAtPitch = session.attendanceAtPitch ?? 0;
  const attendanceAtPitchPct =
    showUpCount > 0 ? (attendanceAtPitch / showUpCount) * 100 : 0;
  const signUpCount = signUpRows.length;
  const signUpPct =
    attendanceAtPitch > 0 ? (signUpCount / attendanceAtPitch) * 100 : 0;
  // Revenue: sum each sign-up's actual total (TC carries its own line total;
  // BT uses its row Price, falling back to session.programPrice if blank)
  const revenueTotal = signUpRows.reduce(
    (sum, s) => sum + (Number(s.total) || 0),
    0
  );
  // VW intake totals: each VW row's pastSignups + count of sign-ups whose intake matches
  const signUpsByIntakeForVW: Record<string, number> = {};
  for (const vw of session.vwDates || []) {
    if (!vw.label) continue;
    const monthSignups = signUpRows.filter(
      (s) => (s.intake || "").toLowerCase() === vw.label.toLowerCase()
    ).length;
    signUpsByIntakeForVW[vw.label] = (vw.pastSignups || 0) + monthSignups;
  }

  const metrics: PreviewMetrics = {
    optInCount,
    optInWithoutInvalidCount,
    showUpCount,
    showUpPct,
    attendanceAtPitch,
    attendanceAtPitchPct,
    signUpCount,
    signUpPct,
    revenueTotal,
    signUpsByIntakeForVW,
  };

  return { metrics, optInByCountry, showUpByCountry, signUpByCountry };
}
