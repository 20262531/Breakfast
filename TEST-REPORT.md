# Validation — 29 September 2026

Passed:
- 6 automated domain tests: building conversion, strict packages, CSV parsing, import conflicts, count/payment limits, spreadsheet formula escaping.
- Browser workflow at desktop and mobile widths: partial RB check-in, fully used room blocked, unpaid RO blocked, paid RO counted, D building conversion, import preserves counts and logs, invalid room rejected, history and CSV export.
- Bundled XLSX reader: real .xlsx upload containing Thai name and D102; preview correctly shows 5102.
- Thai font rendering and mobile layout inspected visually; no horizontal page overflow at 390px.
- Firestore Emulator: rules compile; unauthenticated/disabled users blocked; staff cannot change roster or own role; atomic count+entry succeeds; repeated event ID does not add a second count; unpaid RO rejected; direct count tampering rejected; concurrent requests cannot exceed room occupancy; admin reimport preserves count/history; standalone forged entry rejected.

Not connected to a live customer Firebase project. The supplied firebase-config.js is intentionally empty. Live project authentication, rules deployment, and network connectivity must be checked after configuration.

PDF import extension validation:
- All 21 pages of both supplied PDFs parsed with totals reconciled to the report footers.
- LRR: 51 rooms, 63 adults + 2 children. RDL: 65 total document rooms, including 37 excluded accounting rooms; 39 adults + 1 child.
- Merged 79 physical rooms, 105 reported occupants, initial RO 50 / RB 21 / REVIEW 8.
- Actual-PDF browser workflow passed date acknowledgement, required FO reason, successful import, blocked REVIEW check-in, RO classification, pax aggregation, accounting-room exclusion, mobile overflow check.
- Five additional parser tests passed for companion aggregation, conflicting evidence, explicit mapping, pseudo-room/zero/stale stay holds, and duplicate rows.
- Firebase Emulator also checked admin-only rate mapping and rejection of REVIEW room entries.
