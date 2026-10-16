/* Job Octo · CV Match. Reads ../data/public_jobs.json (job postings only, refreshed by the
   daily GitHub Action) and scores each role against the skills in the visitor's CV.
   The CV is read with pdf.js inside the browser; nothing is uploaded or sent anywhere. */
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const KEY = "jobocto.match.v1", MAX_CUSTOM = 3, PAGE = 40;
  const LEVELS = ["Intern / Graduate", "Junior", "Mid", "Senior / Lead"];
  const DEFAULTS = { name: "", skills: [], years: null, roles: [], custom: [], offRegions: [], levels: null, minMatch: 40, sort: "match", fileName: "" };
  // Roles inferred from a posting's skills when its title names none (same rules as scripts/public_feed.py).
  // Older feeds left about 4 in 10 postings without a role, so they never reached anyone.
  const TERM_ROLES = [
    ["AI / GenAI Engineer", ["LLMs", "RAG", "LangChain", "OpenAI API", "Hugging Face", "AI Agents", "LangGraph", "Fine-Tuning", "Prompt Engineering"], 2],
    ["MLOps / ML Engineer", ["MLflow", "Kubeflow", "SageMaker", "Vertex AI", "KServe", "PyTorch", "TensorFlow", "scikit-learn", "Feast", "Seldon"], 2],
    ["Data Engineer", ["Spark", "Airflow", "dbt", "Databricks", "BigQuery", "Snowflake", "ETL", "Kafka", "Hadoop"], 2],
    ["DevOps / Platform / SRE", ["Kubernetes", "Terraform", "Helm", "ArgoCD", "Prometheus", "Grafana", "CloudFormation", "Observability"], 3],
    ["Frontend Engineer", ["React", "Angular", "Vue", "Next.js", "CSS", "HTML", "Redux", "Tailwind"], 2],
    ["Mobile Engineer", ["Swift", "Kotlin", "Flutter", "React Native"], 1],
    ["QA / Test Engineer", ["Selenium", "Cypress", "Playwright", "Jest"], 2],
    ["Backend Engineer", ["Java", "Spring Boot", "Go", "Node.js", "Django", "Flask", "FastAPI", "Microservices", "Hibernate", "C#", ".NET", "Ruby", "PHP", "Rust", "Scala"], 1],
  ];
  // title patterns, the same as STANDARD_ROLES in scripts/public_feed.py
  const TITLE_ROLES = {
    "Software Engineer": /software (engineer|developer|development engineer)|\bsde\b|\bswe\b|application developer|programmer|product engineer|systems engineer|distributed systems|member of technical staff/i,
    "Backend Engineer": /back[- ]?end|java developer|java engineer|python developer|python engineer|node(\.js)? (developer|engineer)|golang|\bgo engineer|api engineer|integration (developer|engineer)/i,
    "Frontend Engineer": /front[- ]?end|react|angular|vue|ui (engineer|developer)|web developer|javascript (developer|engineer)/i,
    "Full Stack Engineer": /full[- ]?stack/i,
    "Mobile Engineer": /\bios\b|android|mobile|flutter|react native/i,
    "Data Engineer": /data engineer|etl|analytics engineer|big data|data platform/i,
    "Data Scientist / Analyst": /data scien|data analyst|business intelligence|\bbi (developer|engineer)|analytics (developer|specialist)/i,
    "DevOps / Platform / SRE": /devops|dev ops|platform engineer|site reliability|\bsre\b|infrastructure|cloud (engineer|developer)|build engineer|release engineer/i,
    "MLOps / ML Engineer": /ml ?ops|llm ?ops|ai ?ops|machine learning|\bml engineer|ml platform|model (deployment|serving)|ai (platform|infrastructure)/i,
    "AI / GenAI Engineer": /\bai\b|gen ?ai|generative|\bllm|applied ai|artificial intelligence|nlp|agent(ic)? engineer|rag engineer|context engineer|prompt engineer|evals? engineer/i,
    "QA / Test Engineer": /\bqa\b|quality (assurance|engineer)|\btest(ing)? (engineer|automation)|\bsdet\b|automation tester/i,
    "Security Engineer": /security (engineer|analyst|developer)|appsec|devsecops|penetration/i,
  };
  function jobRoles(j) {
    if (j._roles) return j._roles;
    let roles = (j.roles || []).slice();
    Object.entries(TITLE_ROLES).forEach(([r, rx]) => { if (rx.test(j.title) && !roles.includes(r)) roles.push(r); });
    if (!roles.length || (roles.length === 1 && roles[0] === "Software Engineer")) {
      const have = new Set(j.terms || []);
      TERM_ROLES.forEach(([r, keys, need]) => { if (keys.filter(k => have.has(k)).length >= need && !roles.includes(r)) roles.push(r); });
      if (/engineer|developer|programmer/i.test(j.title) && !roles.includes("Software Engineer")) roles.push("Software Engineer");
    }
    return (j._roles = roles);
  }
  // same role patterns as scripts/public_feed.py, used to suggest roles from the CV
  const ROLE_HINTS = {
    "Software Engineer": /software (engineer|developer)|\bsde\b|\bswe\b/i,
    "Backend Engineer": /back[- ]?end|\bjava\b|spring|node\.?js|golang|microservices|\bgo\b|django|fastapi/i,
    "Frontend Engineer": /front[- ]?end|react|angular|vue|tailwind|\bcss\b/i,
    "Full Stack Engineer": /full[- ]?stack/i,
    "Mobile Engineer": /\bios\b|android|flutter|react native|swift|kotlin/i,
    "Data Engineer": /data engineer|\betl\b|spark|airflow|snowflake|databricks/i,
    "Data Scientist / Analyst": /data scien|data analyst|power ?bi|tableau|pandas|scikit/i,
    "DevOps / Platform / SRE": /devops|kubernetes|terraform|site reliability|\bsre\b|jenkins|helm/i,
    "MLOps / ML Engineer": /ml ?ops|mlflow|machine learning|kubeflow/i,
    "AI / GenAI Engineer": /\bllms?\b|gen ?ai|generative|\brag\b|langchain|openai|hugging ?face/i,
    "QA / Test Engineer": /\bqa\b|selenium|cypress|playwright|test automation|\bsdet\b/i,
    "Security Engineer": /security engineer|appsec|penetration|devsecops/i,
  };
  let FEED = null, RX = [], S = load(), shown = PAGE;

  function load() {
    try {
      const d = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(KEY) || "{}"));
      // older versions saved the countries that were ON, so countries added later stayed hidden
      if (Array.isArray(d.regions)) { d.offRegions = ["India", "UK", "Europe", "Sweden", "US", "New Zealand", "Turkey", "Remote from India"].filter(r => !d.regions.includes(r)); delete d.regions; }
      return d;
    } catch (e) { return Object.assign({}, DEFAULTS); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* private mode */ } }
  function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 2800); }

  // ------------------------------------------------------------ CV reading --
  let pdfReady = null;
  function loadPdfjs() {
    if (!pdfReady) pdfReady = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "../assets/vendor/pdf.min.js";
      s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = "../assets/vendor/pdf.worker.min.js"; res(); };
      s.onerror = () => rej(new Error("PDF reader did not load")); document.head.appendChild(s);
    });
    return pdfReady;
  }
  async function pdfText(file) {
    await loadPdfjs();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const c = await (await pdf.getPage(i)).getTextContent();
      out += c.items.map(it => it.str + (it.hasEOL ? "\n" : " ")).join("") + "\n";
    }
    return out;
  }
  const MON = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?";
  function yearsFrom(text) {
    const t = text.replace(/[–—]/g, "-");
    const explicit = [...t.matchAll(/(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years|yrs)\s+(?:of\s+)?(?:professional\s+|industry\s+|work\s+)?experience/gi)].map(m => +m[1]);
    if (explicit.length) return Math.max(...explicit);
    // only the experience section, so education dates do not count
    const start = t.search(/\b(experience|employment|work history)\b/i);
    let sec = start >= 0 ? t.slice(start) : t;
    const end = sec.slice(10).search(/\n\s*(education|projects|academic|skills|certifications)\b/i);
    if (end > 0) sec = sec.slice(0, end + 10);
    const rx = new RegExp(MON + "\\s*(\\d{4})\\s*(?:-|to)\\s*(present|current|now|till date|" + MON + "\\s*(\\d{4}))", "gi");
    const months = new Set(), now = new Date();
    const mi = s => ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(s.slice(0, 3).toLowerCase());
    for (const m of sec.matchAll(rx)) {
      const a = +m[2] * 12 + mi(m[1]);
      const b = /present|current|now|till/i.test(m[3]) ? now.getFullYear() * 12 + now.getMonth() : +m[5] * 12 + mi(m[4]);
      for (let x = a; x <= b && x - a < 600; x++) months.add(x);
    }
    return months.size ? Math.round(months.size / 12 * 2) / 2 : null;
  }
  function nameFrom(text) {
    const line = text.split("\n").map(x => x.trim()).find(x => /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(x) && x.split(/\s+/).length <= 4 && !/resume|curriculum|cv\b/i.test(x));
    return line ? line.replace(/\b\w/g, c => c.toUpperCase()) : "";
  }
  async function readCV(text, fileName) {
    if (!text || text.trim().length < 80) { toast("Could not read text from that file. Try pasting the CV text instead."); renderProfile(); return; }
    await vocabReady; // a CV dropped before the job list loaded used to find 0 skills
    S.name = nameFrom(text);
    S.skills = RX.filter(([, rx]) => rx.test(text)).map(([k]) => k);
    S.years = yearsFrom(text);
    S.fileName = fileName || "pasted text";
    const roleHits = Object.entries(ROLE_HINTS).map(([r, rx]) => [r, (text.match(new RegExp(rx.source, "gi")) || []).length]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    S.roles = roleHits.slice(0, 4).map(([r]) => r);
    if (!S.roles.length) S.roles = ["Software Engineer"];
    S.levels = null; // recalculated from years
    S.minMatch = DEFAULTS.minMatch; // a new CV starts from the default filters, so its own matches show
    save(); shown = PAGE; renderAll();
    toast(S.skills.length ? `Read ${S.skills.length} skills from your CV. Your matches are updated.` : "No known skills found in that file. Try pasting the CV text instead.");
    const r = $("mresults"); if (r && innerWidth < 980) r.scrollIntoView({ behavior: "smooth" });
  }

  // --------------------------------------------------------------- scoring --
  function defaultLevels() {
    const y = S.years ?? 3;
    if (y < 1.5) return ["Intern / Graduate", "Junior", "Mid"];
    if (y < 3) return ["Junior", "Mid", "Senior / Lead"];
    if (y < 6) return ["Junior", "Mid", "Senior / Lead"];
    return ["Mid", "Senior / Lead"];
  }
  // Match % from this CV: skills overlap (85%) plus role fit (15%), then level and years.
  // Short postings with few named skills get an estimate from whatever they do name, so
  // two different CVs no longer see the same flat 60% everywhere.
  function score(j) {
    const have = new Set(S.skills), found = j.terms || [];
    const matched = found.filter(t => have.has(t)), missing = found.filter(t => !have.has(t));
    const roleFit = jobRoles(j).some(r => S.roles.includes(r)) || customHit(j) ? 1 : 0;
    let pct;
    if (found.length < 3) pct = 45 + 12 * matched.length - 8 * missing.length + 15 * roleFit;
    else {
      pct = Math.round(85 * matched.length / found.length + 15 * roleFit);
      if (found.length < 5) pct = Math.min(pct, 80);
    }
    const stretch = j.level === "Senior / Lead" && S.years != null && S.years < 5;
    if (stretch) pct -= S.years < 3 ? 12 : 6;
    if (j.years && S.years != null && j.years > S.years) pct -= Math.min(15, 5 * Math.ceil(j.years - S.years));
    return { pct: Math.max(0, Math.min(98, Math.round(pct))), matched, missing, thin: found.length < 3, stretch };
  }
  const customHit = j => S.custom.some(c => { const t = j.title.toLowerCase(); return c.toLowerCase().split(/\s+/).filter(w => w.length > 1).every(w => t.includes(w)); });
  function roleOk(j) {
    if (jobRoles(j).some(r => S.roles.includes(r))) return true;
    return customHit(j);
  }
  const regionOn = r => !(S.offRegions || []).includes(r);
  const ago = d => { if (!d) return ""; const n = Math.round((Date.now() - Date.parse(d)) / 864e5); return n <= 0 ? "today" : n === 1 ? "1d ago" : n + "d ago"; };
  const cls = p => p >= 75 ? "" : p >= 60 ? " m-mid" : " m-lo";
  const visaTxt = v => v < 0 ? "No visa needed" : "Visa " + v + "%";

  // -------------------------------------------------------------- rendering --
  function renderProfile() {
    const has = S.skills.length > 0;
    $("profile").hidden = !has;
    $("dropTitle").textContent = has ? "Upload a different CV" : "Upload your CV (PDF)";
    $("dropSub").textContent = has ? `Using: ${S.fileName}` : "Click or drop the file here";
    if (!has) return;
    $("pName").textContent = S.name || "Your CV";
    $("pMeta").textContent = `${S.skills.length} skills found` + (S.years != null ? ` · about ${S.years} years of experience` : "");
    $("pYears").value = S.years ?? "";
    $("pSkills").innerHTML = S.skills.map(k => `<span class="sk">${esc(k)}<button type="button" class="x" data-skill="${esc(k)}" aria-label="Remove ${esc(k)}">×</button></span>`).join("");
  }
  function renderRoles() {
    $("roleChips").innerHTML = (FEED ? FEED.roles : Object.keys(ROLE_HINTS)).map(r => `<button type="button" class="chip" data-role="${esc(r)}" aria-pressed="${S.roles.includes(r)}">${esc(r)}</button>`).join("");
    $("customChips").innerHTML = S.custom.length ? S.custom.map(c => `<span class="chip" aria-pressed="true">${esc(c)}<button type="button" class="x" data-custom="${esc(c)}" aria-label="Remove ${esc(c)}">×</button></span>`).join("") : `<span class="m">None added</span>`;
    $("customAdd").disabled = $("customAddBtn").disabled = S.custom.length >= MAX_CUSTOM;
    $("customAdd").placeholder = S.custom.length >= MAX_CUSTOM ? "Limit of 3 reached" : "Add a role title";
  }
  function renderFilters() {
    const regions = FEED ? FEED.regions : [];
    $("regionChips").innerHTML = regions.map(r => `<button type="button" class="chip" data-region="${esc(r)}" aria-pressed="${regionOn(r)}">${esc(r)}</button>`).join("");
    const lv = S.levels || defaultLevels();
    $("levelChips").innerHTML = LEVELS.map(l => `<button type="button" class="chip" data-level="${esc(l)}" aria-pressed="${lv.includes(l)}">${esc(l)}</button>`).join("");
    $("minMatch").value = S.minMatch; $("minMatchVal").textContent = S.minMatch + "%";
    $("sort").value = S.sort;
  }
  function renderList() {
    if (!FEED) return;
    const open = FEED.jobs.filter(j => !j.closed);
    if (!S.skills.length) {
      $("kpis").innerHTML = kpi("Live roles", open.length, "all countries", "var(--accent)") + kpi("Companies", new Set(open.map(j => j.company)).size, "hiring now", "var(--accent-2)");
      $("count").textContent = "";
      $("list").innerHTML = `<div class="empty">Upload your CV on the left to see the roles that match you.</div>`;
      $("more").hidden = true; return;
    }
    const lv = S.levels || defaultLevels();
    const inReg = open.filter(j => regionOn(j.region)), inLv = inReg.filter(j => lv.includes(j.level)), inRole = inLv.filter(roleOk);
    let rows = inRole.map(j => Object.assign({ s: score(j) }, j)).filter(j => j.s.pct >= S.minMatch);
    const by = { match: (a, b) => b.s.pct - a.s.pct || (b.first_seen || "").localeCompare(a.first_seen || ""),
      new: (a, b) => (b.first_seen || "").localeCompare(a.first_seen || "") || b.s.pct - a.s.pct,
      visa: (a, b) => (b.visa < 0 ? 101 : b.visa) - (a.visa < 0 ? 101 : a.visa) || b.s.pct - a.s.pct };
    rows.sort(by[S.sort] || by.match);
    const strong = rows.filter(j => j.s.pct >= 75).length, fresh = rows.filter(j => j.first_seen && (Date.now() - Date.parse(j.first_seen)) < 3 * 864e5).length;
    $("kpis").innerHTML = kpi("Matching roles", rows.length, "with your filters", "var(--accent)") + kpi("Strong matches", strong, "75% or higher", "var(--good)") +
      kpi("New this week", fresh, "first seen in 3 days", "var(--warn)") + kpi("Companies", new Set(rows.map(j => j.company)).size, "hiring for you", "var(--visa)");
    $("count").textContent = `${Math.min(shown, rows.length)} of ${rows.length} roles`;
    $("list").innerHTML = rows.length ? rows.slice(0, shown).map(card).join("") :
      `<div class="empty"><b>No roles match these filters yet.</b><p>${open.length} live roles · ${inReg.length} in your countries · ${inLv.length} at your levels · ${inRole.length} in your roles · ${rows.length} at ${S.minMatch}%+ match</p>
        <div class="empty-acts">${inRole.length ? `<button type="button" class="btn sm" data-fix="min">Lower minimum match to 20%</button>` : ""}${inLv.length > inRole.length ? `<button type="button" class="btn sm" data-fix="roles">Pick all roles</button>` : ""}${inReg.length > inLv.length ? `<button type="button" class="btn sm" data-fix="levels">Show all levels</button>` : ""}${open.length > inReg.length ? `<button type="button" class="btn sm" data-fix="regions">All countries</button>` : ""}</div></div>`;
    $("more").hidden = rows.length <= shown;
  }
  const kpi = (l, n, sm, c) => `<div class="kpi" style="--k:${c}"><span>${l}</span><b>${n}</b><small>${sm}</small></div>`;
  function card(j) {
    const s = j.s, isNew = j.first_seen && (Date.now() - Date.parse(j.first_seen)) < 3 * 864e5;
    return `<article class="jc">
      <div class="ring${cls(s.pct)}" style="--p:${s.pct}" role="img" aria-label="Match ${s.pct} percent"><b>${s.pct}%</b></div>
      <div><div class="t">${esc(j.title)}</div><div class="c">${esc(j.company)} · ${esc(j.location || j.region)}</div>
        <div class="tags">${isNew ? '<span class="tag new">New</span>' : ""}<span class="tag">${esc(j.region)}</span><span class="tag">${esc(j.level)}</span>${j.years ? `<span class="tag">${j.years}+ yrs asked</span>` : ""}${s.stretch ? '<span class="tag warn">Stretch: senior role</span>' : ""}${s.thin ? '<span class="tag warn">Short posting: match estimated</span>' : ""}</div>
        <div class="skills">${s.matched.map(k => `<span class="sk">${esc(k)}</span>`).join("")}${s.missing.slice(0, 6).map(k => `<span class="sk miss">${esc(k)}</span>`).join("")}</div></div>
      <div class="side-r"><a class="btn primary sm" href="${esc(j.url)}" target="_blank" rel="noopener">Apply ↗</a>
        <span class="tag visa" title="${esc(j.visa_basis || "")}">${visaTxt(j.visa)}</span><span class="age">${ago(j.first_seen)}</span></div>
    </article>`;
  }
  function renderAll() { renderProfile(); renderRoles(); renderFilters(); renderList(); }

  // ----------------------------------------------------------------- events --
  async function handleFile(f) {
    if (!f) return;
    try {
      $("dropSub").textContent = "Reading your CV…";
      const text = /\.txt$/i.test(f.name) ? await f.text() : await pdfText(f);
      readCV(text, f.name);
    } catch (e) { toast("Could not read that PDF: " + e.message); renderProfile(); }
  }
  $("cvFile").addEventListener("change", e => { handleFile(e.target.files[0]); e.target.value = ""; });
  const drop = $("drop");
  ["dragenter", "dragover"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add("over"); }));
  ["dragleave", "drop"].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove("over"); }));
  drop.addEventListener("drop", e => handleFile(e.dataTransfer.files[0]));
  $("useText").addEventListener("click", () => readCV($("cvText").value, "pasted text"));
  $("pSkills").addEventListener("click", e => { const b = e.target.closest("[data-skill]"); if (!b) return; S.skills = S.skills.filter(k => k !== b.dataset.skill); save(); renderProfile(); renderList(); });
  function addSkill() {
    const v = $("skillAdd").value.trim(); if (!v) return;
    const known = FEED && Object.keys(FEED.terms).find(k => k.toLowerCase() === v.toLowerCase());
    if (!known) { toast("Pick a skill from the list so it can be matched against postings"); return; }
    if (!S.skills.includes(known)) S.skills.push(known);
    $("skillAdd").value = ""; save(); renderProfile(); renderList();
  }
  $("skillAddBtn").addEventListener("click", addSkill);
  $("skillAdd").addEventListener("keydown", e => { if (e.key === "Enter") addSkill(); });
  $("pYears").addEventListener("change", e => { S.years = e.target.value === "" ? null : +e.target.value; S.levels = null; save(); renderFilters(); renderList(); });
  $("clearAll").addEventListener("click", () => { S = Object.assign({}, DEFAULTS); try { localStorage.removeItem(KEY); } catch (e) {} renderAll(); toast("Your CV details were removed from this device"); });
  $("roleChips").addEventListener("click", e => {
    const b = e.target.closest("[data-role]"); if (!b) return; const r = b.dataset.role;
    S.roles = S.roles.includes(r) ? S.roles.filter(x => x !== r) : S.roles.concat(r); shown = PAGE; save(); renderRoles(); renderList();
  });
  function addCustom() {
    const v = $("customAdd").value.trim().replace(/\s+/g, " ");
    $("customMsg").textContent = "";
    if (!v) return;
    if (S.custom.length >= MAX_CUSTOM) { $("customMsg").textContent = "You can add up to 3 of your own roles. Remove one to add another."; return; }
    if (S.custom.some(c => c.toLowerCase() === v.toLowerCase())) return;
    S.custom.push(v); $("customAdd").value = ""; shown = PAGE; save(); renderRoles(); renderList();
  }
  $("customAddBtn").addEventListener("click", addCustom);
  $("customAdd").addEventListener("keydown", e => { if (e.key === "Enter") addCustom(); });
  $("customChips").addEventListener("click", e => { const b = e.target.closest("[data-custom]"); if (!b) return; S.custom = S.custom.filter(c => c !== b.dataset.custom); save(); renderRoles(); renderList(); });
  $("regionChips").addEventListener("click", e => {
    const b = e.target.closest("[data-region]"); if (!b) return; const r = b.dataset.region;
    S.offRegions = regionOn(r) ? (S.offRegions || []).concat(r) : S.offRegions.filter(x => x !== r); shown = PAGE; save(); renderFilters(); renderList();
  });
  $("levelChips").addEventListener("click", e => {
    const b = e.target.closest("[data-level]"); if (!b) return; const l = b.dataset.level, cur = S.levels || defaultLevels();
    S.levels = cur.includes(l) ? cur.filter(x => x !== l) : cur.concat(l); shown = PAGE; save(); renderFilters(); renderList();
  });
  $("minMatch").addEventListener("input", e => { S.minMatch = +e.target.value; $("minMatchVal").textContent = S.minMatch + "%"; save(); renderList(); });
  $("sort").addEventListener("change", e => { S.sort = e.target.value; save(); renderList(); });
  $("more").addEventListener("click", () => { shown += PAGE; renderList(); });
  $("list").addEventListener("click", e => {
    const b = e.target.closest("[data-fix]"); if (!b) return;
    const f = b.dataset.fix;
    if (f === "min") S.minMatch = 20;
    if (f === "roles") S.roles = (FEED ? FEED.roles : Object.keys(ROLE_HINTS)).slice();
    if (f === "levels") S.levels = LEVELS.slice();
    if (f === "regions") S.offRegions = [];
    save(); renderAll();
  });
  document.querySelectorAll("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "light" ? "dark" : "light"; document.documentElement.dataset.theme = next;
    try { localStorage.setItem("jobocto.theme", next); } catch (e) {}
  }));

  // ------------------------------------------------------------------- boot --
  let vocabDone; const vocabReady = new Promise(r => { vocabDone = r; });
  const compile = terms => Object.entries(terms || {}).map(([k, v]) => { try { return [k, new RegExp(v, "i")]; } catch (e) { return null; } }).filter(Boolean);
  (async function boot() {
    try {
      const r = await fetch("../data/public_jobs.json", { cache: "no-cache" });
      if (!r.ok) throw new Error(r.status);
      FEED = await r.json();
      RX = compile(FEED.terms); vocabDone();
      $("skillList").innerHTML = Object.keys(FEED.terms).sort().map(k => `<option value="${esc(k)}">`).join("");
      const when = FEED.generated_at ? new Date(FEED.generated_at) : null;
      $("updated").textContent = when ? `${FEED.jobs.filter(j => !j.closed).length} live roles · updated ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })}` : "Live roles";
    } catch (e) {
      // no job list yet: still read CVs with the plain skills vocabulary
      try { RX = compile((await (await fetch("../data/terms.json", { cache: "no-cache" })).json()).terms); } catch (e2) { RX = []; }
      vocabDone();
      $("updated").textContent = "Job list not ready yet";
      $("list").innerHTML = `<div class="empty">The public job list is created by the next daily run. Please check back after 8:00 AM IST.</div>`;
    }
    renderAll();
  })();
})();
