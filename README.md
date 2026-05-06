# CETLens

**CETLens** is a browser-based MHT-CET response sheet analyzer that helps students instantly understand their performance after uploading their MHT-CET Objection Tracker Portal response sheet.

Upload an **HTML**, **PDF**, or supported **TXT** response sheet and CETLens generates a complete performance dashboard with score, accuracy, subject-wise breakdown, question-level review, export options, share card generation, and live community analytics.

> All response sheet parsing happens locally in the browser. The uploaded file itself is not sent to a server.

**Live Deployment:** https://cetlens.onrender.com

---

## Table of Contents

- [About the Project](#about-the-project)
- [Why CETLens Exists](#why-cetlens-exists)
- [Key Features](#key-features)
- [Supported Exam Streams](#supported-exam-streams)
- [Supported File Formats](#supported-file-formats)
- [How the App Works](#how-the-app-works)
- [Scoring Rules](#scoring-rules)
- [Dashboard Features](#dashboard-features)
- [Question Review System](#question-review-system)
- [Live Community Analysis](#live-community-analysis)
- [Export Features](#export-features)
- [Session Restore](#session-restore)
- [Privacy and Data Handling](#privacy-and-data-handling)
- [Tech Stack](#tech-stack)
- [External Libraries](#external-libraries)
- [Project Structure](#project-structure)
- [Core File Responsibilities](#core-file-responsibilities)
- [Local Development](#local-development)
- [Deployment](#deployment)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)
- [Security Notes](#security-notes)
- [Browser Compatibility](#browser-compatibility)
- [Author](#author)
- [License](#license)

---

## About the Project

CETLens is a lightweight, static web application built using plain **HTML**, **CSS**, and **JavaScript**. It is designed specifically for MHT-CET students who want a fast and reliable way to analyze their response sheet without manually counting correct, incorrect, and unattempted questions.

The app reads the response sheet directly in the browser, extracts the correct option and candidate response for every question, applies the relevant scoring logic, and renders a clean analytics dashboard.

CETLens supports:

- PCM response sheets
- PCB response sheets
- HTML files saved from the MHT-CET Objection Tracker Portal
- PDF response sheets with selectable text
- Pipe-delimited TXT data for manual or programmatic testing
- Question image previews for PDF uploads
- Score export as CSV
- PDF report generation
- Shareable score card image generation
- Anonymous community score comparison using Firebase

---

## Why CETLens Exists

Manually analyzing an MHT-CET response sheet can be slow and error-prone. Students usually need to:

1. Open the response sheet.
2. Check each correct option.
3. Compare it with their selected option.
4. Count correct, incorrect, and unattempted questions.
5. Apply subject-wise marks.
6. Calculate score and accuracy.
7. Understand where marks were lost.

CETLens automates this entire process.

Instead of manually checking hundreds of questions, students can upload their response sheet and instantly get:

- Total score
- Accuracy
- Correct / incorrect / unattempted count
- Subject-wise marks
- Question-by-question review
- Visual score dashboard
- Exportable reports
- Shift-wise community comparison

---

## Key Features

### 1. Fully Browser-Based Analysis

CETLens runs directly in the browser. The core parsing and scoring logic does not require a backend server.

The app uses browser APIs such as:

- `FileReader`
- `ArrayBuffer`
- `localStorage`
- `IndexedDB`
- Canvas APIs
- DOM parsing

This keeps the app fast, portable, and easy to host on any static hosting platform.

---

### 2. MHT-CET Response Sheet Parsing

The app extracts response data from the MHT-CET Objection Tracker Portal format.

It scans the text for patterns such as:

```text
Correct Option: <option_id>
Candidate Response: <option_id>
```

For every question, it determines:

- Question number
- Question ID, when available
- Subject
- Section-wise question number
- Correct option ID
- Candidate selected option ID
- Status
- Marks awarded

---

### 3. Multiple Upload Formats

CETLens supports:

- `.html`
- `.htm`
- `.pdf`
- `.txt`

The preferred format is HTML saved from the official portal, but PDF files are also supported when they contain selectable text.

---

### 4. PCM and PCB Mode Support

Users can choose between:

- **PCM** — Physics, Chemistry, Mathematics
- **PCB** — Physics, Chemistry, Biology

The selected mode affects:

- Expected question count
- Subject mapping
- Score calculation
- Shift list
- Community analytics grouping

---

### 5. Attempt and Shift Selection

Before uploading a response sheet, the user selects:

- Attempt
- Shift
- Stream

The app currently includes **Attempt 1** shift lists.

For PCM, shifts include dates such as:

- 11 April - Morning
- 11 April - Evening
- 13 April - Morning
- 13 April - Evening
- 15 April - Morning
- 15 April - Evening
- 16 April - Morning
- 16 April - Evening
- 17 April - Morning
- 17 April - Evening
- 18 April - Morning
- 18 April - Evening
- 19 April - Morning
- 19 April - Evening
- 20 April - Morning
- 20 April - Evening

For PCB, shifts include dates such as:

- 21 April - Morning
- 21 April - Evening
- 22 April - Morning
- 22 April - Evening
- 23 April - Morning
- 23 April - Evening
- 24 April - Morning
- 24 April - Evening
- 25 April - Morning
- 25 April - Evening

This information is used for live community comparison.

---

### 6. Stream Mismatch Detection

CETLens checks whether the uploaded file matches the selected stream.

For example:

- If the user selects PCM but uploads a response sheet with 200 questions, the app detects that the sheet likely belongs to PCB.
- If the user selects PCB but uploads a response sheet with 150 questions, the app detects that the sheet likely belongs to PCM.

When a mismatch is found, CETLens displays a warning modal with two choices:

- **Switch & Continue**
- **Re-upload**

This prevents incorrect scoring.

---

### 7. Interactive Dashboard

After processing the file, CETLens displays a dashboard containing:

- Overall score
- Maximum marks
- Correct answer count
- Incorrect answer count
- Unattempted count
- Accuracy percentage
- Subject-wise marks
- Question table
- Question preview thumbnails
- Status filters
- Detailed question modal
- Live statistics strip
- Share and export buttons

---

### 8. Question-Level Review

Each parsed question is displayed in a table with:

- Serial number
- Subject code
- Question preview
- Status
- Marks

Clicking a question opens a detailed modal showing:

- Question number
- Subject
- Subject-wise question number
- Correct / incorrect / unattempted badge
- Marks awarded
- Candidate answer
- Correct answer
- PDF question image preview, when available

---

### 9. PDF Question Preview Cropping

For PDF uploads, CETLens uses PDF.js to:

1. Load the PDF.
2. Extract text from each page.
3. Render pages to canvas.
4. Detect question boundaries.
5. Crop question regions.
6. Store question preview images as data URLs.
7. Show previews in the dashboard and detail modal.

Question images are also persisted temporarily using IndexedDB so that restored sessions can still show previews.

---

### 10. Filters

The dashboard includes filter chips for:

- All questions
- Correct
- Incorrect
- Unattempted
- Physics
- Chemistry
- Mathematics
- Biology

Filters instantly update the question table and the currently active question set.

---

### 11. Keyboard Shortcuts

| Key | Action |
|---|---|
| `ArrowRight` | Go to next question |
| `ArrowLeft` | Go to previous question |
| `Escape` | Close question modal, lightbox, or sidebar |

When the question detail modal is open, arrow keys navigate inside the filtered question set.

---

### 12. Theme Support

CETLens supports both:

- Light mode
- Dark mode

The selected theme is stored in `localStorage`.

If no theme is saved, the app checks the system preference using:

```js
window.matchMedia('(prefers-color-scheme: dark)')
```

The design uses neumorphic surfaces, soft shadows, accent colors, and CSS variables for consistent theming.

---

## Supported Exam Streams

### PCM

PCM includes:

- Physics
- Chemistry
- Mathematics

Typical structure:

| Subject | Questions | Marks per Correct Answer |
|---|---:|---:|
| Physics | 50 | 1 |
| Chemistry | 50 | 1 |
| Mathematics | 50 | 2 |

Expected question count:

```text
150 questions
```

Maximum score:

```text
200 marks
```

---

### PCB

PCB includes:

- Physics
- Chemistry
- Biology

Typical structure:

| Subject | Questions | Marks per Correct Answer |
|---|---:|---:|
| Physics | 50 | 1 |
| Chemistry | 50 | 1 |
| Biology | 100 | 1 |

Expected question count:

```text
200 questions
```

Maximum score:

```text
200 marks
```

---

## Supported File Formats

### 1. HTML / HTM

Supported extensions:

```text
.html
.htm
```

This is the recommended upload format.

Users should save the full MHT-CET Objection Tracker Portal page from the browser and upload it to CETLens.

The app converts the HTML into plain text using the browser DOM:

```js
const div = document.createElement('div');
div.innerHTML = raw;
const text = div.textContent || div.innerText || '';
```

Then it parses the extracted text.

#### Advantages

- Fastest parsing
- Reliable text extraction
- Smaller memory usage compared to PDF
- Best option if PDF is scanned or image-based

#### Limitation

Question image previews may not be available from HTML files because portal image URLs are usually relative paths that cannot be resolved locally.

---

### 2. PDF

Supported extension:

```text
.pdf
```

PDF support is powered by PDF.js.

The app:

1. Reads the PDF as an `ArrayBuffer`.
2. Extracts text page by page.
3. Reconstructs text order.
4. Parses correct and candidate responses.
5. Renders pages to canvas.
6. Crops question preview images.
7. Displays previews in the dashboard.

#### Advantages

- Supports image preview for each question
- Useful for visual question review
- Works well with text-based PDFs

#### Limitation

Scanned PDFs are not supported because there is no selectable text layer to parse.

If a PDF upload fails, users should try uploading the HTML version of the response sheet.

---

### 3. TXT

Supported extension:

```text
.txt
```

TXT support is mainly useful for testing or manually prepared data.

Each line should follow a pipe-delimited format:

```text
qid|section|question_text|optId:option_text|optId:option_text|optId:option_text|optId:option_text|correctOptId|candidateOptId
```

Example:

```text
200001|Physics|Sample question text|300001:Option A|300002:Option B|300003:Option C|300004:Option D|300002|300002
```

Minimum requirements:

- At least 8 pipe-separated fields
- A valid section name
- Correct option ID
- Candidate option ID

For unattempted questions, the candidate option may be represented as:

```text
null
```

---

## How the App Works

### Step 1: User Selects Stream, Attempt, and Shift

Before upload, the user selects:

- PCM or PCB
- Attempt
- Shift

This prevents incorrect score comparison and allows the app to group anonymous community analytics correctly.

---

### Step 2: User Uploads File

The upload zone supports:

- Click to browse
- Drag and drop
- File name preview during drag
- Validation before opening the file picker

If attempt or shift is not selected, CETLens blocks the upload and shows an error message.

---

### Step 3: File Type Detection

The `processFile()` function detects the file type:

```js
const isPDF = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
const isTXT = file.name.toLowerCase().endsWith('.txt');
```

Based on the file type, the app calls:

| File Type | Processing Path |
|---|---|
| PDF | `processPDF(file)` |
| TXT | `parseRawData(text)` |
| HTML / HTM | HTML text extraction + `parsePortalText(text)` |

---

### Step 4: Text Parsing

The main parser is `parsePortalText()`.

It looks for correct option entries using this regular expression:

```js
const CORR_RE = /Correct\s+Option\s*[:\s]\s*(\d{5,6})/gi;
```

For each correct option match, it checks nearby text for the candidate response:

```js
const candInLine = afterCorr.match(/Candidate\s+Res\w*\s*[:\s]\s*(\d+)/i);
```

A response of `0` or an empty value is treated as unattempted.

---

### Step 5: Question Object Creation

Each parsed question becomes an object containing data similar to:

```js
{
  id: 1,
  qid: "200001",
  section: "Physics",
  sectionNum: 1,
  text: "Q1",
  correctLabel: "B",
  candidateLabel: "B",
  correctOptId: "300002",
  candidateOptId: "300002",
  status: "correct",
  marks: 1
}
```

The `status` can be:

```text
correct
incorrect
unattempted
```

---

### Step 6: Score Calculation

The `computeStats()` function calculates:

- Correct count
- Incorrect count
- Unattempted count
- Earned marks
- Maximum marks
- Accuracy
- Subject-wise marks
- Subject-wise percentage

Accuracy is calculated based on attempted questions only:

```js
accuracy = correct / (correct + incorrect)
```

Unattempted questions are excluded from the accuracy denominator.

---

### Step 7: Dashboard Rendering

After parsing and scoring, CETLens calls:

```js
renderDashboard(qs)
```

This updates:

- Score card
- Subject rows
- Question grid
- Question table
- Filter counts
- Question viewer
- Charts
- Export buttons
- Live statistics strip

---

## Scoring Rules

### Correct Answer

Marks are awarded only when the candidate option ID matches the correct option ID.

### Incorrect Answer

Incorrect answers receive:

```text
0 marks
```

There is no negative marking.

### Unattempted Question

Unattempted questions receive:

```text
0 marks
```

A question is treated as unattempted when the candidate response is:

```text
0
```

or missing.

### PCM Scoring

| Subject | Marks per Correct Answer |
|---|---:|
| Physics | 1 |
| Chemistry | 1 |
| Mathematics | 2 |

### PCB Scoring

| Subject | Marks per Correct Answer |
|---|---:|
| Physics | 1 |
| Chemistry | 1 |
| Biology | 1 |

---

## Dashboard Features

### Overall Score Card

The dashboard has a tabbed score card with two tabs.

#### Overall Score Tab

Shows:

- Semi-circular score gauge
- Earned score
- Maximum score
- Correct count
- Incorrect count
- Accuracy

The gauge is rendered using SVG arc paths.

#### Subject-wise Score Tab

Shows each subject with:

- Subject name
- Earned marks
- Maximum marks

---

### Live Statistics Strip

After a score is saved to Firebase, CETLens can show a brief live comparison strip containing:

- Your percentile
- Shift average
- Shift highest
- Students ahead of you
- Total participants in your shift

This is based on anonymous aggregated data.

---

### Question Table

The question table displays:

| Column | Description |
|---|---|
| `#` | Question number |
| `Question` | Subject abbreviation and subject-wise question number |
| `Preview` | PDF thumbnail preview, when available |
| `Status` | Correct, incorrect, or unattempted icon |
| `Marks` | Marks awarded |

Rows are clickable and open the question detail modal.

---

### Question Detail Modal

The modal shows:

- Question number
- Subject
- Subject-wise question number
- Status badge
- Marks pill
- Question image preview
- Candidate answer
- Correct answer
- Previous / next navigation
- Current position in filtered set

---

### Lightbox

Clicking a question image opens a lightbox view.

The lightbox can be closed by:

- Clicking outside the image
- Clicking the close button
- Pressing `Escape`

---

## Question Review System

CETLens maintains:

```js
let questions = [];
let filteredQs = [];
let currentQ = 0;
```

This allows the app to:

- Store all parsed questions
- Store currently filtered questions
- Track the active question
- Navigate question-by-question
- Keep the table and modal synchronized

---

## Status Colors

The UI uses distinct colors for status indicators:

| Status | Meaning |
|---|---|
| Green | Correct |
| Red | Incorrect |
| Grey | Unattempted |

The colors are defined using CSS variables in `style.css`.

---

## Live Community Analysis

CETLens includes Firebase-powered community analytics.

Users can view:

- Their position within their shift
- Percentile
- Students ahead
- Students below
- Same-score count
- Shift average
- Shift highest
- Shift participant count
- Score distribution histogram
- Subject-wise comparison
- Shift-vs-shift average comparison
- Participants per shift
- Highest score per shift
- Subject averages per shift
- Stream distribution between PCM and PCB

---

## Firebase Data Model

The app uses Firebase Realtime Database.

The main aggregate path follows this structure:

```text
stats/{stream}/{attempt}/{shift}
```

Example:

```text
stats/PCM/Attempt 1/11 April - Morning
```

Each shift aggregate stores values such as:

```js
{
  count: 120,
  sum: 16234,
  highest: 198,
  min: 42,
  scoreCounts: {
    150: 4,
    151: 2
  },
  subjectSums: {
    Physics: 4300,
    Chemistry: 4100,
    Mathematics: 7800
  },
  updatedAt: 1710000000000
}
```

---

## Duplicate Prevention

To avoid duplicate score submissions, CETLens generates a SHA-256 hash from the candidate responses:

```js
const raw = qs.map(q => (q.qid || q.id) + ':' + (q.candidateOptId || '0')).join('|');
```

The hash is stored under:

```text
hashes/{stream}/{shift}/{hash}
```

If the same response pattern is submitted again, the app skips the Firebase write.

---

## Firebase Read Cache

`firebase.js` includes an in-memory cache to reduce repeated database reads.

The cache TTL is:

```js
const _CACHE_TTL_MS = 5 * 60 * 1000;
```

That means analysis data is cached for 5 minutes during the same browser session.

---

## Export Features

### CSV Export

The CSV export includes:

| Column |
|---|
| Q# |
| Section |
| Section Q# |
| Status |
| Correct Option ID |
| Candidate Option ID |
| Marks |

The file is downloaded with a UTF-8 BOM for Excel compatibility.

Example generated filename:

```text
response_sheet_analysis.csv
```

---

### PDF Report Export

CETLens uses jsPDF to generate a formatted report containing:

- CETLens title
- Report subtitle
- File name
- Stream mode
- Date
- Question count
- Total score
- Correct count
- Incorrect count
- Unattempted count
- Accuracy
- Sectional breakdown
- Footer with project credit

Example generated filename:

```text
ExamReport_PCM_1710000000000.pdf
```

---

### Share Card Export

CETLens uses html2canvas to render an off-screen score card as a PNG image.

The score card contains:

- Stream
- Total score
- Maximum marks
- Correct count
- Incorrect count
- Accuracy
- Subject scores
- Date
- CETLens watermark

Example generated filename:

```text
score_card_PCM_148_1710000000000.png
```

---

## Session Restore

CETLens saves the current session in `localStorage` using the key:

```text
examSession
```

Stored session data includes:

- Parsed questions
- Exam mode
- File name
- Timestamp
- Selected attempt
- Selected shift

For PDF question previews, CETLens stores images in IndexedDB.

IndexedDB details:

| Value | Name |
|---|---|
| Database | `CETLensDB` |
| Version | `1` |
| Object Store | `questionImages` |

When the app is reopened, it can show a restore modal asking whether the user wants to restore the previous session.

---

## Privacy and Data Handling

CETLens is designed so that response sheet parsing happens locally in the browser.

The uploaded response sheet file is not uploaded to a backend server.

However, the app includes optional Firebase-powered community analytics. When a valid response sheet is processed, the app may save anonymous aggregate score data such as:

- Stream
- Attempt
- Shift
- Total score
- Subject-wise scores
- Timestamp
- Duplicate-prevention hash

The app does **not** store the uploaded file in Firebase.

The app does **not** store full raw question data in Firebase.

The app does **not** store names, roll numbers, or personal identity fields in its own submission payload.

### Local Storage Used

CETLens uses `localStorage` for:

- Theme preference
- Session restore data

### IndexedDB Used

CETLens uses IndexedDB for:

- Temporary PDF question preview images

### Firebase Used

Firebase is used for:

- Anonymous aggregate score statistics
- Shift-wise community analytics
- Duplicate submission prevention

---

## Tech Stack

CETLens is built with:

| Technology | Purpose |
|---|---|
| HTML | Page structure and app layout |
| CSS | Styling, themes, layout, neumorphic design |
| JavaScript | Parsing, scoring, state management, rendering |
| Firebase Realtime Database | Anonymous community analytics |
| Browser APIs | File handling, storage, canvas rendering |

There is no framework, no bundler, and no build step.

---

## External Libraries

The app uses CDN-loaded libraries.

| Library | Purpose |
|---|---|
| Firebase SDK | Realtime Database and analytics storage |
| PDF.js | PDF text extraction and page rendering |
| Chart.js | Charts and visualizations |
| canvas-confetti | Confetti animation for high scores |
| jsPDF | PDF report generation |
| html2canvas | Share card image generation |
| Google Fonts | Inter and JetBrains Mono fonts |

---

## Project Structure

```text
CETLens/
├── index.html
├── style.css
├── script.js
├── firebase.js
├── README.md
└── LICENSE
```

---

## Core File Responsibilities

### `index.html`

Contains the main application markup.

Major sections include:

- Upload screen
- Theme toggle button
- Stream selector
- Attempt selector
- Shift selector
- Drag-and-drop upload zone
- Community analysis CTA
- Author/about panel
- Stream mismatch modal
- Restore session modal
- Loading overlay
- Dashboard layout
- Score card
- Filter bar
- Question table
- Question detail modal
- Lightbox
- Share card template
- Landing page
- Detailed analysis screen
- Community analysis screen

It also loads:

- Google Fonts
- `style.css`
- Firebase SDK
- `firebase.js`
- Application scripts and CDN libraries

---

### `style.css`

Contains the complete design system and responsive UI styling.

Major responsibilities:

- CSS reset
- Light theme variables
- Dark theme variables
- Neumorphic shadows
- Upload screen layout
- Buttons
- Dashboard layout
- Topbar
- Question table
- Score card
- Filter chips
- Modal styling
- Lightbox styling
- Landing page sections
- Analysis screen styles
- Community screen styles
- Mobile responsive behavior

The design is based on CSS custom properties such as:

```css
--background
--foreground
--accent
--text
--correct
--incorrect
--unattempted
```

---

### `script.js`

Contains the main client-side app logic.

Major responsibilities:

- Global state management
- Theme handling
- Upload validation
- Drag-and-drop support
- File processing
- HTML parsing
- PDF processing
- TXT parsing
- Question extraction
- Score calculation
- Stream mismatch handling
- Dashboard rendering
- Score card rendering
- Question table rendering
- Question detail modal
- Lightbox
- Keyboard shortcuts
- CSV export
- PDF export
- Share card generation
- Session restore
- IndexedDB image persistence
- Analysis screen switching
- Community screen switching

Important functions include:

| Function | Purpose |
|---|---|
| `processFile()` | Detects file type and starts parsing |
| `processPDF()` | Handles PDF extraction and image cropping |
| `parsePortalText()` | Parses MHT-CET portal text |
| `parseRawData()` | Parses pipe-delimited TXT data |
| `computeStats()` | Calculates score and statistics |
| `renderDashboard()` | Renders all dashboard data |
| `renderQuestionTable()` | Displays question rows |
| `openQDetail()` | Opens question detail modal |
| `exportCSV()` | Downloads CSV report |
| `exportPDF()` | Downloads PDF report |
| `generateShareCard()` | Downloads score card PNG |
| `saveSession()` | Saves current session locally |
| `restoreSession()` | Restores previous session |
| `resetApp()` | Clears session and returns to upload screen |

---

### `firebase.js`

Contains Firebase configuration and analytics logic.

Major responsibilities:

- Firebase initialization
- Cache management
- Aggregate score storage
- Duplicate prevention
- Score normalization
- Community analytics fetching
- Brief dashboard strip rendering
- Full analysis rendering
- Shift-wise statistics
- Score distribution charts
- Subject average charts
- Community-wide analysis charts

Important functions include:

| Function | Purpose |
|---|---|
| `saveSubmissionToFirebase()` | Saves anonymous score aggregate |
| `generateAnswerHash()` | Creates duplicate-prevention hash |
| `incrementAggregate()` | Updates aggregate statistics |
| `fetchAndRenderBriefStrip()` | Loads live dashboard comparison |
| `fetchFullAnalysis()` | Loads detailed user-shift analysis |
| `fetchCommunityFullAnalysis()` | Loads public community analytics |
| `renderShiftDrillDown()` | Shows selected-shift details |
| `renderCommShiftDrillDown()` | Shows community shift details |

---

### `LICENSE`

The project uses the MIT License.

---

## Local Development

CETLens does not require Node.js, npm, a bundler, or a build step.

Clone the repository:

```bash
git clone https://github.com/swanandjaju/CETLens.git
cd CETLens
```

Serve the folder using any static server.

Using Python:

```bash
python3 -m http.server 8080
```

Or using Node:

```bash
npx serve .
```

Then open:

```text
http://localhost:8080
```

---

## Why Use a Local Server?

Opening `index.html` directly with a `file://` URL may work for basic HTML uploads, but some browser features and CDN worker scripts may behave differently.

A local server is recommended because:

- PDF.js worker loading is more reliable.
- Browser security restrictions are reduced.
- Static assets load consistently.
- Development behavior matches deployment more closely.

---

## Deployment

Because CETLens is a static web app, it can be deployed on:

- Render
- GitHub Pages
- Netlify
- Vercel
- Firebase Hosting
- Cloudflare Pages
- Any static file server

Required files:

```text
index.html
style.css
script.js
firebase.js
LICENSE
README.md
```

No build command is required.

---

## Known Limitations

### 1. Scanned PDFs Are Not Supported

PDFs must contain selectable text.

If the PDF is image-only, CETLens cannot extract:

- Correct option
- Candidate response
- Question text

Use the HTML version instead.

---

### 2. HTML Question Images May Not Load

HTML files saved from the portal may contain relative image paths.

Because those images are not bundled with the uploaded HTML file, CETLens may not be able to display question previews from HTML uploads.

PDF uploads are better for question image previews.

---

### 3. Parser Depends on Portal Text Format

The parser looks for labels like:

```text
Correct Option
Candidate Response
```

If the official portal changes its format, the parser may need updates.

---

### 4. Large PDFs Can Be Memory Intensive

For PDF uploads, CETLens renders pages to canvas and crops question images.

Large PDFs may use significant memory, especially on low-end devices.

---

### 5. Only One Response Sheet at a Time

CETLens processes one file per session.

Uploading a new file replaces the previous session.

---

### 6. Private Browsing Restrictions

Some browsers restrict `localStorage` or IndexedDB in private mode.

In that case:

- Theme persistence may not work.
- Session restore may not work.
- PDF question image persistence may not work.

The app is designed to fail gracefully when storage APIs are unavailable.

---

## Future Improvements

Possible future enhancements:

- Add more attempts dynamically
- Add admin-configurable shift lists
- Improve PDF question boundary detection
- Add offline PWA support
- Add percentile export in PDF report
- Add charts to exported PDF
- Add subject-wise accuracy charts to visible dashboard
- Add error reporting for failed parse attempts
- Add sample response sheet for testing
- Add Firebase security rules documentation
- Add support for answer key updates
- Add better mobile dashboard layout
- Add option to disable community analytics
- Add manual correction mode for parser edge cases

---

## Security Notes

The Firebase config in a frontend app is public by design. Security must be enforced through Firebase Realtime Database rules.

Recommended Firebase rules should ensure:

- Users cannot overwrite arbitrary analytics data.
- Aggregate writes are validated.
- Raw personal data is not accepted.
- Hash paths cannot expose sensitive information.
- Reads are limited to intended public analytics.

---

## Browser Compatibility

CETLens works best in modern browsers that support:

- ES6 JavaScript
- Canvas
- IndexedDB
- localStorage
- File API
- Crypto API
- CSS variables
- Flexbox and CSS Grid

Recommended browsers:

- Google Chrome
- Microsoft Edge
- Brave
- Firefox
- Safari, latest versions

---

## Author

**Swanand Jaju**

First Year, AI & ML  
Walchand College of Engineering, Sangli

- GitHub: [github.com/swanandjaju](https://github.com/swanandjaju)
- LinkedIn: [linkedin.com/in/swanand-jaju](https://www.linkedin.com/in/swanand-jaju/)

---

## License

This project is licensed under the [MIT License](./LICENSE).

© 2026 Swanand Jaju
