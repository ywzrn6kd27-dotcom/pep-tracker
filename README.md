# Pep Tracker

A local-first React dashboard for reviewing user-entered injection history, spreadsheet-style decay estimates, supply inventory, prepared-vial records, and backups.

## Features

- Data Review dashboard with current modeled values, date slider, trend chart, selected-day details, configurable next-date intervals, and quick entry.
- Injection history with search, filtering, editing, deletion, CSV export, and CSV/XLSX import.
- Supply batch tracking with stock thresholds, optional expiration dates, and an inventory ledger.
- Prepared-vial records with concentration arithmetic, user-configurable concentration presets, source-batch traceability, and remaining-quantity tracking.
- JSON backup/restore, CSV export, light/dark themes, responsive layout, validation, duplicate warnings, and calculation details.
- Formula parameters configurable in the UI. Reta defaults to 6 days; Tirz defaults to 5 days, matching the supplied spreadsheet formulas.

## Run locally

Requires Node.js 18 or newer.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build and test

```bash
npm run build
npm test
```

## Import history

On **Injection Data**, choose CSV or Excel (`.xlsx`) containing columns similar to:

- `Date`
- `Pep`
- `Dose (mg)`
- `Units`

Column matching is case-insensitive and accepts common variants. Review the preview before importing. Rows with invalid dates or missing compound names are skipped; blank dose values are flagged and can be imported as zero only after confirmation. Historical imports do not automatically deduct today's inventory.

## Storage and privacy

Records are stored in this browser using localStorage. They are not sent to a server by this app. Browser storage is not a substitute for backups: use **Settings → Export JSON backup** regularly. Clearing browser/site data can delete local records. Do not commit personal records or backups to a public repository.

## Calculation notes

The application reproduces the spreadsheet's simplified daily decay sum:

`sum(dose × 2 ^ (-wholeDaysElapsed / halfLifeDays))`

The defaults are 6 days for `Reta` and 5 days for `Tirz`. These are modeled estimates, not measured blood concentrations or validated clinical pharmacokinetic predictions, and must not be used as medical dosing advice. The application schedules expected dates from user-configured intervals; these are reminders/calendaring aids, not treatment recommendations.

Concentration arithmetic uses `mg ÷ mL = mg/mL`. Presets are user-configured conveniences, not recommended preparation targets. Verify preparation instructions with an appropriate qualified professional.

## GitHub

Create a repository named `Pep Tracker` (GitHub repository slugs generally use `pep-tracker`), extract this project, then commit the source. Keep private records and backups out of the repository.
