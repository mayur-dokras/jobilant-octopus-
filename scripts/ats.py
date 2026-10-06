"""Readers for public job-board feeds. Each returns a list of dicts:
{title, location, url, description, posted}. No API keys are needed.
"""
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

from scoring import strip_html

UA = "JobHuntHQ/1.0 (personal job tracker; github actions)"
GLOBAL_REMOTE_HINT = re.compile(r"worldwide|anywhere in the world|any country|global(ly)? remote|via deel|remote[- ]first, global", re.I)


def get(url, timeout=25, accept="application/json"):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": accept})
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            return e.code, ""
        except Exception:
            if attempt == 0:
                time.sleep(2)
    return 0, ""


def get_json(url):
    code, body = get(url)
    if code != 200 or not body:
        return None
    try:
        return json.loads(body)
    except ValueError:
        return None


# ------------------------------------------------------------- readers --
def greenhouse(token, eu=False):
    host = "boards-api.eu.greenhouse.io" if eu else "boards-api.greenhouse.io"
    d = get_json(f"https://{host}/v1/boards/{token}/jobs?content=true")
    if not d or "jobs" not in d:
        return None
    return [{
        "title": j.get("title", ""),
        "location": (j.get("location") or {}).get("name", ""),
        "url": j.get("absolute_url", ""),
        "description": strip_html(j.get("content", "")),
        "posted": (j.get("first_published") or j.get("updated_at") or "")[:10],
    } for j in d["jobs"]]


def lever(token, eu=False):
    host = "api.eu.lever.co" if eu else "api.lever.co"
    d = get_json(f"https://{host}/v0/postings/{token}?mode=json")
    if d is None or not isinstance(d, list):
        return None
    out = []
    for j in d:
        cats = j.get("categories") or {}
        lists = " ".join(strip_html(x.get("content", "")) for x in j.get("lists") or [])
        created = j.get("createdAt")
        out.append({
            "title": j.get("text", ""),
            "location": cats.get("location", "") or ", ".join(cats.get("allLocations") or []),
            "url": j.get("hostedUrl", ""),
            "description": f"{j.get('descriptionPlain', '')} {lists} {j.get('additionalPlain', '')}",
            "posted": time.strftime("%Y-%m-%d", time.gmtime(created / 1000)) if created else "",
        })
    return out


def ashby(token):
    d = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{token}")
    if not d or "jobs" not in d:
        return None
    out = []
    for j in d["jobs"]:
        if j.get("isListed") is False:
            continue
        loc = j.get("location", "")
        if j.get("isRemote"):
            loc = f"Remote · {loc}"
        out.append({
            "title": j.get("title", ""),
            "location": loc,
            "url": j.get("jobUrl", ""),
            "description": j.get("descriptionPlain", "") or strip_html(j.get("descriptionHtml", "")),
            "posted": (j.get("publishedAt") or "")[:10],
        })
    return out


def workable(token):
    d = get_json(f"https://apply.workable.com/api/v1/widget/accounts/{token}?details=true")
    if not d or "jobs" not in d:
        return None
    out = []
    for j in d["jobs"]:
        loc = ", ".join(x for x in [j.get("city"), j.get("country")] if x)
        if j.get("telecommuting"):
            loc = f"Remote · {loc}"
        out.append({
            "title": j.get("title", ""),
            "location": loc,
            "url": j.get("url") or j.get("shortlink", ""),
            "description": strip_html(j.get("description", "")) + " " + (j.get("experience") or ""),
            "posted": (j.get("published_on") or j.get("created_at") or "")[:10],
        })
    return out


def recruitee(token):
    d = get_json(f"https://{token}.recruitee.com/api/offers/")
    if not d or "offers" not in d:
        return None
    return [{
        "title": j.get("title", ""),
        "location": ", ".join(x for x in [j.get("city"), j.get("country")] if x) + (" · Remote" if j.get("remote") else ""),
        "url": j.get("careers_url", ""),
        "description": strip_html(j.get("description", "") + " " + j.get("requirements", "")),
        "posted": (j.get("published_at") or "")[:10],
    } for j in d["offers"]]


def personio(token):
    code, body = get(f"https://{token}.jobs.personio.de/xml", accept="application/xml")
    if code != 200 or not body:
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None
    out = []
    for p in root.iter("position"):
        pid = p.findtext("id", "")
        desc = " ".join(strip_html(v.text or "") for v in p.iter("value"))
        out.append({
            "title": p.findtext("name", ""),
            "location": p.findtext("office", ""),
            "url": f"https://{token}.jobs.personio.de/job/{pid}",
            "description": desc + " " + (p.findtext("yearsOfExperience", "") or ""),
            "posted": (p.findtext("createdAt", "") or "")[:10],
        })
    return out


def teamtailor(token):
    code, body = get(f"https://{token}.teamtailor.com/jobs.rss", accept="application/rss+xml")
    if code != 200 or not body:
        return None
    try:
        root = ET.fromstring(body)
    except ET.ParseError:
        return None
    out = []
    for it in root.iter("item"):
        locs = " ".join((e.text or "") for e in it.iter() if e.tag.endswith("city") or e.tag.endswith("country"))
        out.append({
            "title": it.findtext("title", ""),
            "location": locs.strip(),
            "url": it.findtext("link", ""),
            "description": strip_html(it.findtext("description", "")),
            "posted": it.findtext("pubDate", ""),
        })
    return out


def smartrecruiters(token):
    d = get_json(f"https://api.smartrecruiters.com/v1/companies/{token}/postings?limit=100")
    if not d or "content" not in d:
        return None
    out = []
    for j in d["content"]:
        loc = j.get("location") or {}
        where = ", ".join(x for x in [loc.get("city"), loc.get("country")] if x)
        if loc.get("remote"):
            where = f"Remote · {where}"
        out.append({
            "title": j.get("name", ""),
            "location": where,
            "url": f"https://jobs.smartrecruiters.com/{token}/{j.get('id', '')}",
            "description": "",  # needs a second call per job; match is estimated
            "posted": (j.get("releasedDate") or "")[:10],
        })
    return out


READERS = {
    "greenhouse": greenhouse,
    "greenhouse_eu": lambda t: greenhouse(t, eu=True),
    "lever": lever,
    "lever_eu": lambda t: lever(t, eu=True),
    "ashby": ashby,
    "workable": workable,
    "recruitee": recruitee,
    "personio": personio,
    "teamtailor": teamtailor,
    "smartrecruiters": smartrecruiters,
}


def read_board(ats, token):
    fn = READERS.get(ats)
    return fn(token) if fn else None


# ------------------------------------------------------------ resolver --
SUFFIX = re.compile(r"\b(ltd|limited|plc|llp|llc|inc|uk|gmbh|bv|b\.v\.|ab|sa|sas|group|holdings?|the)\b", re.I)


def slugs_for(name):
    base = SUFFIX.sub(" ", re.sub(r"\(.*?\)", " ", name.lower()))
    base = re.sub(r"[^a-z0-9 ]+", " ", base).split()
    if not base:
        return []
    out = ["".join(base), "-".join(base)]
    if len(base) > 1 and base[-1] in ("technologies", "technology", "labs", "ai", "io", "software", "bank", "systems"):
        out.append("".join(base[:-1]))
    return list(dict.fromkeys(s for s in out if len(s) >= 3))


def _norm(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def resolve(name):
    """Find which public job board a company uses. Returns (ats, token) or None."""
    want = _norm(SUFFIX.sub(" ", name))
    for slug in slugs_for(name):
        for host, ats in (("boards-api.greenhouse.io", "greenhouse"), ("boards-api.eu.greenhouse.io", "greenhouse_eu")):
            d = get_json(f"https://{host}/v1/boards/{slug}")
            if d and _norm(d.get("name", ""))[:6] == want[:6]:
                return ats, slug
        d = get_json(f"https://api.ashbyhq.com/posting-api/job-board/{slug}")
        if d and d.get("jobs") is not None:
            return "ashby", slug
        for ats, host in (("lever", "api.lever.co"), ("lever_eu", "api.eu.lever.co")):
            d = get_json(f"https://{host}/v0/postings/{slug}?mode=json&limit=1")
            if isinstance(d, list) and d:
                return ats, slug
        d = get_json(f"https://apply.workable.com/api/v1/widget/accounts/{slug}")
        if d and d.get("jobs") is not None and _norm(d.get("name", ""))[:6] == want[:6]:
            return "workable", slug
        time.sleep(0.3)
    return None


# ------------------------------------------------------- Sweden JobTech --
SWEDISH_REQ = re.compile(r"svenska|swedish (is|language) (required|a must)|fluent in swedish|flytande", re.I)
SWEDISH_TEXT = re.compile(r"\b(och|för|med|som|att|vi|du|är|på|erfarenhet)\b", re.I)


def jobtech(query, limit=100):
    q = urllib.parse.quote(query)
    d = get_json(f"https://jobsearch.api.jobtechdev.se/search?q={q}&limit={limit}")
    if not d:
        return []
    out = []
    for h in d.get("hits", []):
        desc = (h.get("description") or {}).get("text", "") or ""
        # skip ads written in Swedish or that require Swedish
        if SWEDISH_REQ.search(desc) or len(SWEDISH_TEXT.findall(desc)) > 25:
            continue
        addr = h.get("workplace_address") or {}
        out.append({
            "title": h.get("headline", ""),
            "company": (h.get("employer") or {}).get("name", ""),
            "location": ", ".join(x for x in [addr.get("municipality"), "Sweden"] if x),
            "url": h.get("webpage_url", ""),
            "description": desc,
            "posted": (h.get("publication_date") or "")[:10],
            "deadline": (h.get("application_deadline") or "")[:10],
        })
    return out
