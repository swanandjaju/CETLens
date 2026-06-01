# CETLens

**Instant MHT-CET Response Sheet Analyzer & Community Analytics Platform**

Upload your official MHT-CET Objection Portal response sheet (HTML, PDF, or TXT) and generate a fully interactive analytics dashboard instantly. CETLens operates entirely locally on your device, ensuring zero data privacy risks while contributing to a crowd-sourced, sybil-resistant live community analytics engine.

**Live Application:** [https://cet-lens.vercel.app](https://cet-lens.vercel.app)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Core Features](#core-features)
3. [Data Integrity & Anti-Poisoning Framework](#data-integrity--anti-poisoning-framework)
4. [Machine Learning & Statistical Analysis](#machine-learning--statistical-analysis)
5. [Tech Stack](#tech-stack)
6. [Architecture and Application Flow](#architecture-and-application-flow)
7. [Database Structure](#database-structure)
8. [Local Setup & Deployment](#local-setup--deployment)
9. [Performance Optimizations](#performance-optimizations)
10. [License](#license)

---

## Project Overview

After every MHT-CET examination attempt, students receive a raw response sheet that is notoriously difficult to interpret manually. CETLens solves this by automatically parsing the raw HTML/PDF to extract question IDs, candidate answers, and correct answers. 

It calculates the total score, subject-wise breakdown, and accuracy metrics without ever transmitting the raw file to a server. Simultaneously, CETLens aggregates anonymized score statistics to generate real-time community insights, including shift-wise averages, percentile distributions, and difficulty rankings across both Attempt 1 and Attempt 2.

---

## Core Features

### Client-Side Parsing Engine
- **Multi-Format Support:** Accepts HTML/MHTML saves from the Objection Portal, direct PDF prints, and pipe-delimited TXT exports.
- **Section Detection:** Automatically identifies Physics, Chemistry, Mathematics (PCM), and Biology (PCB) sections using text heuristics and positional inference.
- **PDF Extraction:** Utilizes `pdf.js` to extract text layers and render bounding boxes, generating inline thumbnail crops for every question securely in the browser.

### Interactive Dashboard
- **Score Visualization:** Custom-built SVG arc gauges display the candidate's total score (out of 200 for PCM, 150 for PCB).
- **Subject-Wise Analytics:** Chart.js doughnut charts display subject-specific performance and accuracy ratios.
- **Question Review Grid:** A fully filterable table (Correct, Incorrect, Unattempted) with keyboard navigation and modal lightboxes for detailed question review.

### Live Community Analytics
- **Real-Time Aggregation:** Post-submission banners immediately display the user's estimated percentile, shift average, and relative standing.
- **Shift-Wise Analysis:** Dedicated dashboards comparing individual performance against the shift mean and median using radar charts and score histograms.
- **Percentile Predictor:** An experimental projection model estimating percentiles based on live shift statistics and historical density curves.

---

## Data Integrity & Anti-Poisoning Framework

Because the official CET Cell response sheets lack a forced cryptographic identifier (like an application number) that reliably survives browser downloads, CETLens employs a robust, multi-layered data integrity framework to prevent spam, duplicate submissions, and deliberate data poisoning.

1. **SHA-256 Duplicate Blocking:** The frontend extracts every Question ID and selected Option ID, concatenating them into a strict sequence. This sequence is hashed using the Web Crypto API (`SHA-256`). If the database detects a hash collision, the submission is instantly rejected as a duplicate.
2. **Shift Signature Locks:** To prevent malicious actors from uploading response sheets into the wrong shift to manipulate averages, the backend generates a unique cryptographic "signature" from all question IDs present in the file. Once 35 authentic submissions establish the signature for a specific shift, the shift is permanently "locked." Any subsequent uploads containing mismatched signatures are automatically flagged and rejected.
3. **Mathematical Impossibility Filters:** The backend silently discards submissions with mathematically impossible score distributions (e.g., scores exceeding theoretical maximums or missing mandatory subject data).
4. **Sybil Resistance:** strict IP-based rate limiting caps unique uploads to a maximum of 3 per IP address per shift, allowing genuine shared usage while blocking automated spam.

---

## Data & Statistical Analysis

CETLens serves as a foundation for rigorous statistical analysis of the MHT-CET examination. 

- **Data Engineering:** The platform exports cleaned, feature-engineered datasets containing score frequencies, standard deviations, variances, and skewness metrics for every shift.
- **Detailed Reports:** A comprehensive Data Analytics Report is generated post-examination, providing detailed shift difficulty rankings, score compression indices, and subject dominance analysis. This report is directly accessible via the platform dashboard.

---

## Tech Stack

CETLens is intentionally built without a heavy framework or build step. It relies entirely on vanilla web technologies and public CDNs to maximize performance and transparency.

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6+)
- **Backend & Database:** Supabase (PostgreSQL, REST API)
- **Data Visualization:** Chart.js
- **PDF Processing:** pdf.js
- **Exports:** jsPDF, html2canvas
- **Cryptography:** Web Crypto API

---

## Architecture and Application Flow

CETLens is a Single Page Application (SPA) utilizing a custom hash-based router. 

1. **Initialization:** The application applies the user's preferred theme and checks `localStorage` for an existing session.
2. **File Processing:** Uploaded files are parsed locally via `DOMParser` or `pdf.js`. 
3. **Scoring:** The scoring engine applies the MHT-CET marking scheme (+2 for Math, +1 for Physics/Chemistry/Biology, 0 negative marking).
4. **Data Aggregation:** A background asynchronous call securely transmits the anonymized statistics (Total Score, Subject Scores, SHA-256 Hash, Shift ID) to the Supabase backend via an upsert operation.
5. **Session Management:** The parsed question array is serialized to `localStorage`, and PDF image crops are persisted in `IndexedDB`.

---

## Database Structure

The Supabase PostgreSQL database is optimized for irreversible, anonymized aggregation. Raw user data is never stored.

### `shift_stats` Table
- `id` (uuid): Primary key
- `stream` (text): PCM or PCB
- `attempt` (text): Attempt 1 or Attempt 2
- `shift` (text): Shift identifier
- `count` (integer): Total valid submissions
- `total_score` (numeric): Cumulative score sum
- `highest` / `min_score` (integer): Range boundaries
- `score_counts` (jsonb): A frequency map (e.g., `{"142": 3}`) used for percentile calculation without storing individual rows.
- `subject_sums` (jsonb): Cumulative subject scores for calculating shift averages.

**Row Level Security (RLS):** Policies are strictly configured to allow anonymous reads and upserts on aggregate fields, while explicitly denying standard inserts, deletes, or arbitrary modifications.

---

## Local Setup & Deployment

CETLens requires no build pipeline. 

1. Clone the repository:
   ```bash
   git clone https://github.com/swanandjaju/CETLens.git
   ```
2. Serve the directory using any local web server:
   ```bash
   python3 -m http.server 8080
   # OR
   npx serve .
   ```
3. Open `http://localhost:8080` in your browser.

*Note: For the Web Crypto API (`crypto.subtle`) to function correctly, the application must be served over a secure context (`localhost` or `HTTPS`).*

---

## Performance Optimizations

- **TTL In-Memory Caching:** Supabase read requests are cached client-side for 15 minutes, drastically reducing network round-trips during navigation.
- **IndexedDB Cursor Limits:** Image caches are strictly bound to the active session. `IndexedDB` stores are cleared prior to new uploads to prevent storage bloat.
- **Progressive Feedback:** PDF rendering is resource-intensive. The UI provides asynchronous step-by-step loading states (Extracting text → Parsing → Rendering images) to maintain an active user experience.
- **Dynamic CSS Theming:** Dark mode toggling relies on a single `data-theme` attribute mutation on the root element, ensuring instantaneous `<O(1)>` style recalculation.

---

## License

This project is licensed under the MIT License. You are free to use, copy, modify, merge, publish, distribute, sublicense, or sell the software, provided the original copyright notice and license text are included.

---

Built with ❤️ by Swanand Jaju — WCE Sangli, 2026