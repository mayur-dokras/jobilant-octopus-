# Job Octo

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

## How privacy works

| Item | Where it lives | Who can read it |
|---|---|---|
| Roles, companies, CV details | `data/vault.json`, encrypted with AES-256 | Only someone with the passcode |
| Passcode | GitHub secret `JOBHQ_PASSCODE` and my own devices | Only me and the scheduled jobs |
| Board progress and notes | This browser's local storage | Only me, on this device |
| Daily summary | A GitHub issue with counts only | Public, but contains no names |

The source code is public. The data is not.

## Setup

Allow about 15 minutes. Do these steps once, in this order.

### 1. Lock the starter data

1. Open `Lock-your-data.html` (it sits next to this folder, not inside it) by double-clicking it.
2. Choose a passcode of at least 12 characters and click **Create vault.json**.
3. Move the downloaded `vault.json` into `job-hunt-hq/data/`.
4. Keep `Lock-your-data.html` on your computer. Never upload it.

### 2. Create the repository

1. On GitHub, select **New repository**.
2. Name it `job-hunt-hq`, set it to **Public**, and leave every "Add" option unticked.
3. Select **Create repository**.

### 3. Upload the files

1. On the empty repository page, select **uploading an existing file**.
2. Drag in the *contents* of the `job-hunt-hq` folder: `index.html`, `README.md`, `.gitignore`, and the `assets`, `data`, `scripts` and `.github` folders.
3. Hidden items (`.github`, `.gitignore`) are not shown by default. Show them first:
   macOS Finder, press `Cmd + Shift + .`; Windows File Explorer, **View → Show → Hidden items**.
4. Select **Commit changes**.
5. Confirm that `.github/workflows` contains three files and `data` contains `vault.json` and `terms.json`.

### 4. Add the passcode secret

1. Go to **Settings → Secrets and variables → Actions → New repository secret**.
2. Name: `JOBHQ_PASSCODE`. Value: the passcode from step 1, exactly as typed.
3. Select **Add secret**.

### 5. Allow the scheduled jobs to save

1. Go to **Settings → Actions → General**.
2. Under *Actions permissions*, choose **Allow all actions and reusable workflows**.
3. Under *Workflow permissions*, choose **Read and write permissions**, then **Save**.

### 6. Publish the site

1. Go to **Settings → Pages**.
2. Source: **Deploy from a branch**. Branch: **main**, folder **/ (root)**. Select **Save**.
3. After one or two minutes the address appears: `https://<username>.github.io/job-hunt-hq/`.
4. Open it, enter the passcode and tick **Remember on this device**.

### 7. Run the first update

1. Open the **Actions** tab. If asked, enable workflows.
2. Select **Daily job feed → Run workflow**.
3. A green tick after a few minutes means it worked. Refresh the site; the top line shows the time of the update.

### 8. Turn on notifications

1. On the repository page select **Watch → All Activity**.
2. In your GitHub notification settings, keep **Email** switched on.
3. Optional: install the GitHub mobile app for phone alerts.

## Schedule

| Workflow | When | Result |
|---|---|---|
| Daily job feed | Every day, 08:00 IST (02:30 UTC) | New roles on the site and a short summary issue |
| Weekly company discovery | Mondays, 07:30 IST (02:00 UTC) | Suggestions under **Discovered** |
| Add approved company | When you select **Track this company** and submit the issue | Company included from the next run |

GitHub may start scheduled runs a few minutes late.

## Everyday use

- **New for you:** filter by type, region, match and visa odds. Defaults: match 60% and visa 55% or higher.
- **Download tailored CV / Cover letter:** read each PDF once before sending, and add a line about the company to the letter.
- **Board:** drag a card to a new column, or open it to record dates and notes.
- **Export backup:** download your board now and then. Use **Import** on another device.
- **My CV details:** edit the text the CV button uses. Changes stay on that device.
- **Lock:** forgets the passcode on the current device.

## Troubleshooting

| Problem | Fix |
|---|---|
| Run fails at "Unlock data" | The secret is missing or differs from the passcode used in step 1. Re-enter it in step 4. |
| Run fails at "Save results" with error 403 | Workflow permissions are not set to read and write. Repeat step 5. |
| Site shows 404 | Wait two minutes, then check step 6 (branch `main`, folder `/ (root)`). |
| Passcode not accepted on the site | Check capital letters and spaces. It must match the secret exactly. |
| No update for a day | Open **Actions**. If scheduled runs were paused after a quiet period, select **Enable**. |
| Board empty on a new device | Boards are stored per browser. Use **Export backup** and **Import**. |

## Changing the passcode

Open `Lock-your-data.html`, create a new `vault.json` with the new passcode, upload it to `data/` (replacing the old file), and update the `JOBHQ_PASSCODE` secret. The next daily run rebuilds the role list; companies approved after setup need approving again.

## Project structure

```
index.html             the site
assets/                styles, scripts, PDF library and font
data/vault.json        all personal data, encrypted
data/terms.json        skills vocabulary used for matching
scripts/               daily feed, weekly discovery, encryption
.github/workflows/     schedules for the scripts above
```

## Credits

PDF generation by [pdfmake](https://github.com/bpampuch/pdfmake) (MIT). Carlito font (SIL Open Font License 1.1).
Sweden listings from the JobTech JobSearch API (Arbetsförmedlingen). UK sponsor data from the Home Office register of licensed sponsors.
