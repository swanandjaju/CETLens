# CETLens

CETLens is an incredibly powerful, fully client-side analytical platform designed to parse, process, and evaluate **MHT-CET Objection Portal response sheets**. By operating entirely within the user's browser, CETLens delivers real-time statistical insights, shift-wise difficulty analysis, dynamic percentile predictions, and robust error detection without the need for a dedicated backend application server.

Built with speed, accuracy, and scalability in mind, CETLens processed over **8.5k+ candidate submissions** in its initial deployment, calculating hyper-accurate difficulty curves using advanced statistical mathematics.

---

## Key Features

### 1. Client-Side Parsing Engine (Zero Server Load)
- **Multi-Format Support:** Intelligently processes standard HTML, MHTML, and PDF response sheets with zero server uploads. 
- **DOM Traversal & Extraction:** Parses question text, image content, candidate selections, and official answer keys directly from the DOM using a custom robust traversal algorithm.
- **Immediate Scoring:** Calculates scores instantaneously upon file upload, applying stream-specific marking schemes dynamically (e.g., PCM vs. PCB).

### 2. Analytical Dashboard
- **Score Breakdown:** Provides a detailed overview of the user's performance, including total marks, correct attempts, incorrect attempts, and unattempted questions.
- **Subject-Wise Analysis:** Dissects the score by subject (Physics, Chemistry, Mathematics/Biology), offering granular insights into strengths and weaknesses through visual gauges.
- **Question Review Grid:** A comprehensive grid allowing users to filter questions by status (Correct, Incorrect, Unattempted) and review specific questions alongside their associated images and correct answers.
- **Export Capabilities:** Users can export their analysis to PDF or Excel formats seamlessly via client-side libraries.

### 3. Community Intelligence & Leaderboards
- **Anonymized Data Sync:** Safely syncs the user's basic statistical footprint (total score, stream, shift) to a Supabase PostgreSQL database to build community aggregates without storing PII.
- **Live Shift Difficulty Ranking:** Aggregates anonymized score data across different examination shifts to dynamically rank shifts by difficulty. 
- **Score Distribution Charts:** Generates live distribution metrics, establishing the user's relative standing compared to the broader participant pool using interactive Chart.js graphs.

### 4. Advanced Percentile Predictor
- **Multi-Attempt Support:** Fully supports dynamic mathematical models for both **Attempt 1** and **Attempt 2** candidate pools.
- **Skewness & Variance Algorithms:** Unlike basic average-based predictors, CETLens calculates the **Standard Deviation** and **Skewness** of the live score distributions. This allows the algorithm to accurately detect if a shift was "top-heavy" (easy) or "bottom-heavy" (hard), preventing outliers from skewing predictions.
- **Historical Curve Interpolation:** Maps live shift difficulty against historical baseline curves using Logit transformations to project highly accurate, smooth percentile estimates.

### 5. Advanced Error Handling and Auto-Correction
- **Shift Anomaly Detection:** Employs signature-based identity checks to detect structural mismatches or incorrect shift metadata.
- **Automated Fallbacks:** Intelligently corrects malformed stream data (e.g., assigning Mathematics vs. Biology dynamically based on stream detection) and recalculates metrics seamlessly.
- **Resilient UI:** Graceful degradation ensures core dashboard functionality remains intact even in the event of partial parsing failures or database unavailability.

---

## Technical Architecture

CETLens is built as a static Single Page Application (SPA), emphasizing performance, security, and low operational overhead. It achieves a backend-like complexity entirely through Vanilla JS and Supabase RPCs.

### Technologies Used
- **Frontend Core:** HTML5, CSS3 (Vanilla), JavaScript (ES6+). No bulky frameworks.
- **Database / Backend as a Service (BaaS):** Supabase (PostgreSQL).
- **Libraries:**
  - `pdf.js`: Rendering and extracting text/data from PDF documents.
  - `html2canvas` & `jspdf`: Client-side snapshotting and PDF exporting.
  - `chart.js`: Interactive data visualization.
  - `xlsx`: Exporting data to Excel sheets.

### Application Flow
1. **Input:** User drops an MHT-CET response sheet into the browser.
2. **Processing (`script.js`):** The app parses the document structure, standardizing the messy source HTML/PDF into a clean JSON array of question objects.
3. **Scoring:** The parsing engine computes the score and constructs statistical aggregates.
4. **Persistence (`analytics.js`):** The extracted statistical footprint is asynchronously transmitted to Supabase via a locked-down RPC (`record_submission`).
5. **Prediction (`predictor.js`):** The user accesses the predictor, which queries the Supabase `shift_stats` view, computes live Skewness/Variance across thousands of rows, and outputs a projected percentile.

---

## Repository Structure

- `index.html`: The primary entry point containing the application layout, SVG assets, and modal structures.
- `style.css`: The global stylesheet defining the design system, typography, animations, and responsive layouts.
- `script.js`: The core logic for file ingestion, parsing, session management, and DOM manipulation. Includes globally shared utilities like `window.escapeHtml`.
- `analytics.js`: Handles communication with Supabase, UI rendering for the community leaderboards, and Chart.js initialization.
- `predictor.js`: Contains the mathematical models, historical mappings, and skewness distribution logic for percentile estimation.
- `router.js`: A lightweight client-side routing implementation using the History API to manage navigation states without page reloads.
- `rpc.sql`: The critical PostgreSQL stored procedures, view definitions, and security policies required to configure the Supabase instance.
- `schema.sql`: Basic database definitions.
- `reference_shift_ranking.json` & `percentile_curves.json`: Historical reference points for the predictor algorithm.

---

## Deployment & Setup

CETLens is a purely static site and can be deployed to any static hosting provider (Vercel, Netlify, GitHub Pages, Cloudflare Pages) in seconds.

### 1. Database Setup (Supabase)
1. Create a new Supabase project.
2. Navigate to the SQL Editor.
3. Copy the contents of `rpc.sql` and execute them. This will automatically set up the `score_submissions` table, the `shift_stats` aggregated view, and the `record_submission` secure RPC function.
4. (Optional) Run `rpc_security_hardening.sql` to lock down RLS policies.

### 2. Frontend Configuration
1. Open `supabase.js`.
2. Replace `SUPABASE_URL` and `SUPABASE_ANON` with your project's respective credentials.
3. If you want to freeze Attempt 1 data (to prevent further live alterations), ensure `PREDICTOR_USE_LIVE_DATA` is set to `false` in `predictor.js`.

### 3. Hosting
Simply upload the root directory containing the `.html`, `.js`, and `.css` files to your preferred static host. No build step (e.g., Webpack/Vite) is required.

---

## Disclaimer

The percentile predictions and shift rankings provided by CETLens are based on voluntary user data and experimental mathematical models. They are unofficial estimates and should **not** be treated as final, guaranteed, or admission-safe metrics.

---
*Made with ❤️ by Swanand Jaju*
