/* Tailored CV, built in the browser with pdfmake (no AI, no server).
   Same one-page A4 template every time. Per job it changes only:
   the second subtitle title, which summary is used and what is bold,
   the order of skill lines, and the order of bullets inside each role.
   Titles, employers, dates, metrics, projects and certifications never change. */
window.CV = (function () {


  function secondTitle(profile, job) {
    const t = (job.title || "").toLowerCase(), s = profile.second_titles;
    if (/ml ?ops|ml platform|ml infra/.test(t)) return s.mlops;
    if (/site reliability|\bsre\b/.test(t)) return s.sre;
    if (/devops/.test(t)) return s.devops;
    if (/platform|infrastructure/.test(t)) return s.platform;
    if (/data engineer|data platform/.test(t)) return s.data;
    if (/machine learning|\bml\b|\bai\b|llm/.test(t)) return s.ai;
    if (/python|backend|back-end|back end/.test(t)) return s.backend;
    return s.software;
  }
  function summaryKey(job) { return job.kind === "MLOps" ? "mlops" : job.kind === "AI" ? "ai" : "backend"; }

  // Summary sentence bank. Every sentence restates a fact already on the CV.
  // Per job, the opener for the role type is followed by the sentences whose tags
  // best match the posting (matched skills, missing skills, title and note), best match first.
  const DEFAULT_BANK = {
    openers: {
      backend: "Backend Software Engineer with 4+ years building production Python services, REST integrations and the data layers behind them.",
      mlops: "MLOps and Backend Engineer with 4+ years building production Python services and pipelines.",
      ai: "Backend Software Engineer with 4+ years of production Python, now building an AI engineering platform (in progress) with LLMs, RAG, LangChain and the OpenAI API.",
    },
    sentences: [
      { id: "gov", p: 9, text: "Designed the PostgreSQL data model and REST integrations for 3 UK Government data services at a 6-person cybersecurity startup.", tags: ["postgresql", "sql", "database", "rest", "api", "integration", "data model", "backend", "relational"] },
      { id: "security", p: 4, needs: "gov", text: "Secured sensitive data there with OAuth2, JWT, TLS and AES-256 encryption.", tags: ["security", "oauth", "jwt", "tls", "encryption", "gdpr", "compliance", "governance"] },
      { id: "testing", p: 6, text: "Writes unit and integration tests with Pytest and ran automated validation on Jenkins CI.", tags: ["test", "pytest", "unit testing", "tdd", "quality", "ci/cd", "jenkins", "github actions", "automated testing"] },
      { id: "defects", p: 8, cap: 1, text: "Owned resolution of 40+ production defects and contributed to a 25% reduction in MTTR.", tags: ["production", "reliability", "incident", "on-call", "sre", "debugging", "troubleshooting", "monitoring", "observability"] },
      { id: "linux", p: 5, cap: 1, text: "Debugged production-critical Python, C/C++ and Linux systems with GDB and log analysis.", tags: ["linux", "c++", "systems", "gdb", "debugging", "unix", "kernel", "systemd", "go"] },
      { id: "automation", p: 7, cap: 1, text: "Wrote 5 Python automation tools that cut manual investigation time by around 80%.", tags: ["automation", "python", "scripting", "tooling", "developer experience"] },
      { id: "etl", p: 3, cap: 1, text: "Built ETL migrations and automated checks for an enterprise ERP platform.", tags: ["etl", "data pipeline", "data engineering", "pipelines", "data quality", "sql", "snowflake", "dbt"] },
      { id: "mlops", p: 3, not: ["cloud"], text: "Freelances for a UK client via Alignerr on model deployment and pipeline automation with Docker, Kubernetes, MLflow and Airflow.", tags: ["mlops", "mlflow", "airflow", "model", "machine learning", "ml", "kubernetes", "deployment", "kubeflow"] },
      { id: "llm", p: 2, skip: ["ai"], text: "Building an AI engineering platform (in progress) with LLMs, RAG, LangChain and the OpenAI API.", tags: ["llm", "rag", "langchain", "openai", "genai", "generative", "agent", "ai engineer", "vector"] },
      { id: "ai_tools", p: 2, text: "Builds daily with AI coding tools, including Claude Code and Cursor.", tags: ["ai coding", "ai tools", "claude", "cursor", "copilot", "ai-assisted", "ai assisted"] },
      { id: "async", p: 4, text: "Works with FastAPI, async/await and concurrency.", tags: ["async", "asyncio", "concurrency", "fastapi", "aiohttp", "event loop"] },
      { id: "cloud", p: 3, not: ["mlops"], text: "Deploys with Docker, Kubernetes and Terraform on AWS.", tags: ["aws", "terraform", "docker", "kubernetes", "cloud", "gcp", "azure", "infrastructure as code", "helm"] },
      { id: "messaging", p: 1, text: "Also uses Apache Kafka, RabbitMQ and Redis.", tags: ["kafka", "rabbitmq", "redis", "event-driven", "streaming", "messaging", "queue"] },
    ],
  };
  function jobText(job) {
    return [job.title, job.note, ...(job.matched || []), ...(job.missing || []), job.description || ""].join(" | ").toLowerCase();
  }
  // Ranked sentences for this job (best first); the summary keeps the first n, printed in bank order.
  function rankSentences(profile, job) {
    const bank = profile.summary_bank || DEFAULT_BANK, key = summaryKey(job), text = jobText(job);
    return bank.sentences.filter(s => !(s.skip || []).includes(key))
      .map((s, i) => ({ s, i, score: s.tags.filter(t => text.includes(t)).length * 10 + (s.p || 0) }))
      .sort((a, b) => b.score - a.score);
  }
  function composeSummary(profile, job, ids) {
    if (job.summary) return job.summary;
    const bank = profile.summary_bank || DEFAULT_BANK;
    // the first Capgemini sentence printed names the employer
    let named = false;
    const pick = (ids || []).map(id => bank.sentences.find(s => s.id === id)).filter(Boolean).map(s => {
      if (!s.cap || named) return s.text;
      named = true; return "At Capgemini Engineering, " + s.text[0].toLowerCase() + s.text.slice(1);
    });
    return [bank.openers[summaryKey(job)], ...pick].join(" ");
  }
  const allowed = (s, ids) => (!s.needs || ids.includes(s.needs)) && !(s.not || []).some(x => ids.includes(x));
  // Text with **double asterisks** marks words to print in bold.
  function marked(text) {
    return text.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map(t => /^\*\*.+\*\*$/.test(t) ? { text: t.slice(2, -2), bold: true } : t);
  }
  // Skills Mayur has confirmed that older vault copies may not list yet.
  const ADD_SKILLS = { "Quality and Ways of Working": ["Unit Testing", "Automated Testing"], "Databases": ["Relational Databases", "Query Optimisation"] };
  function upgrade(profile) {
    const p = JSON.parse(JSON.stringify(profile));
    // Mayur confirmed 5 automation tools (older vault copies say 2)
    (p.experience || []).forEach(r => (r.bullets || []).forEach(b => { b.text = b.text.replace(/\b2 Python automation tools\b/, "5 Python automation tools"); }));
    (p.skill_groups || []).forEach(g => (ADD_SKILLS[g.label] || []).forEach((x, j) => { if (!g.items.includes(x)) g.items.splice(g.label === "Databases" ? g.items.length : 1 + j, 0, x); }));
    return p;
  }
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  function boldRuns(text, terms) {
    const fixed = ["4+ years", "around 80%", "40+", "25%", "3 UK Government", "Backend Software Engineer", "MLOps and Backend Engineer", "in progress"];
    const all = [...new Set([...fixed, ...terms])].filter(Boolean).sort((a, b) => b.length - a.length);
    if (!all.length) return [text];
    const alt = all.map(esc).join("|");
    const split = new RegExp("(?<![A-Za-z0-9])(" + alt + ")(?![A-Za-z0-9])", "i"), whole = new RegExp("^(" + alt + ")$", "i");
    return text.split(split).filter(x => x !== "").map(part => whole.test(part) ? { text: part, bold: true } : part);
  }
  const lc = a => a.map(x => String(x).toLowerCase());

  function hits(str, terms) {
    const s = str.toLowerCase();
    return terms.filter(t => new RegExp("(^|[^a-z0-9])" + esc(t) + "($|[^a-z0-9])").test(s)).length;
  }

  function orderSkills(profile, job) {
    if (job.fixed) return profile.skill_groups.map(g => ({ label: g.label, items: g.items }));
    const terms = lc(job.matched || []);
    const first = { MLOps: "MLOps and Platform", AI: "AI and LLMs", Backend: "Backend and APIs" }[job.kind] || "Backend and APIs";
    const groups = profile.skill_groups.map(g => {
      const items = [...g.items].sort((a, b) => hits(b, terms) - hits(a, terms));
      return { label: g.label, items, score: items.reduce((n, i) => n + hits(i, terms), 0) + (g.label === first ? 100 : 0) };
    });
    return groups.sort((a, b) => b.score - a.score);
  }
  function orderBullets(list, job) {
    if (job.fixed) return list.map(b => typeof b === "string" ? b : b.text);
    const terms = lc(job.matched || []).concat([job.kind.toLowerCase()]);
    return list.map((b, i) => ({ b, i, s: (b.tags || []).filter(t => terms.some(x => x.includes(t) || t.includes(x))).length + hits(b.text, terms) }))
      .sort((x, y) => y.s - x.s || x.i - y.i).map(x => x.b.text);
  }
  function relocation(job) {
    if (job.region === "Remote from India") return "";
    if (job.region === "UK") return "Open to relocation to the UK";
    const city = (job.location || "").split(/[·,|/]/).map(x => x.trim()).find(x => x && !/remote|hybrid|on-site|office/i.test(x));
    if (job.region === "Europe" || job.region === "Sweden") return city ? `Open to relocation to ${city}` : "Open to relocation within the EU";
    return "Open to relocation";
  }

  // Measurements taken from Mayur's own CV (Carlito, A4):
  // name 15 bold · subtitle 10.5 #333 · contact 8.5 · section 10 bold caps + 0.75pt rule
  // body 9.5 (line 11.6pt) · dates 8.5 #454545 · bullet at +4.3pt, text at +13.6pt · margins 28.9pt
  const GRAY = "#454545";
  // pdfmake treats "-" and "/" as break points and then spreads justified space after them
  // ("6- person", "C/ C++"). Keep such words in one unbreakable run so they print as typed.
  const JOINED = /(\S*[-/+]\S* ?)/;
  function keepJoined(runs) {
    const out = [];
    (Array.isArray(runs) ? runs : [runs]).forEach(r => {
      const base = typeof r === "string" ? { text: r } : r;
      String(base.text).split(JOINED).filter(x => x !== "").forEach(part => {
        const piece = Object.assign({}, base, { text: part });
        if (JOINED.test(part) && /[-/+]/.test(part) && !/^\s/.test(part)) piece.noWrap = true;
        // a run that starts with a space would get double justify spacing: hand the space to the run before
        const lead = /^[.,;:)]*\s*/.exec(piece.text);
        if (lead && lead[0] && out.length) { out[out.length - 1].text += lead[0]; piece.text = piece.text.slice(lead[0].length); }
        if (piece.text !== "") out.push(piece);
      });
    });
    return out;
  }
  function section(title, gap, fs = 9.5) {
    return [{
      id: "sec-" + title,
      table: { widths: ["*"], body: [[{ text: title.toUpperCase(), bold: true, fontSize: fs + 0.5, characterSpacing: 0.7 }]] },
      layout: { hLineWidth: i => (i === 1 ? 0.75 : 0), vLineWidth: () => 0, hLineColor: () => "#888888",
        paddingLeft: () => 0, paddingRight: () => 0, paddingTop: () => 0, paddingBottom: () => 2 },
      margin: [0, gap, 0, 0.9],
    }];
  }
  const bullet = (t, fs) => ({ columns: [{ width: 9.3, text: "\u2022", fontSize: fs }, { width: "*", text: keepJoined(t), alignment: "justify" }], columnGap: 0, margin: [4.3, 0, 0, 0] });
  const dated = (left, dates, fs, top) => ({ columns: [{ width: "*", text: left }, { width: "auto", text: dates, fontSize: fs - 1, color: GRAY, alignment: "right", margin: [0, 0.8, 0, 0] }], margin: [0, top, 0, 0] });

  function doc(profile, job, fs = 9.5, gap = 2.4, ids = []) {
    const p = upgrade(profile), c = p.contact;
    const sub = [p.first_title, job.second_title || secondTitle(p, job), p.experience_tag].join("  |  ");
    const reloc = relocation(job);
    const contact = [c.location, reloc, c.phone, c.email].filter(Boolean).join("  |  ");
    const raw = composeSummary(p, job, ids), summary = job.summary ? marked(raw) : boldRuns(raw, job.matched || []);
    const skills = orderSkills(p, job).map(g => ({ text: keepJoined([{ text: g.label + ": ", bold: true }, g.items.join(", ")]), alignment: "justify" }));
    const exp = [];
    p.experience.forEach((r, i) => {
      exp.push(dated([{ text: r.title, bold: true }, "  |  " + r.org], r.dates, fs, i ? gap * 0.6 : 0.7));
      orderBullets(r.bullets, job).forEach(t => exp.push(bullet(t, fs)));
    });
    const projects = orderBullets(p.projects, job).map(t => bullet(t, fs));
    const edu = p.education.map((e, i) => dated([{ text: e.degree, bold: true }, ", " + e.org], e.dates, fs, i ? 0.7 : 0));
    return {
      pageSize: "A4",
      pageMargins: [28.9, 18.7, 28.8, 18],
      info: { title: `Mayur Dokras CV - ${job.company}`, author: "Mayur Dokras", creator: "Mayur Dokras", producer: "Mayur Dokras", subject: job.title },
      defaultStyle: { font: "Carlito", fontSize: fs, lineHeight: 1, color: "#000000" },
      content: [
        { text: p.name, fontSize: 15 + (fs - 9.5), bold: true },
        { text: sub, fontSize: fs + 1, color: "#333333", margin: [0, 0.8, 0, 1.4] },
        { text: contact, fontSize: fs - 1 },
        { text: c.links.join("  |  "), fontSize: fs - 1, margin: [0, 0.8, 0, 0] },
        ...section("Summary", gap + 1.2, fs), { text: keepJoined(summary), alignment: "justify", id: "sumStart" },
        ...section("Technical Skills", gap, fs), ...skills,
        ...section("Professional Experience", gap, fs), ...exp,
        ...section("Projects", gap, fs), ...projects,
        ...section("Education", gap, fs), ...edu,
        ...section("Certifications", gap, fs), { text: keepJoined(p.certifications.join("  |  ")), alignment: "justify" },
      ],
    };
  }

  function pages(buf) {
    const s = new TextDecoder("latin1").decode(buf);
    return (s.match(/\/Type\s*\/Page[^s]/g) || []).length;
  }

  // Fill the page: use the largest body size (up to 10.6pt) that keeps the CV on one page
  // with the summary at 5 lines or fewer, then spread any space left over the section gaps.
  function measure(def, gap) {
    const pos = {};
    def.pageBreakBefore = node => { if (node.id) pos[node.id] = node.startPosition; return false; };
    return new Promise(res => pdfMake.createPdf(def).getBuffer(buf => {
      delete def.pageBreakBefore;
      const fs = def.defaultStyle.fontSize, a = pos.sumStart, b = pos["sec-Technical Skills"];
      const sumLines = a && b ? Math.round((b.top - gap - a.top) / (fs * 1.2207)) : 99;
      res({ pages: pages(buf), sumLines });
    }));
  }
  // Largest body size first (10.6pt down to 8.95pt). At each size the summary takes the best
  // matching sentences that still fit in 5 lines; a sentence that would make a sixth line is
  // skipped for a shorter one. The size is accepted once at least 3 sentences fit.
  async function fill(profile, job, f) {
    const ids = [];
    if (job.summary) {
      const m = await measure(doc(profile, job, f, 2.4, ids), 2.4);
      return m.pages === 1 && m.sumLines <= 5 ? ids : null;
    }
    for (const r of rankSentences(profile, job)) {
      if (ids.length >= 5) break;
      if (!allowed(r.s, ids)) continue;
      const m = await measure(doc(profile, job, f, 2.4, [...ids, r.s.id]), 2.4);
      if (m.pages > 1) break;
      if (m.sumLines <= 5) ids.push(r.s.id);
    }
    return ids.length >= 3 ? ids : null;
  }
  async function build(profile, job) {
    let fs = null, ids = [];
    for (let f = 10.6; f >= 8.95; f = Math.round((f - 0.1) * 100) / 100) {
      const got = await fill(profile, job, f);
      if (got) { fs = f; ids = got; break; }
    }
    if (fs === null) {
      ids = job.summary ? [] : rankSentences(profile, job).slice(0, 2).map(r => r.s.id);
      const def = doc(profile, job, 9.0, 0.4, ids), m = await measure(doc(profile, job, 9.0, 0.4, ids), 0.4);
      return { def, used: [9.0, 0.4, ids], pages: m.pages, lines: m.sumLines, squeezed: true };
    }
    // spread leftover space over the section gaps: largest gap (up to 9pt) that still fits one page
    let lo = 2.4, hi = 9;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2, m = await measure(doc(profile, job, fs, mid, ids), mid);
      if (m.pages === 1) lo = mid; else hi = mid;
    }
    const gap = Math.max(2.4, lo - 0.3);
    const m = await measure(doc(profile, job, fs, gap, ids), gap);
    return { def: doc(profile, job, fs, gap, ids), used: [fs, gap, ids], pages: m.pages, lines: m.sumLines };
  }
  async function download(profile, job) {
    if (!window.pdfMake) throw new Error("PDF library did not load");
    const { def, used } = await build(profile, job);
    const safe = (job.company || "Company").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    pdfMake.createPdf(def).download(`Mayur_Dokras_CV_${safe}.pdf`);
    return { second: secondTitle(profile, job), summary: summaryKey(job), fontSize: used[0], sentences: used[2] };
  }

  // ---------------------------------------------------------------- cover letter ---
  // One-page UK-style letter built from fixed, true paragraphs. Per job it changes the
  // opening (role, company, the posting's skills that are on the CV), which evidence
  // paragraph leads, an honest line about skills not yet used, and the relocation line.
  const listAnd = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
  function placeOf(job) {
    if (job.region === "Remote from India") return "";
    const city = (job.location || "").split(/[·,|/()]/).map(x => x.trim()).find(x => x && !/remote|hybrid|on-site|office|days?\b|worldwide|anywhere|global|via |emea|europe/i.test(x));
    return city || (job.region === "UK" ? "United Kingdom" : "");
  }
  // "Backend Engineer · Junior–Mid · Python" -> "Backend Engineer"; dashes become commas
  const cleanTitle = t => String(t || "").split(" · ")[0].replace(/\s*[\u2013\u2014]\s*/g, ", ").trim();
  function letterParas(job, profile) {
    const key = summaryKey(job), text = jobText(job), title = cleanTitle(job.title);
    // only name skills that are actually on the CV
    const pr = profile || {}, cvText = JSON.stringify([pr.skill_groups, pr.experience, pr.projects]).toLowerCase();
    const matched = (job.matched || []).filter(m => m.length <= 22 && new RegExp("(^|[^a-z0-9])" + esc(m.toLowerCase()) + "($|[^a-z0-9])").test(cvText)).slice(0, 3);
    const aiTools = /ai coding|ai tools|claude|cursor|copilot|ai-assisted|ai assisted/.test(text);
    const p1 = `I am applying for the ${title} role at ${job.company}.` +
      (matched.length > 1 ? ` The posting asks for ${listAnd(matched)}, ${matched.length === 2 ? "both" : "all"} of which I have used in my work.` : matched.length ? ` The posting asks for ${matched[0]}, which I have used throughout my work.` : "") +
      " I have spent four years on production software, most recently on backend services for a UK startup and before that on Capgemini Engineering systems used by enterprise clients.";
    const cap = "During three years at Capgemini Engineering I worked on Python, C and C++ code running on Linux, where much of my work was finding out why something had failed and fixing it at the source. I closed more than 40 production defects in that period, using GDB and logs to trace each one back to its cause, and the team brought its mean time to recovery down by a quarter. I also wrote five Python tools that removed most of the manual effort from our investigations.";
    const mlops = "Since early 2026 I have freelanced for a UK client through Alignerr on model deployment and pipeline automation, working with Docker, Kubernetes, MLflow and Airflow. Before that, at Capgemini Engineering, I ran ETL migrations for an enterprise ERP platform and built the scripts and automated checks behind them. I also closed more than 40 production defects there and wrote five Python tools that removed most of the manual effort from our investigations.";
    const ai = "I am building an AI engineering platform in Python that marks code submissions and writes CI tests for them, using LLMs, RAG, LangChain and the OpenAI API, with tool-calling agents and evaluation against stored cases. It is still in progress, and it draws on habits from three years at Capgemini Engineering, where I closed more than 40 production defects and wrote five Python tools that removed most of the manual effort from our investigations.";
    const malvox = "At Malvox, a six-person cybersecurity startup in the UK, I owned the PostgreSQL schema and the code that pulled data from three government services, and I wrote automated validation for every integration on Jenkins. " +
      (aiTools ? "I use Pytest and GitHub Actions for the same discipline today, with Claude Code and Cursor open throughout the day." : "I use Pytest and GitHub Actions for the same discipline today.");
    const missing = (job.missing || []).filter(m => m && m.length <= 22 && !/\d|check|\bjd\b|posting|see /i.test(m)).slice(0, 2);
    const closest = { backend: "building Python services on PostgreSQL and deploying them with Docker and Kubernetes", mlops: "model deployment and pipeline automation with MLflow, Airflow and Kubernetes", ai: "the AI engineering platform I am building with LLMs, RAG and LangChain" }[key];
    const gap = missing.length ? ` I have not yet used ${listAnd(missing)} in production. My closest experience is ${closest}, and I would put my first weeks into learning ${missing.length > 1 ? "them" : "it"} in your codebase and tooling.` : "";
    const reloc = job.region === "Remote from India" ? "" : job.region === "UK" ? " and am ready to relocate to the UK" :
      (placeOf(job) && !/europe|sweden/i.test(placeOf(job)) ? ` and am ready to relocate to ${placeOf(job)}` : " and am ready to relocate within the EU");
    const close = `I write tests alongside the code and document what I build so the rest of the team can run it without me, which is how I handed my tools over at Capgemini. I studied for an MSc in Software Engineering at the University of Southampton from 2024 to 2026${reloc}. I would welcome a conversation about how I could contribute to the ${job.company} team.`;
    const lead = key === "mlops" ? mlops : key === "ai" ? ai : cap;
    return [p1, lead, malvox + gap, close];
  }
  function letterDoc(profile, job, fs = 11) {
    const c = profile.contact, today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
    const paras = letterParas(job, profile);
    return {
      pageSize: "A4", pageMargins: [62, 56, 62, 50],
      info: { title: `Mayur Dokras Cover Letter - ${job.company}`, author: "Mayur Dokras", creator: "Mayur Dokras", producer: "Mayur Dokras", subject: job.title },
      defaultStyle: { font: "Carlito", fontSize: fs, lineHeight: 1.18 },
      content: [
        { text: profile.name, fontSize: 16, bold: true },
        { text: [profile.first_title, job.second_title || secondTitle(profile, job)].join("  |  "), color: "#333333", margin: [0, 1, 0, 2] },
        { text: [c.location, c.phone, c.email, c.links[0]].join("  |  "), fontSize: 9.5 },
        { canvas: [{ type: "line", x1: 0, y1: 0, x2: 471.28, y2: 0, lineWidth: 0.75, lineColor: "#888888" }], margin: [0, 6, 0, 18] },
        { text: today, margin: [0, 0, 0, 12] },
        { text: ["Recruitment Team", job.company, placeOf(job)].filter(Boolean).join("\n"), margin: [0, 0, 0, 14] },
        { text: "Re: " + cleanTitle(job.title), bold: true, margin: [0, 0, 0, 12] },
        { text: "Dear Hiring Manager,", margin: [0, 0, 0, 10] },
        ...paras.map(t => ({ text: keepJoined(t), alignment: "justify", margin: [0, 0, 0, 10] })),
        { text: "Yours faithfully,", margin: [0, 6, 0, 22] },
        { text: "Mayur Dokras", bold: true },
      ],
    };
  }
  async function downloadLetter(profile, job) {
    if (!window.pdfMake) throw new Error("PDF library did not load");
    const p = upgrade(profile);
    let def = null;
    for (const f of [11, 10.5, 10, 9.5]) { def = letterDoc(p, job, f); if ((await measure(letterDoc(p, job, f), 0)).pages === 1) break; }
    const safe = (job.company || "Company").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    pdfMake.createPdf(def).download(`Mayur_Dokras_Cover_Letter_${safe}.pdf`);
    return { words: letterParas(job, p).join(" ").split(/\s+/).length };
  }

  // ------------------------------------------------------------ tailor studio ---
  // The automatic version as editable text, so it can be changed by hand and rebuilt.
  async function tailored(profile, job) {
    const p = upgrade(profile), r = await build(profile, job);
    const raw = composeSummary(p, job, r.used[2]);
    const summary = job.summary ? raw : boldRuns(raw, job.matched || []).map(x => typeof x === "string" ? x : `**${x.text}**`).join("");
    return {
      second: job.second_title || secondTitle(p, job), summary,
      skills: orderSkills(p, job).map(g => g.label + ": " + g.items.join(", ")).join("\n"),
      bullets: p.experience.map(e => orderBullets(e.bullets, job)),
      projects: orderBullets(p.projects, job),
    };
  }
  // Profile and job with the hand edits applied (order is kept exactly as typed).
  function applyTailor(profile, job, t) {
    const p = upgrade(profile);
    p.skill_groups = t.skills.split("\n").map(l => l.trim()).filter(Boolean).map(l => {
      const i = l.indexOf(":"); return i < 0 ? { label: "Skills", items: l.split(/,\s*/) } : { label: l.slice(0, i).trim(), items: l.slice(i + 1).split(/,\s*/).map(x => x.trim()).filter(Boolean) };
    });
    p.experience = p.experience.map((e, i) => Object.assign({}, e, { bullets: (t.bullets[i] || []).filter(Boolean).map(text => ({ text })) }));
    p.projects = t.projects.filter(Boolean).map(text => ({ text }));
    return [p, Object.assign({}, job, { summary: t.summary, second_title: t.second, fixed: true })];
  }
  function plainText(p, j) {
    const c = p.contact;
    return [p.name, [p.first_title, j.second_title, p.experience_tag].join(" | "), [c.location, c.phone, c.email].join(" | "), c.links.join(" | "),
      "SUMMARY", String(j.summary).replace(/\*\*/g, ""), "TECHNICAL SKILLS", ...p.skill_groups.map(g => g.label + ": " + g.items.join(", ")),
      "PROFESSIONAL EXPERIENCE", ...p.experience.flatMap(e => [e.title + " | " + e.org + " " + e.dates, ...e.bullets.map(b => b.text)]),
      "PROJECTS", ...p.projects.map(b => b.text), "EDUCATION", ...p.education.map(e => e.degree + ", " + e.org + " " + e.dates),
      "CERTIFICATIONS", p.certifications.join(" | ")].join("\n");
  }
  async function downloadDef(def, company) {
    const safe = (company || "Company").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    pdfMake.createPdf(def).download(`Mayur_Dokras_CV_${safe}.pdf`);
  }

  return { tailored, applyTailor, plainText, downloadDef, SECOND_TITLES: ["MLOps Engineer", "Platform Engineer", "DevOps Engineer", "Site Reliability Engineer", "Python Developer", "Software Development Engineer", "Data Platform Engineer", "Cloud Engineer", "API Engineer"],
    download, downloadLetter, letterDoc, letterParas, doc, build, secondTitle, composeSummary, upgrade, DEFAULT_BANK };
})();
