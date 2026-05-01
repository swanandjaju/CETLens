# ExamAnalyzer Pro

ExamAnalyzer Pro is a web-based tool designed to help MHT-CET students instantly analyze their response sheets[cite: 1]. By uploading an MHT-CET Objection Portal response sheet, users can generate a comprehensive performance dashboard entirely locally, ensuring that no personal data is ever uploaded or stored on an external server[cite: 1, 2].

## Key Features

*   **100% Local Processing**: All file parsing and data extraction happen locally on your device to ensure complete privacy[cite: 1].
*   **Multiple File Format Support**: Accepts `.html`, `.htm`, `.pdf`, and `.txt` (pipe-delimited) files[cite: 1, 2].
*   **Stream Selection**: Seamlessly toggle between PCM (Physics, Chemistry, Mathematics) and PCB (Physics, Chemistry, Biology) scoring modes[cite: 1].
*   **Mismatched Stream Detection**: Automatically detects if the uploaded question count does not match the selected stream and prompts the user to switch[cite: 2].
*   **Comprehensive Analytics Dashboard**: 
    *   Calculates total score, overall accuracy, correct answers, incorrect answers, and unattempted questions[cite: 2].
    *   Visualizes overall accuracy using a dynamic donut chart[cite: 1, 2].
    *   Displays sectional performance (Physics, Chemistry, Mathematics/Biology) using bar tracks and subject-wise pie charts[cite: 1, 2].
*   **Interactive Question Viewer**: 
    *   Review individual questions alongside your candidate response and the correct option[cite: 1].
    *   Filter questions by status: All, Correct, Incorrect, or Unattempted[cite: 1, 2].
    *   View cropped question images directly within the app if a PDF response sheet is uploaded[cite: 2].
*   **Export & Sharing Capabilities**:
    *   **CSV Export**: Download raw question data for deeper spreadsheet analysis[cite: 1, 2].
    *   **PDF Report**: Generate a detailed, formatted A4 performance report document[cite: 1, 2].
    *   **Share Card**: Create and download an image of your score card to easily share your results[cite: 1, 2].

## Tech Stack & Libraries

The application is built using native HTML, CSS, and JavaScript, enhanced by a clean, neumorphic/industrial skeuomorphism design system[cite: 2, 3]. It utilizes the following external libraries via CDN:

*   **Chart.js (v4.4.1)**: Powers the donut and pie charts for accuracy visualization[cite: 1].
*   **PDF.js (v3.4.120)**: Used to parse text and render cropped question images from uploaded PDF response sheets[cite: 1, 2].
*   **jsPDF (v2.5.1)**: Generates the downloadable PDF performance reports[cite: 1, 2].
*   **html2canvas (v1.4.1)**: Captures the DOM to generate the downloadable PNG share cards[cite: 1, 2].
*   **Canvas Confetti (v1.9.3)**: Triggers a celebratory confetti animation for scores of 150 or higher[cite: 1, 2].

## How It Works

1.  **Upload Sheet**: Drop your MHT-CET objection portal HTML or PDF response sheet into the designated upload zone[cite: 1].
2.  **Auto-Parse**: The local parser extracts every question, your selected answer, and the correct answer in under a second[cite: 1].
3.  **Full Dashboard**: Instantly view your score, accuracy, subject breakdowns, and review questions one by one[cite: 1].
4.  **Export & Share**: Download a score card image or export your raw data as a CSV or PDF for further review[cite: 1].

## Credits

ExamAnalyzer Pro was built by Swanand Jaju, a First Year AIML student at Walchand College of Engineering, Sangli[cite: 1].
