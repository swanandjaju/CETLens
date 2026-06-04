# CETLens - Technical Documentation & System Architecture


Welcome to the source code documentation for **CETLens**. 

CETLens is a client-side web application designed to process, parse, and analyze MHT-CET Objection Portal response sheets. By parsing raw response files directly within the browser, CETLens achieves two primary goals: 
1. **Data Privacy**: Original response sheets are processed locally and not uploaded to a server.
2. **Analytics**: It standardizes different response formats into subject-wise mathematical scores, and synchronizes anonymized metadata with a Supabase PostgreSQL backend to model community normalizations, rank distributions, and percentile predictions.

This documentation serves as a guide for developers and system architects seeking to understand the inner workings of the CETLens ecosystem.

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

CETLens was built to handle web traffic spikes during the MHT-CET result cycle. To meet these performance requirements, the application uses Vanilla ES6+ JavaScript rather than heavy JavaScript frameworks (like React, Vue, or Angular).

### The Tech Stack
* **Frontend UI/UX**: Vanilla HTML5, CSS3 (using CSS Custom Properties for dynamic theming), and Vanilla JS.
* **Backend / Database**: Serverless Supabase (PostgreSQL).
* **Charting & Visualization**: `Chart.js` via CDN.
* **Document Parsing**: `pdf.js` for canvas-based PDF rendering, and native `DOMParser` for HTML/MHTML processing.
* **Export Utilities**: `html2canvas` and `jsPDF` for client-side report generation.

By relying on CDNs for dependencies and a serverless database backend, the application minimizes infrastructure costs while scaling to support concurrent users.

---

## 2. Frontend Architecture & State Management

CETLens utilizes a direct DOM manipulation strategy driven by a global state model.

### Global State Management
State is maintained via global `window` objects. The application initializes variables such as `window._supabaseClient` and UI state flags (`_selectedCommunityStream`, `examMode`, `selectedShift`). Functions are designed to read from these globals and update the DOM directly. 

### Theming Engine
CETLens includes a theming engine that supports light and dark modes. 
- **CSS Variables**: Colors are mapped to CSS custom properties (e.g., `--bg`, `--text`, `--accent`).
- **Toggle Mechanism**: When the user triggers the theme toggle, JavaScript applies a `[data-theme="dark"]` attribute to the `<html>` element, applying the new color palette.
- **Persistence**: The user's preference is stored in `localStorage` to maintain the selected theme on subsequent visits.

---

## 3. The Parsing Engine (`script.js`)

The `script.js` file handles the ingestion, validation, and parsing of user files. Because students download their response sheets on various devices (Android, iOS, Windows) using different browsers, the uploaded files manifest in different formats. The parsing engine standardizes them.

### HTML and MHTML Processing Pipeline
The application uses DOM parsing to calculate scores.
1. **File Reading**: The `FileReader` API ingests the file as text.
2. **Sanitization**: To prevent Cross-Site Scripting (XSS), the raw string is passed into the native `DOMParser`, constructing an off-screen, inert DOM tree. Embedded scripts are stripped.
3. **Selector Targeting**: The engine executes `querySelectorAll` commands to find specific structural classes used by the official exam portal. It iterates through the nodes, matching the "Right Answer" table cell against the "Chosen Option" cell.
4. **Subject Mapping**: The exam follows a sequential format. The engine maps questions 1-50 to Physics, 51-100 to Chemistry, and 101-150 to Mathematics (or 101-200 to Biology). 
5. **Scoring**: An accumulator calculates marks based on correct responses (+1 or +2 depending on the subject).

### PDF.js Processing & Heuristic Extraction
When users use "Print to PDF", the semantic HTML structure is lost. CETLens reconstructs the data.
1. **Canvas Rendering**: Using Mozilla's `pdf.js`, CETLens creates hidden `<canvas>` elements and renders each page of the PDF into memory.
2. **Text Layer Extraction**: The `getTextContent()` method extracts raw text coordinate arrays.
3. **Regex Topology Mapping**: Because PDFs lack DOM structures, the text layers are concatenated into strings. The engine uses Regular Expressions (Regex) to map patterns like `Question ID : [0-9]+` and `Chosen Option : [1-4]`. The algorithm accounts for whitespace variations, fragmented substrings, and missing delimiters caused by PDF compression.

---

## 4. Database Architecture & Concurrency

During peak loads, multiple users compute their scores simultaneously. CETLens relies on Supabase (PostgreSQL) to handle this throughput. 

### Schema & JSONB Aggregation
Traditional SQL schemas might store one row per user submission, but querying thousands of rows to compute community averages can be resource-intensive. 
Instead, CETLens utilizes a `shift_stats` view that relies on PostgreSQL's `JSONB` data type.

A specific shift's record is structured as follows:
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
The `score_counts` dictionary functions as a frequency map. By mapping the raw score to a frequency count, the database payload size is significantly reduced.

### The RPC Function & Row-Level Locking
To prevent race conditions when two users submit a score to the same shift at the same time, CETLens uses a Remote Procedure Call (RPC) named `record_submission`. 
- This function uses PostgreSQL's `SELECT ... FOR UPDATE` row-level lock.
- It fetches the row for the specified shift, increments the `count`, adds to the `total_score`, updates the `highest`/`lowest` thresholds if necessary, and increments the specific key inside the `score_counts` JSONB object.
- It then releases the lock. This ensures writes maintain consistency and prevents dropped submissions during traffic spikes.

---

## 5. Statistical Analytics Module (`analytics.js`)

The `analytics.js` module updates the UI with statistics by fetching the JSONB data from Supabase.

### Data Hydration & Rendering Lifecycle
1. **Network Fetch**: The client performs a `SELECT` on the `shift_stats` view for the selected stream (e.g., PCM).
2. **Data Transformation**: The JSONB `score_counts` map is expanded back into a flat array of scores in JavaScript memory. 
3. **Chart Rendering Lifecycle**: Before drawing new charts, the script loops through the `_communityCharts` cache and calls `.destroy()` on existing `Chart.js` instances. This prevents overlapping canvases and manages memory usage.

### Visualization Strategy
The application uses various chart types to present data to the user:
- **Radar Charts**: Compares the user's subject-wise performance (Physics vs. Chemistry vs. Math) against the shift average.
- **Histograms**: Plots the expanded score arrays into buckets of 20 (e.g., 0-20, 20-40) to visualize the distribution of the examination scores. 
- **Horizontal Bar Charts**: Displays leaderboards showing the highest score across all shifts.

### Shift Difficulty Algorithm
CETLens incorporates an algorithm to evaluate shift difficulty, as outlier scores can skew a standard mean. 
The algorithm calculates:
- **The Normalized Mean**
- **The Median**: Evaluated directly from the JSONB frequency map to reduce outlier distortion.
- **Top / Bottom Percentages**: Calculates the percentage of students scoring above a high threshold (e.g., 120) versus below a low threshold (e.g., 80).
Shifts are then sorted dynamically based on this composite score.

---

## 6. Predictive Modeling (`predictor.js`)

The application models test scores, which typically follow a normal distribution (an S-curve), rather than using basic linear interpolation.

### Statistical Moments (Variance & Skewness)
The predictor algorithm analyzes the shape of the score distribution for a specific shift using statistical moments:
- **Variance (Standard Deviation)**: Measures the spread of the data. A higher standard deviation indicates greater differentiation in student scores.
- **Skewness**: The third standardized moment. A positive skew suggests lower average scores, while a negative skew indicates higher average scores.
The algorithm adjusts a user's raw score based on the Skewness of their specific shift. 

### Logit Interpolation Mapping
Once the user's score is adjusted against their shift's variance and skewness, it is mapped to a percentile curve.
1. The system references historical exam data stored in `percentile_curves.json`.
2. It applies a **Logit Transformation**: `log(p / (1 - p))` to linearize the S-curve of the historical percentiles.
3. It maps the user's adjusted score onto this linearized scale, performs linear interpolation between the two closest known boundary points, and maps the result back via the Inverse Logit function.
4. The output is a decimal-level percentile prediction (e.g., 98.452%).

---

## 7. Local Setup & Deployment Guide

Running CETLens locally or deploying it to a production server involves the following steps.

### Environment Setup
To connect the frontend parsing engine to your own Supabase instance:
1. Create a Supabase Project.
2. Execute the `rpc.sql` (if available in your legacy repository) to generate the tables, views, and RPC functions.
3. Open `script.js` and locate the Supabase initialization block.
4. Replace the `SUPABASE_URL` and `SUPABASE_ANON_KEY` variables with your specific project credentials.

### Running Locally
Because the application relies on Vanilla JavaScript and CDN scripts, there is no `npm install` or build step required.
1. Clone the repository.
2. Launch a local web server to bypass CORS restrictions. If you have Python installed, run:
   ```bash
   python -m http.server 8000
   ```
3. Navigate to `http://localhost:8000` in your browser.

### Deployment
Deploy the flat folder structure directly to any static web host:
- **GitHub Pages**: Push to the `main` branch and configure GitHub Pages in the repository settings.
- **Vercel / Netlify**: Connect your GitHub repository. The root directory will be automatically served without any build commands.

---

## 8. License & Credits

Designed and developed by **Swanand Jaju**.

This project utilizes the following open-source technologies:
- [Chart.js](https://www.chartjs.org/) for canvas charting.
- [pdf.js](https://mozilla.github.io/pdf.js/) by Mozilla for document rendering.
- [html2canvas](https://html2canvas.hertzen.com/) & [jsPDF](https://parall.ax/products/jspdf) for client-side report generation.
- [SheetJS](https://sheetjs.com/) for Excel/CSV parsing support.