# Job Hunt HQ

Mayur Dokras's personal job board: MLOps, Python backend and AI Engineer roles in
the UK, Europe and Sweden, scored against his CV, with visa odds for applying from India.
Runs free on GitHub (Pages for the site, Actions for the daily and weekly checks).

## What it does

| When | What happens |
|---|---|
| Every day, 06:00 UTC (07:00 UK summer time, 11:30 IST) | `scripts/fetch_jobs.py` reads the job boards of every tracked company plus Sweden's Platsbanken, keeps roles that fit, scores them, updates `data/jobs.json`, and opens a GitHub issue with the day's best new roles (GitHub emails it to you). |
| Every Monday, 05:30 UTC | `scripts/discover.py` checks the UK Home Office sponsor register for companies you don't track yet, looks for a public job board, and lists the ones with a matching role under **Discovered**. |
| When you click **Track this company** | A GitHub issue opens; submit it and `scripts/add_company.py` adds the company to the daily feed within a minute. |

Your board, notes and hidden roles stay in your browser (localStorage). Use **Export backup** now and then.

## Setup (about 10 minutes, once)

1. **Create the repository.** On GitHub: New repository → name it `job-hunt-hq` → **Public** → Create.
   (GitHub Pages is free only for public repositories. Only the job list is public; your board stays in your browser.)
2. **Upload the files.** Open the repo → "uploading an existing file" → drag in *everything* from this folder,
   including the hidden `.github` folder (on a Mac press Cmd+Shift+. in Finder to show it) → Commit.
3. **Allow the bot to save results.** Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save.
4. **Turn on the website.** Settings → Pages → Source: *Deploy from a branch* → Branch: `main`, folder `/ (root)` → Save.
   After a minute the site is live at `https://<your-username>.github.io/job-hunt-hq/`.
5. **Run the first check now.** Actions tab → *Daily job feed* → **Run workflow**. It takes a few minutes; refresh the site afterwards.
6. **Get the email digest.** Click **Watch** (top of the repo) → *All activity*. Install the GitHub mobile app for phone alerts.

## Daily use

- **New for you**: corner badge = skills match; purple chip = visa odds from India. Defaults: match 60%+, visa 55%+. "70%+ sponsors only" narrows to the strongest sponsors.
- **Download tailored CV**: builds a one-page A4 PDF from `data/profile.json` in your browser. It changes the second title, summary, bold terms and the order of skills and bullets. It never changes titles, dates, metrics, projects or certifications. Read it once before you send it.
- **Board**: drag cards across Shortlisted → Applied → In consideration → Technical test → HR round → Salary discussion → Accepted / Rejected, or open a card to set dates and notes.

## Changing things

| To change | Edit |
|---|---|
| Your CV text, summaries, skills | `data/profile.json` |
| Companies tracked | `data/companies.json` (`ats` + `token` if you know the job board; leave them out and the daily run finds it) |
| Which titles count, skills list, visa rules | `scripts/scoring.py` |
| Sweden search words | `SWEDEN_QUERIES` in `scripts/fetch_jobs.py` |

## Notes and limits

- Readable job boards: Greenhouse, Lever, Ashby, Workable, Recruitee, Personio, Teamtailor, SmartRecruiters, Sweden's JobTech API. Companies with their own careers site (Picnic, Nord Security) stay on the board from the starter list for 30 days; add new roles from them with **+ Add role manually**.
- Visa odds are rules of thumb from the posting text and the company's sponsorship history, not a promise. Check the employer's sponsor licence and the salary threshold before you rely on them.
- Not yet included: EURES (its search address is unofficial and may change) and the Dutch, Irish and US sponsor lists (their download links need checking first).
- GitHub pauses scheduled workflows in repos with no activity for 60 days; the daily commit counts as activity. If a run is ever paused, the Actions tab shows an **Enable** button.
- pdfmake (MIT licence) is bundled in `assets/vendor/`.
