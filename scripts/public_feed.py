"""Public job feed for the "CV Match" page (match/index.html).

Built in the same daily run as Mayur's private feed, from the same job boards,
but kept wide: every tech role at any level in the target countries. It holds
job postings only (no personal data), so it is written unencrypted to
data/public_jobs.json and the match page reads it without a passcode.

Matching against a visitor's CV happens in the visitor's browser.
"""
import datetime as dt
import hashlib
import re

from scoring import ALLOWED_REGIONS, TERMS, region_of, strip_html, visa_odds, load_json, save_json

TODAY = dt.date.today().isoformat()
KEEP_DAYS_CLOSED = 3  # closed postings disappear quickly from the public page

# Standard roles shown as chips on the match page: label -> title pattern.
STANDARD_ROLES = {
    "Software Engineer": r"software (engineer|developer|development engineer)|\bsde\b|\bswe\b|application developer|programmer|product engineer|systems engineer|distributed systems|member of technical staff|\bmts\b",
    "Backend Engineer": r"back[- ]?end|java developer|java engineer|python developer|python engineer|node(\.js)? (developer|engineer)|golang|\bgo engineer|api engineer|integration (developer|engineer)",
    "Frontend Engineer": r"front[- ]?end|react|angular|vue|ui (engineer|developer)|web developer|javascript (developer|engineer)",
    "Full Stack Engineer": r"full[- ]?stack",
    "Mobile Engineer": r"\bios\b|android|mobile|flutter|react native",
    "Data Engineer": r"data engineer|etl|analytics engineer|big data|data platform",
    "Data Scientist / Analyst": r"data scien|data analyst|business intelligence|\bbi (developer|engineer)|analytics (developer|specialist)",
    "DevOps / Platform / SRE": r"devops|dev ops|platform engineer|site reliability|\bsre\b|infrastructure|cloud (engineer|developer)|build engineer|release engineer",
    "MLOps / ML Engineer": r"ml ?ops|llm ?ops|ai ?ops|machine learning|\bml engineer|ml platform|model (deployment|serving)|ai (platform|infrastructure)",
    "AI / GenAI Engineer": r"\bai\b|gen ?ai|generative|\bllm|applied ai|artificial intelligence|nlp|agent(ic)? engineer|rag engineer|context engineer|prompt engineer|evals? engineer",
    "QA / Test Engineer": r"\bqa\b|quality (assurance|engineer)|\btest(ing)? (engineer|automation)|\bsdet\b|automation tester",
    "Security Engineer": r"security (engineer|analyst|developer)|appsec|devsecops|penetration",
}
_ROLE_RX = {k: re.compile(v, re.I) for k, v in STANDARD_ROLES.items()}
# The public page also covers India (the private feed does not).
INDIA = re.compile(r"\b(india|bengaluru|bangalore|pune|hyderabad|chennai|mumbai|navi mumbai|delhi|new delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|kochi|coimbatore|jaipur|indore|chandigarh|trivandrum|thiruvananthapuram|mysore|mysuru|nagpur|vadodara)\b", re.I)
PUBLIC_REGIONS = set(ALLOWED_REGIONS) | {"India"}
TECH_TITLE = re.compile(r"\b(engineer|engineering|developer|programmer|sde|swe|devops|sre|architect|scientist|analyst|tester|qa)\b", re.I)
NOT_TECH = re.compile(
    r"\b(sales|account (executive|manager)|business development|recruit|talent|marketing|finance|accountant|legal|counsel|"
    r"hr\b|people partner|customer success|customer support|office|executive assistant|copywriter|content writer|"
    r"social media|procurement|payroll|nurse|driver|warehouse)\b", re.I)

# Wider skills vocabulary than Mayur's list, so any developer's CV can be matched.
EXTRA_TERMS = {
    "Angular": r"\bangular\b", "Vue": r"\bvue(\.js)?\b", "Next.js": r"next\.?js", "Redux": r"\bredux\b",
    "Tailwind": r"tailwind", "HTML": r"\bhtml5?\b", "CSS": r"\bcss3?\b|\bscss\b|\bsass\b", "Express": r"\bexpress(\.js)?\b",
    "NestJS": r"nest\.?js", "GraphQL": r"graphql", "Jest": r"\bjest\b", "Cypress": r"\bcypress\b",
    "Playwright": r"playwright", "Selenium": r"selenium", "Guidewire": r"guidewire|policycenter|claimcenter|billingcenter",
    "Gosu": r"\bgosu\b", "PHP": r"\bphp\b|laravel", "Ruby": r"\bruby\b|\brails\b", ".NET": r"\.net\b|asp\.net",
    "Swift": r"\bswift\b", "Kotlin": r"\bkotlin\b", "Flutter": r"\bflutter\b|\bdart\b", "React Native": r"react native",
    "Salesforce": r"salesforce|\bapex\b", "SAP": r"\bsap\b|\babap\b", "Power BI": r"power ?bi", "Tableau": r"tableau",
    "Hadoop": r"hadoop|\bhive\b", "DynamoDB": r"dynamodb", "Lambda": r"\blambda\b|serverless", "SQS": r"\bsqs\b|\bsns\b",
    "Hibernate": r"hibernate|\bjpa\b", "Maven": r"\bmaven\b|\bgradle\b", "Oracle": r"\boracle\b|pl/sql",
    "Hugging Face": r"hugging ?face|transformers library", "LoRA": r"\blora\b|\bqlora\b|peft", "Chroma": r"\bchroma(db)?\b",
    "Pinecone": r"pinecone", "LangGraph": r"langgraph", "Agile": r"\bagile\b|\bscrum\b", "Jira": r"\bjira\b",
    "C++": r"c\+\+", "C": r"\bc/c\+\+|\bc programming|\bansi c\b|\bembedded c\b|\bc,\s*c\+\+",
    "Go": r"\bgolang\b|\bgo\b(?=\s*[,/)])|\bgo (developer|engineer|programming)",
    "Figma": r"\bfigma\b", "Elasticsearch": r"elasticsearch|opensearch",
}
PUBLIC_TERMS = {k: v for k, v in TERMS.items() if k != "C#"}
PUBLIC_TERMS.update(EXTRA_TERMS)
PUBLIC_TERMS["C#"] = r"c#"
_TERM_RX = {k: re.compile(v, re.I) for k, v in PUBLIC_TERMS.items()}
YEARS = re.compile(r"(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?\+?\s*(?:years|yrs)", re.I)


# When the title alone names no standard role (e.g. "Senior II Product Engineer",
# "Java Distributed Systems Engineer"), infer roles from the skills in the posting so the
# job still reaches people who want that kind of work. Before this, about 4 in 10 postings
# had no role and never appeared on the match page.
TERM_ROLES = [
    ("AI / GenAI Engineer", {"LLMs", "RAG", "LangChain", "OpenAI API", "Hugging Face", "AI Agents", "LangGraph", "Fine-Tuning", "Prompt Engineering"}, 2),
    ("MLOps / ML Engineer", {"MLflow", "Kubeflow", "SageMaker", "Vertex AI", "KServe", "PyTorch", "TensorFlow", "scikit-learn", "Feast", "Seldon"}, 2),
    ("Data Engineer", {"Spark", "Airflow", "dbt", "Databricks", "BigQuery", "Snowflake", "ETL", "Kafka", "Hadoop"}, 2),
    ("DevOps / Platform / SRE", {"Kubernetes", "Terraform", "Helm", "ArgoCD", "Prometheus", "Grafana", "CloudFormation", "Observability"}, 3),
    ("Frontend Engineer", {"React", "Angular", "Vue", "Next.js", "CSS", "HTML", "Redux", "Tailwind"}, 2),
    ("Mobile Engineer", {"Swift", "Kotlin", "Flutter", "React Native"}, 1),
    ("QA / Test Engineer", {"Selenium", "Cypress", "Playwright", "Jest"}, 2),
    ("Backend Engineer", {"Java", "Spring Boot", "Go", "Node.js", "Django", "Flask", "FastAPI", "Microservices", "Hibernate", "C#", ".NET", "Ruby", "PHP", "Rust", "Scala"}, 1),
]


def roles_for(title: str, terms: list) -> list:
    roles = [k for k, rx in _ROLE_RX.items() if rx.search(title or "")]
    if roles and roles != ["Software Engineer"]:
        return roles
    have = set(terms)
    roles += [r for r, keys, need in TERM_ROLES if len(have & keys) >= need and r not in roles]
    if re.search(r"engineer|developer|programmer|\bsde\b|\bswe\b", title or "", re.I) and "Software Engineer" not in roles:
        roles.append("Software Engineer")
    return roles


def keep_public(title: str) -> bool:
    t = title or ""
    if NOT_TECH.search(t):
        return False
    return bool(TECH_TITLE.search(t)) or any(rx.search(t) for rx in _ROLE_RX.values())


def level_of(title: str) -> str:
    t = (title or "").lower()
    if re.search(r"\b(intern|internship|graduate|trainee|apprentice|working student)\b", t):
        return "Intern / Graduate"
    if re.search(r"\b(junior|jr\.?|associate|entry)\b", t):
        return "Junior"
    if re.search(r"\b(senior|sr\.?|staff|principal|lead|head|manager|director|architect)\b", t):
        return "Senior / Lead"
    return "Mid"


def public_job(raw, company):
    title, desc, loc = raw["title"], strip_html(raw.get("description", "")), raw.get("location", "")
    if not raw.get("url") or not keep_public(title):
        return None
    region = region_of(loc, company.get("region", ""))
    if region == "Other" and INDIA.search(loc):
        region = "India"
    if region == "Remote":
        region = "Other"
    if region not in PUBLIC_REGIONS:
        return None
    text = f"{title} {desc}"
    terms = [k for k, rx in _TERM_RX.items() if rx.search(text)]
    asked = [int(n) for n in YEARS.findall(desc) if 0 < int(n) <= 15]
    if region == "India":
        visa, basis = -1, "India: no visa needed"
    else:
        visa, basis = visa_odds(desc, loc, region, company, raw.get("company", ""))
    return {
        "id": hashlib.sha1(f"{raw['url']}|{title}".encode()).hexdigest()[:12],
        "title": title,
        "company": raw.get("company") or company["name"],
        "location": loc,
        "region": region,
        "roles": roles_for(title, terms),
        "level": level_of(title),
        "terms": terms[:30],
        "years": max(asked) if asked else None,
        "visa": visa,
        "visa_basis": basis,
        "url": raw["url"],
        "posted": raw.get("posted", ""),
        "source": raw.get("source", ""),
    }


def save(fresh):
    """Merge with yesterday's file (keep first_seen), drop closed roles after a few days."""
    old = {j["id"]: j for j in load_json("public_jobs.json", {"jobs": []}).get("jobs", [])}
    out, seen = {}, set()
    for j in fresh:
        if j["url"] in seen:
            continue
        seen.add(j["url"])
        prev = old.get(j["id"])
        j["first_seen"] = prev["first_seen"] if prev else TODAY
        out[j["id"]] = j
    for jid, prev in old.items():
        if jid in out:
            continue
        prev.setdefault("closed_on", TODAY)
        if (dt.date.today() - dt.date.fromisoformat(prev["closed_on"])).days < KEEP_DAYS_CLOSED:
            prev["closed"] = True
            out[jid] = prev
    jobs = sorted(out.values(), key=lambda j: (j.get("closed", False), j.get("first_seen", "")), reverse=False)
    save_json("public_jobs.json", {
        "generated_at": dt.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
        "regions": ["India", "UK", "Europe", "Sweden", "US", "New Zealand", "Turkey", "Remote from India"],
        "roles": list(STANDARD_ROLES),
        "terms": PUBLIC_TERMS,
        "jobs": jobs,
    })
    return len(jobs)
