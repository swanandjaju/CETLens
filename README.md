# CETLens - Technical Documentation

CETLens is a static, client-side web application architected to process, parse, and analyze MHT-CET Objection Portal response sheets entirely within the user's browser. It extracts DOM-level question data, computes mathematical scores, and generates real-time community statistics and percentile predictions via a serverless Supabase PostgreSQL backend.

---

## 1. System Architecture

CETLens is built as a pure Single Page Application (SPA). It uses vanilla JavaScript, CSS3, and HTML5 without any complex build systems (e.g., Webpack, React, Vite), ensuring maximum performance and zero server-side processing overhead.

### Data Flow Lifecycle
1. **Ingestion (Client-Side):** The user drags and drops a raw HTML, MHTML, or PDF file into the dropzone.
2. **Parsing (`script.js`):** The application reads the file via the FileReader API, normalizes the DOM tree, and extracts candidate responses vs. correct answers using CSS selector targeting.
3. **Evaluation (`script.js`):** The extracted array is evaluated against the selected stream (PCM or PCB) to generate total scores.
4. **Data Synchronization (`analytics.js`):** A lightweight, anonymized footprint (Stream, Attempt, Shift, Total Score) is transmitted to the Supabase database.
5. **Statistical Aggregation (Supabase):** The `record_submission` RPC function increments the global tally and updates a JSONB frequency map for the respective shift without storing Personally Identifiable Information (PII).
6. **Prediction Modeling (`predictor.js`):** The client retrieves the aggregated shift data, calculates the Variance and Skewness of the distribution, and estimates the user's percentile by interpolating the live score against historical JSON curves.

---

## 2. Core Modules

### A. The Parsing Engine (`script.js`)
The parsing engine handles the ingestion of different file formats and normalizes them into a standard JSON structure.

#### Key Functions
- **`processFiles(files)`**: The main entry point for file drops. Validates MIME types and routes to the appropriate parser.
- **`parseHTML(htmlString)`**: 
  - Converts the raw string into a DOM element using `DOMParser`.
  - Searches for elements with `.question-pnl`.
  - Extracts the Question ID, correct option text (from `.rightAns`), and the candidate's chosen option.
- **`parseMHTML(mhtmlString)`**: Resolves multipart MIME boundaries and extracts the primary HTML payload, routing it back to `parseHTML`.
- **`parsePDF(file)`**: 
  - Utilizes `pdf.js` to render the document into hidden canvases.
  - Extracts text layers and rebuilds the question-answer topology using complex regular expressions designed specifically for the official MHT-CET PDF layout.

### B. Statistical Analytics (`analytics.js`)
This module handles all community data integration and chart rendering.

#### Core Mechanics
- **`saveSubmissionToSupabase(score, stream, attempt, shift)`**:
  - Validates the parameters and constructs the Supabase request.
  - Calls the PostgreSQL RPC function to securely update the database frequency maps.
- **`fetchAnalyticsData(stream, attempt)`**:
  - Queries the `shift_stats` materialized view.
  - Parses the `score_counts` JSONB object, converting it into JavaScript objects mapped by shift name.
- **`renderCommunityCharts()`**:
  - Integrates with `Chart.js`.
  - Generates line and bar charts to display the distribution of scores (e.g., how many users scored between 150-160) across different attempts and shifts.

### C. Percentile Predictor & Difficulty Algorithm (`predictor.js`)
This module contains the complex mathematical models used to rank shifts and predict percentiles.

#### The Skewness & Variance Model
Unlike basic average-based models, CETLens dynamically calculates the exact shape of the score distribution for each shift.
- **Mean & Median:** Provides the baseline average difficulty.
- **Variance (Standard Deviation):** Measures how spread out the scores are. A high variance indicates an unpredictable paper.
- **Skewness:** The third standardized moment. 
  - *Positive Skew* indicates a difficult paper (scores cluster at the bottom). 
  - *Negative Skew* indicates an easy paper (scores cluster at the top).
- **The Difficulty Score:** 
  The final difficulty is computed as:
  `Difficulty = (Normalized Mean * 0.4) + (Normalized Median * 0.3) + (Percentage Above 120 * 0.2) + (Skewness Penalty * 0.1)`

#### The Interpolation Engine
- **`updatePredictorPrediction(...)`**:
  - Maps the user's live shift difficulty rank to the closest matching historical curve in `reference_shift_ranking.json`.
  - Fetches the mapped 15 percentile curve sets from `percentile_curves.json`.
  - Performs a Logit transformation to smoothly interpolate the candidate's raw marks into a final decimal percentile.

---

## 3. Database Schema & RPCs (`rpc.sql`)

The Supabase PostgreSQL database is optimized for heavy concurrent writes without race conditions, utilizing a specific schema structure.

### Tables
1. **`score_submissions`**
   - **Purpose:** An append-only table logging incoming submissions.
   - **Columns:** `id` (UUID), `created_at` (Timestamp), `score` (Integer), `stream` (Text), `attempt` (Text), `shift` (Text).

### Views
2. **`shift_stats`**
   - **Purpose:** A materialized view or standard view that aggregates data rapidly.
   - **Columns:** `stream`, `attempt`, `shift`, `count`, `total_score`, `score_counts` (JSONB).
   - **Mechanism:** The `score_counts` JSONB object holds a frequency map (e.g., `{"85": 12, "86": 4}`) to massively reduce payload sizes when sent to the frontend.

### Functions (RPC)
3. **`record_submission`**
   - **Parameters:** `p_score`, `p_stream`, `p_attempt`, `p_shift`.
   - **Logic:** Locks the specific shift row to prevent race conditions. Updates the `total_score` and increments the correct JSONB key in `score_counts` based on `p_score`.

---

## 4. Repository Structure & Global Scope

- `index.html`: The HTML5 document containing the DOM structure. Contains no business logic. Heavy use of nested flexbox and grid layouts.
- `style.css`: All application styling. Utilizes CSS variables (Custom Properties) for theming and neumorphic design patterns.
- `script.js`: Exposes `window.escapeHtml` globally to prevent XSS. Manages DOM state transitions (e.g., uploading -> processing -> dashboard).
- `analytics.js`: Attaches event listeners for the Analytics tab. Holds the `Chart.js` instance references globally to prevent memory leaks.
- `predictor.js`: Maintains the `_predictorLiveRows` global cache to prevent excessive API calls to Supabase on keystrokes.
- `router.js`: Modifies the `window.history` state. Intercepts back-button presses to smoothly transition UI states instead of reloading the document.

---

## 5. Deployment Guide

### A. Backend Configuration
1. Create a Supabase Project.
2. In the Supabase SQL Editor, paste and execute the entire contents of `rpc.sql` and `schema.sql`.
3. Configure your Table Policies (RLS) to ensure that the `score_submissions` table only accepts INSERTs, preventing unauthorized read/delete access.

### B. Frontend Configuration
1. Locate `supabase.js` in the root directory.
2. Replace the constants with your specific Supabase credentials:
   ```javascript
   const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
   const SUPABASE_ANON = 'YOUR_ANON_KEY';
   ```
3. If deploying for a closed attempt (e.g., Attempt 1 is finished), open `predictor.js` and set:
   ```javascript
   const PREDICTOR_USE_LIVE_DATA = false;
   ```
   This will freeze the algorithm to read from the static `MANUAL_DIFFICULTY_RANKING` array instead of live database calls. For active data collection (Attempt 2), ensure it remains `true`.

### C. Hosting
Deploy the flat directory to any static file server:
- **Vercel / Netlify / Cloudflare Pages:** Drag and drop the folder.
- **GitHub Pages:** Push to the `main` branch and enable Pages in repository settings.
- **Apache / Nginx:** Serve the directory directly over Port 80/443.

---
*Made with ❤️ by Swanand Jaju*