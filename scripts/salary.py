"""Pay ranges for the job cards.

First choice is the job board's own pay field (Greenhouse, Lever, Ashby and
Recruitee publish one when the company fills it in). Otherwise the posting text
is read for lines such as "£60,000 - £75,000", "€70k-85k", "$120,000 to $150,000",
"SEK 45 000 - 55 000 per month" or "18-25 LPA".

Every result is {"min", "max", "cur", "per", "src"}: amounts as whole numbers in
the posting's own currency, per "year", "month", "day" or "hour".
"""
import re

SYMBOL = {"£": "GBP", "€": "EUR", "$": "USD", "₹": "INR", "kr": "SEK"}
CODES = "GBP|EUR|USD|SEK|NZD|CHF|DKK|NOK|PLN|INR|TRY|CZK|AUD|CAD"
CUR = rf"(?:£|€|\$|₹|\b(?:{CODES})\b)"
NUM = r"\d{1,3}(?:[,.   ]\d{3})+|\d+(?:[.,]\d+)?"
DASH = r"\s*(?:-|–|—|to|bis|till)\s*"
NOT_MONEY = r"(?!\s*(?:m\b|mn\b|bn\b|million|billion|b\b|\+? ?(?:users|customers|employees|people)))"

# £60,000 - £75,000 / £60k-75k / GBP 60,000 to 75,000 (+ optional trailing code)
PRE = re.compile(rf"(?P<c1>{CUR})\s?(?P<a>{NUM})\s?(?P<ak>[kK])?{DASH}(?:(?P<c2>{CUR})\s?)?(?P<b>{NUM})\s?(?P<bk>[kK])?{NOT_MONEY}")
# 60,000 - 75,000 EUR / 45 000 - 55 000 kr / 70k-85k EUR
POST = re.compile(rf"(?<![\d.,])(?P<a>{NUM})\s?(?P<ak>[kK])?{DASH}(?P<b>{NUM})\s?(?P<bk>[kK])?\s?(?P<c1>\b(?:{CODES})\b|€|£|kr\b|SEK\b){NOT_MONEY}")
# a single amount, only right after a pay word: "salary: up to £80k", "base pay from €65,000"
ONE = re.compile(rf"(?:salary|compensation|base pay|pay range|pay|package|gehalt|lön)[^.\n]{{0,30}}?(?P<c1>{CUR})\s?(?P<a>{NUM})\s?(?P<ak>[kK])?{NOT_MONEY}", re.I)
# Indian postings: "18-25 LPA", "12 to 18 lakhs"
LPA = re.compile(r"(?P<a>\d{1,3}(?:\.\d+)?)" + DASH + r"(?P<b>\d{1,3}(?:\.\d+)?)\s*(?:lpa|lakhs?(?: per annum)?|l\.p\.a)", re.I)
PER = [("hour", re.compile(r"per hour|/\s?h(ou)?r\b|an hour|hourly|p/h", re.I)),
       ("day", re.compile(r"per day|/\s?day|daily rate|a day\b|p/d", re.I)),
       ("month", re.compile(r"per month|/\s?mo(nth)?\b|monthly|a month|/\s?mån|per mån|i månaden|pro monat|brutto monatlich", re.I))]
# whole-year amounts outside these bounds are almost always something else (funding, headcount)
SANE = {"year": (8_000, 2_000_000), "month": (800, 120_000), "day": (80, 5_000), "hour": (8, 600)}


def _num(text, k):
    t = text.replace(" ", "").replace(" ", "").replace(" ", "")
    if re.fullmatch(r"\d{1,3}([,.]\d{3})+", t):
        n = float(re.sub(r"[,.]", "", t))
    else:
        n = float(t.replace(",", "."))
    return int(round(n * 1000)) if k else int(round(n))


def _cur(sym):
    if not sym:
        return ""
    s = sym.strip()
    return SYMBOL.get(s, SYMBOL.get(s.lower(), s.upper()))


def _per(after):
    for name, rx in PER:
        if rx.search(after):
            return name
    return "year"


def _ok(lo, hi, per, cur):
    if cur == "INR":
        return 50_000 <= lo <= hi <= 50_000_000 if per == "year" else lo > 0
    a, b = SANE[per]
    return a <= lo <= hi <= b and hi <= lo * 3


def from_text(text):
    """Best pay range found in a posting, or None."""
    if not text:
        return None
    for rx in (PRE, POST):
        for m in rx.finditer(text):
            g = m.groupdict()
            cur = _cur(g.get("c1") or g.get("c2"))
            if not cur:
                continue
            ak, bk = g.get("ak"), g.get("bk")
            lo, hi = _num(g["a"], ak or (bk and len(g["a"]) <= 3)), _num(g["b"], bk or (ak and len(g["b"]) <= 3))
            if hi < lo:
                lo, hi = hi, lo
            per = _per(text[m.end():m.end() + 40])
            if _ok(lo, hi, per, cur):
                return {"min": lo, "max": hi, "cur": cur, "per": per, "src": "posting"}
    m = LPA.search(text)
    if m:
        lo, hi = float(m["a"]) * 100_000, float(m["b"]) * 100_000
        if 0 < lo <= hi:
            return {"min": int(lo), "max": int(hi), "cur": "INR", "per": "year", "src": "posting"}
    for m in ONE.finditer(text):
        cur, n = _cur(m["c1"]), _num(m["a"], m["ak"])
        per = _per(text[m.end():m.end() + 40])
        if _ok(n, n, per, cur):
            return {"min": n, "max": n, "cur": cur, "per": per, "src": "posting"}
    return None


def _interval(text):
    t = (text or "").lower()
    return "hour" if "hour" in t else "month" if "month" in t else "day" if "day" in t else "year"


def board(min_value, max_value, currency, interval="year"):
    """Normalise a board's own pay field. Returns None when it is empty or odd."""
    try:
        lo, hi = float(min_value or 0), float(max_value or min_value or 0)
    except (TypeError, ValueError):
        return None
    cur = _cur(currency or "")
    if not cur or hi <= 0:
        return None
    lo = lo or hi
    per = _interval(interval)
    if not _ok(int(lo), int(hi), per, cur):
        return None
    return {"min": int(lo), "max": int(hi), "cur": cur, "per": per, "src": "board"}


def greenhouse(job):
    for r in job.get("pay_input_ranges") or []:
        s = board((r.get("min_cents") or 0) / 100, (r.get("max_cents") or 0) / 100, r.get("currency_type"), r.get("title") or "year")
        if s:
            return s
    return None


def lever(job):
    r = job.get("salaryRange") or {}
    return board(r.get("min"), r.get("max"), r.get("currency"), r.get("interval") or "year")


def ashby(job):
    comp = job.get("compensation") or {}
    for c in comp.get("summaryComponents") or []:
        if (c.get("compensationType") or "").lower() in ("salary", "basesalary", "base salary"):
            s = board(c.get("minValue"), c.get("maxValue"), c.get("currencyCode"), c.get("interval") or "year")
            if s:
                return s
    return from_text(comp.get("compensationTierSummary") or comp.get("scrapeableCompensationSalarySummary") or "")


def recruitee(job):
    r = job.get("salary") or {}
    if isinstance(r, dict):
        return board(r.get("min"), r.get("max"), r.get("currency"), r.get("period") or "year")
    return None


if __name__ == "__main__":  # quick self-check: python scripts/salary.py
    cases = {
        "Salary: £60,000 - £75,000 + equity": (60000, 75000, "GBP", "year"),
        "We pay €70k–85k depending on experience": (70000, 85000, "EUR", "year"),
        "Base $120,000 to $150,000 per year": (120000, 150000, "USD", "year"),
        "Lön 45 000 - 55 000 kr per månad": (45000, 55000, "SEK", "month"),
        "CTC 18-25 LPA": (1800000, 2500000, "INR", "year"),
        "salary up to £80k": (80000, 80000, "GBP", "year"),
        "Day rate £450 - £550 per day outside IR35": (450, 550, "GBP", "day"),
        "We raised $20-30M from investors": None,
        "70.000 - 85.000 EUR brutto": (70000, 85000, "EUR", "year"),
        "Team of 10 - 20 engineers": None,
    }
    bad = 0
    for text, want in cases.items():
        got = from_text(text)
        got = got and (got["min"], got["max"], got["cur"], got["per"])
        if got != want:
            bad += 1
            print("FAIL", text, got, want)
    print("ok" if not bad else f"{bad} failed")
