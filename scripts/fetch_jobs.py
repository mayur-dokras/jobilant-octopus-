"""Daily run: read every tracked company's job board plus Sweden's Platsbanken,
keep MLOps / Python backend / AI Engineer roles at Mayur's level, score them,
write data/jobs.json and post a short digest as a GitHub issue.

Run locally:  python scripts/fetch_jobs.py
"""
import datetime as dt
import hashlib
import json
import os
import sys
import urllib.request

sys.path.insert(0, os.path.dirname(__file__))
import ats  # noqa: E402
from scoring import (HAVE, TERMS, keep_title, kind_of, load_json, region_of,  # noqa: E402
                     save_json, skills_match, visa_odds)

TODAY = dt.date.today().isoformat()
RESOLVE_PER_RUN = int(os.environ.get("RESOLVE_PER_RUN", "40"))
RECHECK_DAYS = 30
SWEDEN_QUERIES = ["mlops", "machine learning engineer", "ml engineer", "python backend",
                  "python developer", "ai engineer", "platform engineer", "data engineer python"]
DROP_REGIONS = {"Other"}


def job_id(url, title):
    return hashlib.sha1(f"{url}|{title}".encode()).hexdigest()[:12]


def score(raw, company):
    title, desc, loc = raw["title"], raw.get("description", ""), raw.get("location", "")
    region = region_of(loc, company.get("region", ""))
    if region == "Remote":  # company marked remote but this posting gave no country
        region = "Remote from India" if ats.GLOBAL_REMOTE_HINT.search(desc) else "Other"
    if region in DROP_REGIONS:
        return None
    match, have, miss, flag = skills_match(title, desc)
    visa, basis = visa_odds(desc, loc, region, company, raw.get("company", ""))
    return {
        "id": job_id(raw["url"], title),
        "kind": kind_of(title),
        "title": title,
        "company": raw.get("company") or company["name"],
        "location": loc,
        "region": region,
        "match": match,
        "visa": visa,
        "matched": have,
        "missing": miss,
        "note": raw.get("note", ""),
        "visa_basis": basis,
        "url": raw["url"],
        "flag": flag + (f"; apply by {raw['deadline']}" if raw.get("deadline") else ""),
        "source": raw.get("source", ""),
        "posted": raw.get("posted", ""),
    }


def main():
    companies_doc = load_json("companies.json", {"companies": []})
    companies = companies_doc["companies"]
    cache = load_json("ats_cache.json", {})
    old = load_json("jobs.json", {"jobs": []})
    old_by_id = {j["id"]: j for j in old.get("jobs", [])}

    # 1) find job boards for companies we have not mapped yet (a few per day)
    resolved_now = 0
    for c in companies:
        if c.get("token") or resolved_now >= RESOLVE_PER_RUN:
            continue
        hit = cache.get(c["name"])
        if hit and hit.get("ats"):
            c["ats"], c["token"] = hit["ats"], hit["token"]
            continue
        if hit and hit.get("miss") and (dt.date.fromisoformat(hit["miss"]) > dt.date.today() - dt.timedelta(days=RECHECK_DAYS)):
            continue
        found = ats.resolve(c["name"])
        resolved_now += 1
        if found:
            c["ats"], c["token"] = found
            cache[c["name"]] = {"ats": found[0], "token": found[1], "found": TODAY}
        else:
            cache[c["name"]] = {"miss": TODAY}

    # 2) read boards
    fresh, checked, errors = [], 0, []
    for c in companies:
        if not c.get("token"):
            continue
        rows = ats.read_board(c["ats"], c["token"])
        if rows is None:
            errors.append(c["name"])
            continue
        checked += 1
        for r in rows:
            if not r.get("url") or not keep_title(r["title"]):
                continue
            r["source"] = c["ats"].split("_")[0].title()
            j = score(r, c)
            if j:
                fresh.append(j)

    # 3) Sweden (Platsbanken via JobTech)
    seen_urls = set()
    for q in SWEDEN_QUERIES:
        for r in ats.jobtech(q):
            if r["url"] in seen_urls or not keep_title(r["title"]):
                continue
            seen_urls.add(r["url"])
            r["source"] = "Platsbanken (Sweden)"
            j = score(r, {"name": r["company"], "region": "Sweden", "sponsor": "employer-led"})
            if j:
                fresh.append(j)

    # 4) merge with yesterday: keep first_seen, mark closed, keep manual entries for 30 days
    by_id, fresh_urls = {}, set()
    dedup = []
    for j in fresh:  # the same posting can be listed under two queries or boards
        if j["url"] in fresh_urls:
            continue
        fresh_urls.add(j["url"])
        dedup.append(j)
    fresh = dedup
    for j in fresh:
        prev = old_by_id.get(j["id"])
        j["first_seen"] = prev["first_seen"] if prev else TODAY
        j["closed"] = False
        by_id[j["id"]] = j
    closed_today = 0
    for jid, prev in old_by_id.items():
        if jid in by_id:
            continue
        if prev.get("checked") == "manual":
            if prev.get("url") in fresh_urls:
                continue  # the feed now tracks this posting itself
            age = (dt.date.today() - dt.date.fromisoformat(prev.get("first_seen", TODAY))).days
            if age <= 30:
                by_id[jid] = prev
            continue
        if not prev.get("closed"):
            closed_today += 1
        prev["closed"] = True
        prev.setdefault("closed_on", TODAY)
        if (dt.date.today() - dt.date.fromisoformat(prev["closed_on"])).days <= 14:
            by_id[jid] = prev  # keep briefly so board cards can show "posting closed"

    jobs = sorted(by_id.values(), key=lambda j: (j.get("closed", False), -j["match"], -j["visa"]))
    new_today = [j for j in jobs if j.get("first_seen") == TODAY and not j.get("closed")]
    save_json("jobs.json", {
        "generated_at": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "companies_checked": checked,
        "companies_tracked": len(companies),
        "boards_failed": errors,
        "new_today": len(new_today),
        "closed_today": closed_today,
        "jobs": jobs,
    })
    save_json("ats_cache.json", cache)
    save_json("terms.json", {"terms": TERMS, "have": sorted(HAVE)})  # keeps the site's match % in step
    companies_doc["companies"] = companies
    save_json("companies.json", companies_doc)
    print(f"checked {checked} boards, {len(jobs)} roles, {len(new_today)} new, {closed_today} closed")
    post_digest(new_today, checked, closed_today)


def post_digest(new_today, checked, closed):
    token, repo = os.environ.get("GITHUB_TOKEN"), os.environ.get("GITHUB_REPOSITORY")
    if not token or not repo:
        return
    good = [j for j in new_today if j["match"] >= 60 and (j["visa"] < 0 or j["visa"] >= 55)]
    if not good:
        return
    # Public issue: counts only. Role names and companies stay inside the locked site.
    owner, name = repo.split("/")
    top = max(j["match"] for j in good)
    lines = [f"{len(good)} new roles passed your filters today (best match {top}%).",
             f"{checked} job boards checked, {closed} postings closed.", "",
             f"Open your board to see them: https://{owner}.github.io/{name}/"]
    api = f"https://api.github.com/repos/{repo}/issues"
    hdr = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json", "User-Agent": "JobHuntHQ"}
    try:  # make sure the "digest" label exists (422 = already there)
        lab = json.dumps({"name": "digest", "color": "1f6f78", "description": "Daily Job Hunt HQ summary"}).encode()
        urllib.request.urlopen(urllib.request.Request(f"https://api.github.com/repos/{repo}/labels", data=lab, headers=hdr, method="POST"), timeout=20)
    except Exception:
        pass
    # close yesterday's digest so only one stays open
    try:
        req = urllib.request.Request(api + "?labels=digest&state=open", headers=hdr)
        for issue in json.loads(urllib.request.urlopen(req, timeout=20).read()):
            body = json.dumps({"state": "closed"}).encode()
            urllib.request.urlopen(urllib.request.Request(f"{api}/{issue['number']}", data=body, headers=hdr, method="PATCH"), timeout=20)
    except Exception as e:  # digest is best-effort
        print("could not close old digest:", e)
    body = json.dumps({"title": f"{len(good)} new roles · {TODAY}", "body": "\n".join(lines), "labels": ["digest"]}).encode()
    try:
        urllib.request.urlopen(urllib.request.Request(api, data=body, headers=hdr, method="POST"), timeout=20)
    except Exception as e:
        print("could not post digest:", e)


if __name__ == "__main__":
    main()
