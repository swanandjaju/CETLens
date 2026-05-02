# CETLens

A fully client-side MHT-CET response sheet analyzer. Upload your response sheet from the MHT-CET Objection Tracker Portal and get an instant, detailed performance dashboard — score breakdown, subject-wise accuracy charts, per-question review, and multiple export formats. No data ever leaves your device.

**Live deployment:** https://cetlens.onrender.com

---

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Supported File Formats](#supported-file-formats)
- [How It Works](#how-it-works)
- [Parsing Logic](#parsing-logic)
- [Dashboard Sections](#dashboard-sections)
- [Scoring Rules](#scoring-rules)
- [Export Options](#export-options)
- [Stream Mismatch Detection](#stream-mismatch-detection)
- [Theme System](#theme-system)
- [Keyboard Shortcuts](#keyboard-shortcuts)
- [Project Structure](#project-structure)
- [Libraries Used](#libraries-used)
- [Local Development](#local-development)
- [Privacy](#privacy)
- [Known Limitations](#known-limitations)
- [Author](#author)
- [License](#license)

---

## Overview

CETLens is a zero-backend web application. All file reading, text extraction, question parsing, scoring, and chart rendering happen entirely inside the browser. There is no server, no database, and no analytics tracking. The only network requests made are to load the CDN libraries listed below.

The tool is built for the MHT-CET Objection Tracker Portal response sheet format — the document students download after their exam attempt to review their answers.

---

## Features

### Upload and Parsing
- Accepts the MHT-CET response sheet in three formats: HTML (saved from the portal), PDF, and pipe-delimited TXT.
- Drag-and-drop or click-to-browse file selection.
- Filename preview shown in the drop zone during drag.
- A processing lock prevents duplicate submissions if the user triggers the upload twice.
- Clear, context-specific error messages when a file cannot be parsed (unsupported extension, scanned PDF, wrong format, etc.).

### Stream Selection
- Two modes: PCM (Physics, Chemistry, Mathematics) and PCB (Physics, Chemistry, Biology).
- The mode determines the number of expected questions (150 for PCM, 200 for PCB) and the marks-per-question rule for Mathematics.
- The selected mode is shown persistently in the dashboard topbar.

### Dashboard
- Score overview with total marks, correct, incorrect, unattempted, and accuracy percentage.
- Main donut chart showing the correct/incorrect/unattempted split with a centered accuracy percentage.
- Horizontal subject bar chart showing marks earned per subject relative to maximum.
- Per-subject donut charts in a responsive grid (one per subject appearing in the sheet).
- Tabbed score card with an SVG arc gauge showing overall score and a subject-wise breakdown tab.
- Filterable, scrollable question table showing every question's number, section, status, correct option ID, candidate option ID, and marks.
- Question detail modal with per-question image (PDF uploads only), answer comparison, status badge, and marks pill.
- Question navigator grid grouped by subject, color-coded by status.
- Confetti animation fires automatically when total score is 150 or higher.

### Question Review
- Clicking any row in the question table opens a modal with full question detail.
- The modal shows the cropped question image (PDF only), the correct option ID, the candidate's chosen option ID, and a clear visual indicator of whether the answer was correct, incorrect, or unattempted.
- Arrow key navigation between questions works inside the modal.
- Clicking a question image opens a full-screen lightbox for zooming.

### Filters
- Filter chips for All, Correct, Incorrect, Unattempted, and each individual subject.
- Filters apply instantly to both the question table and the detail navigator.
- The table scroll resets to top when a filter is changed.

---

## Supported File Formats

### HTML (.html / .htm)
The recommended format. Save the full page from the MHT-CET Objection Tracker Portal using "Save As > Webpage, Complete" in your browser. The parser strips HTML tags and works on the plain text, looking for `Correct Option` and `Candidate Response` label pairs.

### PDF (.pdf)
The PDF version of the same portal page. PDF.js extracts text from each page, reconstructs line order by Y-coordinate, and runs the same text parser. In addition, for PDF uploads, each page is rendered to a canvas at 1.8x scale and individual question images are cropped from the rendered pages using the Y-positions of the "Correct Option" labels as crop boundaries. This produces the question image previews shown in the detail modal.

Note: scanned (image-only) PDFs cannot be parsed because there is no selectable text layer.

### TXT (.txt)
A pipe-delimited plain text format for programmatic or manual data entry. Each line represents one question in the following structure:

```
qid|section|question_text|optId:option_text|optId:option_text|...|correctOptId|candidateOptId
```

At minimum, eight pipe-separated fields are required per line. Lines with fewer than eight fields are skipped.

---

## How It Works

### Step 1 — File Selection
The user selects their stream (PCM or PCB), then drops or browses for their response sheet file. The `processFile` function acquires a processing lock and dispatches to the appropriate parser based on file extension.

### Step 2 — Parsing
The parser scans the text for the pattern `Correct Option: <5-or-6-digit ID>` using a regular expression. For each match, it looks at the text immediately following for a `Candidate Response` field to determine what the student answered. The section (Physics, Chemistry, Mathematics, Biology) is inferred from text appearing before each match. If no section label is found, fallback ordering is applied based on question index.

### Step 3 — Stream Mismatch Check
After parsing, the total question count is compared against the expected count for the selected mode. If the count matches the opposite mode (e.g., 200 questions when PCM was selected), a mismatch popup appears offering to automatically switch modes and recalculate marks.

### Step 4 — Dashboard Render
The parsed question array is passed to `renderDashboard`, which computes all statistics, renders the charts via Chart.js, populates the question table, and shows the dashboard layout. The session is saved to `localStorage` for reference (session restore is intentionally disabled to keep the UX simple).

### Step 5 — Interaction
The user can filter questions, click rows to open the detail modal, navigate with arrow keys, zoom question images, and export their results.

---

## Parsing Logic

The core parser, `parsePortalText`, uses the following approach:

1. Find all occurrences of `Correct Option: <ID>` in the full text using a global regex.
2. For each match, look within the next 200 characters for a `Candidate Response` or similar field.
3. A candidate ID of `0` or empty is treated as unattempted (no answer selected).
4. The block of text before each "Correct Option" is scanned for a 6-digit question ID and a subject label keyword.
5. Per-subject counters (physN, chemN, mathN, bioN) track the question number within each section.
6. Status is assigned: `correct` if candidate ID equals correct ID, `incorrect` if a candidate ID exists but doesn't match, `unattempted` if no candidate ID.

The pipe-delimited parser (`parseRawData`) splits each line on `|`, extracts options from the middle fields, and matches the `correctOptId` and `candidateOptId` values against the option list.

---

## Dashboard Sections

### Metrics Strip
Four stat cards showing: Total Score (earned / maximum), Correct (count), Incorrect (count), Accuracy (percentage based on attempted questions only — unattempted questions are excluded from the accuracy denominator).

### Main Donut Chart
A Chart.js doughnut chart showing the three-way split (correct / incorrect / unattempted) with a centered accuracy label and a manual legend below.

### Subject Bar Chart
Horizontal bars for each subject showing `earned / maximum` marks with a fill percentage. The bar colors are fixed per subject: Physics = cyan, Chemistry = magenta, Mathematics = green, Biology = cyan.

### Subject Donut Charts
One small doughnut chart per subject, each showing correct/incorrect/unattempted counts for that subject and a centered percentage label.

### Score Card (Tabbed)
Two tabs:
- **Overall Score:** An SVG arc gauge rendered with calculated path arcs. The needle position is proportional to the score percentage. Below the gauge, the score, accuracy, correct, and incorrect counts are shown.
- **Subject-wise:** A table of each subject with correct count, marks earned, marks possible, and a percentage bar.

### Question Table
A scrollable table listing every question with columns for question number, section, section-relative question number, status badge, correct option ID, candidate option ID, and marks. Rows are clickable and highlight the active question.

### Question Detail Modal
Opens on row click. Shows:
- Question number and section header
- Status badge (Correct / Incorrect / Unattempted) and marks pill (+1, +2, or 0)
- The cropped question image (PDF uploads only; HTML uploads show a placeholder)
- Answer comparison: candidate's answer with a tick or cross icon, and the correct answer with a tick icon
- Prev / Next navigation buttons and a counter showing position within the current filtered set

### Question Navigator Grid
Grouped by subject. Each button represents one question, color-coded green (correct), red (incorrect), or grey (unattempted). Clicking a button jumps to that question in the detail modal.

---

## Scoring Rules

| Stream | Subject | Marks per correct answer |
|--------|---------|--------------------------|
| PCM | Physics | 1 |
| PCM | Chemistry | 1 |
| PCM | Mathematics | 2 |
| PCB | Physics | 1 |
| PCB | Chemistry | 1 |
| PCB | Biology | 1 |

There is no negative marking. Incorrect and unattempted answers both score 0.

Maximum possible score:
- PCM: Physics (50) + Chemistry (50) + Mathematics (100) = 200 marks over 150 questions
- PCB: Physics (50) + Chemistry (50) + Biology (100) = 200 marks over 200 questions

---

## Export Options

### CSV Export
Exports a UTF-8 CSV file (with BOM for Excel compatibility) with the following columns: Q#, Section, Section Q#, Status, Correct Option ID, Candidate Option ID, Marks. The filename is derived from the uploaded file's name. Internal quotes in field values are escaped per RFC 4180.

### PDF Report (jsPDF)
Generates a formatted A4 PDF report with:
- A header with the CETLens title and report subtitle
- File metadata (filename, mode, date, question count)
- A large score display box
- A four-column stats row (correct, incorrect, unattempted, accuracy)
- A sectional breakdown table with per-subject totals, correct counts, incorrect counts, and scores
- A footer: `Generated by CETLens · Built by Swanand Jaju · WCE Sangli`

The PDF is downloaded directly to the browser.

### Score Card Image (html2canvas)
Renders an off-screen HTML score card element to a 600×330 canvas at 2x scale and downloads it as a PNG. The card shows score, mode, accuracy, correct/incorrect counts, date, and a per-subject summary. A watermark reading `cetlens · by swanand jaju · wce sangli` is included on the card. This format is intended for sharing on social platforms.

---

## Stream Mismatch Detection

When the number of parsed questions does not match the expected count for the selected mode but does match the expected count for the opposite mode, a modal popup appears. The popup explains the mismatch, states the detected question count and the expected count for the correct mode, and offers two actions:

- **Switch & Continue:** Automatically changes the mode to the detected correct stream, recalculates marks for all questions (important because Mathematics gets 2 marks in PCM), and loads the dashboard.
- **Re-upload:** Dismisses the popup and returns to the upload screen so the user can select the correct mode manually before uploading again.

---

## Theme System

The app ships with a light theme by default (neumorphic design using a grey-blue `#e0e5ec` base) and a dark theme that inverts the surface palette.

Theme preference is read on page load from `localStorage` under the key `cetlensTheme`. If no saved preference exists, the system dark mode preference (`prefers-color-scheme: dark`) is respected automatically. Toggling via the sun/moon button in the top-right corner saves the new preference to `localStorage`. Chart colors are not affected by theme switching after charts are rendered — they use fixed hex values in the JavaScript.

---

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `ArrowRight` | Next question (in question navigator or detail modal) |
| `ArrowLeft` | Previous question (in question navigator or detail modal) |
| `Escape` | Close detail modal / close lightbox / close mobile sidebar |

When the detail modal is open, arrow keys navigate within the current filtered question set. When the modal is closed, arrow keys navigate the underlying question viewer.

---

## Project Structure

```
/
├── index.html      # All markup: upload screen, dashboard layout, landing page,
│                   # modals, share card element, lightbox, loading overlay
├── style.css       # Design system tokens, neumorphic shadows, light/dark themes,
│                   # component styles for every UI section
└── script.js       # All application logic: parsing, PDF processing, chart rendering,
                    # filtering, export, theme management, keyboard handling
```

There is no build step, no bundler, no Node.js dependency, and no package.json. The application is three plain files that can be opened directly in a browser or served by any static file host.

---

## Libraries Used

All libraries are loaded from CDN and are not vendored into the repository.

| Library | Version | Purpose |
|---------|---------|---------|
| Chart.js | 4.4.1 | Doughnut charts and bar charts |
| PDF.js | 3.4.120 | PDF text extraction and page rendering |
| canvas-confetti | 1.9.3 | Confetti animation on high scores |
| jsPDF | 2.5.1 | PDF report generation |
| html2canvas | 1.4.1 | Score card PNG export |
| Inter (Google Fonts) | — | Primary display and body font |
| JetBrains Mono (Google Fonts) | — | Monospace font for IDs and code-like values |

PDF.js uses a separate web worker loaded from the same CDN path (`pdf.worker.min.js`). The worker URL is configured at the top of `script.js`.

---

## Local Development

No build tooling is required.

```bash
# Clone the repository
git clone https://github.com/swanandjaju/cetlens.git
cd cetlens

# Serve locally (any static server works)
npx serve .
# or
python3 -m http.server 8080
```

Then open `http://localhost:8080` in your browser.

Opening `index.html` as a `file://` URL directly may cause PDF.js worker loading to fail in some browsers due to CORS restrictions on local file access. Using a local server avoids this.

---

## Privacy

All file processing happens locally in the browser. The uploaded file is read into memory using the browser's `FileReader` / `ArrayBuffer` APIs and is never sent to any server. The application makes no fetch or XHR requests with your data. The only outbound requests are to load the CDN libraries on page load and the Google Fonts stylesheet.

Session data (the parsed question array, filename, mode, and timestamp) is written to `localStorage` as a cache but is cleared when the user clicks "Upload New File" or when the app is reset. This data never leaves the device.

---

## Known Limitations

- **Scanned PDFs:** PDFs that are image scans without a selectable text layer cannot be parsed. Use the HTML version of the response sheet in this case.
- **Question images from HTML:** Images embedded in the HTML response sheet use relative paths that resolve to the portal server, not to the local file. The application cannot load these images. Question image previews are only available when a PDF is uploaded.
- **Portal format changes:** The parser relies on the specific label strings `Correct Option` and `Candidate Response` appearing in the response sheet. If the MHT-CET Objection Portal changes its output format, the parser will need to be updated.
- **Large PDFs:** Rendering all pages to canvas at 1.8x scale is memory-intensive. Very large response sheets may be slow to process on low-RAM devices.
- **Private browsing:** `localStorage` may be restricted in some private browsing modes. The app handles this gracefully — theme preferences and session caching fall back silently without throwing errors.
- **Single file only:** The application processes one response sheet at a time. Uploading a new file replaces the previous session entirely.

---

## Author

**Swanand Jaju**
First Year, AI & ML — Walchand College of Engineering, Sangli

- GitHub: [github.com/swanandjaju](https://github.com/swanandjaju)
- LinkedIn: [linkedin.com/in/swanand-jaju](https://www.linkedin.com/in/swanand-jaju/)

---

## License

This project is licensed under the [MIT License](./LICENSE).

© 2026 Swanand Jaju
