# Job Octo

A private job board for MLOps, Python backend and AI Engineer roles in the UK and Europe.
It collects new openings every morning, scores each one against my CV, estimates the chance
of visa sponsorship, and tracks every application from shortlist to offer.

The site is hosted on GitHub Pages and updated by GitHub Actions. It costs nothing to run.

## Features

- **Daily feed.** New roles from the company job boards I track and from Sweden's public job board, refreshed each morning.
- **Match score.** Each role shows how much of its stack matches my CV, what is missing, and the likely visa route.
- **Resume from a job description.** Paste any posting (title, company, location and the full text). The site picks the role type and second title, orders the summary, skills, bullets and projects from my real experience, and opens an editor with the PDF updating beside it. It shows the ATS score, JD match, Readiness and a gaps list: skills I have not used, skills I have that the CV does not yet show (one click adds them), years asked, title fit, and requirements to check such as languages, sponsorship, clearance and certifications. Builds are kept under **Recent builds** with their scores, ready to reopen, add to Applied or turn into a cover letter.
- **Templates.** Five single-column, ATS-safe layouts, switchable while editing: **Octo Classic** (my own one-page style, the default), **Jake's Resume** (the layout most used in software, ML and DevOps hiring), **Harvard** (serif, education first; US corporate), **UK CV** (personal statement, up to two pages) and **Europass style** (EU institutions, universities and public bodies).
- **Tailored CV.** One click produces a one-page A4 CV for the role in my own template. The summary is assembled from true statements that match the posting's main requirements, kept within five lines.
- **Cover letter.** One click produces a one-page letter for the role from true, fixed paragraphs, naming the posting's skills that are on my CV and stating plainly any that are not.
- **Application board.** Applied, Technical test, In consideration, Rejected. Each stage scrolls on its own, so long lists never stretch the page.
- **Company discovery.** Each Monday, new licensed UK sponsors with a suitable role are suggested for tracking.
- **Private by design.** All personal data is encrypted. Visitors without the passcode see only a lock screen.
- **CV Match for friends.** A public page at `/match/` where anyone can upload a CV, choose roles (12 standard roles plus up to 3 of their own) and see matching live jobs across India, the UK, Europe, Sweden, the US, New Zealand and Turkey. The CV is read in their browser and never uploaded. It uses a separate job list (`data/public_jobs.json`) that holds postings only, built in the same daily run.

## How privacy works

| Item | Where it lives | Who can read it |
|---|---|---|
| Roles, companies, CV details | `data/vault.json`, encrypted with AES-256 | Only someone with the passcode |
| Passcode | GitHub secret `JOBHQ_PASSCODE` and my own devices | Only me and the scheduled jobs |
| Board progress and notes | This browser's local storage | Only me, on this device |
| Daily summary | A GitHub issue with counts only | Public, but contains no names |
| CV Match job list | `data/public_jobs.json`, job postings only | Public (no personal data) |

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

### 9. Morning email for 90%+ matches (optional, free)

The daily run can email you only the strongest new roles, from your own Gmail. Nothing is sent on days without one.

1. Turn on 2-Step Verification for your Google account: myaccount.google.com → **Security**.
2. Open myaccount.google.com/apppasswords, type a name such as `Job Octo` and select **Create**. Copy the 16-character password.
3. In the repository: **Settings → Secrets and variables → Actions → New repository secret**. Add:
   - `GMAIL_ADDRESS`: your Gmail address
   - `GMAIL_APP_PASSWORD`: the 16-character app password
   - `ALERT_EMAIL_TO` (optional): a different address to receive the alert
4. Optional: under the **Variables** tab add `ALERT_MIN_MATCH` (for example `85`) to change the 90% threshold.
5. Test it: **Actions → Daily job feed → Run workflow**, tick **Also send a test email**, then **Run workflow**. A test email with your 3 best open roles arrives within a few minutes.

## Schedule

| Workflow | When | Result |
|---|---|---|
| Daily job feed | Every day, 08:00 IST (02:30 UTC) | New roles on the site and a short summary issue |
| Weekly company discovery | Mondays, 07:30 IST (02:00 UTC) | Suggestions under **Discovered** |
| Add approved company | When you select **Track this company** and submit the issue | Company included from the next run |

GitHub may start scheduled runs a few minutes late.

## Everyday use

- **New for you:** filter by type, region, match and visa odds. Defaults: match 60% and visa 55% or higher.
- **Resume from JD:** paste the posting, choose a template (or keep Octo Classic), select **Build my best resume**, then edit on the left while the PDF updates in the middle and the scores and gaps update on the right.
- **Download tailored CV / Cover letter:** read each PDF once before sending, and add a line about the company to the letter.
- **Salary:** cards show the pay range when the job board or posting gives one, in its own currency. **Any salary** filters by the top of the range (roughly converted to pounds a year); roles without a salary stay listed unless **Salary listed** is on.
- **Interview prep:** every role's details, the editor's score panel and each Pipeline card show what the posting stresses most, the line of your CV that proves each point, the gaps to prepare a story for and the likely interview topics.
- **Relocation line:** set automatically from the job's location (also on Resume from JD, where the region is worked out from the Location box, the title or the posting). You can edit or clear it in the editor.
- **Pipeline:** drag a card to a new column, or open it to record dates and notes. Seven days after you apply, a red **Follow up** badge appears; after 14 days without an answer the card moves to **No reply**. **Followed up today** in the card restarts the clock.
- **This week:** applications, replies, interviews and your reply rate, with the last 6 weeks as a chart.
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
| Site still looks old after an upload | GitHub Pages caches files for up to 10 minutes. Wait, then reload once (Ctrl+Shift+R or Cmd+Shift+R). |
| No morning email | Check the run log under **Email the strongest new matches**. "Gmail refused the login" means the app password is wrong or 2-Step Verification is off. Days without a new 90%+ match send nothing. |
| No salaries showing | Salaries are saved from the next daily run on. Many postings, most Indian ones included, do not publish pay. |
| A friend sees few or odd matches on CV Match | Ask them to select **Clear my CV from this device**, then upload again. The page also explains which filter hid the roles and offers one-click fixes. |

## Changing the passcode

Open `Lock-your-data.html`, create a new `vault.json` with the new passcode, upload it to `data/` (replacing the old file), and update the `JOBHQ_PASSCODE` secret. The next daily run rebuilds the role list; companies approved after setup need approving again.

## Project structure

```
index.html             the site
assets/                styles, scripts, PDF library and fonts
assets/vendor/extra_fonts_vfs.js   italic and serif fonts for the Jake's and Harvard templates (loaded only when used)
match/                 CV Match page for friends
data/vault.json        all personal data, encrypted
data/terms.json        skills vocabulary used for matching
scripts/               daily feed, weekly discovery, encryption
.github/workflows/     schedules for the scripts above
```

## Credits

PDF generation by [pdfmake](https://github.com/bpampuch/pdfmake) (MIT). PDF preview by [pdf.js](https://github.com/mozilla/pdf.js) (Apache 2.0). Carlito and Liberation Serif fonts (SIL Open Font License 1.1).
Sweden listings from the JobTech JobSearch API (Arbetsförmedlingen). UK sponsor data from the Home Office register of licensed sponsors.
