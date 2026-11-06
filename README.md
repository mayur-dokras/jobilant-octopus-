# Job Octo

A private job board for MLOps, Python backend and AI Engineer roles in the UK and Europe.
It collects new openings every morning, scores each one against my CV, estimates the chance
of visa sponsorship, and tracks every application from shortlist to offer.

The site is hosted on GitHub Pages and updated by GitHub Actions. It costs nothing to run.

## Features

- **Daily feed.** New roles from the company job boards I track and from Sweden's public job board, refreshed each morning.
- **Match score.** Each role is scored the way a recruiter reads it (`assets/jdscore.js`, used by the site and the daily run). Must-haves count 3, responsibilities 1.5, nice-to-haves 1, and company or benefits text counts 0. "A and B" needs both, while "A or B" and "such as A, B" need one. Tools match exactly: TypeScript never counts as NestJS, and a similar tool earns 0.3 as "related experience". CV evidence weighs 1.0 in an experience bullet, 0.8 in a project, 0.6 in the summary and 0.5 in the skills list; anything marked "(currently learning)" counts 0.25 at most. One missing must-have caps the score at 70%, two at 60%, and each year short costs 5 points. Eligibility rules show as blockers. Scores are rounded to the nearest 5, with a one-line reason and the CV line behind every point. Tests: `node --test tests/jdscore.test.js`.
- **Resume from a job description.** Paste any posting (title, company, location and the full text). The site picks the role type and second title, orders the summary, skills, bullets and projects from my real experience, and opens an editor with the PDF updating beside it. It shows the ATS score, JD match, Readiness and a gaps list: skills I have not used, skills I have that the CV does not yet show (one click adds them), years asked, title fit, and requirements to check such as languages, sponsorship, clearance and certifications. Builds are kept under **Recent builds** with their scores, ready to reopen, add to Applied or turn into a cover letter.
- **Templates.** Five single-column, ATS-safe layouts, switchable while editing: **Octo Classic** (my own one-page style, the default), **Jake's Resume** (the layout most used in software, ML and DevOps hiring), **Harvard** (serif, education first; US corporate), **UK CV** (personal statement, up to two pages) and **Europass style** (EU institutions, universities and public bodies).
- **Tailored CV.** One click produces a one-page A4 CV for the role in my own template. The summary is assembled from true statements that match the posting's main requirements, kept within five lines.
- **Cover letter.** One click produces a one-page letter for the role from true, fixed paragraphs, naming the posting's skills that are on my CV and stating plainly any that are not.
- **Application board.** Applied, Technical test, In consideration, Rejected. Each stage scrolls on its own, so long lists never stretch the page.
- **Company discovery.** Each Monday, new licensed UK sponsors with a suitable role are suggested for tracking.
- **Private by design.** All personal data is encrypted. Visitors without the passcode see only a lock screen.
- **CV Match for friends.** A public page at `/match/` where anyone can upload a CV, choose roles (12 standard roles plus up to 3 of their own) and see matching live jobs across India, the UK, Europe, Sweden, the US, New Zealand and Turkey. The CV is read in their browser and never uploaded. It uses a separate job list (`data/public_jobs.json`) that holds postings only, built in the same daily run.
