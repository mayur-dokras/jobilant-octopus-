# Job Octo 🐙

A private job board for MLOps, Python backend and AI Engineer roles in the UK and Europe.
It collects new openings every morning, scores each one against my CV, estimates the chance
of visa sponsorship, and tracks every application from shortlist to offer.

The site is hosted on GitHub Pages and updated by GitHub Actions. It costs nothing to run.

## Features

- **Daily feed.** New roles from the company job boards I track and from Sweden's public job board, refreshed each morning.
- **Match score.** Each role shows how much of its stack matches my CV, what is missing, and the likely visa route.
- **Tailored CV.** One click produces a one-page A4 CV for the role in my own template. The summary is assembled from true statements that match the posting's main requirements, kept within five lines.
- **Cover letter.** One click produces a one-page letter for the role from true, fixed paragraphs, naming the posting's skills that are on my CV and stating plainly any that are not.
- **Application board.** Shortlisted, Applied, In consideration, Technical test, HR round, Salary discussion, Accepted, Rejected.
- **Company discovery.** Each Monday, new licensed UK sponsors with a suitable role are suggested for tracking.
- **Private by design.** All personal data is encrypted. Visitors without the passcode see only a lock screen.


## Troubleshooting

| Problem | Fix |
|---|---|
| Run fails at "Unlock data" | The secret is missing or differs from the passcode used in step 1. Re-enter it in step 4. |
| Run fails at "Save results" with error 403 | Workflow permissions are not set to read and write. Repeat step 5. |
| Site shows 404 | Wait two minutes, then check step 6 (branch `main`, folder `/ (root)`). |
| Passcode not accepted on the site | Check capital letters and spaces. It must match the secret exactly. |
| No update for a day | Open **Actions**. If scheduled runs were paused after a quiet period, select **Enable**. |
| Board empty on a new device | Boards are stored per browser. Use **Export backup** and **Import**. |


## Credits

PDF generation by [pdfmake](https://github.com/bpampuch/pdfmake) (MIT). Carlito font (SIL Open Font License 1.1).
Sweden listings from the JobTech JobSearch API (Arbetsförmedlingen). UK sponsor data from the Home Office register of licensed sponsors.
