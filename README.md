# CETLens

CETLens is a client-side web application designed to parse, process, and analyze MHT-CET Objection Portal response sheets. The application operates entirely within the user's browser, calculating statistical insights, parsing DOM structures, and estimating percentile metrics without passing full response documents to a backend server.

---

## Technical Overview

The application functions by reading the user-uploaded response sheet (HTML, MHTML, or PDF), parsing the embedded text or DOM nodes to extract the candidate's chosen options versus the official answer key, and calculating the final score based on stream-specific marking schemes.

To provide community-level insights (like shift difficulty and score distribution), the app extracts only anonymized aggregate data (e.g., total score, stream, shift name) and syncs it to a Supabase PostgreSQL database. The Supabase database aggregates these inputs via an RPC and returns live statistics to the frontend.

## Core Mechanisms

### 1. File Parsing Engine (`script.js`)
- **HTML/MHTML Processing:** The application uses `DOMParser` to traverse the uploaded file. It targets specific container classes (e.g., `question-pnl`) to extract the Question ID, the candidate's selected option, and the correct option ID.
- **PDF Processing:** If a PDF is uploaded, CETLens uses `pdf.js` to extract text layers. It uses regular expressions to reconstruct the question-answer mapping that would normally be present in the HTML DOM.
- **Scoring Logic:** After extracting the raw data, the app maps the questions to their respective subjects (Physics, Chemistry, Mathematics/Biology). Correct answers are awarded stream-appropriate marks (e.g., +2 for Mathematics, +1 for Physics/Chemistry).

### 2. Community Data Sync (`analytics.js` & `rpc.sql`)
- **Data Transmission:** Once scoring is complete, `analytics.js` sends a minimal payload (Stream, Attempt, Shift, Total Score) to the Supabase instance.
- **Database Aggregation:** The Supabase database uses a secure RPC (`record_submission`) to handle concurrent updates. The RPC increments the `count` for that specific shift and updates a JSONB `score_counts` object that acts as a frequency map (e.g., `{"134": 5, "135": 2}`). This frequency map prevents the need to store individual user records.
- **Data Retrieval:** The frontend periodically queries the `shift_stats` view to retrieve the updated `score_counts` for all shifts.

### 3. Percentile Prediction & Shift Difficulty (`predictor.js`)
The application includes a mathematical model to rank shifts by relative difficulty and estimate user percentiles.

- **Statistical Analysis:** For each shift, the application iterates over the `score_counts` frequency map to calculate:
  - Total Submissions (`count`)
  - Mean Average (`average`)
  - Median Score (`median`)
  - **Standard Deviation & Skewness:** By calculating the third standardized moment (Skewness), the algorithm determines if the score distribution is top-heavy or bottom-heavy.
- **Difficulty Scoring:** A composite difficulty score is generated using a weighted average of normalized Mean, Median, Skewness, and the percentage of scores above 120 / below 80. Shifts are then sorted by this composite score.
- **Interpolation:** The user's shift is mapped against a historical baseline (`reference_shift_ranking.json`). The application uses Logit transformation to interpolate the user's marks against the historical percentile curve (`percentile_curves.json`) for that specific difficulty rank.

## Repository Structure

- `index.html`: The primary entry point. Contains the complete DOM structure, SVG assets, and modal templates for the Single Page Application (SPA).
- `style.css`: The global stylesheet defining the UI layout, CSS variables, and responsive behavior.
- `script.js`: Handles file drag-and-drop, format parsing (HTML/PDF), DOM extraction, and session state. Includes globally shared utilities like `window.escapeHtml`.
- `analytics.js`: Manages the Supabase client connection, calls the `record_submission` RPC, and uses `Chart.js` to render the community score distribution graphs.
- `predictor.js`: Contains the statistical formulas (Mean, Median, Skewness) and the historical curve mapping logic for the percentile predictor.
- `router.js`: Implements client-side routing via the HTML5 History API to switch between the Dashboard, Analytics, and Predictor views without page reloads.
- `rpc.sql`: The PostgreSQL stored procedures and view definitions required to configure the Supabase database.
- `schema.sql`: Basic database table definitions.
- `reference_shift_ranking.json` & `percentile_curves.json`: Static JSON files containing historical reference data used by the predictor algorithm.

## Deployment & Configuration

CETLens requires static hosting for the frontend and a Supabase instance for the community database.

1. **Database Setup:** 
   - Create a Supabase PostgreSQL project.
   - Execute the contents of `rpc.sql` in the Supabase SQL Editor to establish the `score_submissions` table, the `shift_stats` view, and the secure RPC endpoints.
2. **Frontend Setup:** 
   - Open `supabase.js` and inject your Supabase Project URL and Anon Key.
   - (Optional) Toggle `PREDICTOR_USE_LIVE_DATA` in `predictor.js` to `false` if you wish to freeze the dynamic ranking and use a hardcoded manual ranking array for specific attempts.
3. **Hosting:** 
   - Upload the root directory to a static host (e.g., Vercel, Netlify, GitHub Pages). There is no Node.js backend or build step required.

---
*Made with ❤️ by Swanand Jaju*