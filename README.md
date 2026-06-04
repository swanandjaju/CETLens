# CETLens - Advanced Technical Documentation & System Architecture

![CETLens Hero Image](https://via.placeholder.com/1200x400.png?text=CETLens+Architecture)

Welcome to the definitive source code documentation for **CETLens**. 

CETLens is an advanced, high-performance client-side web application designed to process, parse, and analyze MHT-CET Objection Portal response sheets. By parsing raw response files directly within the browser, CETLens achieves two primary goals: 
1. **Absolute Data Privacy**: Original response sheets are never uploaded to any server.
2. **Real-time Analytics**: It normalizes disparate response formats into exact subject-wise mathematical scores, and instantly synchronizes anonymized metadata with a Supabase PostgreSQL backend to model dynamic community normalizations, rank distributions, and percentile predictions.

This documentation serves as a comprehensive guide for developers, data scientists, and system architects seeking to understand the inner workings of the CETLens ecosystem.

---

## Table of Contents
1. [Core Philosophy & Tech Stack](#1-core-philosophy--tech-stack)
2. [Frontend Architecture & State Management](#2-frontend-architecture--state-management)
3. [The Parsing Engine (`script.js`)](#3-the-parsing-engine-scriptjs)
   - [HTML and MHTML Processing Pipeline](#html-and-mhtml-processing-pipeline)
   - [PDF.js Processing & Heuristic Extraction](#pdfjs-processing--heuristic-extraction)
4. [Database Architecture & Concurrency (`Supabase / PostgreSQL`)](#4-database-architecture--concurrency)
   - [Schema & JSONB Aggregation](#schema--jsonb-aggregation)
   - [The RPC Function & Row-Level Locking](#the-rpc-function--row-level-locking)
5. [Statistical Analytics Module (`analytics.js`)](#5-statistical-analytics-module-analyticsjs)
   - [Data Hydration & Rendering Lifecycle](#data-hydration--rendering-lifecycle)
   - [Visualization Strategy](#visualization-strategy)
   - [Shift Difficulty Algorithm](#shift-difficulty-algorithm)
6. [Predictive Modeling (`predictor.js`)](#6-predictive-modeling-predictorjs)
   - [Statistical Moments (Variance & Skewness)](#statistical-moments-variance--skewness)
   - [Logit Interpolation Mapping](#logit-interpolation-mapping)
7. [Local Setup & Deployment Guide](#7-local-setup--deployment-guide)
8. [License & Credits](#8-license--credits)

---

## 1. Core Philosophy & Tech Stack

CETLens was built under extremely tight latency and hosting constraints. During the MHT-CET result cycle, web traffic spikes significantly. Therefore, the application abandons heavyweight JavaScript frameworks (like React, Vue, or Angular) in favor of hyper-optimized Vanilla ES6+ JavaScript.

### The Tech Stack
* **Frontend UI/UX**: Vanilla HTML5, CSS3 (leveraging CSS Custom Properties for O(1) dynamic theming), and Vanilla JS.
* **Backend / Database**: Serverless Supabase (PostgreSQL).
* **Charting & Visualization**: `Chart.js` via CDN.
* **Document Parsing**: `pdf.js` for canvas-based PDF rendering, and native `DOMParser` for HTML/MHTML processing.
* **Export Utilities**: `html2canvas` and `jsPDF` for client-side report generation.

By relying on CDNs for dependencies and a serverless database backend, the cost to scale CETLens to tens of thousands of concurrent users remains nearly zero.

---

## 2. Frontend Architecture & State Management

Unlike traditional SPA frameworks that maintain a virtual DOM, CETLens utilizes a direct DOM manipulation strategy driven by a global state model.

### Global State Management
State is maintained via global `window` objects. The application initializes variables such as `window._supabaseClient` and UI state flags (`_selectedCommunityStream`, `examMode`, `selectedShift`). Functions are designed to read from these globals and mutate the DOM directly. 

### Theming Engine
CETLens features an advanced theming engine that supports light and dark modes out of the box. 
- **CSS Variables**: All colors are mapped to CSS custom properties (e.g., `--bg`, `--text`, `--accent`).
- **Toggle Mechanism**: When the user triggers the theme toggle, JavaScript applies a `[data-theme="dark"]` attribute to the `<html>` element, instantly forcing a repaint with the new palette.
- **Persistence**: The user's preference is serialized and stored in `localStorage` to prevent unstyled flashes of light on subsequent visits.

---

## 3. The Parsing Engine (`script.js`)

The `script.js` file handles the ingestion, validation, and parsing of user files. Because students download their response sheets on various devices (Android, iOS, Windows) using different browsers, the uploaded files manifest in numerous chaotic formats. The parsing engine standardizes them.

### HTML and MHTML Processing Pipeline
The most accurate method of score calculation is through DOM parsing. 
1. **File Reading**: The `FileReader` API ingests the file as plain text.
2. **Sanitization**: To prevent Cross-Site Scripting (XSS), the raw string is passed into the native `DOMParser`, constructing an off-screen, inert DOM tree. Scripts embedded in the original file are stripped.
3. **Selector Targeting**: The engine executes complex `querySelectorAll` commands to hunt for specific structural classes injected by the official exam portal. It loops through the nodes, matching the "Right Answer" table cell against the "Chosen Option" cell.
4. **Subject Mapping**: The MHT-CET exam is strictly sequential. The engine maps questions 1-50 to Physics, 51-100 to Chemistry, and 101-150 to Mathematics (or 101-200 to Biology). 
5. **Scoring**: A simple mathematical accumulator calculates marks based on correct responses (+1 or +2 depending on the subject).

### PDF.js Processing & Heuristic Extraction
When users "Print to PDF" on their phones, the semantic HTML structure is destroyed. CETLens reconstructs it.
1. **Canvas Rendering**: Using Mozilla's `pdf.js`, CETLens creates hidden `<canvas>` elements and renders every page of the PDF into memory.
2. **Text Layer Extraction**: The `getTextContent()` method extracts raw text coordinate arrays.
3. **Regex Topology Mapping**: Because PDFs lack DOM structures, the text layers are concatenated into massive strings. The engine uses advanced Regular Expressions (Regex) to map patterns like `Question ID : [0-9]+` and `Chosen Option : [1-4]`. The algorithm must account for massive whitespace variations, fragmented substrings, and completely missing delimiters caused by aggressive PDF compression.

---

## 4. Database Architecture & Concurrency

During peak loads, thousands of students compute their scores simultaneously. CETLens relies on **Supabase (PostgreSQL)** to handle this throughput without bottlenecks. 

### Schema & JSONB Aggregation
Traditional SQL schemas would store one row per user submission. However, querying thousands of rows to compute a community average is computationally expensive. 
Instead, CETLens utilizes a highly optimized `shift_stats` view that relies heavily on PostgreSQL's `JSONB` data type.

A specific shift's record looks like this:
```json
{
  "stream": "PCM",
  "attempt": "Attempt 1",
  "shift": "23 April - Evening",
  "count": 1400,
  "total_score": 125000,
  "highest": 182,
  "lowest": 40,
  "score_counts": {
    "95": 12,
    "96": 4,
    "182": 1
  }
}
```
The `score_counts` dictionary is a frequency map. By mapping the raw score to a frequency count, the database payload is compressed by 99%.

### The RPC Function & Row-Level Locking
To prevent race conditions when two users submit a score to the same shift at the exact same millisecond, CETLens relies on a bespoke Remote Procedure Call (RPC) named `record_submission`. 
- This function uses PostgreSQL's `SELECT ... FOR UPDATE` row-level lock.
- It atomically fetches the row for the specified shift, increments the `count`, adds to the `total_score`, updates the `highest`/`lowest` thresholds if necessary, and increments the specific key inside the `score_counts` JSONB object.
- It then releases the lock. This ensures O(1) writes with absolute mathematical consistency, guaranteeing no dropped submissions during traffic spikes.

---

## 5. Statistical Analytics Module (`analytics.js`)

The `analytics.js` module hydrates the UI with real-time statistics by fetching the compressed JSONB data from Supabase.

### Data Hydration & Rendering Lifecycle
1. **Network Fetch**: The client performs a `SELECT` on the `shift_stats` view for the selected stream (e.g., PCM).
2. **Data Transformation**: The JSONB `score_counts` map is "expanded" back into a flat array of scores in JavaScript memory. 
3. **Chart Rendering Lifecycle**: Before drawing new charts, the script aggressively loops through the `_communityCharts` cache and invokes `.destroy()` on existing `Chart.js` instances. This prevents "ghosting" effects (where two canvases overlap) and prevents GPU memory leaks.

### Visualization Strategy
The application utilizes various chart types to provide profound insights to the user:
- **Radar Charts**: Compares the user's specific subject-wise performance (Physics vs. Chemistry vs. Math) against the shift average.
- **Histograms**: Plots the expanded score arrays into buckets of 20 (e.g., 0-20, 20-40) to visualize the standard bell-curve distribution of the examination. 
- **Horizontal Bar Charts**: Renders comparative leaderboards showcasing the highest score across all shifts.

### Shift Difficulty Algorithm
CETLens doesn't rely purely on the "average" score to rank shift difficulty, because outlier scores (a few students scoring 190+) can heavily skew a standard mean. 
Instead, the Difficulty Algorithm mathematically combines:
- **The Normalized Mean**
- **The Median**: Evaluated directly from the JSONB frequency map to prevent outlier distortion.
- **Top / Bottom Percentages**: Calculates the percentage of students scoring above a "high" threshold (e.g., 120) versus below a "low" threshold (e.g., 80).
Shifts are then sorted dynamically based on this composite weighted score.

---

## 6. Predictive Modeling (`predictor.js`)

Predicting a user's percentile accurately before official results requires profound mathematical modeling. Basic linear interpolation fails because human test scores follow an S-curve (a normal distribution), not a straight line.

### Statistical Moments (Variance & Skewness)
The predictor algorithm analyzes the exact shape of the score distribution for a specific shift using higher-order mathematical moments:
- **Variance (Standard Deviation)**: Measures the spread of the data. A high standard deviation means the paper successfully differentiated top-tier students from average students.
- **Skewness**: The third standardized moment. A positive skew means the bulk of students scored very low (indicating an extremely difficult paper). A negative skew implies an easy paper where scores clumped at the top.
The algorithm assigns "penalties" or "bonuses" to a user's raw score based on the Skewness of their specific shift. 

### Logit Interpolation Mapping
Once the user's score is normalized against their shift's variance and skewness, it must be mapped to a percentile curve.
1. The system references historical exam data stored in `percentile_curves.json`.
2. It executes a **Logit Transformation**: `log(p / (1 - p))` to linearize the S-curve of the historical percentiles.
3. It maps the user's normalized score onto this linearized scale, performs strict linear interpolation between the two closest known boundary points, and then maps the result back via the Inverse Logit function.
4. The output is a highly accurate, decimal-level percentile prediction (e.g., 98.452%).

---

## 7. Local Setup & Deployment Guide

Running CETLens locally or deploying it to a production server is straightforward.

### Environment Setup
To connect the frontend parsing engine to your own Supabase instance:
1. Create a Supabase Project.
2. Execute the `rpc.sql` (if available in your legacy repository) to generate the tables, views, and RPC functions.
3. Open `script.js` and locate the Supabase initialization block.
4. Replace the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables with your specific project credentials.

### Running Locally
Because it relies on Vanilla JavaScript and CDN scripts, there is no `npm install` or build step required.
1. Clone the repository.
2. Launch a local web server to bypass CORS restrictions. If you have Python installed, run:
   ```bash
   python -m http.server 8000
   ```
3. Navigate to `http://localhost:8000` in your browser.

### Deployment
Deploy the flat folder directly to any static web host:
- **GitHub Pages**: Push to the `main` branch and configure GitHub Pages in the repository settings.
- **Vercel / Netlify**: Connect your GitHub repository. The root directory will be automatically served without any build commands.

---

## 8. License & Credits

Designed, architected, and engineered by **Swanand Jaju**.

This project is built upon the shoulders of giants. It leverages the following open-source technologies:
- [Chart.js](https://www.chartjs.org/) for beautiful, hardware-accelerated canvas charting.
- [pdf.js](https://mozilla.github.io/pdf.js/) by Mozilla for complex document rendering pipelines.
- [html2canvas](https://html2canvas.hertzen.com/) & [jsPDF](https://parall.ax/products/jspdf) for client-side report generation and snapshotting.
- [SheetJS](https://sheetjs.com/) for deep Excel/CSV parsing capabilities.

*If you found this tool helpful, insightful, or educational, please consider starring the repository to support further development!*