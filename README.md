# ExamAnalyzer Pro

[![Live Demo](https://img.shields.io/badge/Live_Demo-Access_Here-success?style=for-the-badge)](https://mhtcetmarkscalculator.onrender.com/)

ExamAnalyzer Pro is a web-based tool designed to help MHT-CET students instantly analyze their response sheets. By uploading an MHT-CET Objection Portal response sheet, users can generate a comprehensive performance dashboard entirely locally, ensuring that no personal data is ever uploaded or stored on an external server.

**🔗 Try it out here:** [https://mhtcetmarkscalculator.onrender.com/](https://mhtcetmarkscalculator.onrender.com/)

## Key Features

*   **100% Local Processing**: All file parsing and data extraction happen locally on your device to ensure complete privacy.
*   **Multiple File Format Support**: Accepts `.html`, `.htm`, `.pdf`, and `.txt` (pipe-delimited) files.
*   **Stream Selection**: Seamlessly toggle between PCM (Physics, Chemistry, Mathematics) and PCB (Physics, Chemistry, Biology) scoring modes.
*   **Mismatched Stream Detection**: Automatically detects if the uploaded question count does not match the selected stream and prompts the user to switch.
*   **Comprehensive Analytics Dashboard**: 
    *   Calculates total score, overall accuracy, correct answers, incorrect answers, and unattempted questions.
    *   Visualizes overall accuracy using a dynamic donut chart.
    *   Displays sectional performance (Physics, Chemistry, Mathematics/Biology) using bar tracks and subject-wise pie charts.
*   **Interactive Question Viewer**: 
    *   Review individual questions alongside your candidate response and the correct option.
    *   Filter questions by status: All, Correct, Incorrect, or Unattempted.
    *   View cropped question images directly within the app if a PDF response sheet is uploaded.
*   **Export & Sharing Capabilities**:
    *   **CSV Export**: Download raw question data for deeper spreadsheet analysis.
    *   **PDF Report**: Generate a detailed, formatted A4 performance report document.
    *   **Share Card**: Create and download an image of your score card to easily share your results.

## Tech Stack & Libraries

The application is built using native HTML, CSS, and JavaScript, enhanced by a clean, neumorphic/industrial skeuomorphism design system. It utilizes the following external libraries via CDN:

*   **Chart.js (v4.4.1)**: Powers the donut and pie charts for accuracy visualization.
*   **PDF.js (v3.4.120)**: Used to parse text and render cropped question images from uploaded PDF response sheets.
*   **jsPDF (v2.5.1)**: Generates the downloadable PDF performance reports.
*   **html2canvas (v1.4.1)**: Captures the DOM to generate the downloadable PNG share cards.
*   **Canvas Confetti (v1.9.3)**: Triggers a celebratory confetti animation for scores of 150 or higher.

## How It Works

1.  **Upload Sheet**: Drop your MHT-CET objection portal HTML or PDF response sheet into the designated upload zone.
2.  **Auto-Parse**: The local parser extracts every question, your selected answer, and the correct answer in under a second.
3.  **Full Dashboard**: Instantly view your score, accuracy, subject breakdowns, and review questions one by one.
4.  **Export & Share**: Download a score card image or export your raw data as a CSV or PDF for further review.

## Credits

ExamAnalyzer Pro was built by Swanand Jaju, a First Year AIML student at Walchand College of Engineering, Sangli.
