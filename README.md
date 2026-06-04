# CETLens - Technical Documentation

CETLens is an advanced client-side web application architected to process, parse, and analyze MHT-CET Objection Portal response sheets entirely within the user's browser. It extracts DOM-level question data, computes mathematical scores, and generates community statistics and percentile predictions.

---

## 1. System Architecture & Lifecycle

CETLens is built as a Single Page Application (SPA) using vanilla JavaScript, CSS3, and HTML5. To balance the need for live community data with long-term hosting costs, the application architecture was designed in two distinct lifecycle phases:

### Phase 1: Live Data Collection (Supabase)
During the active MHT-CET results period, the application relied on a **Serverless Supabase PostgreSQL backend**. 
1. **Scoring:** The parsing engine computed the score locally.
2. **Data Synchronization:** A lightweight, anonymized footprint (Stream, Attempt, Shift, Total Score) was transmitted to Supabase.
3. **Statistical Aggregation:** A highly optimized PostgreSQL RPC function (`record_submission`) incremented a JSONB frequency map for the respective shift without storing Personally Identifiable Information (PII). This prevented race conditions during heavy traffic (handling over **8,500+ submissions**).

### Phase 2: Static Archival (Current State)
Once active data collection concluded, the application was gracefully degraded into a **100% Serverless Static App** to eliminate database hosting costs.
1. **Snapshotting:** The live Supabase data (the JSONB frequency maps) was dumped into local JSON files (`static_shift_stats.json`).
2. **Local Fetching:** The frontend data fetchers (`analytics.js`, `predictor.js`) were refactored to read from these static JSON snapshots instead of making Supabase network calls.
3. **Result:** The application now runs entirely from GitHub Pages forever, providing the exact same percentile predictions and community leaderboards with zero backend infrastructure.

---

## 2. Core Modules

### A. The Parsing Engine (`script.js`)
The parsing engine handles the ingestion of different file formats and normalizes them into a standard JSON structure.
- **HTML/MHTML Processing:** Uses `DOMParser` to extract Question IDs and candidate responses via CSS selector targeting.
- **PDF Processing:** Utilizes `pdf.js` to render the document into hidden canvases, extracting text layers and rebuilding the question-answer topology via complex regex algorithms.

### B. Statistical Analytics (`analytics.js`)
- **Data Hydration:** Fetches the archived JSON snapshots (`static_shift_stats.json` and `static_submission_summary.json`).
- **Visualization:** Integrates with `Chart.js` to render interactive line and bar charts displaying the distribution of scores across different shifts.

### C. Percentile Predictor & Difficulty Algorithm (`predictor.js`)
Unlike basic average-based models, CETLens dynamically calculates the exact shape of the score distribution for each shift using mathematical moments.
- **Variance (Standard Deviation):** Measures the spread of scores.
- **Skewness:** The third standardized moment. Positive Skew indicates a difficult paper; Negative Skew indicates an easy paper.
- **The Difficulty Score:** Computes a composite rank using Normalized Mean, Median, Skewness Penalty, and outlier percentages.
- **Logit Interpolation:** Maps the user's score to the closest historical curve (`percentile_curves.json`) and performs a Logit transformation to project a highly accurate decimal percentile.

---

## 3. Legacy Database Schema & RPCs (`rpc.sql`)
*Note: This schema was used during Phase 1 (Live Data Collection) and is preserved in the repository for architectural reference.*

- **`score_submissions` (Table):** An append-only table logging incoming submissions.
- **`shift_stats` (View):** Aggregated data rapidly. The `score_counts` JSONB object held a frequency map (e.g., `{"85": 12, "86": 4}`) to massively reduce payload sizes.
- **`record_submission` (RPC):** Locked the specific shift row to prevent race conditions during concurrent writes. Incremented the correct JSONB key based on the user's score.

---

## 4. Deployment Guide (Static Mode)

Because the application is now in Phase 2 (Static Archival), deploying it is incredibly simple:
1. Ensure `static_shift_stats.json` and `static_submission_summary.json` are present in the root directory.
2. Deploy the flat directory to any static file server:
   - **GitHub Pages:** Push to the `main` branch and enable Pages.
   - **Vercel / Netlify / Cloudflare Pages:** Drag and drop the folder.

No Node.js backend, build step, or Supabase credentials are required.

---
*Made with ❤️ by Swanand Jaju*