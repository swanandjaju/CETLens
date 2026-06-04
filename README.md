# CETLens - Advanced Technical Documentation & Project Architecture

![CETLens Hero Image](https://via.placeholder.com/1200x400.png?text=CETLens+Architecture)

Welcome to the definitive source code documentation for **CETLens**, an advanced client-side web application explicitly architected to process, parse, and deeply analyze MHT-CET Objection Portal response sheets. This application functions entirely within the user's browser environment, ensuring maximum security and zero payload transmission of original sheets. It extracts DOM-level question data, computes raw mathematical scores subject-wise, and mathematically models community statistics to generate highly accurate percentile predictions.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture & Lifecycle](#2-system-architecture--lifecycle)
   - [Phase 1: Live Data Collection (Supabase)](#phase-1-live-data-collection-supabase)
   - [Phase 2: Static Archival (Current State)](#phase-2-static-archival-current-state)
3. [Core Parsing Engine (`script.js`)](#3-core-parsing-engine-scriptjs)
   - [HTML / MHTML Parsing Algorithm](#html--mhtml-parsing-algorithm)
   - [PDF Parsing & OCR Bridging](#pdf-parsing--ocr-bridging)
4. [Statistical Analytics Module (`analytics.js`)](#4-statistical-analytics-module-analyticsjs)
   - [Data Hydration & Memoization](#data-hydration--memoization)
   - [Chart Lifecycle & Canvas Rendering](#chart-lifecycle--canvas-rendering)
5. [Predictive Modeling (`predictor.js`)](#5-predictive-modeling-predictorjs)
   - [Algorithmic Approach to Difficulty](#algorithmic-approach-to-difficulty)
   - [Logit Interpolation Mapping](#logit-interpolation-mapping)
6. [Legacy Database Schema (Reference Only)](#6-legacy-database-schema-reference-only)
7. [Local Setup & Deployment](#7-local-setup--deployment)
8. [License & Credits](#8-license--credits)

---

## 1. Project Overview

During the highly competitive MHT-CET examination cycle, thousands of students receive response sheets with ambiguous layouts and non-standardized formats (spanning raw HTML, MHTML, and varied PDF snapshots). **CETLens** was developed to provide an instantaneous, offline-first parsing utility capable of normalizing these disparate formats into an accurate, uniform score breakdown (Physics, Chemistry, Mathematics/Biology).

Beyond simple calculation, CETLens aggregates these scores to establish a "Community Normalization Curve." This allows students to instantly see their rank, the shift-specific mean, and predicted percentiles before official results are declared.

---

## 2. System Architecture & Lifecycle

CETLens is constructed as a modern **Single Page Application (SPA)** utilizing heavily optimized vanilla JavaScript (ES6+), CSS3 (with CSS Variables for dynamic theming), and HTML5 APIs. The lack of a heavyweight frontend framework (like React or Vue) was a deliberate architectural decision to ensure instantaneous load times even on low-end mobile devices over 3G networks.

To balance the necessity of real-time community data ingestion with zero long-term infrastructure costs, the application lifecycle was engineered in two distinct operational phases:

### Phase 1: Live Data Collection (Supabase)
During the two-week peak traffic window (handling over **8,500+ organic submissions**), the application relied on a Serverless Supabase PostgreSQL backend.
1. **Client-Side Scoring:** The parsing engine computed the raw score entirely locally. The original document was never transmitted to a server, guaranteeing user privacy.
2. **Anonymized Sync:** Only a lightweight, anonymized telemetry footprint (comprising the Stream, Attempt, Shift, and Total Score) was transmitted to the Supabase endpoint via REST.
3. **Database Concurrency:** To avoid race conditions during concurrent bulk writes, a highly optimized PostgreSQL RPC function (`record_submission`) was deployed. Instead of appending thousands of individual rows, this RPC used row-level locking to increment a JSONB frequency map for the respective shift. This reduced the database footprint by 99% and ensured O(1) read times.

### Phase 2: Static Archival (Current State)
Once active data collection concluded, CETLens was transitioned into a **100% Serverless Static Web Application** to completely eliminate database hosting and scaling costs indefinitely.
1. **Data Snapshotting:** The live Supabase data (the JSONB frequency maps) was dumped, serialized, and compressed into local static JSON payloads (`static_shift_stats.json` and `static_submission_summary.json`).
2. **Offline Refactoring:** The frontend data pipelines in `analytics.js` and `predictor.js` were comprehensively refactored. The Supabase client SDK was stripped from the codebase. The application now hydrates its visualization layer directly from the bundled offline JSON objects.
3. **End Result:** CETLens runs entirely from a static file server (like GitHub Pages) forever. It provides the exact same rich analytics, percentile predictions, and community leaderboards with absolute zero backend infrastructure, ensuring total platform longevity.

---

## 3. Core Parsing Engine (`script.js`)

The `script.js` module is the beating heart of CETLens. It manages the ingestion of unstandardized file formats and executes complex regex and DOM-traversal algorithms to extract question IDs and user answers.

### HTML / MHTML Parsing Algorithm
When a user uploads a raw HTML or MHTML file, CETLens executes the following sequence:
- **Sanitization:** The `DOMParser` API is utilized to safely parse the file into an in-memory document tree without executing embedded malicious scripts (XSS protection).
- **Selector Targeting:** The engine scans for specific structural classes injected by the official exam portal. It loops through nodes, extracting the "Right Answer", the "Chosen Option", and the "Question Status" (Attempted/Unattempted).
- **Subject Mapping:** The system heuristically determines the subject (Physics, Chemistry, Math, Biology) based on sequential boundaries within the document.

### PDF Parsing & OCR Bridging
Due to variations in how users generate PDFs (Print to PDF, third-party mobile scanners), the PDF pipeline requires extensive computational effort:
- **Canvas Rendering:** `pdf.js` is leveraged to sequentially render each page onto a hidden `<canvas>` element in the background thread.
- **Text Layer Extraction:** The `getTextContent()` method extracts raw text arrays. Because PDFs lack semantic structure, CETLens relies on advanced RegEx pattern matching to reconstruct the topology of a question block, accounting for varying whitespace, fragmented strings, and missing delimiters.

---

## 4. Statistical Analytics Module (`analytics.js`)

The `analytics.js` module transforms raw numeric data into actionable, interactive visualizations utilizing `Chart.js`.

### Data Hydration & Memoization
Because the dataset contains over 8,500 records spread across dozens of shifts, rendering charts on-the-fly involves heavy Map/Reduce operations. To guarantee 60fps UI performance:
- **Data Shape Reconstitution:** The static JSON frequency maps (`{"score_counts": {"95": 12, "96": 4}}`) are "expanded" back into raw score arrays for mathematical processing.
- **Aggressive Memoization:** When a user toggles between the "PCM" and "PCB" streams on the Community Dashboard, the massive shift-maps are not rebuilt from scratch. The application caches the computation via `_memoizedPcmStatsMap`, guaranteeing instantaneous UI updates with O(1) retrieval time.

### Chart Lifecycle & Canvas Rendering
- **Automated Destruction:** To prevent GPU memory leaks and "ghosting" effects when re-rendering overlapping canvases, a rigorous lifecycle hook (`Object.values(_communityCharts).forEach(c => { if (c) c.destroy(); })`) guarantees old charts are wiped from the DOM before new data is painted.
- **Responsive Colors:** Chart rendering is tied into the CSS variable system (e.g., `getComputedStyle(document.documentElement).getPropertyValue('--accent')`), ensuring seamless transitions when the user toggles Dark Mode.

---

## 5. Predictive Modeling (`predictor.js`)

Unlike basic average-based models that fail at the extreme tails of a distribution, CETLens dynamically calculates the exact shape of the score distribution for each shift using mathematical moments.

### Algorithmic Approach to Difficulty
To accurately gauge how "difficult" a specific shift was relative to others, the system analyzes the dataset using higher-order statistics:
- **Variance (Standard Deviation):** Measures the spread of scores. A high variance indicates the paper heavily differentiated top students from average ones.
- **Skewness:** The third standardized moment. Positive Skew indicates a difficult paper (scores clumped at the bottom); Negative Skew indicates an easy paper.
- **The Difficulty Score:** A composite mathematical rank is generated by weighting the Normalized Mean, the Median, applying a Skewness Penalty, and evaluating outlier percentages (students scoring >120 vs <80).

### Logit Interpolation Mapping
To predict the user's percentile:
- The system maps the user's raw score to the closest historical curve stored in `percentile_curves.json`.
- It executes a **Logit transformation** (`log(p / (1 - p))`) to linearize the S-curve of the standard normal distribution.
- Linear interpolation is applied between the two closest known data points on the transformed scale, and the result is mapped back using the Inverse Logit function to project a highly accurate, decimal-level percentile prediction.

---

## 6. Legacy Database Schema (Reference Only)

*Note: This schema is deprecated as of Phase 2. It is documented here strictly for architectural reference and historical context.*

```sql
-- Phase 1: High-Concurrency Tracking View
CREATE VIEW shift_stats AS
SELECT 
    stream, attempt, shift,
    COUNT(*) as count,
    SUM(total_score) as total_score,
    MAX(total_score) as highest,
    MIN(total_score) as lowest,
    jsonb_object_agg(score, count) as score_counts
FROM score_submissions
GROUP BY stream, attempt, shift;
```
During peak load, a bespoke PostgreSQL RPC (`record_submission`) was executed. It utilized row-level `FOR UPDATE` locks to atomically increment specific keys inside the `score_counts` JSONB dictionary, utterly bypassing the traditional overhead of multi-row `INSERT` operations at scale.

---

## 7. Local Setup & Deployment

Because CETLens operates entirely as a serverless static web application, local development and production deployment are incredibly straightforward. There are zero build steps, no Node.js dependencies to install, and no backend environment variables to configure.

### Local Development
1. Clone the repository to your local machine.
2. Ensure the offline datasets (`static_data.js` / `static_shift_stats.json`) are present in the directory.
3. Open `index.html` directly in your web browser. Alternatively, use a simple local server (e.g., `python -m http.server 8000` or the VS Code Live Server extension) for a more robust development experience with hot reloading.

### Production Deployment
Deploy the flat directory structure to any major static hosting provider:
- **GitHub Pages:** Push the codebase to your `main` branch and enable GitHub Pages in the repository settings.
- **Vercel / Netlify / Cloudflare Pages:** Simply drag and drop the folder into their dashboard or link the Git repository.

---

## 8. License & Credits

Designed, architected, and built by **Swanand Jaju**.

This project relies on several fantastic open-source libraries:
- [Chart.js](https://www.chartjs.org/) for beautiful, responsive canvas charting.
- [pdf.js](https://mozilla.github.io/pdf.js/) by Mozilla for complex document rendering.
- [html2canvas](https://html2canvas.hertzen.com/) & [jsPDF](https://parall.ax/products/jspdf) for exporting analysis reports.
- [SheetJS](https://sheetjs.com/) for optional Excel parsing support.

*If you found this tool helpful, please consider starring the repository!*