# CETLens

> **Instant MHT-CET Response Sheet Analyzer with Live Community Analytics**

CETLens is a fully client-side web application that allows MHT-CET students to upload their official Objection Portal response sheet (HTML, PDF, or TXT), instantly parse it, and get a rich analytics dashboard — all without sending any personal data to a server. On top of the local analysis, it anonymously aggregates scores to Firebase Realtime Database and surfaces live community-wide statistics across all shifts and streams.

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
5. [How It Works — End to End](#how-it-works--end-to-end)
   - [Step 1: Stream & Shift Selection](#step-1-stream--shift-selection)
   - [Step 2: File Upload & Parsing](#step-2-file-upload--parsing)
   - [Step 3: Score Computation](#step-3-score-computation)
   - [Step 4: Dashboard Rendering](#step-4-dashboard-rendering)
   - [Step 5: Firebase Write Path](#step-5-firebase-write-path)
   - [Step 6: Live Stats Strip](#step-6-live-stats-strip)
   - [Step 7: Full Analysis Screen](#step-7-full-analysis-screen)
   - [Step 8: Community Screen](#step-8-community-screen)
6. [Supported File Formats](#supported-file-formats)
7. [Scoring Rules](#scoring-rules)
8. [Firebase Data Model](#firebase-data-model)
9. [Caching Strategy](#caching-strategy)
10. [IndexedDB — Question Image Persistence](#indexeddb--question-image-persistence)
11. [Session Persistence](#session-persistence)
12. [Export Capabilities](#export-capabilities)
13. [UI / Theme System](#ui--theme-system)
14. [Keyboard Shortcuts](#keyboard-shortcuts)
15. [Shift Schedule Reference](#shift-schedule-reference)
16. [Security & Privacy](#security--privacy)
17. [Known Limitations & Edge Cases](#known-limitations--edge-cases)
18. [Local Setup](#local-setup)
19. [Environment Notes](#environment-notes)

---

## Features

| Category | Feature |
|---|---|
| **Parsing** | Supports MHT-CET Objection Portal HTML saves, PDF response sheets, and pipe-delimited TXT exports |
| **Parsing** | Automatic section detection (Physics, Chemistry, Mathematics, Biology) |
| **Parsing** | PDF page rendering & per-question image cropping via pdf.js |
| **Dashboard** | Arc gauge score display with animated fill |
| **Dashboard** | Overall stats: score, correct, incorrect, unattempted, accuracy |
| **Dashboard** | Subject-wise doughnut charts (Physics, Chemistry, Mathematics / Biology) |
| **Dashboard** | Question-by-question table with status icons and thumbnail previews |
| **Dashboard** | Detail modal with full question image, candidate answer vs. correct answer |
| **Dashboard** | Filter bar: All / Correct / Incorrect / Unattempted / per-subject |
| **Dashboard** | Sidebar question grid with colour-coded status buttons |
| **Firebase** | Anonymous score submission with SHA-256 duplicate prevention |
| **Firebase** | Aggregate-only write (no raw submissions stored) |
| **Firebase** | Concurrent-safe transaction on the stats node |
| **Firebase** | 5-minute in-memory read cache |
| **Live Stats** | Post-submission brief strip: percentile, shift average, shift highest, ahead/behind counts |
| **Analysis** | Full analysis screen: percentile arc gauge, shift vs. shift comparisons, score histogram, radar chart, subject comparison bars, stream donut |
| **Analysis** | Per-shift drill-down with participant count, mean, median, highest, lowest |
| **Community** | Community screen: same charts but across all shifts/streams without requiring a personal upload |
| **Export** | CSV export of all question data |
| **Export** | PDF report (jsPDF, styled with corner brackets, score box, sectional table) |
| **Export** | PNG share card via html2canvas |
| **UX** | Dark/light theme with system preference detection and localStorage persistence |
| **UX** | Session restore via localStorage + IndexedDB (survives page refresh) |
| **UX** | Stream mismatch detection with one-click correction |
| **UX** | Confetti animation for scores ≥ 150 |
| **UX** | Lightbox for question image zoom |
| **UX** | Keyboard navigation (←/→ arrow keys, Escape) |
| **UX** | Drag-and-drop file upload with filename preview |
| **UX** | Mobile responsive with hamburger sidebar drawer |

---

## Tech Stack & Dependencies

All dependencies are loaded from CDN — no build step or `npm install` required.

| Library | Version | Use |
|---|---|---|
| **Firebase App (compat)** | 10.9.0 | App initialization |
| **Firebase Realtime Database (compat)** | 10.9.0 | Score aggregation & live analytics |
| **Chart.js** | 4.4.1 | All charts (bar, doughnut, radar, histogram) |
| **pdf.js** | 3.4.120 | PDF text extraction & page rendering |
| **canvas-confetti** | 1.9.3 | Celebration animation |
| **jsPDF** | 2.5.1 | PDF report export |
| **html2canvas** | 1.4.1 | Share card PNG generation |
| **Google Fonts — Inter** | — | Body typography |
| **Google Fonts — JetBrains Mono** | — | Monospace elements |

No framework (React, Vue, etc.) is used. The entire front-end is vanilla HTML/CSS/JavaScript.

---

## Project Structure

```
cetlens/
├── index.html      — Full page structure, all screens, CDN script tags
├── style.css       — Design system, neumorphic tokens, all component styles
├── script.js       — All application logic (parsing, rendering, UI state)
└── firebase.js     — Firebase config, aggregation helpers, write/read logic
```

Everything runs from a single directory. No bundler, no framework, no server required.

---

## File-by-File Reference

### index.html

The single HTML file that contains the skeleton for every screen in the application. Screens are `<div>` elements toggled via `display:none / flex` — there is no client-side router.

**Screens / overlays defined:**

| Element ID | Description |
|---|---|
| `#uploadScreen` | Landing / upload page. Contains brand, stream selector (PCM/PCB), attempt & shift dropdowns, drag-and-drop zone, and Community CTA banner. |
| `#loadingScreen` | Full-screen spinner overlay shown during file processing. Has a step label and sub-label updated in real time. |
| `#dashboard` | Main analysis dashboard. Contains the topbar, collapsible sidebar (question grid), and the content area (score card, metrics, question table, question viewer). |
| `#analysisScreen` | Full-screen detailed analysis view (Firebase-powered). Five sections: Your Position, Subject-wise, Score Distribution, Shift vs Shift, Stream Overview. |
| `#communityScreen` | Community-wide live analysis — same charts as analysisScreen but aggregated across all students, accessible before uploading. |
| `#mismatchOverlay` | Modal shown when the uploaded file's question count doesn't match the selected stream. |
| `#restoreOverlay` | Modal shown on page load if a previous session is found in localStorage. |
| `#qDetailOverlay` | Modal that opens when a row in the question table is clicked, showing the full question image and answer comparison. |
| `#lightbox` | Full-screen image lightbox triggered by clicking any question image. |
| `#shareCardEl` | Hidden off-screen div rendered by html2canvas to produce the shareable PNG score card. |
| `#landingPage` | Informational landing section with hero, "How It Works" steps, and testimonials. |

**Script loading order (bottom of `<body>`):**
1. `Chart.js` — must be before `script.js`
2. `pdf.js` — must be before `script.js`
3. `canvas-confetti`
4. `jsPDF`
5. `html2canvas`
6. `script.js` — app logic (last)

Firebase scripts are loaded in `<head>` and `firebase.js` immediately follows them so that `firebase.initializeApp()` runs before any script in `<body>`.

---

### style.css

3,261 lines of CSS built around a **industrial skeuomorphic / neumorphic** design language. Key systems:

**Design Tokens (CSS custom properties on `:root`)**

| Token | Default (light) | Purpose |
|---|---|---|
| `--background` | `#e0e5ec` | Base chassis colour |
| `--foreground` | `#f0f2f5` | Raised panel surface |
| `--accent` | `#ff4757` | Safety-red, used for scores, CTAs, highlights |
| `--shadow-card` | dual box-shadow | Neumorphic raised card |
| `--shadow-pressed` | inset dual box-shadow | Neumorphic pressed/recessed state |
| `--correct` | `#22c55e` | Green for correct answers |
| `--incorrect` | `#ef4444` | Red for incorrect answers |
| `--unattempted` | `#64748b` | Slate for unattempted |
| `--font-body` | `'Inter'` | Body copy |
| `--font-mono` | `'JetBrains Mono'` | Q numbers, codes |

**Dark Theme** — toggled via `[data-theme="dark"]` on `<html>`. The dark theme overrides all surface and text tokens to a deep charcoal/obsidian palette while keeping the `--accent` red.

**Key component classes:**

| Class | Description |
|---|---|
| `.upload-screen` / `.upload-container` | Two-column upload layout (left: controls, right: about panel) |
| `.mode-btn` | Stream selector buttons (PCM/PCB) with active state |
| `.upload-zone` | Drag-and-drop file area with drag animation |
| `.topbar` | Fixed top navigation bar with brand, file name, mode badge, and action buttons |
| `.main-layout` | Flex container for sidebar + content |
| `.sidebar` | Collapsible question grid sidebar (turns into a drawer on mobile) |
| `.score-tabs-card` | Tabbed card with Overall Score (arc gauge) and Subject-wise Score tabs |
| `.arc-gauge` | SVG arc gauge — paths animated via JS |
| `.metric-card` | Individual stat tile (score, correct, incorrect, accuracy) |
| `.q-table` / `.q-table-card` | Scrollable question list table |
| `.q-viewer` | Inline question detail panel (desktop) |
| `.q-detail-modal` | Modal question detail (triggered on table row click) |
| `.filter-chip` | Status/subject filter buttons |
| `.q-btn` | Question grid button in sidebar, coloured by status |
| `.analysis-card` | Card used throughout the analysis & community screens |
| `.live-brief-strip` | Post-submission stats banner |
| `.neu-testimonial` | Skeuomorphic sticky-note style testimonial cards |
| `.device` | CSS-only device mockup used in the hero section |
| `.led` | Animated green LED dot (used for "Live" badges) |
| `.community-cta-banner` | Gradient-bordered CTA card on the upload screen |

---

### script.js

The entire application logic in a single strict-mode JavaScript file (~800 lines). No modules, no imports — everything is global.

#### State Variables

| Variable | Type | Purpose |
|---|---|---|
| `questions` | `Array` | Full parsed question array for the current session |
| `filteredQs` | `Array` | Currently displayed subset (by filter) |
| `currentQ` | `Number` | Index into `filteredQs` for the active question |
| `examMode` | `String` | `'PCM'` or `'PCB'` |
| `donutChartInst` | `Chart` | Main doughnut chart instance (destroyed on reset) |
| `subjectChartInsts` | `Array<Chart>` | Per-subject doughnut chart instances |
| `pdfPageImages` | `Object` | Raw rendered canvas pages (freed after cropping) |
| `questionImages` | `Object` | `{ qId: dataURL }` — cropped question images |
| `questionPageMap` | `Object` | `{ qId: pageNumber }` — which PDF page each question is on |
| `selectedAttempt` | `String` | e.g. `'Attempt 1'` |
| `selectedShift` | `String` | e.g. `'11 April - Morning'` |
| `_pendingQs` | `Array\|null` | Buffered questions during stream mismatch flow |
| `_isProcessing` | `Boolean` | Mutex to prevent double-processing |
| `_analysisCharts` | `Object` | Chart instances on the analysis screen (destroyed on re-open) |
| `_communityCharts` | `Object` | Chart instances on the community screen |

#### Key Functions

**Initialization & Theme**

| Function | Description |
|---|---|
| `applyTheme()` | Reads `localStorage` or falls back to `prefers-color-scheme`. Sets `data-theme` on `<html>`. |
| `toggleTheme()` | Flips between `'light'` and `'dark'`, persists to `localStorage`. |
| `checkStoredSession()` | Reads `localStorage` for a previous session; if found, populates the restore modal. |

**File Handling**

| Function | Description |
|---|---|
| `handleFile(inp)` | Entry point from the file `<input>` `onchange` event. |
| `processFile(file)` | Routes to `processPDF()` or HTML/TXT text reading. Sets the `_isProcessing` mutex. |
| `processPDF(file)` | Full PDF pipeline: load via pdf.js → extract text per page → build a per-page Y-coordinate map of "Correct Option" lines → render pages at 1.8× scale → crop one canvas strip per question → store as JPEG data URLs. |
| `extractHTMLImages(htmlText)` | Currently a stub — external image paths from the portal don't resolve. |
| `classifyUploadError(file, err)` | Returns a user-friendly error string based on the file type and error message. |

**Parsers**

| Function | Description |
|---|---|
| `parsePortalText(text)` | Primary parser. Uses two regex patterns: `/Correct\s+Option\s*[:\s]\s*(\d{5,6})/gi` for correct answers and a lookahead for `Candidate Res...` to find the student's answer. Detects section from the preceding text block. Builds option ID → label (A/B/C/D) maps. |
| `parseRawData(raw)` | Parser for pipe-delimited `.txt` exports. Format: `qid|section|text|optId:text|...|correctOptId|candidateOptId`. |

Both parsers return a normalized array of question objects:

```js
{
  id,           // 1-based global index
  qid,          // 6-digit question ID from the portal
  section,      // 'Physics' | 'Chemistry' | 'Mathematics' | 'Biology'
  sectionNum,   // 1-based index within the section
  text,         // display label e.g. "Q1"
  correctLabel, // 'A' | 'B' | 'C' | 'D' | null
  candidateLabel,
  correctOptId, // raw 6-digit option ID
  candidateOptId,
  status,       // 'correct' | 'incorrect' | 'unattempted'
  marks         // 2 for PCM Mathematics correct, 1 for all others correct, 0 otherwise
}
```

**Stats Computation**

| Function | Description |
|---|---|
| `computeStats(qs)` | Returns `{ correct, incorrect, unattempted, earned, maxM, accuracy, subStats }`. `subStats` is an array per section with `{ s, c, e, mx, pct }`. |

**Dashboard Rendering**

| Function | Description |
|---|---|
| `renderDashboard(qs)` | Orchestrates all dashboard renders: metric cards, donut chart, bar chart, subject pie charts, score card, grid, question table, first question. |
| `renderScoreCard(st)` | Draws the SVG arc gauge and populates the stat pills and subject score rows. |
| `renderSubjectCharts(qs, unatColor)` | Creates one doughnut chart per section in the `#subjectChartsGrid`. |
| `renderGrid(qs)` | Renders the sidebar question grid (coloured buttons by status). |
| `renderQuestionTable()` | Renders the `<tbody>` of the question table from `filteredQs`. Includes thumbnail images where available. |
| `showQuestion(idx, scroll)` | Populates the inline question viewer with the question at `filteredQs[idx]`. Updates status badges, answer icons, marks pill, and image area. |
| `populateQDetail(q)` | Same as `showQuestion` but for the modal detail view. |
| `updateFilterCounts(qs)` | Re-renders the filter bar buttons with current counts per status and per section. |

**Navigation**

| Function | Description |
|---|---|
| `prevQ() / nextQ()` | Move through `filteredQs`. |
| `prevQDetail() / nextQDetail()` | Move through `filteredQs` inside the modal. |
| `jumpToQ(gi)` | Jump to a global question index; resets filter to 'all' if question is not in the current filter. |
| `setFilter(f, btn)` | Updates `filteredQs`, re-renders the table, shows first question. Supports `all`, `correct`, `incorrect`, `unattempted`, and section name filters. |
| `highlightQTableRow(qId)` | Adds `.q-table-active` to the matching table row and scrolls it into view within `#qTableCard` (deliberately scoped to avoid scrolling the outer page). |

**Screen Management**

| Function | Description |
|---|---|
| `showLoading()` | Hides upload/landing, shows spinner. |
| `showDash(qs)` | Hides spinner, shows dashboard, calls `renderDashboard`, saves session, triggers confetti if score ≥ 150. |
| `showDashRestored(qs)` | Same as `showDash` but skips Firebase write and only fetches the brief strip. |
| `resetApp()` | Tears down all charts, resets all state, clears localStorage and IndexedDB, returns to upload screen. |
| `openAnalysisScreen() / closeAnalysisScreen()` | Toggles the analysis screen and triggers `fetchFullAnalysis()`. |
| `openCommunityScreen() / closeCommunityScreen()` | Toggles the community screen and triggers `fetchCommunityFullAnalysis()`. |
| `openLightbox(src) / closeLightbox()` | Shows/hides the full-screen image lightbox. |
| `toggleSidebar() / closeSidebar()` | Toggles the mobile sidebar drawer. |

**Export Functions**

| Function | Description |
|---|---|
| `exportCSV()` | Builds a UTF-8 CSV string and triggers a download. |
| `exportPDF()` | Uses jsPDF to draw a styled A4 PDF with score box, stat row, and sectional breakdown table. |
| `generateShareCard()` | Populates `#shareCardEl`, renders it to canvas via html2canvas at 2× scale, triggers PNG download. |
| `triggerDownload(filename, mime, content)` | Generic Blob-based download helper. |

**Mismatch Flow**

| Function | Description |
|---|---|
| `finish(filename, qs)` | Checks if `qs.length` matches the opposite stream's expected count. If so, triggers the mismatch modal instead of loading the dashboard. |
| `showMismatchPopup(filename, qs, correctMode)` | Populates and opens the mismatch overlay. |
| `mismatchSwitchAndContinue()` | Switches `examMode`, recalculates marks, and calls `loadDash`. |
| `mismatchReupload()` | Closes the overlay and calls `resetApp()`. |

---

### firebase.js

Handles all Firebase Realtime Database interactions. It is intentionally separated from `script.js` so it can be swapped or disabled independently.

#### Configuration

```js
const firebaseConfig = {
  apiKey:            "...",
  authDomain:        "cetlens.firebaseapp.com",
  databaseURL:       "https://cetlens-default-rtdb.firebaseio.com",
  projectId:         "cetlens",
  storageBucket:     "cetlens.firebasestorage.app",
  messagingSenderId: "531158222764",
  appId:             "1:531158222764:web:912956a9796b9a3fa11c09",
  measurementId:     "G-QE27HLWH4Y"
};
```

> ⚠️ This API key is embedded in client-side code and should be protected by Firebase Security Rules. Anyone can read this key from the source — security is enforced at the database rule level, not by keeping the key secret.

#### In-Memory Cache

```js
const _fbCache = {};
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

Three cache helper functions:

| Function | Description |
|---|---|
| `_cacheGet(key)` | Returns cached value if TTL has not elapsed, otherwise `null`. |
| `_cacheSet(key, val)` | Stores value with current timestamp. |
| `_cacheInvalidate(prefix)` | Deletes all keys that start with `prefix`. Called after a successful write. |

#### Chart Utilities (shared with script.js)

| Function | Description |
|---|---|
| `getChartColors()` | Reads CSS custom property values at runtime so charts always match the current theme. Returns `{ text, muted, border, bg, accent }`. |
| `baseChartOptions(colors)` | Returns a Chart.js options object with responsive settings and themed tooltips/scales. Used as a spread base for all charts. |
| `drawArcGauge(svgEl, fillEl, ratio)` | Computes SVG path data for a semicircular arc gauge from 0 to `ratio` (0–1). Used for both the main score gauge and the percentile gauge. |

#### Data Utility Functions

| Function | Description |
|---|---|
| `statsPath(stream, attempt, shift)` | Returns the Firebase path string: `stats/{stream}/{attempt}/{shift}`. |
| `scoreLimitForStream(stream)` | Returns `150` for PCB, `200` for PCM. |
| `normalizeScore(score, stream)` | Clamps score to `[0, scoreLimit]`. |
| `incrementAggregate(current, payload)` | Pure function — merges a new submission into an existing aggregate node. Updates `count`, `sum`, `highest`, `min`, `scoreCounts` (histogram), and `subjectSums`. Used inside a Firebase transaction. |
| `countScores(scoreCounts, predicate)` | Counts total students matching a score predicate from the `scoreCounts` histogram object. |
| `expandScoreCounts(scoreCounts)` | Reconstructs a flat array of scores from the `{ score: count }` histogram. |
| `buildShiftMapFromStats(statsByShift)` | Converts the raw Firebase stats node into a `{ shiftName: { scores, scoreCounts, subjectSums, count, sum, highest, min } }` map for use in chart rendering. |
| `rawEntriesFromStats(statsByShift, stream, attempt, summary)` | Reconstructs a pseudo–raw-entries object from the aggregated stats for compatibility with the analysis renderer (which was originally written for individual submission records). |

#### Write Path: `saveSubmissionToFirebase(qs, st, filename)`

Exactly 3 Firebase operations:

1. **Read** — `hashes/{stream}/{shift}/{sha256hash}` — checks for duplicate submission.
2. **Write (transaction)** — `stats/{stream}/{attempt}/{shift}` — atomically updates the aggregate using `incrementAggregate`. Transactions handle concurrent submissions from multiple users safely.
3. **Write (multi-path update)** — updates `summary/total`, `summary/streams/{stream}`, and records the hash in a single round-trip.

The hash is generated by `generateAnswerHash(qs)` using `crypto.subtle.digest('SHA-256', ...)` on the concatenated string of all `questionId:candidateOptId` pairs. This makes the hash unique to a specific answer pattern — two students with the same answers would share a hash and only one would be recorded.

After writing, `_cacheInvalidate` is called for `analysisRaw:{stream}:{attempt}` and `community`.

#### Read Path: `fetchAnalysisRaw(db, stream, attempt)`

Reads `stats/{stream}/{attempt}` and `summary` in parallel. Caches the result. Returns reconstructed pseudo-raw entries.

#### Brief Strip: `fetchAndRenderBriefStrip(stream, attempt, shift, userScore, userSubStats)`

Reads only the single shift's stats node. Calculates percentile, computes students above/same/below, and calls `renderBriefStrip` to inject the HTML strip into `#liveStatsBrief`.

#### Full Analysis: `fetchFullAnalysis()`

Delegates to `fetchAnalysisRaw`, then:
- Builds a `shiftMap` from the returned entries (keyed by shift name)
- Computes user's percentile, median, mean within their shift
- Renders 7 charts: score compare bar, subject radar, score histogram, shift average bar (horizontal), participants per shift, highest per shift, subject avg grouped bar, stream donut
- Populates the per-shift drill-down selector
- Renders subject comparison progress bars

#### Community Analysis: `fetchCommunityFullAnalysis()` / `_renderCommunityData(payload)`

Reads `stats/PCM/Attempt 1`, `stats/PCB/Attempt 1`, and `summary` in parallel. Merges PCM and PCB shift maps. Renders: histogram, shift avg, participants per shift, highest per shift, subject avg by shift, stream donut. Uses a separate `_communityCharts` object so community and analysis screen charts don't interfere.

---

## How It Works — End to End

### Step 1: Stream & Shift Selection

The user selects PCM or PCB (sets `examMode`), then picks an Attempt from the dropdown. Selecting "Attempt 1" reveals the shift dropdown populated by `updateShifts()`. PCM shifts run April 11–20, PCB shifts run April 21–25. `validateSelection()` is checked on both file input click and drag-and-drop drop events.

### Step 2: File Upload & Parsing

`processFile(file)` sets `_isProcessing = true` and routes:

- **PDF** → `processPDF(file)`:
  1. pdf.js loads the file as an `ArrayBuffer`.
  2. Text is extracted page-by-page. Each page's text items are sorted top-to-bottom, left-to-right and concatenated into `fullText`.
  3. For each page, the Y-coordinate of each "Correct Option" label is recorded in `corrOptYByPage`.
  4. `parsePortalText(fullText)` extracts all questions.
  5. Each question is mapped to its source page via `questionPageMap`.
  6. Pages are rendered at 1.8× scale to canvases.
  7. Each question's bounding strip is computed from the Y-coordinates of its "Correct Option" label (bottom boundary) and the previous question's label (top boundary). Multi-page questions are stitched together.
  8. The cropped strips are stored as JPEG data URLs in `questionImages`.

- **HTML** → `file.text()` → `div.innerHTML` to strip tags → `parsePortalText(text)`
- **TXT** → `file.text()` → `parseRawData(text)`

If `qs.length === 0`, a descriptive error is thrown and `classifyUploadError` formats a friendly message.

### Step 3: Score Computation

`computeStats(qs)` iterates the question array:

- `correct` / `incorrect` / `unattempted` — filtered counts
- `earned` — sum of `q.marks`
- `maxM` — sum of max-possible marks per question
- `accuracy` — `correct / (correct + incorrect) * 100`
- `subStats` — per-section `{ c, e, mx, pct }` objects

**Marks rules:**
- PCM Mathematics correct: **+2 marks**
- All other correct answers: **+1 mark**
- Incorrect or unattempted: **0 marks** (no negative marking)

### Step 4: Dashboard Rendering

`showDash(qs)` → `renderDashboard(qs)`:

1. Metric cards injected into `#metricsGrid`
2. Main doughnut chart on `#donutChart` (correct / incorrect / unattempted)
3. Per-section doughnut charts in `#subjectChartsGrid`
4. Arc gauge SVG paths computed and set
5. Stat pills rendered
6. Subject-wise score rows rendered (Tab 2)
7. Sidebar grid rendered
8. Question table rendered
9. First question shown in the viewer
10. `saveSession()` called — persists to localStorage + IndexedDB

### Step 5: Firebase Write Path

`saveSubmissionToFirebase(qs, st, filename)` is called from `loadDash`:

1. Builds a `payload` with `{ attempt, shift, stream, score, subjects, timestamp }`.
2. Calls `generateAnswerHash(qs)` — SHA-256 of all `qid:candidateOptId` pairs.
3. Checks `hashes/{stream}/{shift}/{hash}` — if it exists, skips to rendering the brief strip (no duplicate write).
4. Runs a transaction on the stats aggregate.
5. Multi-path update: increments `summary/total`, `summary/streams/{stream}`, writes the hash record.
6. Calls `_cacheInvalidate` on affected cache keys.
7. Calls `fetchAndRenderBriefStrip`.

### Step 6: Live Stats Strip

After the write, `fetchAndRenderBriefStrip` reads the single shift node and injects into `#liveStatsBrief`:

- Your Percentile (`(total - above) / total * 100`)
- Shift Average
- Shift Highest
- Count ahead of you
- Total in shift
- "View Full Analysis →" button

### Step 7: Full Analysis Screen

Opened via the "Analysis" topbar button or the strip's CTA. `openAnalysisScreen()` destroys old charts, shows the loading spinner, and calls `fetchFullAnalysis()`.

`fetchFullAnalysis()` uses the cached `fetchAnalysisRaw()` result and renders across 5 sections:

**Section 01 — Your Position**
- Percentile arc gauge (same SVG component as the score gauge)
- Count cards: ahead / same score / below
- Key stats: shift average, shift highest, total participants
- Bar chart: You vs Shift Average vs Shift Highest

**Section 02 — Subject-wise Your Shift**
- Radar chart: Your subject scores vs Shift average subject scores
- Subject comparison bars: You vs Avg vs Max for each subject

**Section 03 — Score Distribution**
- Statistical summary: mean, median, mode, min, max, participants
- Score histogram (buckets of 20)
- Your score bucket highlighted in accent red

**Section 04 — Shift vs Shift**
- Horizontal bar chart: average score per shift
- Participants per shift bar chart
- Highest score per shift bar chart
- Subject average grouped bar chart (Physics / Chemistry / Math or Bio per shift)
- Per-shift drill-down: select any shift to see its stats table

**Section 05 — Stream Overview**
- PCM vs PCB participation doughnut
- Total analyzed, median, mean stat cards
- Anonymous data disclaimer

### Step 8: Community Screen

Accessible from the landing page CTA before uploading. Calls `fetchCommunityFullAnalysis()` which reads PCM and PCB stats and `summary` together, merges the shift maps, and renders the same chart set as the analysis screen but without any personal score overlay.

---

## Supported File Formats

| Format | How to obtain | Notes |
|---|---|---|
| `.html` / `.htm` | Save the MHT-CET Objection Tracker Portal response page using **File → Save As → Webpage, Complete** | Most reliable; includes section labels |
| `.pdf` | Download or print-to-PDF from the portal | Enables per-question image previews |
| `.txt` | Pipe-delimited export | Format: `qid\|section\|text\|optId:text\|...\|correctOptId\|candidateOptId` per line |

---

## Scoring Rules

| Stream | Section | Correct | Incorrect | Unattempted |
|---|---|---|---|---|
| PCM | Physics | +1 | 0 | 0 |
| PCM | Chemistry | +1 | 0 | 0 |
| PCM | Mathematics | **+2** | 0 | 0 |
| PCB | Physics | +1 | 0 | 0 |
| PCB | Chemistry | +1 | 0 | 0 |
| PCB | Biology | +1 | 0 | 0 |

Maximum scores: PCM = **200**, PCB = **150**.

There is no negative marking.

---

## Firebase Data Model

```
cetlens (Firebase Realtime Database)
├── stats/
│   ├── PCM/
│   │   └── Attempt 1/
│   │       └── {shiftName}/           e.g. "11 April - Morning"
│   │           ├── count              Number of submissions
│   │           ├── sum                Sum of all scores
│   │           ├── highest            Highest score seen
│   │           ├── min                Lowest score seen
│   │           ├── updatedAt          Server timestamp (ms)
│   │           ├── scoreCounts/
│   │           │   └── {score}: count  Histogram: score → number of students
│   │           └── subjectSums/
│   │               ├── Physics:    sumOfPhysicsScores
│   │               ├── Chemistry:  sumOfChemistryScores
│   │               └── Mathematics: sumOfMathScores
│   └── PCB/
│       └── Attempt 1/
│           └── {shiftName}/
│               └── (same structure)
│
├── summary/
│   ├── total              Total submissions across all streams
│   └── streams/
│       ├── PCM: count
│       └── PCB: count
│
└── hashes/
    └── {stream}/
        └── {shift}/
            └── {sha256hash}/
                └── timestamp
```

**Design decisions:**

- No raw submission documents are stored — only aggregates. This means the database scales regardless of how many students use the tool.
- The `scoreCounts` histogram allows percentile computation without storing individual scores.
- The `subjectSums` allow per-subject averages without per-student data.
- The `hashes` subtree serves as a deduplication index. A student submitting the same answers twice will hit the hash check and not increment any counters.
- All writes are in a single `update()` call (step 3) or a `transaction()` (step 2) to minimise round-trips.

---

## Caching Strategy

`firebase.js` maintains a module-level `_fbCache` object:

```js
const _fbCache = {};
const _CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
```

Cache keys in use:

| Key Pattern | Content | Invalidated by |
|---|---|---|
| `analysisRaw:{stream}:{attempt}` | `{ statsByShift, summary }` from Firebase | `saveSubmissionToFirebase` on a matching stream+attempt |
| `community` | `{ pcmStats, pcbStats, summary }` | `saveSubmissionToFirebase` (any submission) |

If a user submits and then re-opens the analysis screen within 5 minutes, the data will be fresh (cache was invalidated by the write). If they open it without submitting (e.g. from the Community CTA), the first read is cached for 5 minutes — re-opening within that window costs zero Firebase reads.

---

## IndexedDB — Question Image Persistence

Question images (JPEG data URLs cropped from PDF pages) can be large. They are stored in an IndexedDB object store `questionImages` in database `CETLensDB` (version 1).

| Function | Behaviour |
|---|---|
| `openImageDB()` | Opens/creates the database, creates `questionImages` store on `upgradeneeded`. |
| `saveImagesToIDB(images)` | Clears the store then writes all `{ qId: dataURL }` entries. Called from `saveSession()` as fire-and-forget. |
| `loadImagesFromIDB()` | Reads all entries via a cursor. Called during `restoreSession()` before rendering the dashboard. |
| `clearImagesFromIDB()` | Called by `resetApp()` to free storage. |

The store holds only one session at a time (it is `clear()`ed before each save).

---

## Session Persistence

When a dashboard is shown (`showDash`), `saveSession(filename, qs)` stores:

```js
localStorage.setItem('examSession', JSON.stringify({
  questions, examMode, filename, timestamp, selectedAttempt, selectedShift
}));
```

On next page load, `checkStoredSession()` runs inside `DOMContentLoaded`. If a valid session is found, the restore modal is shown with the filename, mode, question count, and relative time since last use.

- **Restore** → `restoreSession()` — loads images from IndexedDB first, then calls `showDashRestored(qs)` (no Firebase write, but fetches brief strip).
- **Start Fresh** → `dismissRestore()` — clears `window._storedSession`.

`resetApp()` explicitly calls `localStorage.removeItem('examSession')` and `clearImagesFromIDB()`.

---

## Export Capabilities

### CSV Export

Column order: `Q#`, `Section`, `Section Q#`, `Status`, `Correct Option ID`, `Candidate Option ID`, `Marks`. Values are double-quoted and internal quotes are escaped. The filename is derived from the uploaded file name (extension stripped) + `_analysis.csv`. A BOM (`\uFEFF`) is prepended for Excel compatibility.

### PDF Export

Built with jsPDF (A4 portrait, mm units). Layout:

1. Light neumorphic background fill
2. Top accent rule (red)
3. Corner bracket decorations
4. CETLens title + subtitle
5. Horizontal rule
6. File metadata (filename, mode, date, question count)
7. Score box with large score, /maxM, and "TOTAL SCORE" label
8. Four stat boxes in a row (Correct, Incorrect, Unattempted, Accuracy)
9. Section divider + "SECTIONAL BREAKDOWN" heading
10. Table header row
11. One row per subject (subject name, total questions, correct, incorrect, score)
12. Footer with attribution and privacy note

### Share Card PNG

An off-screen `#shareCardEl` div (600×330px) is populated with the score, mode, correct/incorrect/accuracy, subject abbreviations, and date. `html2canvas` renders it at 2× scale (1200×660px) and it is downloaded as a PNG named `score_card_{mode}_{score}_{timestamp}.png`.

---

## UI / Theme System

**Toggle** — `toggleTheme()` flips `data-theme` on `<html>` between `'light'` and `'dark'`. Three theme toggle buttons exist: one on the upload screen (`#uploadThemeBtn`), one in the dashboard topbar (`#dashThemeBtn`), and one in the analysis/community screen topbar.

**Persistence** — The theme is stored in `localStorage` under key `examAnalyzerTheme`. On page load, `applyTheme()` reads localStorage; if no preference is saved, it falls back to `window.matchMedia('(prefers-color-scheme: dark)')`.

**Charts** — `getChartColors()` reads computed CSS property values at render time, so charts automatically use the correct colours for whichever theme is active.

---

## Keyboard Shortcuts

| Key | Context | Action |
|---|---|---|
| `←` Arrow | Dashboard (no modal open) | Previous question in filtered list |
| `→` Arrow | Dashboard (no modal open) | Next question in filtered list |
| `←` Arrow | Question detail modal open | Previous question in modal |
| `→` Arrow | Question detail modal open | Next question in modal |
| `Escape` | Anywhere | Closes question detail modal, lightbox, and sidebar (in priority order) |

---

## Shift Schedule Reference

### PCM (Physics, Chemistry, Mathematics) — Attempt 1

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

### PCB (Physics, Chemistry, Biology) — Attempt 1

| Date | Sessions |
|---|---|
| 21 April | Morning, Evening |
| 22 April | Morning, Evening |
| 23 April | Morning, Evening |
| 24 April | Morning, Evening |
| 25 April | Morning, Evening |

---

## Security & Privacy

- **All parsing is local.** The uploaded file is never sent to any server. Parsing happens entirely in the browser using JavaScript `File.text()` or pdf.js.
- **No personal information is sent to Firebase.** The only data uploaded is the aggregated score, stream, attempt, shift, per-subject scores, and the SHA-256 hash of the answer pattern. Names, IDs, roll numbers, and question images are never transmitted.
- **Firebase API key is client-side.** This is expected for Firebase web apps. Security is enforced through Firebase Security Rules at the database level — the API key itself is not a secret.
- **Duplicate prevention is hash-based.** The SHA-256 hash ensures the same answer sheet cannot inflate community statistics — even if the page is refreshed or the file uploaded again.
- **Session data in localStorage** is stored only on the user's own device and is never transmitted. It is cleared on reset.

---

## Known Limitations & Edge Cases

- **Scanned PDFs** — pdf.js cannot extract text from image-only (scanned) PDFs. In this case, `parsePortalText` will return 0 questions and an appropriate error is shown. Using the HTML version is recommended.
- **Question image cropping accuracy** — The cropping algorithm relies on the Y-coordinate of "Correct Option" label occurrences in the PDF. If a question spans pages, the stitching logic handles it, but unusual PDF layouts may produce misaligned crops.
- **Section detection fallback** — If a section label (Physics, Chemistry, etc.) cannot be found in the text preceding a question, the parser falls back to positional inference: questions 1–50 → Physics, 51–100 → Chemistry, 101+ → Mathematics/Biology. This is only a fallback for edge cases.
- **HTML relative image paths** — The MHT-CET portal response sheet references question images via relative file paths. When saving as HTML, browsers save local copies in a companion folder. If the HTML file is uploaded without the companion folder, `extractHTMLImages` cannot resolve the images (it is currently a stub). Upload the PDF for image support.
- **PCB Mathematics** — PCB does not have Mathematics. If `examMode === 'PCB'` and a Mathematics section is somehow present, marks would be calculated as +1 (the PCM +2 rule is explicitly conditional on `examMode === 'PCM'`).
- **Community analytics scope** — The community screen currently only reads `Attempt 1` data. Future attempts would require additional Firebase reads.
- **No authentication** — All Firebase reads and writes are anonymous. The hash-based deduplication is the only anti-abuse mechanism.
- **localStorage quota** — `saveSession` catches quota-exceeded errors silently. If the questions array is very large, it may not save. IndexedDB is used for images to avoid this.

---

## Local Setup

CETLens requires no build tools. To run locally:

```bash
# Clone or copy all four files into a directory
# Then serve with any static file server, e.g.:

npx serve .
# or
python3 -m http.server 8080
# or simply open index.html in a browser
```

> **Note:** Opening `index.html` directly as a `file://` URL works for most features. However, pdf.js workers and some `crypto.subtle` calls require a proper HTTP context (localhost or HTTPS). Use a local server if PDF processing doesn't work.

### Firebase

The project connects to the live `cetlens` Firebase project. If you want to run your own instance:

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com).
2. Enable Realtime Database.
3. Replace the `firebaseConfig` object in `firebase.js` with your project's config.
4. Set database rules to allow authenticated or unauthenticated reads/writes as appropriate.

---

## Environment Notes

- **Browser support** — Requires a modern browser with ES2017+ support, `crypto.subtle` (HTTPS or localhost), `IndexedDB`, `CSS Custom Properties`, and `ResizeObserver`. Works in Chrome, Firefox, Edge, and Safari 15+.
- **Mobile** — Fully responsive. The sidebar collapses into a slide-in drawer triggered by a hamburger button. Charts are `responsive: true` in Chart.js.
- **No server-side component** — This is a completely static site. It can be hosted on GitHub Pages, Netlify, Vercel, Firebase Hosting, or any CDN.
- **Offline** — Parsing and dashboard rendering work offline. Firebase features (brief strip, analysis screen, community screen) require an internet connection.

---

*Built with ❤️ by Swanand Jaju — WCE Sangli, 2026*
