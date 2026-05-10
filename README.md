# CETLens

**Instant MHT-CET Response Sheet Analyzer with Live Community Analytics**

Upload your official MHT-CET Objection Portal response sheet — HTML, PDF, or pipe-delimited TXT — and get a fully interactive analytics dashboard in seconds. No account, no server, no installation. Everything runs in your browser.

**Live:** [https://cet-lens.vercel.app](https://cet-lens.vercel.app)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Problem Statement](#problem-statement)
3. [Key Features](#key-features)
4. [Tech Stack](#tech-stack)
7. [Architecture and Application Flow](#architecture-and-application-flow)
8. [Folder Structure](#folder-structure)
9. [Installation and Local Setup](#installation-and-local-setup)
10. [Environment Variables and Backend Setup](#environment-variables-and-backend-setup)
11. [Local Development](#local-development)
12. [Deployment](#deployment)
13. [Database Structure and Backend Explanation](#database-structure-and-backend-explanation)
14. [Authentication Flow](#authentication-flow)
15. [Supabase API Usage](#supabase-api-usage)
16. [Core Functionalities in Detail](#core-functionalities-in-detail)
17. [Security Considerations](#security-considerations)
18. [Performance Optimizations](#performance-optimizations)
19. [Known Limitations](#known-limitations)
20. [License](#license)

---

## Project Overview

CETLens is a zero-dependency, fully static single-page application built for MHT-CET aspirants. It accepts the official response sheet that NTA/State CET Cell publishes on the Objection Portal — the same file students download to check their answers — and turns it into a rich, readable dashboard.

The dashboard shows your total score, a subject-wise breakdown, a per-question status table with option comparisons, and question images cropped directly from your PDF if you uploaded one. Beyond your own results, CETLens anonymously aggregates scores from all students who use the app and surfaces live community statistics: shift-wise averages, percentiles, score distributions, and subject performance — without collecting any personal data.

The entire parsing and scoring pipeline runs client-side using vanilla JavaScript. The only server interaction is anonymous, aggregated analytics written to and read from a Supabase Postgres database. There is no login wall, no tracking, and no account required.

---

## Problem Statement

After every MHT-CET attempt, students are left with a raw response sheet — an HTML page or PDF that lists question IDs, option IDs, and correct option IDs in a format that is genuinely difficult to read. The Objection Portal shows you what you answered, but it does not calculate your score, break it down by subject, show your accuracy, or tell you where you stand relative to others in your shift.

The result is that students manually count correct and incorrect answers, or wait for coaching institutes to publish "estimated cut-offs" that are often inaccurate or shift-specific. There is no official, fast, or reliable way to get a clear picture of your actual performance immediately after the exam.

---

## Key Features

### File Parsing

- **Three input formats supported:** HTML saves from the MHT-CET Objection Portal, PDF response sheets, and pipe-delimited TXT exports. Each uses a separate parsing strategy internally.
- **Automatic section detection:** The parser identifies Physics, Chemistry, Mathematics, and Biology sections by matching label text in the response sheet. If labels are missing (which happens in some portal exports), it falls back to positional inference based on question count thresholds.
- **PDF text extraction and image cropping:** When a PDF is uploaded, CETLens uses pdf.js to extract the text layer for parsing, and then renders each page to a canvas element. Each question's bounding box is detected from text positions, and a per-question image crop is stored in IndexedDB. These question images show up as inline thumbnails in the dashboard and can be opened full-screen in a lightbox.
- **Stream detection and mismatch handling:** The app detects whether the uploaded sheet is PCM (Physics, Chemistry, Mathematics) or PCB (Physics, Chemistry, Biology). If the uploaded file's question count doesn't match the selected stream, a mismatch overlay offers a one-click correction to switch stream mode without re-uploading.

### Dashboard

- **Arc gauge score display:** An SVG-based semicircular gauge fills proportionally to your score relative to the maximum (200 for PCM, 150 for PCB), rendered using trigonometric path calculations rather than a library.
- **Score statistics row:** Correct, incorrect, unattempted, and accuracy percentage are displayed in metric tiles immediately below the gauge.
- **Subject-wise doughnut charts:** Individual Chart.js doughnut instances for each subject, showing earned vs maximum marks.
- **Question-by-question table:** A scrollable table listing every question with its section, status icon, marks obtained, and a thumbnail image if a PDF was uploaded.
- **Filter chips:** Filter the question table by All, Correct, Incorrect, Unattempted, or by individual subject. Filters update the visible table rows and keep the sidebar in sync.
- **Sidebar question grid:** A colour-coded grid of numbered buttons — green for correct, red for incorrect, grey for unattempted — that mirrors the filter state and jumps to any question on click.
- **Question detail modal:** A full-screen overlay showing the question image, selected option vs correct option with clear visual labels, and marks obtained. Navigable with arrow keys.
- **Lightbox:** Clicking any question image opens a full-screen lightbox for reading question text clearly.
- **Keyboard navigation:** Left and right arrow keys navigate questions in both the dashboard panel and the detail modal. Escape closes any open overlay.
- **Confetti:** Scores of 150 or above trigger a three-burst confetti animation on dashboard load.

### Community and Live Analytics

- **Post-submission brief strip:** Immediately after a new upload is processed, a banner appears showing your percentile, your shift's average, the shift's highest recorded score, and how many students scored above and below you. This data comes from Supabase in real time.
- **Shift-wise analysis screen:** A dedicated full-screen view showing your position within your shift — a percentile arc gauge, score histogram, radar chart comparing your subject scores against shift averages, a bar chart of subject-wise comparison, and statistical cards with mean, median, and participant count.
- **Community screen:** Accessible directly from the upload page without needing to upload a file. Shows aggregate data across all shifts and both streams — score distribution histogram, shift-vs-shift average comparison, participants per shift, highest score per shift, subject-wise averages per shift, and a drill-down selector for any individual shift. PCM vs PCB participation is shown as a donut chart alongside overall mean, median, and total student count.

### Session and State Management

- **localStorage session restore:** When a dashboard is shown, the parsed question array, exam mode, filename, selected attempt and shift, and a timestamp are serialised to localStorage. On the next page load, a restore modal offers to resume the previous session.
- **IndexedDB for question images:** PDF-derived question images are too large for localStorage. They are stored in a separate IndexedDB object store (`CETLensDB / questionImages`) and loaded back during session restore.
- **Hash-based deep links:** The URL updates to `#dashboard`, `#analysis`, or `#community` as you navigate. Sharing or bookmarking `/#dashboard` restores your session silently, without showing the restore modal. `/#community` works even without a saved session.

### Exports

- **CSV export:** Downloads a spreadsheet of all questions with columns for question number, section, section-relative number, status, correct option ID, candidate option ID, and marks.
- **PDF report:** Generates a styled A4 PDF using jsPDF — branded header, file metadata, large score display, four-column stats row (correct, incorrect, unattempted, accuracy), and a per-subject sectional breakdown table with a footer privacy note.
- **Share card PNG:** Renders a hidden off-screen score card element using html2canvas and downloads it as a PNG — designed to be posted on social media or sent to friends.

### UX Details

- **Dark and light theme:** The theme toggle respects `prefers-color-scheme` as a default if no preference is stored, and persists the manual choice in localStorage.
- **Drag-and-drop upload:** The drop zone highlights on dragover and previews the filename before the file is dropped.
- **Mobile-responsive layout:** The sidebar collapses into a hamburger-triggered drawer on small screens. The dashboard layout stacks vertically. Charts resize correctly.
- **Loading steps:** A labelled step display (Extracting text → Parsing questions → Rendering images → Calculating scores) keeps the user informed during PDF processing, which can take a few seconds on large files.

---

## Tech Stack

All libraries are loaded from public CDNs. There is no npm, no bundler, and no build step.

| Library / Tool | Version | Purpose |
|---|---|---|
| **Supabase JS** | 2.x (UMD) | Postgres-backed anonymous score aggregation and live analytics reads |
| **Chart.js** | 4.4.1 | Bar, doughnut, radar, and histogram charts throughout the app |
| **pdf.js** | 3.4.120 | PDF text extraction for parsing, and page canvas rendering for question images |
| **canvas-confetti** | 1.9.3 | Celebration animation on high scores |
| **jsPDF** | 2.5.1 | Client-side PDF report generation |
| **html2canvas** | 1.4.1 | Rasterising the share card element to a downloadable PNG |
| **Google Fonts — Inter** | — | Primary UI typeface |
| **Google Fonts — JetBrains Mono** | — | Monospace elements, score numerals |

No framework is used. CETLens is vanilla HTML, CSS, and JavaScript.

**Browser APIs in use:**

- `IndexedDB` — question image persistence across sessions
- `localStorage` — session state and theme preference
- `crypto.subtle` (SHA-256) — duplicate submission fingerprinting
- `FileReader` / `DataTransfer` — file input and drag-and-drop
- `ResizeObserver` — responsive chart redraws
- `history.pushState` — hash-based URL management

---

## Architecture and Application Flow

CETLens is a single-page application with no server-side rendering. Every "screen" — upload, loading, dashboard, analysis, community — is a DOM section that gets shown or hidden by JavaScript. Navigation is managed client-side using a hash router.

**High-level flow:**

```
User opens page
  └─ applyTheme() — sets light/dark from localStorage or prefers-color-scheme
  └─ checkStoredSession() — if a session exists, shows restore modal
  └─ [router.js] handleRoute() — if URL hash is #dashboard or #analysis,
       silently restores session and skips the restore modal entirely

User selects stream (PCM/PCB), attempt, and shift
User drops or selects a response sheet file

processFile(file)
  ├─ HTML → parsePortalHTML(text) — DOM parsing via DOMParser
  ├─ PDF  → parsePDF(arrayBuffer)
  │    ├─ pdf.js text extraction → parsePortalText(text)
  │    └─ pdf.js page rendering → canvas crops → saveImagesToIDB()
  └─ TXT  → parseTXT(text) — pipe-delimited format

Questions array built → computeStats(qs)
  └─ Per-question mark calculation (+2 correct, -0.5 incorrect for PCM;
       +4 correct, -1 incorrect per section for Biology in PCB)

showDash(qs)
  ├─ renderDashboard(qs) — arc gauge, metric tiles, charts, table, sidebar
  ├─ saveSession(filename, qs) → localStorage + IndexedDB
  ├─ saveSubmissionToSupabase() → anonymous aggregate write
  └─ fetchAndRenderBriefStrip() → live stats pull for post-submission banner

User opens Analysis screen
  └─ fetchFullAnalysis() — reads shift_stats from Supabase
       └─ Renders percentile gauge, histogram, radar, bar charts

User opens Community screen
  └─ fetchCommunityFullAnalysis() — reads all PCM + PCB Attempt 1 data
       └─ Renders cross-shift overview charts
```

**Script loading order in index.html:**

```
1. analytics.js    — loaded early; defines chart helpers and Supabase read functions
2. supabase CDN    — UMD bundle, required before supabase.js runs
3. supabase.js     — creates window._supabaseClient
4. Chart.js CDN
5. pdf.js CDN
6. canvas-confetti CDN
7. jsPDF CDN
8. html2canvas CDN
9. script.js       — all core app logic; references window._supabaseClient
10. router.js      — wraps existing screen functions; must load after script.js
```

The router wraps functions like `showDash`, `openAnalysisScreen`, and `openCommunityScreen` at load time by capturing references to the originals, adding `history.pushState` calls, and reassigning the global names. This is why the order matters — if `router.js` loaded before `script.js`, those globals would not exist yet.

---

## Folder Structure

```
cetlens/
│
├── index.html        Single HTML file containing all screen markup, CDN imports, and scoped styles
├── style.css         Full design system — CSS custom properties, light/dark themes, every component
├── script.js         Core application logic: parsing, scoring, dashboard rendering, modals, exports
├── analytics.js      Supabase analytics: read/write helpers, chart rendering for analysis and community screens
├── supabase.js       Supabase client initialisation (createClient call, stored at window._supabaseClient)
├── router.js         Hash-based router — wraps screen functions, handles popstate and initial URL dispatch
│
├── LICENSE           MIT
└── README.md         This file
```

**Why no `src/`, `dist/`, or `components/` directories?**

CETLens has no build pipeline. Every file is served as-is. Splitting into subdirectories would add complexity without benefit for a project of this scope. The five JavaScript and CSS files are small enough to navigate directly, and keeping everything flat makes local development as simple as `python3 -m http.server`.

---

## Installation and Local Setup

CETLens requires no installation beyond a browser and a static file server. The only reason to use a server at all (rather than opening `index.html` directly) is that `crypto.subtle` and pdf.js workers require a secure context — `localhost` or HTTPS.

**Clone the repository:**

```bash
git clone https://github.com/swanandjaju/CETLens.git
cd CETLens
```

**Start a local server using any of the following:**

```bash
# Python (built-in, no install needed)
python3 -m http.server 8080

# Node.js via npx (no global install needed)
npx serve .

# VS Code Live Server extension
# Right-click index.html → "Open with Live Server"
```

Then open `http://localhost:8080` in your browser.

---

## Environment Variables and Backend Setup

CETLens has no `.env` file. The Supabase configuration is inlined directly in `supabase.js`:

```js
const SUPABASE_URL  = 'https://<your-ref>.supabase.co';
const SUPABASE_ANON = '<your-anon-key>';
```

The `SUPABASE_ANON` key is the public anonymous key, not the service role key. It is intentionally embedded in client-side code — Supabase's Row Level Security (RLS) policies are what actually control what the anonymous client can and cannot do. Embedding the anon key is the standard pattern for Supabase browser clients.

**To run a separate instance with your own Supabase project:**

1. Create a new project at [supabase.com](https://supabase.com).
2. Create the required tables (see [Database Structure](#database-structure-and-backend-explanation) below).
3. Configure Row Level Security policies on those tables.
4. Replace `SUPABASE_URL` and `SUPABASE_ANON` in `supabase.js` with your project's values.
5. No other configuration is needed.

---

## Local Development

There is no watch mode, hot reload, or compile step. Edit any file and refresh the browser.

For working on the PDF parsing logic, open the browser DevTools console — `processFile()` and the parser functions log useful intermediate state. The `_fbCache` object in `analytics.js` is accessible at `window._fbCache` in the global scope if you need to inspect or manually invalidate cached Supabase reads.

For Supabase interaction, the client is at `window._supabaseClient` after page load. You can call it directly from the DevTools console to inspect table data:

```js
const { data } = await window._supabaseClient.from('shift_stats').select('*');
console.table(data);
```

**Linting and formatting:**

There is currently no ESLint or Prettier configuration. The codebase uses `'use strict'` in the main JS files and follows consistent spacing and naming conventions. If you add linting, a `.eslintrc` targeting ES2017 browser globals is appropriate.

---

## Deployment

CETLens is a static app and can be deployed to any service that serves static files over HTTPS.

**Vercel (current deployment):**

```bash
# Install Vercel CLI once
npm i -g vercel

# Deploy from project root
vercel
```

No `vercel.json` configuration is required since there is no routing that needs server-side rewriting — hash-based navigation is handled entirely client-side.

**Netlify:**

Drag and drop the project folder into the Netlify dashboard, or connect the GitHub repository. The build command is blank and the publish directory is the root `/`.

**GitHub Pages:**

Push the repository to GitHub and enable Pages in repository settings, pointing at the `main` branch root. The site will be available at `https://<username>.github.io/CETLens/`.

**Note on HTTPS requirement:**

`crypto.subtle` (used for SHA-256 duplicate fingerprinting) and pdf.js workers both require a secure context. Ensure your deployment is served over HTTPS, which all of the above services provide by default. `localhost` also counts as a secure context for local development.

---

## Database Structure and Backend Explanation

CETLens uses two Supabase tables. Raw response sheets or individual question data are never sent to the server. The only data written is anonymised, pre-aggregated, and structured so that individual users cannot be identified or reconstructed.

### `shift_stats`

Stores running aggregate statistics keyed by stream, attempt, and shift. Each row represents one (stream, attempt, shift) combination.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` | Primary key |
| `stream` | `text` | `PCM` or `PCB` |
| `attempt` | `text` | e.g. `Attempt 1`, `Attempt 2` |
| `shift` | `text` | e.g. `11 April - Morning` |
| `count` | `integer` | Number of submissions for this shift |
| `total_score` | `numeric` | Sum of all scores — used with `count` to compute average |
| `highest` | `integer` | Highest score recorded for this shift |
| `min_score` | `integer` | Lowest score recorded for this shift |
| `score_counts` | `jsonb` | Frequency map of scores, e.g. `{"142": 3, "167": 1}` — used for histograms and percentile calculation |
| `subject_sums` | `jsonb` | Sum of subject scores, e.g. `{"Physics": 420, "Chemistry": 310}` — divided by `count` for subject averages |
| `updated_at` | `timestamptz` | Last write timestamp |

The `score_counts` JSONB column is the key design decision here. Rather than storing individual scores as separate rows (which would grow linearly with submissions and allow score-sequence reconstruction), CETLens uses a frequency map. A score of 142 appearing 3 times is stored as `"142": 3`. This structure supports histogram rendering, percentile computation, and statistical calculations (mean, median, mode) while being compact and irreversible back to individual records.

### `submission_summary`

A single-row (or small set of rows) table storing overall submission counts and global statistics, used to populate the community overview panel. The exact schema mirrors `shift_stats` but without the shift key, aggregating across all shifts for a given stream and attempt.

### Write Strategy

When a new response sheet is successfully parsed and the dashboard is shown for the first time (`showDash`, not `showDashRestored`), `saveSubmissionToSupabase()` is called. It:

1. Computes a SHA-256 hash of the candidate's answer pattern (the sequence of answered option IDs).
2. Checks whether this hash has been submitted before by reading a `submitted_hashes` record or checking a local flag in sessionStorage.
3. If it's a new submission, performs an upsert on the `shift_stats` row for the matching (stream, attempt, shift), incrementing all aggregate fields.

The upsert uses Supabase's built-in atomic update capability to avoid race conditions when multiple users submit simultaneously. No transaction lock is needed because the update operations are additive and commutative.

Session restores (`showDashRestored`) explicitly skip the Supabase write — the comment in the source code makes this clear — so refreshing or reopening a saved session does not inflate submission counts.

---

## Authentication Flow

CETLens has no user authentication. Every Supabase interaction uses the anonymous public key. There is no login, no session token, and no user identity on the server side.

Duplicate submission prevention is handled by SHA-256 fingerprinting of the answer pattern rather than user identity. A device that clears its sessionStorage and re-uploads the same response sheet would generate the same hash and be deduplicated server-side.

**Row Level Security:**

The Supabase tables should have RLS policies that:

- Allow anonymous `SELECT` (read) on `shift_stats` and `submission_summary`.
- Allow anonymous `INSERT` and `UPDATE` on `shift_stats` only for the aggregate upsert operation.
- Deny `DELETE` to all anonymous users.

This prevents anyone from clearing or tampering with the aggregate data using the public anon key, while still allowing the app to write and read normally.

---

## Supabase API Usage

`analytics.js` handles all Supabase interactions. The client is accessed via `window._supabaseClient`, which is initialised in `supabase.js` after the CDN bundle loads.

**Reading shift stats:**

```js
const { data, error } = await sb
  .from('shift_stats')
  .select('*')
  .eq('stream', stream)
  .eq('attempt', attempt);
```

**Reading summary:**

```js
const { data, error } = await sb
  .from('submission_summary')
  .select('*');
```

**Writing an aggregated submission (upsert):**

The write logic increments `count`, `total_score`, updates `highest` and `min_score`, merges the new score into `score_counts`, and merges subject scores into `subject_sums`. Because JSONB merging at the database level requires some care, the current implementation reads the existing row, updates the object in JavaScript using `incrementAggregate()`, and writes it back. This is an optimistic update pattern — acceptable given that exact-to-the-integer consistency on aggregate stats is not critical for the percentile and comparison use case.

**In-memory cache:**

Every Supabase read result is cached in `_fbCache` with a 15-minute TTL. The cache key pattern is:

```
analysisRaw:{stream}:{attempt}   → shift stats for one stream/attempt
community                        → PCM + PCB combined data for the community screen
```

The cache is invalidated by prefix after a new write, so a student who submits and then opens the analysis screen will always fetch fresh data rather than seeing pre-submission numbers.

---

## Core Functionalities in Detail

### Response Sheet Parsing

The parser in `script.js` uses regular expressions and text heuristics rather than a fixed schema, because the MHT-CET portal exports are not structured documents — they are rendered HTML or PDFs that vary in layout across years and NIC portal versions.

**Text extraction flow for PDF:**

1. `pdfjsLib.getDocument(arrayBuffer)` loads the PDF.
2. Each page is processed with `page.getTextContent()`, and the text items are concatenated with whitespace normalisation.
3. The combined text string is passed to `parsePortalText()`.
4. Simultaneously, each page is rendered to a canvas using `page.render()`, and text positions from `getTextContent()` are used to infer per-question bounding boxes for image cropping.

**Core parsing logic (`parsePortalText`):**

The regex `/Correct\s+Option\s*[:\s]\s*(\d{5,6})/gi` anchors each question — every question in the response sheet has a "Correct Option:" field followed by a 5-6 digit option ID. This is the stable pattern across portal exports.

For each match, the parser looks backward to find:
- The question's internal ID (a 6-digit number starting with `2`).
- The section label (Physics, Chemistry, Mathematics, Biology).
- All available option IDs (6-digit numbers starting with `3`).
- The candidate's selected option ID immediately after the correct option.

Options are sorted numerically and assigned labels A, B, C, D. This allows the dashboard to display "Option B" rather than a raw option ID.

**Scoring rules:**

| Stream | Subject | Correct | Incorrect | Unattempted |
|---|---|---|---|---|
| PCM | Mathematics | +2 | 0 | 0 |
| PCM | Physics, Chemistry | +1 | 0 | 0 |
| PCB | Physics, Chemistry, Biology | +1 | 0 | 0 |

There is no negative marking. Max score is 200 for PCM (50 Math × 2 + 50 Physics × 1 + 50 Chemistry × 1) and 150 for PCB (50 × 3).

### Chart Rendering

All charts in `analytics.js` read their colours from CSS custom properties at render time via `getChartColors()`. This is what makes charts correctly adapt to theme switches — rather than hardcoding hex values in the chart config, colour values are pulled from `getComputedStyle(document.documentElement)` when the chart is first created. Charts are destroyed and recreated on each screen open to avoid stale canvas state.

### Arc Gauge

The arc gauge on the dashboard and the percentile gauge on the analysis screen are raw SVG paths computed with trigonometry in `drawArcGauge()`. The function calculates the start and end points of a semicircular arc using `Math.cos` and `Math.sin`, then constructs an SVG arc path string. This avoids any gauge library dependency and keeps the visual fully CSS-themeable.

---

## Security Considerations

**File processing is client-side only:** The uploaded response sheet is read by the browser's `FileReader` API and parsed in JavaScript. The raw file content is never sent to any server. This is verifiable by running the app with network requests blocked in DevTools — the parsing and dashboard rendering work completely offline.

**What Supabase receives:** The only outbound network requests are to the Supabase API. These requests contain:
- The stream (PCM or PCB).
- The attempt (Attempt 1 or 2).
- The shift (e.g. "11 April - Morning").
- The total score as an integer.
- Per-subject scores as a key-value object.
- A SHA-256 hash of the candidate's answer pattern.

No name, roll number, registration ID, date of birth, or any other personally identifiable information is transmitted or stored.

**SHA-256 fingerprint:** The answer pattern hash is computed using `crypto.subtle.digest('SHA-256', ...)` — the Web Crypto API — which is available only in secure contexts (HTTPS or localhost). The hash is one-way: it prevents the same student from inflating the submission count by re-uploading, but it cannot be used to reconstruct the original answers.

**Supabase anon key:** The public anonymous key in `supabase.js` is not a secret. Row Level Security policies on the Supabase side control what this key can actually do. The key can be inspected in browser DevTools by anyone, which is expected and harmless as long as RLS is properly configured.

**localStorage and IndexedDB:** Session data and question images stay on the user's device. Resetting the app (`resetApp()`) clears both. A student using a shared or public computer should use the reset button before leaving.

---

## Performance Optimizations

**15-minute in-memory read cache:** `analytics.js` caches every Supabase read result in `_fbCache` with a 15-minute TTL. Reopening the analysis or community screen within the TTL window serves data from memory without a network round-trip. This is particularly useful on mobile where repeated navigation between screens is common.

**One session at a time in IndexedDB:** `saveImagesToIDB()` calls `store.clear()` before writing new images. This prevents unbounded growth of the image store and keeps read times fast, since the cursor only iterates over the current session's images.

**Chart instance destruction on screen open:** Rather than accumulating Chart.js instances, all chart instances for a screen are stored in an object and destroyed before re-rendering. This prevents canvas memory leaks on long sessions with repeated screen navigation.

**Incremental PDF processing feedback:** PDF rendering is inherently slower than HTML or TXT parsing. The loading screen's step labels are updated progressively as each stage completes, giving the user feedback that something is happening rather than a blank loading indicator for several seconds.

**CSS custom properties for theming:** Theme switches are O(1) — a single `setAttribute` call on the root element. There is no class iteration, no component re-render, and no JavaScript recalculation of styles. Charts, however, do not react to CSS changes after creation, which is why they are recreated on each screen open rather than relying on live style updates.

---

## Known Limitations

- **Scanned PDFs:** Image-only PDFs — where the page is a photograph of the response sheet rather than a text-layer document — cannot be parsed. pdf.js's `getTextContent()` returns nothing useful for scanned pages. OCR is not in scope for the current version.
- **PDF image cropping accuracy:** The question boundary detection from text positions is heuristic. On PDFs with unusual layouts or non-standard fonts, some crops may be misaligned or include adjacent question content.
- **HTML image paths:** When saving the Objection Portal page as HTML, browsers sometimes save it as a single HTML file without the accompanying asset folder. In this case, question images embedded via relative paths will not load. The parser still extracts text and calculates scores correctly.
- **Community analytics scope:** The community screen fetches Attempt 1 data only. Attempt 2 aggregates are stored in `shift_stats` but not yet surfaced in the community view.
- **Concurrent write race conditions:** The current read-modify-upsert pattern for Supabase writes is not atomic. Under high concurrent load (many users submitting simultaneously), it is theoretically possible for updates to overwrite each other. At the traffic levels this app currently handles, this is not a practical problem, but it is worth noting.
- **localStorage quota:** Parsing a very large session (all 150 questions with metadata) is well within typical localStorage quotas, but on browsers with unusually low quotas or full storage, the `saveSession` call will silently fail. The session restore feature will simply not work in that case; the dashboard still functions normally.
- **Deep links require a saved session:** Navigating directly to `/#dashboard` or `/#analysis` only works if a session is stored in localStorage. If there is no session, the router redirects to the home screen with a brief error message.

---

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for the full text.

You are free to use, copy, modify, merge, publish, distribute, sublicense, or sell the software, subject to including the original copyright notice and license text in any copy or substantial portion of the project.

---

_Built by Swanand Jaju — WCE Sangli, 2026_