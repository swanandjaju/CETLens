# CETLens

CETLens is a comprehensive, client-side analytical platform designed to parse, process, and evaluate MHT-CET Objection Portal response sheets. By operating entirely within the user's browser, CETLens delivers real-time statistical insights, shift-wise difficulty analysis, and robust error detection without the need for a dedicated backend application server.

## Overview

The platform allows users to upload their MHT-CET response sheets (in HTML, MHTML, or PDF format). Once uploaded, CETLens processes the raw document, extracting questions, selected options, correct options, and question states. It then computes the total score, subject-wise breakdowns, and overall accuracy. Furthermore, it securely syncs anonymized statistical data to Supabase to generate community-driven insights, including shift difficulty rankings and aggregate score distributions.

## Key Features

### 1. Client-Side Parsing Engine
- **Multi-Format Support:** Accurately processes standard HTML, MHTML, and PDF response sheets.
- **Data Extraction:** Parses question text, image content, candidate selections, and official answer keys directly from the DOM using custom traversal algorithms.
- **Immediate Scoring:** Calculates scores instantaneously upon file upload, applying stream-specific marking schemes (e.g., PCM vs. PCB).

### 2. Analytical Dashboard
- **Score Breakdown:** Provides a detailed overview of the user's performance, including total marks, correct attempts, incorrect attempts, and unattempted questions.
- **Subject-Wise Analysis:** Dissects the score by subject (Physics, Chemistry, Mathematics/Biology), offering granular insights into strengths and weaknesses.
- **Question Review Interface:** A comprehensive grid allowing users to filter questions by status (Correct, Incorrect, Unattempted) and review specific questions alongside their associated images and correct answers.

### 3. Community Intelligence
- **Shift Difficulty Ranking:** Aggregates anonymized score data across different examination shifts to dynamically rank shifts by difficulty. Uses an advanced algorithm factoring in median scores, average scores, and top percentiles.
- **Score Distribution:** Generates live distribution metrics, establishing the user's relative standing compared to the broader participant pool.
- **Percentile Predictor:** An experimental module that projects estimated percentiles based on live shift statistics and historical reference data.

### 4. Advanced Error Handling and Auto-Correction
- **Shift Anomaly Detection:** Employs signature-based identity checks to detect structural mismatches or incorrect shift metadata.
- **Automated Fallbacks:** Intelligently corrects malformed stream data (e.g., assigning Mathematics vs. Biology dynamically based on stream detection) and recalculates metrics seamlessly.
- **Graceful Degradation:** Ensures core dashboard functionality remains intact even in the event of partial parsing failures or database unavailability.

## Technical Architecture

CETLens is built as a static Single Page Application (SPA), emphasizing performance, security, and low operational overhead.

### Technologies Used
- **Frontend Core:** HTML5, CSS3, Vanilla JavaScript (ES6+).
- **Database / Backend as a Service (BaaS):** Supabase (PostgreSQL).
- **Libraries:**
  - `pdf.js` for rendering and extracting data from PDF documents.
  - `html2canvas` for client-side rendering capabilities.
  - `chart.js` for data visualization.

### Data Flow
1. **Input:** User uploads a response sheet.
2. **Processing (`script.js`):** The application parses the document structure, standardizing the data into a structured JSON array of question objects.
3. **Scoring:** The parsing engine computes the score and constructs statistical aggregates.
4. **Persistence (`analytics.js`):** The extracted statistical footprint (excluding personally identifiable information) is asynchronously transmitted to Supabase.
5. **Visualization:** The UI components render the parsed data into interactive charts and scorecards.

## Project Structure

- `index.html`: The primary entry point containing the application layout, SVG assets, and modal structures.
- `index.css`: The global stylesheet defining the design system, typography, animations, and responsive layouts.
- `script.js`: The core logic for file ingestion, parsing, session management, and DOM manipulation.
- `analytics.js`: Handles communication with Supabase, shift difficulty computation, and community data aggregation.
- `predictor.js`: Contains the mathematical models and historical mappings for percentile estimation.
- `router.js`: A lightweight client-side routing implementation using the History API to manage navigation states between the dashboard, live analysis, and predictor views.
- `rpc.sql`: PostgreSQL stored procedures and table definitions required to configure the Supabase instance.

## Deployment

CETLens is a static site and can be deployed to any standard CDN or static hosting provider (e.g., Vercel, Netlify, GitHub Pages).

### Requirements
- A Supabase project with the appropriate tables and RPCs configured (refer to `rpc.sql`).
- Environment variables or inline configuration for the Supabase Project URL and Anon Key within the JavaScript context.

## Disclaimer

The percentile predictions and shift rankings provided by CETLens are based on voluntary user data and experimental models. They are not official and should not be treated as final admission-safe metrics.

---
Made with ❤️ by Swanand Jaju