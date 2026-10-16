"""Morning email with only the strongest new matches.

Runs in the daily workflow after the fetch, while data/jobs.json is unlocked.
Sends through your own Gmail with an app password, so it is free (Gmail allows
about 500 messages a day; this sends at most one). Nothing is sent on days
without a new match at or above the threshold.

Repository secrets (Settings > Secrets and variables > Actions):
  GMAIL_ADDRESS       the Gmail address that sends the alert
  GMAIL_APP_PASSWORD  a 16-character Google app password (not your normal password)
  ALERT_EMAIL_TO      optional; where to send it (defaults to GMAIL_ADDRESS)
Repository variable (optional):
  ALERT_MIN_MATCH     minimum match %, default 90

    python scripts/email_alert.py          # today's new matches
    python scripts/email_alert.py --test   # send the 3 best open roles now, to check the setup
"""
import datetime as dt
import html
import json
import os
import smtplib
import sys
from email.message import EmailMessage
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
TODAY = dt.date.today().isoformat()
SYM = {"GBP": "£", "EUR": "€", "USD": "$", "INR": "₹"}
PER = {"year": "", "month": " / month", "day": " / day", "hour": " / hour"}


def money(s):
    if not s:
        return ""
    sym = SYM.get(s["cur"], s["cur"] + " ")

    def short(n):
        if s["cur"] == "INR" and n >= 100_000:
            return f"{n / 100_000:.1f}".rstrip("0").rstrip(".") + "L"
        return f"{n / 1000:.0f}k" if n >= 10_000 else f"{n:,}"
    rng = short(s["min"]) if s["min"] == s["max"] else f"{short(s['min'])}–{short(s['max'])}"
    return f"{sym}{rng}{PER.get(s.get('per'), '')}"


def pick(jobs, minimum, test):
    open_jobs = [j for j in jobs if not j.get("closed")]
    if test:
        return sorted(open_jobs, key=lambda j: -j.get("match", 0))[:3]
    return sorted([j for j in open_jobs if j.get("first_seen") == TODAY and j.get("match", 0) >= minimum],
                  key=lambda j: (-j["match"], -j.get("visa", -1)))


def site_url():
    repo = os.environ.get("GITHUB_REPOSITORY", "")
    if "/" not in repo:
        return ""
    owner, name = repo.split("/", 1)
    return f"https://{owner.lower()}.github.io/{name}/#feed"


def build(jobs, minimum, test):
    when = dt.date.today().strftime("%-d %b")
    n = len(jobs)
    subject = (f"Test: Job Octo email alert works · {when}" if test else
               f"{n} new {minimum}%+ match{'es' if n > 1 else ''} · {when}")
    text, rows = [], []
    for j in jobs:
        visa = "N/A" if j.get("visa", -1) < 0 else f"{j['visa']}%"
        pay = money(j.get("salary"))
        meta = " · ".join(x for x in [j.get("location") or j.get("region", ""), f"visa {visa}", pay] if x)
        text.append(f"{j['match']}%  {j['title']} at {j['company']}\n     {meta}\n     {j.get('url', '')}")
        rows.append(f"""<tr><td style="padding:14px 0;border-bottom:1px solid #E6E6E6;vertical-align:top;width:64px">
          <div style="font:600 22px/1 Inter,Arial,sans-serif;color:#D9321F">{j['match']}%</div></td>
          <td style="padding:14px 0;border-bottom:1px solid #E6E6E6">
          <a href="{html.escape(j.get('url', ''))}" style="font:600 15px Inter,Arial,sans-serif;color:#0A0A0A;text-decoration:none">{html.escape(j['title'])}</a>
          <div style="font:14px Inter,Arial,sans-serif;color:#0A0A0A;margin-top:2px">{html.escape(j['company'])}</div>
          <div style="font:13px Inter,Arial,sans-serif;color:#6E6E6E;margin-top:2px">{html.escape(meta)}</div></td></tr>""")
    link = site_url()
    intro = ("This is a test message. Your alerts are set up correctly; from tomorrow you will only hear from Job Octo "
             f"on mornings with a new {minimum}%+ match." if test else
             f"New this morning and scored {minimum}% or higher against your CV.")
    body_html = f"""<div style="background:#FAFAFA;padding:24px 12px"><div style="max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E6E6E6;border-radius:14px;padding:24px">
      <div style="font:600 13px Inter,Arial,sans-serif;color:#D9321F;letter-spacing:.02em">JOB OCTO</div>
      <div style="font:600 24px/1.2 Inter,Arial,sans-serif;color:#0A0A0A;letter-spacing:-.02em;margin:6px 0 4px">{html.escape(subject.split(' · ')[0])}</div>
      <div style="font:14px Inter,Arial,sans-serif;color:#6E6E6E;margin-bottom:8px">{html.escape(intro)}</div>
      <table style="width:100%;border-collapse:collapse">{''.join(rows)}</table>
      {f'<a href="{link}" style="display:inline-block;margin-top:18px;background:#D9321F;color:#FFFFFF;font:600 14px Inter,Arial,sans-serif;padding:10px 18px;border-radius:999px;text-decoration:none">Open Job Octo</a>' if link else ''}
    </div></div>"""
    body_text = intro + "\n\n" + "\n\n".join(text) + (f"\n\nOpen Job Octo: {link}" if link else "")
    return subject, body_text, body_html


def main():
    test = "--test" in sys.argv
    user, pw = os.environ.get("GMAIL_ADDRESS", "").strip(), os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "")
    if not user or not pw:
        print("email alert: GMAIL_ADDRESS / GMAIL_APP_PASSWORD secrets not set, skipping")
        return
    to = os.environ.get("ALERT_EMAIL_TO", "").strip() or user
    try:
        minimum = int(os.environ.get("ALERT_MIN_MATCH", "") or 90)
    except ValueError:
        minimum = 90
    path = DATA / "jobs.json"
    if not path.exists():
        print("email alert: data/jobs.json not found (is the vault open?), skipping")
        return
    jobs = pick(json.loads(path.read_text(encoding="utf-8")).get("jobs", []), minimum, test)
    if not jobs:
        print(f"email alert: no new {minimum}%+ matches today, nothing sent")
        return
    subject, body_text, body_html = build(jobs, minimum, test)
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, f"Job Octo <{user}>", to
    msg.set_content(body_text)
    msg.add_alternative(body_html, subtype="html")
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=30) as s:
            s.login(user, pw)
            s.send_message(msg)
    except smtplib.SMTPAuthenticationError:
        # a failed alert must never stop the daily data from being saved
        print("email alert: Gmail refused the login. Check GMAIL_ADDRESS and that GMAIL_APP_PASSWORD is an app password.")
        return
    except Exception as e:
        print("email alert: could not send:", e)
        return
    print(f"email alert: sent {len(jobs)} role(s) to {to}")


if __name__ == "__main__":
    main()
