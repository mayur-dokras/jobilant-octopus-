"""Runs when you click "Track this company" on the site. The button opens a
GitHub issue titled "Track company" whose body holds the company details,
encrypted with your passcode so the public issue reveals nothing. This script
decrypts them, adds the company to companies.json and marks it approved in
discovered.json. The workflow then closes the issue.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
from scoring import load_json, save_json  # noqa: E402
import vault  # noqa: E402


def main():
    event = json.load(open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8"))
    issue = event.get("issue") or {}
    if not issue.get("title", "").startswith("Track company"):
        print("not a track-company issue")
        return
    m = re.search(r"\{.*\}", issue.get("body") or "", re.S)
    if not m:
        print("no details in issue body")
        return
    box = json.loads(m.group(0))
    try:
        item = vault.decrypt(box, vault.passcode())
    except Exception:
        sys.exit("could not decrypt the request: was it created with the same passcode?")
    name = item.get("name", "").strip()
    if not name:
        return
    doc = load_json("companies.json", {"companies": []})
    if any(c["name"].lower() == name.lower() for c in doc["companies"]):
        print("already tracked")
    else:
        doc["companies"].append({
            "name": name, "region": item.get("region", "UK"), "city": item.get("town", ""),
            "careers": "", "source": "Discovered (you approved)", "sponsor": "known",
            "note": item.get("licence", ""), "ats": item.get("ats"), "token": item.get("token"),
        })
        doc["companies"].sort(key=lambda c: c["name"].lower())
        save_json("companies.json", doc)
    disc = load_json("discovered.json", {"items": []})
    for d in disc["items"]:
        if d["name"].lower() == name.lower():
            d["status"] = "approved"
    save_json("discovered.json", disc)
    print("added", name)


if __name__ == "__main__":
    main()
