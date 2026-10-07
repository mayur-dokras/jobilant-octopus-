"""Shared rules for Job Hunt HQ: which roles to keep, how well they match
Mayur's CV, and how likely a visa is for someone applying from India.

Everything here is plain Python (standard library only) so the GitHub
Action needs no installs.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

# ---------------------------------------------------------------- titles --
INCLUDE_TITLE = re.compile(
    r"\b(ml ?ops|machine learning|ml engineer|ml platform|ml infra|ai engineer|applied ai|"
    r"llm|genai|gen ai|backend|back-end|back end|python|platform engineer|platform|"
    r"infrastructure|site reliability|sre|devops|data engineer|data platform|"
    r"software engineer|software developer|developer experience)\b",
    re.I,
)
EXCLUDE_TITLE = re.compile(
    r"\b(senior|sr\.?|staff|principal|lead|head|manager|director|vp|chief|architect|"
    r"intern|internship|graduate|trainee|working student|apprentice|"
    r"front[- ]?end|frontend|ios|android|mobile|designer|design engineer|"
    r"sales|account|recruit|support engineer|solutions engineer|solutions architect|"
    r"customer success|technical writer|researcher|research scientist|"
    r"\.net|c#|php|ruby|salesforce|sap)\b",
    re.I,
)


def keep_title(title: str) -> bool:
    return bool(INCLUDE_TITLE.search(title or "")) and not EXCLUDE_TITLE.search(title or "")


def kind_of(title: str) -> str:
    t = (title or "").lower()
    if re.search(r"ml ?ops|ml platform|ml infra|platform|infrastructure|site reliability|\bsre\b|devops|developer experience", t):
        return "MLOps"
    if re.search(r"machine learning|\bml\b|\bai\b|applied ai|llm|genai|gen ai", t):
        return "AI"
    return "Backend"


# ---------------------------------------------------------------- skills --
# canonical name -> regex. Order does not matter.
TERMS = {
    "Python": r"\bpython\b", "FastAPI": r"\bfastapi\b", "REST APIs": r"\brest(ful)?\b|\bapis?\b",
    "Microservices": r"micro-?services?", "async": r"\basync(io)?\b|async/await",
    "Java": r"\bjava\b(?!script)", "Spring Boot": r"spring ?boot|\bspring\b", "Go": r"\bgolang\b|\bgo\b(?= |,|/|\))",
    "TypeScript": r"\btypescript\b", "JavaScript": r"\bjavascript\b", "React": r"\breact\b",
    "Bash": r"\bbash\b|shell script", "SQL": r"\bsql\b", "ETL": r"\betl\b|\belt\b",
    "Kafka": r"\bkafka\b", "RabbitMQ": r"\brabbitmq\b", "Snowflake": r"\bsnowflake\b",
    "PostgreSQL": r"\bpostgres(ql)?\b", "MySQL": r"\bmysql\b", "MongoDB": r"\bmongo(db)?\b",
    "Redis": r"\bredis\b|\bvalkey\b", "AWS": r"\baws\b|amazon web services", "Azure": r"\bazure\b",
    "GCP": r"\bgcp\b|google cloud", "Docker": r"\bdocker\b|container", "Kubernetes": r"\bkubernetes\b|\bk8s\b|\beks\b|\bgke\b",
    "Helm": r"\bhelm\b", "Terraform": r"\bterraform\b", "Jenkins": r"\bjenkins\b",
    "GitHub Actions": r"github actions", "CI/CD": r"\bci ?/ ?cd\b|continuous (integration|delivery|deployment)",
    "Linux": r"\blinux\b", "MLflow": r"\bmlflow\b", "Airflow": r"\bairflow\b", "DVC": r"\bdvc\b",
    "TensorFlow": r"\btensorflow\b", "NumPy": r"\bnumpy\b", "LLMs": r"\bllms?\b|large language model",
    "RAG": r"\brag\b|retrieval[- ]augmented", "LangChain": r"\blangchain\b", "OpenAI API": r"\bopenai\b",
    "Prometheus": r"\bprometheus\b", "Grafana": r"\bgrafana\b", "ELK": r"\belk\b|elasticsearch|kibana",
    "Datadog": r"\bdatadog\b", "OpenTelemetry": r"opentelemetry|\botel\b", "Observability": r"observability",
    "OAuth2": r"\boauth ?2?\b", "Pytest": r"\bpytest\b", "Git": r"\bgit\b",
    # gaps to watch
    "PyTorch": r"\bpytorch\b|\btorch\b", "Spark": r"\bspark\b|pyspark", "Kubeflow": r"\bkubeflow\b",
    "SageMaker": r"sagemaker", "ArgoCD": r"\bargo ?cd\b|\bargo\b", "Seldon": r"\bseldon\b", "Feast": r"\bfeast\b",
    "Ray": r"\bray\b(?= |,|\))", "Django": r"\bdjango\b", "Flask": r"\bflask\b", "Celery": r"\bcelery\b",
    "scikit-learn": r"scikit|sklearn", "pandas": r"\bpandas\b", "BigQuery": r"bigquery", "Databricks": r"databricks",
    "dbt": r"\bdbt\b", "ClickHouse": r"clickhouse", "Cassandra": r"cassandra", "Node.js": r"node\.?js",
    "Rust": r"\brust\b", "Scala": r"\bscala\b", "C#": r"c#|\.net\b", "CUDA": r"\bcuda\b|\btriton\b",
    "Vertex AI": r"vertex ai", "KServe": r"kserve|bentoml|triton inference", "CloudFormation": r"cloudformation",
}
HAVE = {
    "Python", "FastAPI", "REST APIs", "Microservices", "async", "Java", "Spring Boot", "Go", "TypeScript",
    "JavaScript", "React", "Bash", "SQL", "ETL", "Kafka", "RabbitMQ", "Snowflake", "PostgreSQL", "MySQL",
    "MongoDB", "Redis", "AWS", "Azure", "GCP", "Docker", "Kubernetes", "Helm", "Terraform", "Jenkins",
    "GitHub Actions", "CI/CD", "Linux", "MLflow", "Airflow", "DVC", "TensorFlow", "NumPy", "LLMs", "RAG",
    "LangChain", "OpenAI API", "Prometheus", "Grafana", "ELK", "Datadog", "OpenTelemetry", "Observability",
    "OAuth2", "Pytest", "Git",
}
_COMPILED = {k: re.compile(v, re.I) for k, v in TERMS.items()}
YEARS = re.compile(r"(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs)", re.I)
SENIOR_TEXT = re.compile(r"\bsenior (engineer|level)|staff level|10\+ years", re.I)


def strip_html(text: str) -> str:
    text = html.unescape(text or "")
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def skills_match(title: str, description: str, years_have: int = 4):
    """Return (match %, matched list, missing list, flag)."""
    text = f"{title} {description}"
    found = [k for k, rx in _COMPILED.items() if rx.search(text)]
    matched = [k for k in found if k in HAVE]
    missing = [k for k in found if k not in HAVE]
    flag = ""
    if len(found) < 3:
        score = 60  # description too thin to judge; neutral estimate
        flag = "JD thin: match estimated"
    else:
        score = round(100 * len(matched) / len(found))
        if len(found) < 5:  # short description: don't over-promise
            score = min(score, 75)
            flag = "Short JD: match capped at 75%"
    asked = [int(n) for n in YEARS.findall(description or "") if 0 < int(n) <= 15]
    if asked:
        need = max(asked)
        if need > years_have:
            score -= min(15, 5 * (need - years_have))
            flag = (flag + "; " if flag else "") + f"Stretch: asks {need}+ yrs"
    if SENIOR_TEXT.search(description or ""):
        score -= 5
    return max(0, min(98, score)), matched[:12], missing[:8], flag


# ------------------------------------------------------------------ visa --
NEG = re.compile(
    r"(not|unable to|cannot|can't|do not|does not|don't|won't|will not)\s+(be able to\s+)?(offer|provide|sponsor|support)"
    r"[^.]{0,40}(visa|sponsor|immigration)|no visa sponsorship|without (the need for )?sponsorship|"
    r"must (already )?have (the )?(full )?right to work|legally (able|authori[sz]ed) to work in|"
    r"not currently able to provide immigration",
    re.I,
)
POS = re.compile(
    r"visa sponsorship|sponsor (your|a|the) visa|visa support|relocation (package|support|assistance|bonus)|"
    r"we (can|will) sponsor|help(ing)? (you )?relocate|ready to relocate|willing to relocate",
    re.I,
)
AGENCY = re.compile(r"recruit|rekrytering|bemanning|staffing|talent partners|jobgether", re.I)
GLOBAL_REMOTE = re.compile(r"worldwide|anywhere|global|any country|deel", re.I)
REGION_WORDS = {
    "UK": r"\b(uk|united kingdom|england|scotland|wales|london|manchester|edinburgh|bristol|cambridge|oxford|leeds|glasgow|belfast|cardiff|birmingham|hatfield)\b",
    "Sweden": r"\b(sweden|stockholm|gothenburg|göteborg|malmö|malmo|lund|uppsala|linköping)\b",
    "US": r"\b(united states|usa|u\.s\.|new york|san francisco|seattle|austin|boston|chicago|remote[- ]us|amer)\b",
    "Europe": r"\b(netherlands|amsterdam|rotterdam|germany|berlin|munich|hamburg|ireland|dublin|cork|france|paris|spain|madrid|barcelona|portugal|lisbon|finland|helsinki|denmark|copenhagen|norway|oslo|estonia|tallinn|latvia|riga|lithuania|vilnius|poland|warsaw|czech|prague|austria|vienna|switzerland|zurich|belgium|brussels|luxembourg|italy|milan|emea|europe)\b",
}
_REGIONS = {k: re.compile(v, re.I) for k, v in REGION_WORDS.items()}


def region_of(location: str, default: str = "") -> str:
    loc = location or ""
    if re.search(r"remote", loc, re.I) and GLOBAL_REMOTE.search(loc):
        return "Remote from India"
    for name in ("UK", "Sweden", "Europe", "US"):
        if _REGIONS[name].search(loc):
            return name
    return default or "Other"


def visa_odds(description: str, location: str, region: str, company: dict, employer_name: str = ""):
    """Return (visa %, -1 for 'not needed', basis text)."""
    text = description or ""
    loc = location or ""
    if region == "Remote from India":
        return -1, "Remote worldwide: work from India, no visa involved"
    if NEG.search(text):
        return 3, "Posting says it cannot sponsor or needs existing work rights"
    if re.search(r"remote", loc, re.I) and region in ("UK", "US", "Europe"):
        return 10, f"Remote role tied to {region} residence"
    if region == "US":
        if POS.search(text):
            return 20, "US posting mentions sponsorship, but H-1B is a lottery from India"
        return 5, "US: H-1B lottery from India; target EU/UK roles instead"
    if POS.search(text):
        return 85, "Posting mentions visa sponsorship or relocation help"
    if AGENCY.search(employer_name or company.get("name", "")):
        return 40, "Recruitment agency: depends on the end client"
    sponsor = company.get("sponsor", "verify")
    if region == "US":
        return 5, "US: H-1B lottery from India; target EU/UK roles instead"
    table = {
        "explicit": (85, "Company states visa sponsorship"),
        "known": (65 if region == "UK" else 60, "Known sponsor; no wording in this posting"),
        "employer-led": (55, "Employer-led permit country; no wording in posting"),
        "verify": (45, "Sponsor status unconfirmed"),
        "none": (30, "No sponsorship history found"),
    }
    if region in ("Europe", "Sweden") and sponsor in ("verify", "none"):
        return 50, "EU employer-led permit; no wording in posting"
    return table.get(sponsor, (45, "Sponsor status unconfirmed"))


# --------------------------------------------------------------- helpers --
def load_json(name, default):
    p = DATA / name
    if not p.exists():
        return default
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def save_json(name, obj):
    p = DATA / name
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
