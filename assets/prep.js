/* Interview prep from a job description, worked out in the browser (no AI service).
   For one job it lists:
   - focus: the 3-5 things the posting stresses most, each with the line of Mayur's CV that proves it
   - weak spots: what the posting asks for that the CV cannot prove yet, with the closest true story
   - topics: what an interviewer for this kind of role will most likely ask about
   Evidence only ever quotes Mayur's own CV text; nothing is invented. */
window.Prep = (function () {
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MUST = /\b(must|required|requirement|essential|you have|you bring|strong|proven|solid|deep|expert|proficien\w*|hands-on)\b/i;

  // Themes a posting can stress that are not single tools. Each points at a true story from the CV.
  const THEMES = [
    ["Production ownership", /\b(on-?call|incident|production (support|issues|systems)|reliability|uptime|troubleshoot\w*|root cause|debugg\w*|sla|slo)\b/i, /defect|mttr|gdb|debug/i],
    ["Testing and quality", /\b(test(ing|s)?|tdd|quality|pytest|unit tests?|integration tests?|code review)\b/i, /pytest|validation|test/i],
    ["API and integration design", /\b(apis?|rest(ful)?|integrations?|microservices?|endpoints?|grpc|graphql)\b/i, /rest|integration|api/i],
    ["Data pipelines", /\b(etl|elt|data pipelines?|pipelines?|ingestion|data quality|batch|streaming)\b/i, /etl|pipeline|migration/i],
    ["Automation and tooling", /\b(automat\w*|tooling|scripting|developer experience|productivity)\b/i, /automation tools|automat/i],
    ["Model deployment and MLOps", /\b(ml ?ops|model (deployment|serving|monitoring)|mlflow|airflow|kubeflow|feature store|ml pipelines?)\b/i, /mlflow|airflow|model deployment|alignerr/i],
    ["LLM applications", /\b(llms?|rag|retrieval|langchain|agents?|agentic|prompt|generative|genai|fine-?tun\w*|embeddings?)\b/i, /llm|rag|langchain|sotonbuddy|lora|agent/i],
    ["Ownership in a small team", /\b(startup|fast-paced|ownership|end-to-end|autonomy|small team|founding|wear many hats)\b/i, /startup|owned|6-person/i],
    ["Security and data protection", /\b(security|oauth|encryption|gdpr|compliance|governance|pii|privacy)\b/i, /oauth|encrypt|aes|jwt|tls/i],
    ["Cloud and infrastructure", /\b(cloud|aws|gcp|azure|terraform|infrastructure as code|iac|kubernetes|docker|containers?)\b/i, /docker|kubernetes|terraform|aws/i],
    ["Collaboration and communication", /\b(stakeholders?|cross-functional|collaborat\w*|communicat\w*|mentor\w*|documentation)\b/i, /document|handed|team/i],
  ];
  // Closest true experience when a skill is a real gap (said in the interview, not added to the CV).
  const CLOSEST = [
    [/^(Spark|Databricks|BigQuery|dbt|ClickHouse|Cassandra|Snowflake|Feast)$/, "ETL migrations and automated checks for an enterprise ERP platform at Capgemini, plus Kafka, RabbitMQ and Redis"],
    [/^(Kubeflow|SageMaker|Vertex AI|KServe|Seldon|Ray|ArgoCD)$/, "model deployment and pipeline automation with Docker, Kubernetes, MLflow and Airflow on the Alignerr freelance work"],
    [/^(Go|Rust|Scala|C#|Java|Node\.js|TypeScript)$/, "production Python, C and C++ at Capgemini; explain how you picked up a new codebase there"],
    [/^(Django|Flask|Celery)$/, "FastAPI services with async/await and the REST integrations at Malvox"],
    [/^(LangGraph|AI Agents|Vector Databases|Prompt Engineering)$/, "the tool-calling agents and RAG in the AI engineering platform you are building"],
    [/^(CUDA|PyTorch|scikit-learn|pandas|TensorFlow)$/, "fine-tuning Llama with LoRA in PyTorch for SotonBuddy"],
    [/^(CloudFormation|Azure|GCP)$/, "Docker, Kubernetes and Terraform on AWS"],
  ];
  // What interviewers ask for each role type, and for common tools in the posting.
  const BASE = {
    Backend: ["Designing a REST API end to end: resources, errors, versioning, pagination", "Database schema and indexing choices, with your Malvox PostgreSQL model as the example", "Concurrency in Python: async/await, threads and where each fits", "How you test a service: unit, integration and what runs in CI"],
    MLOps: ["Taking a model from notebook to production: packaging, serving, rollback", "CI/CD for ML: what is tested and versioned (code, data, model)", "Monitoring models in production: drift, latency, alerts", "Kubernetes basics: deployments, probes, resource limits, autoscaling"],
    AI: ["Designing a RAG system: chunking, embeddings, retrieval quality", "Evaluating LLM output: test sets, metrics and regressions", "Agents and tool calling: failure modes and guardrails", "Fine-tuning versus prompting: when LoRA is worth it (SotonBuddy)"],
  };
  const TOOL_Q = {
    "Kubernetes": "Kubernetes: how a deployment rolls out and how you debug a crashing pod",
    "Docker": "Docker: image size, layers and multi-stage builds",
    "PostgreSQL": "PostgreSQL: indexes, query plans and transactions",
    "Kafka": "Kafka: partitions, consumer groups and delivery guarantees",
    "AWS": "AWS: which services you used and how they were secured",
    "Terraform": "Terraform: state, modules and reviewing a plan safely",
    "FastAPI": "FastAPI: dependency injection, validation and async endpoints",
    "RAG": "RAG: how you would measure and improve retrieval quality",
    "LLMs": "LLMs: cost, latency and hallucination trade-offs",
    "MLflow": "MLflow: tracking experiments and promoting a model",
    "Airflow": "Airflow: DAG design, retries and backfills",
    "CI/CD": "CI/CD: what your pipeline checks before a release goes out",
    "Redis": "Redis: caching patterns and invalidation",
    "Microservices": "Microservices: boundaries, communication and failure handling",
    "Observability": "Observability: logs, metrics, traces and what you alert on",
    "Python": "Python: generators, typing and packaging a library",
    "SQL": "SQL: joins, window functions and query tuning",
    "Linux": "Linux: diagnosing a slow or stuck process",
  };

  const short = (t, n = 150) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };

  // Every line of the CV that can serve as evidence, with where it comes from.
  function evidence(profile) {
    const p = CV.upgrade(profile), out = [];
    (p.experience || []).forEach(e => (e.bullets || []).forEach(b => out.push({ text: typeof b === "string" ? b : b.text, from: CV.splitOrg(e.org)[0] || e.org })));
    (p.projects || []).forEach(b => { const t = typeof b === "string" ? b : b.text; out.push({ text: t, from: t.split(/[,.(]/)[0].trim() }); });
    return out;
  }

  function analyse(job, profile) {
    const jd = String(job.description || ""), title = job.title || "", full = title + "\n" + jd;
    const thin = jd.trim().length < 200;
    const sentences = jd.split(/(?<=[.!?\n])\s+/);
    // 1) skills from the posting, weighted by repetition, title and "must/required" wording
    let terms = Match.found(full);
    if (!terms.length) terms = [...(job.matched || []), ...(job.missing || [])].filter(Boolean);
    const weight = k => (Match.count(k, jd) || 1) + (Match.test(k, title) ? 3 : 0) + (sentences.some(s => MUST.test(s) && Match.test(k, s)) ? 2 : 0);
    const ranked = terms.map(k => ({ k, w: weight(k), have: Match.has(k) || (job.matched || []).includes(k) })).sort((a, b) => b.w - a.w);
    const ev = profile ? evidence(profile) : [];
    const proof = k => ev.find(x => Match.test(k, x.text));
    const focus = ranked.filter(x => x.have).slice(0, 4).map(x => {
      const e = proof(x.k);
      return { name: x.k, proof: e ? `${e.from}: ${short(e.text)}` : "On your skills list. Prepare one concrete example of using it." };
    });
    // 2) themes the posting stresses, each with the CV line that backs it
    const themes = THEMES.map(([name, rx, cvRx]) => ({ name, hits: sentences.filter(s => rx.test(s)).length + (rx.test(title) ? 2 : 0), cvRx }))
      .filter(t => t.hits > 0).sort((a, b) => b.hits - a.hits).slice(0, 2)
      .map(t => { const e = ev.find(x => t.cvRx.test(x.text)); return e ? { name: t.name, proof: `${e.from}: ${short(e.text)}` } : null; }).filter(Boolean);
    const seen = new Set();
    const allFocus = [...focus, ...themes].filter(f => !seen.has(f.proof) && seen.add(f.proof)).slice(0, 5);
    // 3) weak spots
    const weak = ranked.filter(x => !x.have).slice(0, 4).map(x => {
      const c = CLOSEST.find(([rx]) => rx.test(x.k));
      return { name: x.k, say: `Not on your CV. Say so plainly, then bridge from ${c ? c[1] : "the closest work you have done"}, and how you would learn it in the first weeks.` };
    });
    const yrs = Math.max(0, ...[...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?\+?\s*(?:years|yrs)/gi)].map(m => +m[1]).filter(n => n <= 15));
    if (yrs > 4) weak.push({ name: `${yrs}+ years asked`, say: "You have 4+. Lead with scope and numbers: 40+ production defects, 25% lower MTTR, 5 automation tools." });
    if (/no (visa )?sponsorship|unable to sponsor|not (be able to )?(offer|provide) (visa )?sponsorship|must (already )?have (the )?right to work/i.test(jd)) weak.push({ name: "Sponsorship", say: "The posting says it will not sponsor a visa. Check before you spend time on it." });
    // 4) likely interview topics
    const kind = job.kind && BASE[job.kind] ? job.kind : (Match.kind ? Match.kind(title) : "Backend");
    const topics = [...ranked.map(x => TOOL_Q[x.k]).filter(Boolean).slice(0, 3), ...BASE[kind] || BASE.Backend].slice(0, 6);
    return { focus: allFocus, weak, topics, thin };
  }

  function html(job, profile, opts = {}) {
    if (!window.Match || !window.CV) return "";
    const r = analyse(job, profile);
    const li = (a, f) => a.map(f).join("");
    return `<div class="prep">
      ${r.thin ? `<p class="m prep-note">${opts.feed ? "Based on the skills list. Prep reads the full posting from the next daily run." : "Short posting text, so this is a rough read. Paste the full job description for a better one."}</p>` : ""}
      <div class="prep-blk"><h4>Focus on</h4>${r.focus.length ? `<ol class="prep-list">${li(r.focus, f => `<li><b>${esc(f.name)}</b><span>${esc(f.proof)}</span></li>`)}</ol>` : `<p class="m">No clear focus found in this text.</p>`}</div>
      ${r.weak.length ? `<div class="prep-blk"><h4>Prepare a story for</h4><ul class="prep-list weak">${li(r.weak, w => `<li><b>${esc(w.name)}</b><span>${esc(w.say)}</span></li>`)}</ul></div>` : ""}
      <div class="prep-blk"><h4>Likely interview topics</h4><ul class="prep-topics">${li(r.topics, t => `<li>${esc(t)}</li>`)}</ul></div>
    </div>`;
  }
  return { analyse, html };
})();
