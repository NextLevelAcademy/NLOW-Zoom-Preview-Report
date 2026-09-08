# GEM Preview Report — Implementation Spec

This project is a **fresh copy of NLOW**, rebuilt for the GEM (Genesis Enhanced Masterclass) program. **Do NOT touch the nlow-test/ project.** This is gem-test/, served at `gempreview-wati-auto.pplx.app`.

## Reference materials in workspace

- **Reference Excel report** (the exact structure to mirror): `/home/user/workspace/gem-test/REFERENCE_REPORT.xlsx` (a real GEM report from 7-May-2026)
- **Sample CSV inputs** (4 files):
  - `/home/user/workspace/gem-samples/Keap.csv` — Keap opt-in export
  - `/home/user/workspace/gem-samples/registration_84101835038_2026_05_07.csv` — Zoom Registration Report
  - `/home/user/workspace/gem-samples/participants_84101835038_2026_05_07.csv` — Zoom Participants Report (= attendance)
  - `/home/user/workspace/gem-samples/ThriveCart Customer Export 2026-05-12 10_13_42.csv` — ThriveCart sales

## Branding changes from NLOW

- Title: **"GEM Preview Report"** (header), report header **"Genesis Enhanced Masterclass | <date>"** with speaker subtitle
- Default Program Price (SGD): **3997** (was 297)
- Default Speaker: **"Julian"**
- Site name / app name: **"GEM Preview Report"**
- Subdomain at publish: **`gempreview-wati-auto`**
- Drop "by Bjorn Ng" subtitle — use Speaker name from Session Details instead

## Input CSV formats (CRITICAL — different from NLOW)

### 1. Keap.csv — opt-in list
- Headers (row 0): `First Name, Phone 1, Email`
- Phone format: `'+65 87661449   ` (leading apostrophe Excel text-marker; space-separated country code + local; sometimes trailing whitespace)
- Parser must:
  - Strip leading `'` and whitespace
  - Split into country code (digits before first space after `+`) and local digits
  - Result: `cc=65, phone=87661449`
  - Some rows may have no `+` and no space → treat all digits as the full phone
  - **Some rows have phone country codes other than +65/+60 → keep cc as-is for country detection**

### 2. Zoom Registration CSV (filename like `registration_*.csv`)
- Rows 0–4 are metadata (Registration Report header, generated time, topic line, attendee detail title)
- **Row 5 is the actual header row**: `First Name, Last Name, Email, Registration Time, Approval Status, Phone`
- Row 6+ are data
- Phone: same `'+65 87661449` apostrophe-prefixed format
- Use this for the "Show up REG" sheet — every row is a registrant
- The **"Showed Up"** column on Show up REG sheet is filled in based on whether the registrant's email appears in the participants CSV

### 3. Zoom Participants CSV (filename like `participants_*.csv`)
- Rows 0–2 are metadata
- **Row 3 is the header row**: `Name (original name), Email, Total duration (minutes), Guest`
- Row 4+ are data
- **THIS IS THE SHOW-UP/ATTENDANCE SOURCE** — anyone in here attended
- No phone column — match back to Keap/registration by email for phone/country

### 4. ThriveCart CSV
- Same format as NLOW (headers in row 0). Has `customer_first_name`, `customer_last_name`, `customer_email`, `customer_phone` or `telephone`, `total`, `relevant_item_pricing_option`, `order_date`, `address_country`

### 5. Bank Transfer CSV (optional, same as NLOW)
- Headers: `Name, Email, Phone Number` (or variants)

## Country detection rules (CRITICAL — different from NLOW)

Country buckets (in the order they appear in country tables in the Excel):
`SG, MY, USA, HK, OTHERS, INVALID, NA`

Detection from country code:
- `65` → SG
- `60` → MY
- `1` → USA
- `852` → HK
- Other valid CC → OTHERS
- Phone present but cc cannot be determined / impossible digits → INVALID
- No phone at all → NA

For Zoom registration phone (`+65 87661449` format), the country code is what's between `+` and first space. For TC/BT phones without an explicit `+`, prefer the matched Keap/registration row's cc.

## Report metrics (matches REFERENCE_REPORT.xlsx Report sheet)

Stat cards (in this order, all GREEN-bordered like NLOW):
1. **Opt In** — total Keap opt-ins (incl. INVALID/NA buckets) — sample: 268
2. **Opt In (without Invalid)** — opt-ins minus INVALID and NA buckets — sample: 268 in sample but logic must subtract INVALID/NA counts
3. **Show Up** — count of participants — sample: 138, with % = ShowUp / OptIn (51.5%)
4. **Attendance at Pitch** — user-entered manual count — sample: 119, with % = Attendance / Show Up (86.2%)
5. **Sign Up** — count of sign-ups (TC + BT combined, deduped by email) — sample: 4, with % = Signup / Attendance (3.4% per formula `=C7/C6*100%`)
6. **Total Revenue Generated** — `Program Price × Sign Up Count` — sample: 4 × 3997 = $15,988.00
7. **GPP Sign-ups To Date** — user-entered cumulative number from past sessions + new sign-ups from this session — sample: 166. Computed: `pastGppSignups + signUpCount`

Country breakdown tables (3 side-by-side tables on the report page, same as NLOW):
- **Opt In by Country** — SG/MY/USA/HK/OTHERS/INVALID/NA + Grand Total
- **Show Up by Country** — same buckets
- **Sign Up by Country** — same buckets

## Show Up Merge logic

This is a single combined list of participants enriched with where their info came from:
- For each participant (from participants CSV) by email:
  - If their email is in Keap → Source = `"Keap"`, Name/Phone from Keap, Country from Keap CC
  - Else if their email is in the registration CSV → Source = `"Registration"`, Name/Phone from Registration, Country from Registration CC
  - Else → Source = `"Unknown"`, use participant name as-is, no phone, country = NA
- Duration = Total duration (minutes) from participant row
- Sign up column = the email itself if they're in sign-ups, else null/empty (matches sample column behavior)

## Sign Up sheet

Columns: `Name, Email, Phone Number, Country, Source ("ThriveCart"|"BT"|"ThriveCart+BT"), Show up`
- Show up = the email itself if they attended, else null/empty

## Keap Working sheet — tag rules

Columns: `First Name, Email, Phone 1, Tags`

Tag rules (using GPP prefix, mirroring NLOW's NLOW rules):
- **Show-up + in opt-in + NOT signed up** → `GPP3,GPP3-DDMMYY`
- **Show-up + in opt-in + signed up** → `GPP3,GPP3-DDMMYY,GPP4,GPP4-DDMMYY`
- **Show-up NOT in opt-in + NOT signed up** → `GPP3,GPP3-DDMMYY,GPP2,GPP2-DDMMYY`
- **Sign-up + NOT signed up's email in opt-in** → `GPP3,GPP3-DDMMYY,GPP4,GPP4-DDMMYY,GPP2,GPP2-DDMMYY`
- **Sign-up only (no attendance) + in opt-in** → `GPP4,GPP4-DDMMYY`
- **Sign-up only (no attendance) + NOT in opt-in** → `GPP4,GPP4-DDMMYY,GPP2,GPP2-DDMMYY`

DDMMYY comes from Session Date input (format `07/05/26` or `070526` → `070526`).

## Student List sheet — 24 columns

For each sign-up (TC + BT), generate one row with these columns (matching the sample exactly):

| # | Column | Source |
|---|--------|--------|
| 1 | Package Sold | TC pricing option or BT package label (fallback: empty) |
| 2 | Name | Full name |
| 3 | Email Address | email |
| 4 | Mobile | full phone digits |
| 5 | Mobile Country Code | "SG"/"MY"/etc derived from country bucket (NOT the digits) |
| 6 | Welcome Msg WATI | blank (manual tracking) |
| 7 | Added them into new thrivecart (Credit Card Logged in) | blank |
| 8 | Forex.com Port over | blank |
| 9 | 1 mth WATI | blank |
| 10 | 3 mth WATI | blank |
| 11 | 6 Mths WATI | blank |
| 12 | Coaching Call Booked | blank |
| 13 | Expiration Date | session date + 1 year (e.g. "7-May-2027") |
| 14 | Months to Expire | months between today and expiration — keep simple: 11 or 12 (just compute) |
| 15 | Telegram Username | blank |
| 16 | Preview Date | session date formatted as "7-May-2026" |
| 17 | Speaker | "LIVE Zoom-{Speaker}" e.g. "LIVE Zoom-Julian" |
| 18 | TM | blank |
| 19 | Affiliate ID | "-" |
| 20 | Enrolment Date | session date formatted as "7-May-2026" |
| 21 | Currency | "SGD" |
| 22 | Course Fee w GST | program price formatted as "3997.00" |
| 23 | Amount Paid | TC's `total` (or BT's program price) formatted as "3997.00" |
| 24 | Payment Gateway | "stripe" (TC) or "Bank Transfer" (BT) |

The Student List **also displays on the report page** as a wide horizontally-scrolling table after the Sign Up table.

## Excel sheet order

1. Report
2. Opt in
3. Show up Merge
4. Show up REG
5. Sign up
6. Keap Working
7. Student List

## Report sheet structure

Match the sample exactly:

```
       Col A    Col B                          Col C            Col D             Col F        Col G
Row 1:          GEM Zoom Live                                                     Opt In
Row 2:          Speaker:                       Julian                             Country      No.
Row 3:          Opt in                         268                                SG           237
Row 4:          Opt in (without Invalid)       268                                MY           19
Row 5:          Show up                        138              51.5%             USA          0
Row 6:          Attendance at pitch            119              86.2%             HK           1
Row 7:          Sign up                        4                =C7/C6*100%       OTHERS       5
Row 8:                                                                            INVALID      0
Row 9:                                                                            NA           6
Row 10:                                                                           Grand Total  268
Row 12:         Rev Generated                                                     Show Up
Row 13:         Program Price S$               $3,997.00                          Country      Count
Row 14:         Total Amount Revenue Generated =C13*C7                            SG           115
Row 15:         TOTAL SIGN UPS [GPP To Date]   166                                MY           16
...etc
Row 24:                                                                           Sign Up
Row 25:                                                                           Country      Count
... etc
```

Use real cell values (computed), not formula strings — except where the sample uses formula strings, you can either replicate the formula or write the computed value (computed value is fine).

## Session Details (the optional panel on Upload page)

Same as NLOW with these fields:
- **Session Date** (DD/MM/YY or DDMMYY) — required for proper DDMMYY tags and Student List dates
- **Attendance at Pitch** (number) — manual count
- **Program Price (SGD)** — default `3997`
- **Speaker** — default `Julian` (new field)
- **GPP Sign-ups To Date** — number (prior cumulative count, e.g. 162; the report adds this session's sign-ups to it)
- VW Date Entries — REMOVE from GEM (no recurring intake split for a one-off masterclass)

## Upload page — required files

3 required + 1 optional:
1. **Keap Opt-In CSV** (required) — Keap.csv
2. **Zoom Registration CSV** (required) — registration_*.csv
3. **Zoom Participants CSV** (required) — participants_*.csv (attendance)
4. **ThriveCart Sales CSV** (required) — TC export
5. **Bank Transfer Sales CSV** (optional)

Yes — that's 4 required for GEM (vs. 3 for NLOW), since Zoom is split into registration + participants. Make sure the upload page reflects this and "Generate Report" is disabled until all 4 required are uploaded.

## WATI Broadcasts (simpler than NLOW)

Replace the 3 NLOW broadcasts with exactly these 2:

1. **Welcome WATI**
   - Template: `l3gpp_welcome_version_3`
   - Default broadcast name: `GEM_Welcome_<YYYYMMDD>`
   - Recipients: ALL sign-ups (TC + BT combined, deduped by email)
   - Parameter: name only

2. **No Show Up**
   - Template: `gpp_sales_darren_vid`
   - Default broadcast name: `GEM_NoShowUp_<YYYYMMDD>`
   - Recipients: opt-ins who did NOT attend (i.e. in Keap but not in participants CSV)
   - Parameter: name only

No banner image swap (templates have static headers — same WATI limitation as NLOW).

## WATI safety rules

- **NEVER send to real contacts without explicit user approval.**
- Test number: **639467480009** (Philippines, +63)
- Same `/api/wati/send-broadcast` endpoint pattern, same Bearer token, same /api/v1/sendTemplateMessage call to `https://live-mt-server.wati.io/8686`

## Implementation steps

1. **shared/schema.ts** — replace BroadcastType enum to `["welcome_wati", "no_show_up"]`. Add CountryGroup variants `"USA"`, `"HK"`, `"INVALID"`. Add `speaker` and `gppToDate` to SessionDetails. Remove `vwDates`. Update PreviewMetrics to add `optInWithoutInvalidCount` and `gppToDateTotal`. Update CountryBreakdown to include all 7 buckets.

2. **client/src/lib/csvParse.ts** — add a `parseCsvSkipRows(file, skipRows)` helper. Or expose a `parseCsv` variant that takes a `header: <rowIndex>` option for the Zoom CSVs.

3. **client/src/lib/reportGenerator.ts** — full rewrite:
   - Replace `parseEWRows` with `parseZoomRegistrationRows` (skip 5 lines) and `parseZoomParticipantRows` (skip 3 lines)
   - Parser for Keap `'+65 87661449` phone format: split on first space after country code
   - Show-up = participants list (no Attended Live column)
   - Country detection extended with USA (cc=1), HK (cc=852), INVALID
   - "Opt-in (without Invalid)" = optInCount - InvalidCount - NACount
   - Remove VW logic, signUpsByIntakeForVW
   - Add gppToDateTotal = (session.gppToDate || 0) + signUpCount

4. **client/src/lib/excelExport.ts** — full rewrite for 7 sheets matching REFERENCE_REPORT.xlsx structure. Keap tag rules use `GPP3/GPP4/GPP2` prefix.

5. **client/src/lib/watiBroadcast.ts** — replace BROADCASTS with the 2 GEM definitions. Update `buildBroadcastContacts` to produce welcome_wati (all sign-ups) and no_show_up (opt-ins who didn't attend).

6. **client/src/pages/home.tsx** — full rewrite of:
   - Upload page: 4 required + 1 optional, drop VW Date Entries, add Speaker and GPP To Date fields
   - Report page: title "Genesis Enhanced Masterclass | <date>", "by <Speaker>", stat cards with the 7 new metrics, 3 country tables (7 buckets each), Show Up Merge table with Source column, Sign Up table with Source column, Student List table (horizontally scrolling 24 cols)
   - Drop "Show-ups not in opt-in" section (it's not in the GEM sample — handled via Keap tags only)
   - Update WatiSection for 2 broadcast types

7. **server/routes.ts** — already generic, just ensure broadcastTypeSchema enum import works.

8. **client/src/components/BroadcastPanel.tsx** — remove banner thumbnail block (GEM templates don't have a banner setup yet). Or keep it conditional on bannerPath being defined; both GEM broadcasts have no bannerPath.

9. **client/index.html** + tab title — change to "GEM Preview Report".

## Build, QA, Deploy

- `cd /home/user/workspace/gem-test && npm install && npm run build`
- `start_server` on port 5000 with `NODE_ENV=production node dist/index.cjs`
- Use Playwright to upload the 4 sample CSVs, set Session Date `070526`, Attendance at Pitch `119`, Speaker `Julian`, GPP To Date `162`, Program Price `3997`, generate report.
- Verify: stat cards show 268 / 268 / 138 (51.5%) / 119 (86.2%) / 4 / $15,988 / 166 (162+4). Country tables match sample (SG=237, MY=19, USA=0, HK=1, OTHERS=5, INVALID=0, NA=6 — opt-in).
- Download Excel, verify 7 sheets, verify Keap Working has GPP3/GPP4 tags, verify Student List has 24 columns and 4 rows for the 4 sign-ups.
- WATI panel: Welcome WATI shows 4 recipients, No Show Up shows (268 - 138) = 130 recipients (only those in Keap who didn't attend).
- Deploy + publish to `gempreview-wati-auto` (new subdomain, new site_id).
