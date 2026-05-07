# CETLens

> **Instant MHT-CET Response Sheet Analyzer with Live Community Analytics**

CETLens is a fully client-side web application that allows MHT-CET students to upload their official Objection Portal response sheet (HTML, PDF, or TXT), instantly parse it, and view a rich analytics dashboard with score breakdowns, question-wise results, export options, and anonymous live community comparisons.

🌐 **Live Deployment:** [https://cet-lens.vercel.app](https://cet-lens.vercel.app)

Built by **Swanand Jaju** — First Year AIML student at Walchand College of Engineering, Sangli.

---

## Table of Contents

1. [Features](#features)
2. [Tech Stack & Dependencies](#tech-stack--dependencies)
3. [Project Structure](#project-structure)
4. [File-by-File Reference](#file-by-file-reference)
   - [index.html](#indexhtml)
   - [style.css](#stylecss)
   - [script.js](#scriptjs)
   - [firebase.js](#firebasejs)
   - [router.js](#routerjs)
5. [How It Works — End to End](#how-it-works--end-to-end)
6. [Supported File Formats](#supported-file-formats)
7. [Scoring Rules](#scoring-rules)
8. [Firebase Data Model](#firebase-data-model)
9. [Caching Strategy](#caching-strategy)
10. [IndexedDB — Question Image Persistence](#indexeddb--question-image-persistence)
11. [Session Persistence](#session-persistence)
12. [Export Capabilities](#export-capabilities)
13. [Routing](#routing)
14. [UI / Theme System](#ui--theme-system)
15. [Keyboard Shortcuts](#keyboard-shortcuts)
16. [Shift Schedule Reference](#shift-schedule-reference)
17. [Security & Privacy](#security--privacy)
18. [Known Limitations & Edge Cases](#known-limitations--edge-cases)
19. [Local Setup](#local-setup)
20. [Environment Notes](#environment-notes)

---

## Features

| Category | Feature |
|---|---|
| **Parsing** | Supports MHT-CET Objection Portal HTML saves, PDF response sheets, and pipe-delimited TXT exports |
| **Parsing** | Automatic section detection for Physics, Chemistry, Mathematics, and Biology |
| **Parsing** | PDF page rendering and per-question image cropping via pdf.js |
| **Dashboard** | Arc gauge score display with animated fill |
| **Dashboard** | Overall stats: score, correct, incorrect, unattempted, and accuracy |
| **Dashboard** | Subject-wise doughnut charts for PCM / PCB subjects |
| **Dashboard** | Question-by-question table with status icons and image thumbnails |
| **Dashboard** | Detail modal with full question image and answer comparison |
| **Dashboard** | Filter bar for All / Correct / Incorrect / Unattempted / per-subject views |
| **Dashboard** | Sidebar question grid with colour-coded status buttons |
| **Firebase** | Anonymous score submission with SHA-256 duplicate prevention |
| **Firebase** | Aggregate-only writes; raw submissions are not stored |
| **Firebase** | Concurrent-safe transaction on the stats node |
| **Firebase** | 5-minute in-memory read cache |
| **Live Stats** | Post-submission strip with percentile, shift average, shift highest, and ahead/behind counts |
| **Analysis** | Full analysis screen with percentile gauge, shift comparisons, histogram, radar chart, subject bars, and stream donut |
| **Analysis** | Per-shift drill-down with participant count, mean, median, highest, and lowest |
| **Community** | Community screen across all shifts/streams without requiring a personal upload |
| **Routing** | Hash-based deep links for home, community, dashboard, and analysis screens via `router.js` |
| **Export** | CSV export of all question data |
| **Export** | Styled PDF report via jsPDF |
| **Export** | PNG share card via html2canvas |
| **UX** | Dark/light theme with system preference detection and localStorage persistence |
| **UX** | Session restore via localStorage + IndexedDB |
| **UX** | Stream mismatch detection with one-click correction |
| **UX** | Confetti animation for scores ≥ 150 |
| **UX** | Lightbox for question image zoom |
| **UX** | Keyboard navigation with arrow keys and Escape |
| **UX** | Drag-and-drop file upload with filename preview |
| **UX** | Mobile responsive layout with hamburger sidebar drawer |

---

## Tech Stack & Dependencies

All dependencies are loaded from CDN — no build step or `npm install` is required.

| Library | Version | Use |
|---|---:|---|
| **Firebase App (compat)** | 10.9.0 | App initialization |
| **Firebase Realtime Database (compat)** | 10.9.0 | Score aggregation and live analytics |
| **Chart.js** | 4.4.1 | Charts: bar, doughnut, radar, histogram |
| **pdf.js** | 3.4.120 | PDF text extraction and page rendering |
| **canvas-confetti** | 1.9.3 | Celebration animation |
| **jsPDF** | 2.5.1 | PDF report export |
| **html2canvas** | 1.4.1 | Share card PNG generation |
| **Google Fonts — Inter** | — | Body typography |
| **Google Fonts — JetBrains Mono** | — | Monospace elements |

No framework such as React, Vue, or Angular is used. CETLens is a vanilla HTML/CSS/JavaScript static web app.

---

## Project Structure

```text
cetlens/
├── index.html      — Full page structure, all screens, CDN script tags
├── style.css       — Design system, neumorphic tokens, all component styles
├── script.js       — Application logic: parsing, rendering, UI state, exports
├── firebase.js     — Firebase config, aggregation helpers, write/read logic
├── router.js       — Hash router for shareable URLs and browser back/forward support
├── LICENSE
└── README.md
```

Everything runs from a single static directory. No bundler, framework, or custom server is required.

---

## File-by-File Reference

### index.html

The single HTML file that contains the skeleton for every screen in the application. Screens are regular DOM sections that are shown or hidden by JavaScript.

**Screens / overlays defined:**

| Element ID | Description |
|---|---|
| `#uploadScreen` | Landing / upload page with brand, stream selector, attempt/shift dropdowns, drag-and-drop zone, and Community CTA banner |
| `#loadingScreen` | Full-screen spinner overlay shown during file processing |
| `#dashboard` | Main analysis dashboard with topbar, sidebar, score cards, metrics, table, and viewer |
| `#analysisScreen` | Full-screen detailed analysis view powered by Firebase aggregates |
| `#communityScreen` | Community-wide live analysis accessible before uploading |
| `#mismatchOverlay` | Modal shown when uploaded question count does not match the selected stream |
| `#restoreOverlay` | Modal shown when a previous session is found in localStorage |
| `#qDetailOverlay` | Modal for a full question view and answer comparison |
| `#lightbox` | Full-screen image lightbox |
| `#shareCardEl` | Hidden off-screen element used by html2canvas to create the shareable PNG card |
| `#landingPage` | Informational landing section with hero, how-it-works content, and testimonials |

**Script loading order:**

1. Firebase scripts in `<head>`
2. `firebase.js` after Firebase scripts
3. `Chart.js`
4. `pdf.js`
5. `canvas-confetti`
6. `jsPDF`
7. `html2canvas`
8. `script.js`
9. `router.js` after `script.js`, so it can wrap the existing screen functions

To enable the hash router, include this after `script.js`:

```html
<script src="router.js"></script>
```

### style.css

Contains the visual system for the app, built around an industrial skeuomorphic / neumorphic style.

**Key systems:**

- CSS custom properties on `:root` for background, foreground, accent, shadows, status colours, and fonts.
- Dark theme overrides via `[data-theme="dark"]`.
- Responsive upload page, dashboard layout, sidebar drawer, cards, charts, tables, overlays, modals, and landing-page sections.

**Important component classes:**

| Class | Description |
|---|---|
| `.upload-screen` / `.upload-container` | Two-column upload layout |
| `.mode-btn` | Stream selector buttons |
| `.upload-zone` | Drag-and-drop file area |
| `.topbar` | Fixed dashboard navigation bar |
| `.main-layout` | Sidebar + content flex layout |
| `.sidebar` | Collapsible question grid sidebar |
| `.score-tabs-card` | Overall / subject-wise score card |
| `.arc-gauge` | SVG arc gauge animated by JavaScript |
| `.metric-card` | Score statistic tiles |
| `.q-table` / `.q-table-card` | Scrollable question list |
| `.q-viewer` | Inline question detail panel |
| `.q-detail-modal` | Modal question detail |
| `.filter-chip` | Filter buttons |
| `.q-btn` | Question grid buttons |
| `.analysis-card` | Shared card style for analysis screens |
| `.live-brief-strip` | Post-submission stats banner |
| `.community-cta-banner` | Landing/upload community analytics CTA |

### script.js

The main application file. It manages browser state, file parsing, score calculation, dashboard rendering, session persistence, overlays, keyboard navigation, and export functions.

**Core state variables:**

| Variable | Purpose |
|---|---|
| `questions` | Full parsed question array for the current session |
| `filteredQs` | Currently displayed subset |
| `currentQ` | Active index in `filteredQs` |
| `examMode` | `PCM` or `PCB` |
| `donutChartInst` | Main Chart.js doughnut instance |
| `subjectChartInsts` | Per-subject chart instances |
| `pdfPageImages` | Rendered PDF page canvases |
| `questionImages` | Cropped question image data URLs keyed by question ID |
| `questionPageMap` | Question-to-PDF-page mapping |
| `selectedAttempt` | Selected exam attempt |
| `selectedShift` | Selected exam shift |
| `_pendingQs` | Buffered questions during mismatch correction |
| `_isProcessing` | Mutex to prevent double-processing |
| `_analysisCharts` | Chart instances for the analysis screen |
| `_communityCharts` | Chart instances for the community screen |

**Important function groups:**

| Group | Functions |
|---|---|
| Theme / init | `applyTheme()`, `toggleTheme()`, `checkStoredSession()` |
| File handling | `handleFile()`, `processFile()`, `processPDF()`, `classifyUploadError()` |
| Parsers | `parsePortalText()`, `parseRawData()` |
| Stats | `computeStats()` |
| Dashboard | `renderDashboard()`, `renderScoreCard()`, `renderSubjectCharts()`, `renderGrid()`, `renderQuestionTable()`, `showQuestion()` |
| Navigation | `prevQ()`, `nextQ()`, `jumpToQ()`, `setFilter()`, `highlightQTableRow()` |
| Screens | `showLoading()`, `showDash()`, `showDashRestored()`, `resetApp()`, `openAnalysisScreen()`, `openCommunityScreen()` |
| Export | `exportCSV()`, `exportPDF()`, `generateShareCard()`, `triggerDownload()` |
| Mismatch | `finish()`, `showMismatchPopup()`, `mismatchSwitchAndContinue()`, `mismatchReupload()` |

Both parsers normalize data into question objects with IDs, section, correct answer, candidate answer, status, and marks.

### firebase.js

Handles all Firebase Realtime Database interaction and shared chart utilities.

**Main responsibilities:**

- Initialize the Firebase app.
- Maintain a short in-memory cache for analytics reads.
- Provide shared chart helpers such as `getChartColors()`, `baseChartOptions()`, and `drawArcGauge()`.
- Generate duplicate-prevention hashes using SHA-256.
- Write aggregate score data with transactions.
- Read shift-level, full-analysis, and community-level aggregate data.
- Render the brief strip, full analysis charts, and community analytics charts.

**Firebase configuration keys are embedded client-side.** This is normal for Firebase web apps; actual security must be enforced using Firebase Realtime Database rules.

### router.js

`router.js` adds a lightweight hash router on top of the existing single-page UI. It does not replace the current screen functions; instead, it wraps them so that opening and closing screens also updates the URL hash.

**Supported routes:**

| Route | Screen |
|---|---|
| `/` | Home / upload screen |
| `/#community` | Community Live Analysis |
| `/#dashboard` | Results Dashboard |
| `/#analysis` | Shift-wise Live Analysis |

**How it works:**

1. Stores references to the original screen functions from `script.js`.
2. Wraps functions such as `showDash()`, `showDashRestored()`, `resetApp()`, `openAnalysisScreen()`, `closeAnalysisScreen()`, `openCommunityScreen()`, and `closeCommunityScreen()`.
3. Uses `history.pushState()` to update the URL when screens change.
4. Uses `handleRoute()` to read `window.location.hash` and show the correct screen.
5. Listens to browser `popstate` so Back / Forward buttons work naturally.
6. Runs once on `DOMContentLoaded` so direct links like `/#community` and `/#analysis` can open the correct screen.

**Session-aware routes:**

- `/#community` works without a saved session.
- `/#dashboard` and `/#analysis` require an existing saved session in `localStorage`.
- If a dashboard or analysis route is opened without a valid saved session, the router redirects back to the home URL.

**Important integration note:**

Because `router.js` wraps functions declared in `script.js`, it must be loaded **after** `script.js`:

```html
<script src="script.js"></script>
<script src="router.js"></script>
```

---

## How It Works — End to End

### Step 1: Stream & Shift Selection

The user selects PCM or PCB, chooses an attempt, and then selects the relevant shift. The selected stream affects section expectations and marks calculation.

### Step 2: File Upload & Parsing

`processFile(file)` routes the uploaded file by type:

- **PDF**: Uses pdf.js to extract text, render pages, map questions to pages, and crop question images.
- **HTML / HTM**: Reads the file as text, strips markup, and parses portal text.
- **TXT**: Parses pipe-delimited rows in the expected export format.

If parsing returns zero questions, the app shows a friendly error message based on the file type and failure mode.

### Step 3: Score Computation

`computeStats(qs)` calculates:

- Correct, incorrect, and unattempted counts.
- Earned score and maximum possible score.
- Accuracy.
- Per-subject correct count, earned marks, maximum marks, and percentage.

### Step 4: Dashboard Rendering

`showDash(qs)` displays the dashboard and calls `renderDashboard(qs)`, which renders:

1. Metric cards.
2. Main doughnut chart.
3. Per-subject doughnut charts.
4. Arc score gauge.
5. Subject score rows.
6. Sidebar question grid.
7. Question table.
8. First selected question viewer.
9. Local session persistence.

### Step 5: Firebase Write Path

`saveSubmissionToFirebase(qs, st, filename)`:

1. Builds a payload with attempt, shift, stream, score, subjects, and timestamp.
2. Generates a SHA-256 hash from the answer pattern.
3. Checks whether the hash was already submitted.
4. Runs a transaction on the shift stats node.
5. Updates summary counters and writes the hash record.
6. Invalidates affected cache keys.
7. Fetches and renders the live stats brief strip.

### Step 6: Live Stats Strip

After a successful submission or restored session, the brief strip shows:

- Your percentile.
- Shift average.
- Shift highest.
- Count ahead of you.
- Total students in the selected shift.
- Link to full analysis.

### Step 7: Full Analysis Screen

The full analysis screen compares the user against their selected shift and stream using Firebase aggregate data. It includes percentile, shift stats, subject comparison, score distribution, shift-vs-shift charts, and stream overview.

### Step 8: Community Screen

The community screen is accessible before uploading. It reads anonymous aggregate stats for PCM and PCB Attempt 1 and renders community-wide charts.

### Step 9: Hash Routing

When `router.js` is loaded, screen transitions update the URL hash. Users can open or share `/#community`, return to `/#dashboard` after a saved session, and use browser Back / Forward navigation between major screens.

---

## Supported File Formats

| Format | How to obtain | Notes |
|---|---|---|
| `.html` / `.htm` | Save the MHT-CET Objection Tracker Portal response page using **File → Save As → Webpage, Complete** | Most reliable for text parsing and section labels |
| `.pdf` | Download or print-to-PDF from the portal | Enables per-question image previews |
| `.txt` | Pipe-delimited export | Format: `qid|section|text|optId:text|...|correctOptId|candidateOptId` per line |

---

## Scoring Rules

| Stream | Section | Correct | Incorrect | Unattempted |
|---|---|---:|---:|---:|
| PCM | Physics | +1 | 0 | 0 |
| PCM | Chemistry | +1 | 0 | 0 |
| PCM | Mathematics | **+2** | 0 | 0 |
| PCB | Physics | +1 | 0 | 0 |
| PCB | Chemistry | +1 | 0 | 0 |
| PCB | Biology | +1 | 0 | 0 |

Maximum scores:

- **PCM:** 200
- **PCB:** 150

There is no negative marking.

---

## Firebase Data Model

```text
cetlens
├── stats/
│   ├── PCM/
│   │   └── Attempt 1/
│   │       └── {shiftName}/
│   │           ├── count
│   │           ├── sum
│   │           ├── highest
│   │           ├── min
│   │           ├── updatedAt
│   │           ├── scoreCounts/
│   │           │   └── {score}: count
│   │           └── subjectSums/
│   │               ├── Physics
│   │               ├── Chemistry
│   │               └── Mathematics
│   └── PCB/
│       └── Attempt 1/
│           └── {shiftName}/
│               └── same aggregate structure
│
├── summary/
│   ├── total
│   └── streams/
│       ├── PCM
│       └── PCB
│
└── hashes/
    └── {stream}/
        └── {shift}/
            └── {sha256hash}/
                └── timestamp
```

**Design decisions:**

- Raw submissions are not stored.
- `scoreCounts` enables percentile and histogram calculations.
- `subjectSums` enables subject-average analytics.
- `hashes` prevents duplicate submissions from inflating community stats.
- Writes use transactions and multi-path updates to reduce race conditions and round trips.

---

## Caching Strategy

`firebase.js` maintains a module-level cache:

```js
const _fbCache = {};
const _CACHE_TTL_MS = 5 * 60 * 1000;
```

| Key Pattern | Content | Invalidated By |
|---|---|---|
| `analysisRaw:{stream}:{attempt}` | Stats and summary for a stream/attempt | Matching submission write |
| `community` | PCM + PCB Attempt 1 stats and summary | Any submission write |

The cache keeps repeated analysis screen opens fast while still invalidating data after new submissions.

---

## IndexedDB — Question Image Persistence

Question images cropped from PDFs can be large, so they are stored in IndexedDB instead of localStorage.

| Function | Behaviour |
|---|---|
| `openImageDB()` | Opens or creates the `CETLensDB` database |
| `saveImagesToIDB(images)` | Clears and writes current question images |
| `loadImagesFromIDB()` | Restores images during session restore |
| `clearImagesFromIDB()` | Deletes stored images on reset |

The app stores only one image session at a time.

---

## Session Persistence

When a dashboard is shown, `saveSession(filename, qs)` stores the active session in localStorage and stores PDF question images in IndexedDB.

Stored session fields include:

- Parsed questions.
- Exam mode.
- Filename.
- Timestamp.
- Selected attempt.
- Selected shift.

On the next page load, `checkStoredSession()` can show a restore modal. Restored sessions skip duplicate Firebase writes but can still fetch live stats.

`router.js` also uses this saved session to restore `/#dashboard` and `/#analysis` links.

---

## Export Capabilities

### CSV Export

Exports question-level data including question number, section, section question number, status, correct option ID, candidate option ID, and marks.

### PDF Export

Uses jsPDF to generate a styled A4 report with title, metadata, score box, stats row, sectional breakdown table, footer, and privacy note.

### Share Card PNG

Uses html2canvas to render a hidden score card element into a downloadable PNG image.

---

## Routing

CETLens uses hash routing through `router.js`.

| URL | Behaviour |
|---|---|
| `https://cet-lens.vercel.app/` | Opens home / upload screen |
| `https://cet-lens.vercel.app/#community` | Opens Community Live Analysis |
| `https://cet-lens.vercel.app/#dashboard` | Restores dashboard if a saved session exists |
| `https://cet-lens.vercel.app/#analysis` | Restores dashboard and opens analysis if a saved session exists |

The router improves shareability and navigation while keeping the app fully static and client-side.

---

## UI / Theme System

The app supports light and dark themes. `toggleTheme()` updates `data-theme` on `<html>` and persists the preference in localStorage. If no preference is saved, the app falls back to `prefers-color-scheme`.

Charts read CSS variables at render time through `getChartColors()`, so their colours match the active theme.

---

## Keyboard Shortcuts

| Key | Context | Action |
|---|---|---|
| `←` Arrow | Dashboard with no modal open | Previous question |
| `→` Arrow | Dashboard with no modal open | Next question |
| `←` Arrow | Question detail modal open | Previous modal question |
| `→` Arrow | Question detail modal open | Next modal question |
| `Escape` | Anywhere | Closes modal, lightbox, or sidebar in priority order |

---

## Shift Schedule Reference

### PCM — Physics, Chemistry, Mathematics — Attempt 1

| Date | Sessions |
|---|---|
| 11 April | Morning, Evening |
| 13 April | Morning, Evening |
| 15 April | Morning, Evening |
| 16 April | Morning, Evening |
| 17 April | Morning, Evening |
| 18 April | Morning, Evening |
| 19 April | Morning, Evening |
| 20 April | Morning, Evening |

### PCB — Physics, Chemistry, Biology — Attempt 1

| Date | Sessions |
|---|---|
| 21 April | Morning, Evening |
| 22 April | Morning, Evening |
| 23 April | Morning, Evening |
| 24 April | Morning, Evening |
| 25 April | Morning, Evening |

---

## Security & Privacy

- Uploaded files are parsed locally in the browser.
- The raw response sheet is not sent to any server.
- Firebase receives only anonymous aggregate score data, stream, attempt, shift, per-subject scores, and a SHA-256 answer-pattern hash.
- The Firebase web API key is not a secret; Firebase Security Rules are responsible for protecting the database.
- Duplicate prevention is hash-based.
- localStorage and IndexedDB session data remain on the user's device and can be cleared with reset.

---

## Known Limitations & Edge Cases

- **Scanned PDFs:** Image-only PDFs cannot be parsed by pdf.js text extraction.
- **PDF cropping accuracy:** Question image cropping depends on detected PDF text positions.
- **Section detection fallback:** If labels are missing, the parser falls back to positional inference.
- **HTML relative image paths:** Saved portal image paths may not resolve unless the companion asset folder is available.
- **PCB Mathematics:** PCB does not have Mathematics; unexpected Mathematics rows are treated without the PCM +2 rule.
- **Community analytics scope:** Community analytics currently read Attempt 1 aggregates.
- **No authentication:** Firebase writes are anonymous; duplicate prevention is based on hashes.
- **localStorage quota:** Large sessions may fail to save in localStorage, but images are stored in IndexedDB to reduce pressure.
- **Hash-routed dashboard links:** `/#dashboard` and `/#analysis` need a saved browser session to restore user-specific data.

---

## Local Setup

CETLens requires no build tools.

```bash
# Clone the repository
 git clone https://github.com/swanandjaju/CETLens.git
 cd CETLens

# Serve with any static server
 npx serve .

# or
 python3 -m http.server 8080
```

You can also open `index.html` directly in a browser, but some browser APIs such as pdf.js workers and `crypto.subtle` work more reliably on `localhost` or HTTPS.

### Deployment

The project is deployed at:

[https://cet-lens.vercel.app](https://cet-lens.vercel.app)

Because CETLens is a static app, it can also be hosted on GitHub Pages, Netlify, Firebase Hosting, Vercel, or any static CDN.

### Firebase

The project connects to the live `cetlens` Firebase project. To run a separate instance:

1. Create a Firebase project.
2. Enable Realtime Database.
3. Replace the `firebaseConfig` object in `firebase.js`.
4. Configure database rules for your desired read/write policy.

---

## Environment Notes

- Requires a modern browser with ES2017+ support.
- Uses `crypto.subtle`, IndexedDB, CSS Custom Properties, and ResizeObserver.
- Works best in Chrome, Firefox, Edge, and modern mobile browsers.
- Fully responsive for mobile use.
- No server-side component is required.
- Offline parsing and dashboard rendering work after assets are loaded.
- Firebase-powered features require an internet connection.

---

*Built with ❤️ by Swanand Jaju — WCE Sangli, 2026*
