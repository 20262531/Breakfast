# Validation — 29 September 2026

Passed:
- 6 automated domain tests: building conversion, strict packages, CSV parsing, import conflicts, count/payment limits, spreadsheet formula escaping.
- Browser workflow at desktop and mobile widths: partial RB check-in, fully used room blocked, unpaid RO blocked, paid RO counted, D building conversion, import preserves counts and logs, invalid room rejected, history and CSV export.
- Bundled XLSX reader: real .xlsx upload containing Thai name and D102; preview correctly shows 5102.
- Thai font rendering and mobile layout inspected visually; no horizontal page overflow at 390px.
- Firestore Emulator: rules compile; unauthenticated/disabled users blocked; staff cannot change roster or own role; atomic count+entry succeeds; repeated event ID does not add a second count; unpaid RO rejected; direct count tampering rejected; concurrent requests cannot exceed room occupancy; admin reimport preserves count/history; standalone forged entry rejected.

Not connected to a live customer Firebase project. The supplied firebase-config.js is intentionally empty. Live project authentication, rules deployment, and network connectivity must be checked after configuration.
