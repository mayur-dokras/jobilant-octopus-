"""Weekly run: look for NEW sponsor companies worth tracking.

Source (v1): the UK Home Office register of licensed sponsors (Skilled Worker
route). For each company not tracked yet, try to find a public job board
(Greenhouse, Ashby, Lever, Workable). Companies whose board has at least one
role that passes Mayur's title rules go into data/discovered.json, where the
site shows them under "Discovered" for him to approve or skip.

Run locally:  python scripts/discover.py
"""
import csv
import datetime as dt
import io
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import ats  # noqa: E402
from scoring import keep_title, load_json, save_json  # noqa: E402

TODAY = dt.date.today().isoformat()
PROBES_PER_RUN = int(os.environ.get("PROBES_PER_RUN", "300"))
REGISTER_PAGE = "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers"
TECHY = re.compile(r"\b(tech|technolog|software|digital|data|cloud|labs?|ai|analytics|systems|cyber|"
                   r"robotics|platform|fintech|pay|payments|bank|health|bio|energy|io|app|apps|engineering|"
                   r"computing|security|quantum|machine|intelligence|automation|devices)\b", re.I)
SKIP = re.compile(r"\b(care|nursing|restaurant|cafe|takeaway|hotel|church|school|college|university|nhs|"
                  r"trust|council|construction|builders|cleaning|salon|dental|pharmacy|farm|transport|"
                  r"logistics|recruitment|solicitors|accountants|catering|mosque|temple|charity)\b", re.I)


def register_rows():
    code, page = ats.get(REGISTER_PAGE, accept="text/html")
    if code != 200:
        print("register page not reachable:", code)
        return []
    m = re.search(r'href="(https://assets\.publishing\.service\.gov\.uk/[^"]+Worker[^"]+\.csv)"', page)
    if not m:
        print("csv link not found on register page")
        return []
    code, body = ats.get(m.group(1), timeout=90, accept="text/csv")
    if code != 200:
        print("csv download failed:", code)
        return []
    rows = []
    for r in csv.DictReader(io.StringIO(body)):
        route = (r.get("Route") or "")
        if "Skilled Worker" not in route:
            continue
        rows.append({"name": (r.get("Organisation Name") or "").strip(),
                     "town": (r.get("Town/City") or "").strip(),
                     "rating": (r.get("Type & Rating") or "").strip()})
    print(f"{len(rows)} Skilled Worker sponsors on the register")
    return rows


def main():
    key = lambda n: ats._norm(ats.SUFFIX.sub(" ", n.lower()))
    tracked = {key(c["name"]) for c in load_json("companies.json", {"companies": []})["companies"]}
    disc = load_json("discovered.json", {"generated_at": None, "items": []})
    known = {key(i["name"]) for i in disc["items"]}
    tried = load_json("discover_cache.json", {})

    rows = register_rows()
    pool = [r for r in rows if r["name"] and key(r["name"]) not in tracked and key(r["name"]) not in known
            and r["name"] not in tried and not SKIP.search(r["name"])]
    pool.sort(key=lambda r: (0 if TECHY.search(r["name"]) else 1, r["name"]))

    added = 0
    for r in pool[:PROBES_PER_RUN]:
        found = ats.resolve(r["name"])
        tried[r["name"]] = TODAY
        if not found:
            continue
        board = ats.read_board(*found) or []
        roles = [j for j in board if keep_title(j["title"])]
        if not roles:
            continue
        disc["items"].append({
            "name": r["name"], "town": r["town"], "licence": f"UK Skilled Worker sponsor ({r['rating']})",
            "ats": found[0], "token": found[1], "found": TODAY,
            "roles": [{"title": j["title"], "url": j["url"], "location": j["location"]} for j in roles[:5]],
            "status": "new",
        })
        added += 1

    disc["generated_at"] = dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z"
    save_json("discovered.json", disc)
    save_json("discover_cache.json", tried)
    print(f"probed {min(len(pool), PROBES_PER_RUN)} companies, added {added} to Discovered")


if __name__ == "__main__":
    main()
