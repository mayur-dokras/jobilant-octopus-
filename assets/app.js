/* Job Octo · page logic. Job data comes from data/*.json (updated by the
   GitHub Actions); your board, hidden roles and notes live in this browser's
   localStorage under one key, with Export / Import for backups. */
(function () {
  const STAGES = [
    ["Applied", "#1f6f78"], ["Technical test", "#c27a00"], ["In consideration", "#2f7fc1"], ["Rejected", "#a43a32"],
  ];
  const KIND = { MLOps: "MLOps / platform", Backend: "Backend / Python", AI: "AI / ML engineer" };
  const KEY = "jobhunthq.v1";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);

  let DATA = { jobs: [] }, COMPANIES = [], DISC = { items: [] }, PROFILE = null, BASE_PROFILE = null, PASS = "";
  let S = load();
  // cards saved under the old 8 stages move to the nearest of the 4 stages kept
  const OLD_STAGE = { "Shortlisted": "Applied", "HR round": "In consideration", "Salary discussion": "In consideration", "Accepted": "In consideration" };
  Object.values(S.board || {}).forEach(it => { if (OLD_STAGE[it.stage]) it.stage = OLD_STAGE[it.stage]; });
  const prevVisit = S.lastVisit || "1970-01-01";
  let strong = false, editing = null;

  function load() {
    try { return Object.assign({ board: {}, hidden: {}, skipped: {}, lastVisit: null }, JSON.parse(localStorage.getItem(KEY) || "{}")); }
    catch (e) { return { board: {}, hidden: {}, skipped: {}, lastVisit: null }; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { toast("Could not save in this browser (private mode?). Export a backup."); } }
  function toast(msg) { const t = $("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200); }
  async function getJSON(p, d) { try { const r = await fetch(p, { cache: "no-cache" }); if (!r.ok) throw 0; return await r.json(); } catch (e) { return d; } }

  // -------------------------------------------------------------- tabs --
  function show(tab) {
    document.querySelectorAll(".tab[data-tab]").forEach(b => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "tab-" + tab);
    if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  }
  document.querySelectorAll(".tab[data-tab]").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));

  // ------------------------------------------------------------- feed ---
  const matchCls = m => m >= 75 ? "m-hi" : m >= 60 ? "m-mid" : "m-lo";
  const visaTxt = v => v < 0 ? "N/A" : v + "%";
  const isNew = j => (j.first_seen || "") > prevVisit || j.first_seen === today();

  let selected = null;
  const ago = d => { if (!d) return ""; const n = Math.round((Date.parse(today()) - Date.parse(d)) / 864e5); return n <= 0 ? "today" : n === 1 ? "1d ago" : n + "d ago"; };
  const ring = (m, big) => m == null ? "" : `<div class="ring ${matchCls(m)}${big ? " lg" : ""}" style="--p:${m}" role="img" aria-label="Skills match ${m} percent"><b>${m}%</b></div>`;
  const open = () => DATA.jobs.filter(j => !j.closed && !S.hidden[j.id] && !S.board[j.id]);

  function renderFeed() {
    const q = $("q").value.toLowerCase(), k = $("f-kind").value, rg = $("f-reg").value;
    const mm = +$("f-match").value, mv = strong ? 70 : +$("f-visa").value, onlyNew = $("f-new").checked;
    const all = open();
    const list = all
      .filter(j => (!k || j.kind === k) && (!rg || j.region === rg) && j.match >= mm && (mv < 0 || j.visa < 0 || j.visa >= mv) && (!onlyNew || isNew(j)))
      .filter(j => !q || [j.title, j.company, j.location, (j.matched || []).join(" "), (j.missing || []).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (isNew(b) - isNew(a)) || b.match - a.match || b.visa - a.visa);
    if (!list.some(j => j.id === selected)) selected = list.length ? list[0].id : null;
    $("feedGrid").innerHTML = list.length ? list.map(row).join("") :
      `<div class="empty">No roles match these filters. Try a lower minimum match or visa odds.</div>`;
    renderDetail(DATA.jobs.find(j => j.id === selected));
    $("feedCount").textContent = `${list.length} of ${all.length} roles`;
    const fresh = all.filter(isNew).length;
    $("b-feed").textContent = fresh ? fresh + " new" : "";
    const strongN = all.filter(j => j.match >= 80).length, sponsor = all.filter(j => j.visa >= 70).length;
    const applied = Object.values(S.board).filter(it => it.stage !== "Rejected").length;
    $("kpis").innerHTML = [
      ["New since last visit", fresh, "added to the feed", "var(--accent)"],
      ["Open roles", all.length, `${DATA.companies_checked ?? COMPANIES.length} companies checked`, "var(--accent-2)"],
      ["Strong matches", strongN, "80% match or higher", "var(--good)"],
      ["Strong sponsors", sponsor, "visa odds 70% or higher", "var(--visa)"],
      ["In progress", applied, "applications on the pipeline", "var(--warn)"],
    ].map(([l, n, sm, c], i) => i === 0
      ? `<button type="button" class="kpi" id="kpiNew" style="--k:${c}" aria-pressed="${onlyNew}" title="Show only new roles"><span>${l}</span><b>${n}</b><small>${onlyNew ? "showing new only · click to show all" : "click to show only these"}</small></button>`
      : `<div class="kpi" style="--k:${c}"><span>${l}</span><b>${n}</b><small>${sm}</small></div>`).join("");
  }
  function row(j) {
    return `<button type="button" class="row" data-id="${esc(j.id)}" aria-selected="${j.id === selected}">
      ${ring(j.match)}
      <div><div class="t">${esc(j.title)}</div><div class="c">${esc(j.company)} · ${esc(j.location || j.region)}</div>
        <div class="tags">${isNew(j) ? '<span class="tag new">New</span>' : ""}<span class="tag">${KIND[j.kind] || esc(j.kind)}</span><span class="tag">${esc(j.region)}</span>${(j.missing || []).filter(Boolean).length ? `<span class="tag warn">${j.missing.filter(Boolean).length} gap${j.missing.filter(Boolean).length > 1 ? "s" : ""}</span>` : ""}</div></div>
      <div class="side-r"><span class="tag visa">Visa ${visaTxt(j.visa)}</span><span class="age">${ago(j.first_seen)}</span></div>
    </button>`;
  }
  function renderDetail(j) {
    const d = $("jobDetail");
    if (!j) { d.innerHTML = `<div class="empty" style="border:0">Select a role to see the details.</div>`; return; }
    const miss = (j.missing || []).filter(Boolean), v = j.visa;
    d.innerHTML = `<div class="d-head">
        <div><h2>${esc(j.title)}</h2><div class="c">${esc(j.company)} · ${esc(j.location || "")}</div>
          <div class="tags">${isNew(j) ? '<span class="tag new">New</span>' : ""}<span class="tag">${KIND[j.kind] || esc(j.kind)}</span><span class="tag">${esc(j.region)}</span></div></div>
        <div style="display:grid;justify-items:end;gap:8px">${ring(j.match, true)}<button type="button" class="btn ghost sm d-close" data-act="close">Close</button></div>
      </div>
      <div class="d-actions">
        <a class="btn primary wide" href="${esc(j.url)}" target="_blank" rel="noopener">Open posting ↗</a>
        <button type="button" class="btn" data-act="studio">Tailor &amp; preview</button>
        <button type="button" class="btn" data-act="cv">Quick CV</button>
        <button type="button" class="btn" data-act="letter">Cover letter</button>
        <button type="button" class="btn" data-act="add" title="Moves this role to Applied, dated today">Mark as applied</button>
        <button type="button" class="btn ghost" data-act="hide">Hide role</button>
      </div>
      <div class="d-body">
        ${j.flag ? `<div class="flag">${esc(j.flag)}</div>` : ""}
        <div class="d-sec"><h3>Skills you have</h3><div class="skills">${(j.matched || []).map(x => `<span class="sk">${esc(x)}</span>`).join("") || '<span class="m">None detected</span>'}</div></div>
        ${miss.length ? `<div class="d-sec"><h3>Gaps</h3><div class="skills">${miss.map(x => `<span class="sk miss">${esc(x)}</span>`).join("")}</div></div>` : ""}
        ${j.note ? `<div class="d-sec"><h3>Recruiter note</h3><p>${esc(j.note)}</p></div>` : ""}
        <div class="d-sec"><h3>Visa from India</h3>
          <div class="visa-row"><span class="m">${v < 0 ? "Not needed or not applicable" : "Estimated sponsorship odds"}</span><b>${visaTxt(v)}</b></div>
          ${v >= 0 ? `<div class="meter"><i style="width:${v}%"></i></div>` : ""}<p class="m">${esc(j.visa_basis || "")}</p></div>
        <div class="d-sec"><h3>Posting</h3><dl class="facts"><dt>Source</dt><dd>${esc(j.source || "")}</dd>${j.posted ? `<dt>Posted</dt><dd>${esc(j.posted)}</dd>` : ""}<dt>First seen</dt><dd>${esc(j.first_seen || "")}</dd></dl></div>
      </div>
`;
  }
  $("feedGrid").addEventListener("click", e => {
    const r = e.target.closest(".row"); if (!r) return;
    selected = r.dataset.id;
    document.querySelectorAll("#feedGrid .row").forEach(x => x.setAttribute("aria-selected", String(x === r)));
    renderDetail(DATA.jobs.find(j => j.id === selected)); $("jobDetail").classList.add("open"); $("jobDetail").scrollTop = 0;
  });
  $("jobDetail").addEventListener("click", async e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const j = DATA.jobs.find(x => x.id === selected);
    if (b.dataset.act === "close") { $("jobDetail").classList.remove("open"); return; }
    if (!j) return;
    if (b.dataset.act === "add") { addToBoard(j, "Applied"); $("jobDetail").classList.remove("open"); toast("Added to Applied, dated today"); }
    if (b.dataset.act === "hide") { S.hidden[j.id] = today(); save(); $("jobDetail").classList.remove("open"); renderFeed(); toast("Hidden. Use \"Unhide all\" to bring it back."); }
    if (b.dataset.act === "cv") await makeCV(j);
    if (b.dataset.act === "letter") await makeLetter(j);
    if (b.dataset.act === "studio") openStudio(j);
  });
  $("kpis").addEventListener("click", e => { if (e.target.closest("#kpiNew")) { $("f-new").checked = !$("f-new").checked; renderFeed(); } });
  $("kindSeg").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("kindSeg").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    $("f-kind").value = b.dataset.v; renderFeed();
  });
  ["q", "f-reg", "f-match", "f-visa", "f-new"].forEach(id => $(id).addEventListener("input", renderFeed));
  $("unhide").addEventListener("click", () => { const n = Object.keys(S.hidden).length; S.hidden = {}; save(); renderFeed(); toast(n ? `${n} hidden roles back in the list` : "Nothing was hidden"); });
  $("f-strong").addEventListener("click", () => { strong = !strong; $("f-strong").setAttribute("aria-pressed", String(strong)); renderFeed(); });

  async function makeCV(j) {
    if (!PROFILE) { toast("CV profile not loaded"); return; }
    try {
      toast("Building your CV…");
      const t = (S.tailor || {})[j.id];
      if (t && t.summary) {
        const [p, jj] = CV.applyTailor(PROFILE, j, t); jj.template = t.template || j.template;
        const r = await CV.build(p, jj);
        CV.downloadDef(r.def, j.company); toast("CV ready, with your saved edits for this role."); return;
      }
      const r = await CV.download(PROFILE, j);
      toast(`CV ready: subtitle "${r.second}", ${r.summary} summary. Read it once before sending.`);
    } catch (err) { toast("Could not build the PDF: " + err.message); }
  }

  function openStudio(j) {
    if (!PROFILE) { toast("CV profile not loaded"); return; }
    S.tailor = S.tailor || {};
    const store = { get: () => S.tailor[j.id], set: v => { if (v) S.tailor[j.id] = v; else delete S.tailor[j.id]; save(); } };
    // builds started from a pasted JD keep their latest scores for the "Recent builds" list
    if (S.jd && S.jd[j.id]) store.scores = sc => { if (S.jd[j.id]) { S.jd[j.id].scores = sc; S.jd[j.id].job.template = sc.template; save(); renderJdRecent(); } };
    return Studio.open(j, PROFILE, store, makeLetter).catch(err => toast("Could not open the editor: " + err.message));
  }
  Studio.init();

  // ------------------------------------------------- resume from a JD ---
  // Paste a posting; the role type, second title and the content order come from the posting.
  const AI_T = /\b(llms?|large language model|rag|retrieval[- ]augmented|langchain|langgraph|openai|hugging ?face|fine[- ]?tun\w*|prompt engineering|gen ?ai|generative|ai agents?|agentic|multi-agent|vector (db|database|store)|embeddings?)\b/gi;
  const OPS_T = /\b(ml ?ops|llm ?ops|mlflow|kubeflow|sagemaker|vertex ai|model (deployment|serving|registry|monitoring)|feature store|airflow|kserve|seldon|bentoml|ml pipelines?)\b/gi;
  function detectKind(title, jd) {
    const k = Match.kind(title), ai = new Set((jd.match(AI_T) || []).map(x => x.toLowerCase())).size, ops = new Set((jd.match(OPS_T) || []).map(x => x.toLowerCase())).size;
    if (k !== "Backend") return k;
    if (ops >= 3 && ops >= ai) return "MLOps";
    if (ai >= 3) return "AI";
    return "Backend";
  }
  const REGION_RX = [
    ["India", /\b(india|pune|mumbai|bengaluru|bangalore|hyderabad|chennai|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|kochi|nagpur)\b/i],
    ["UK", /\b(uk|united kingdom|england|scotland|wales|london|manchester|edinburgh|bristol|cambridge|oxford|southampton|leeds|birmingham|glasgow|belfast|reading)\b/i],
    ["Sweden", /\b(sweden|stockholm|gothenburg|g[oö]teborg|malm[oö]|uppsala|lund)\b/i],
    ["US", /\b(usa|united states|new york|nyc|san francisco|seattle|austin|boston|chicago|los angeles|remote,? us|california|texas)\b/i],
    ["New Zealand", /\b(new zealand|auckland|wellington|christchurch)\b/i],
    ["Turkey", /\b(turkey|t[uü]rkiye|istanbul|ankara|izmir)\b/i],
    ["Europe", /\b(germany|berlin|munich|hamburg|netherlands|amsterdam|rotterdam|ireland|dublin|france|paris|spain|madrid|barcelona|portugal|lisbon|poland|warsaw|krakow|lithuania|vilnius|luxembourg|belgium|brussels|denmark|copenhagen|finland|helsinki|norway|oslo|austria|vienna|switzerland|zurich|italy|milan|czech|prague|estonia|tallinn|europe|emea)\b/i],
  ];
  const regionOf = loc => (REGION_RX.find(([, rx]) => rx.test(loc || "")) || [""])[0];
  const cleanJdTitle = t => String(t || "").replace(/\s*[-–—|(].*$/, "").replace(/\b(senior|sr\.?|junior|jr\.?|mid[- ]?level|lead|principal|staff|i{1,3}|iv|[1-3])\b/gi, "").replace(/\s+/g, " ").trim();
  function ownTitles() { try { return JSON.parse(localStorage.getItem("jobocto.titles") || "[]"); } catch (e) { return []; } }
  let jdKind = "", jdTpl = "octo";
  function jdJob() {
    const title = $("jd-title").value.trim(), company = $("jd-company").value.trim() || "Company", jd = $("jd-text").value.trim();
    const loc = $("jd-loc").value.trim(), region = $("jd-reg").value;
    const sc = Match.score(title, jd), kind = jdKind || detectKind(title, jd);
    const want = cleanJdTitle(title).toLowerCase();
    const second = [...ownTitles(), ...CV.SECOND_TITLES].find(x => x.toLowerCase() === want);
    let h = 0; for (const ch of title + "|" + company + "|" + jd.slice(0, 400)) h = (h * 31 + ch.charCodeAt(0)) | 0;
    return { id: "jd-" + (h >>> 0).toString(36), title, company, location: loc, region, kind, description: jd, url: "", source: "Pasted job description",
      match: sc.match, matched: sc.matched, missing: sc.missing, flag: sc.flag, visa: null, template: jdTpl, second_title: second };
  }
  function renderTplPicker() {
    const reg = $("jd-reg").value, rec = reg === "US" ? "jake" : "octo";
    $("jd-tpls").innerHTML = Object.entries(CV.TEMPLATES).map(([k, T]) => `<button type="button" class="tpl" data-tpl="${k}" aria-pressed="${k === jdTpl}" title="${esc(T.desc)}">
      <span class="tpl-thumb t-${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="tpl-name">${esc(T.name)}</span><span class="tpl-meta">${T.regions.map(r => `<em>${r}</em>`).join("")}${k === rec ? '<em class="rec">Best fit</em>' : ""}</span></button>`).join("");
    const T = CV.TEMPLATES[jdTpl];
    $("jd-tpl-desc").textContent = `${T.name} · ${T.pages === 1 ? "one page" : "up to two pages"}. ${T.desc}`;
    $("jd-guide").innerHTML = Object.entries(CV.TEMPLATES).map(([k, T]) => `<li><b>${esc(T.name)}</b> <span class="tag">${esc(T.badge)}</span><br><span class="m">${T.regions.join(", ")} · ${T.pages === 1 ? "1 page" : "up to 2 pages"}. ${esc(T.desc)}</span></li>`).join("");
  }
  let liveT = null;
  function renderJdLive() {
    const title = $("jd-title").value.trim(), jd = $("jd-text").value.trim();
    if (!jd) { $("jd-live").innerHTML = ""; return; }
    const sc = Match.score(title, jd), kind = jdKind || detectKind(title, jd), found = Match.found(title + " " + jd);
    const yrs = Math.max(0, ...[...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?\+?\s*(?:years|yrs)/gi)].map(m => +m[1]).filter(n => n <= 15));
    $("jd-live").innerHTML = `<div class="live-top"><span class="ring ${sc.match >= 75 ? "m-hi" : sc.match >= 60 ? "m-mid" : "m-lo"}" style="--p:${sc.match}"><b>${sc.match}%</b></span>
      <div><b>Quick read</b><span class="m">${KIND[kind]} · ${found.length} skills named · ${found.filter(k => !Match.has(k)).length} not on your CV${yrs ? ` · asks ${yrs}+ years` : ""}${sc.flag ? " · " + esc(sc.flag) : ""}</span></div></div>
      <div class="skills">${found.filter(k => Match.has(k)).map(k => `<span class="sk">${esc(k)}</span>`).join("")}${found.filter(k => !Match.has(k)).map(k => `<span class="sk miss" title="Not on your CV">${esc(k)}</span>`).join("")}</div>`;
  }
  function renderJdRecent() {
    const items = Object.values(S.jd || {}).sort((a, b) => (b.created || "").localeCompare(a.created || ""));
    $("jd-recent").innerHTML = items.length ? items.map(it => {
      const sc = it.scores || {}, j = it.job, T = CV.TEMPLATES[j.template] || CV.TEMPLATES.octo;
      const pill = (l, n) => n == null ? "" : `<span class="mini ${n >= 80 ? "hi" : n >= 60 ? "mid" : "lo"}"><b>${n}</b>${l}</span>`;
      return `<article class="jd-item" data-id="${esc(j.id)}">
        <div class="jd-item-top"><div><b>${esc(j.title)}</b><span class="m">${esc(j.company)}${j.location ? " · " + esc(j.location) : ""} · ${esc(T.name)}</span></div><span class="age">${esc(it.created || "")}</span></div>
        <div class="minis">${pill("ATS", sc.ats)}${pill("JD match", sc.match)}${pill("Ready", sc.ready)}${sc.gaps != null ? `<span class="mini gap"><b>${sc.gaps}</b>gaps</span>` : ""}</div>
        <div class="jd-item-acts"><button type="button" class="btn sm primary" data-jd="open">Open editor</button><button type="button" class="btn sm" data-jd="letter">Cover letter</button><button type="button" class="btn sm" data-jd="apply"${S.board[j.id] ? " disabled" : ""}>${S.board[j.id] ? "In pipeline" : "Add to Applied"}</button><button type="button" class="btn sm ghost" data-jd="del" aria-label="Delete this build">Delete</button></div>
      </article>`;
    }).join("") : `<div class="empty sm">Your builds appear here with their scores, so you can reopen, apply or write the cover letter later.</div>`;
  }
  $("jd-kind").addEventListener("click", e => {
    const b = e.target.closest("button"); if (!b) return;
    $("jd-kind").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b))); jdKind = b.dataset.v; renderJdLive();
  });
  $("jd-tpls").addEventListener("click", e => { const b = e.target.closest("[data-tpl]"); if (!b) return; jdTpl = b.dataset.tpl; renderTplPicker(); });
  ["jd-title", "jd-text"].forEach(id => $(id).addEventListener("input", () => { clearTimeout(liveT); liveT = setTimeout(renderJdLive, 250); }));
  $("jd-loc").addEventListener("input", () => { const r = regionOf($("jd-loc").value); if (r) { $("jd-reg").value = r; renderTplPicker(); } });
  $("jd-reg").addEventListener("change", renderTplPicker);
  $("jd-clear").addEventListener("click", () => { $("jdForm").reset(); jdKind = ""; $("jd-kind").querySelectorAll("button").forEach((x, i) => x.setAttribute("aria-pressed", String(i === 0))); $("jd-live").innerHTML = ""; $("jd-msg").textContent = ""; renderTplPicker(); });
  $("jdForm").addEventListener("submit", async e => {
    e.preventDefault();
    await Match.load();
    if (!$("jd-title").value.trim()) { $("jd-msg").textContent = "Add the job title from the posting."; $("jd-title").focus(); return; }
    if ($("jd-text").value.trim().length < 80) { $("jd-msg").textContent = "Paste the job description (at least a few lines) so the scores mean something."; $("jd-text").focus(); return; }
    $("jd-msg").textContent = "";
    const j = jdJob();
    S.jd = S.jd || {}; S.tailor = S.tailor || {};
    if (S.tailor[j.id] && S.tailor[j.id].template !== jdTpl) S.tailor[j.id].template = jdTpl;
    S.jd[j.id] = Object.assign({ created: today() }, S.jd[j.id] || {}, { job: j });
    // the editor scores against the pasted text
    S.tailor[j.id] = Object.assign(S.tailor[j.id] || {}, { jd: j.description });
    save(); renderJdRecent();
    const btn = $("jd-build"); btn.disabled = true; btn.textContent = "Building…";
    try { await openStudio(j); } finally { btn.disabled = false; btn.textContent = "Build my best resume"; }
  });
  $("jd-recent").addEventListener("click", e => {
    const b = e.target.closest("button[data-jd]"); if (!b) return;
    const id = b.closest(".jd-item").dataset.id, it = (S.jd || {})[id]; if (!it) return;
    const act = b.dataset.jd;
    if (act === "open") openStudio(it.job);
    if (act === "letter") makeLetter(it.job);
    if (act === "apply") { addToBoard(it.job, "Applied"); renderJdRecent(); toast("Added to Applied, dated today"); }
    if (act === "del") {
      if (b.dataset.confirm !== "1") { b.dataset.confirm = "1"; b.textContent = "Sure?"; return; }
      delete S.jd[id]; if (S.tailor) delete S.tailor[id]; save(); renderJdRecent(); toast("Build deleted");
    }
  });

  async function makeLetter(j) {
    if (!PROFILE) { toast("CV profile not loaded"); return; }
    try {
      toast("Building your cover letter…");
      const r = await CV.downloadLetter(PROFILE, j);
      toast(`Cover letter ready (${r.words} words). Read it and add anything specific to the company before sending.`);
    } catch (err) { toast("Could not build the PDF: " + err.message); }
  }

  // ------------------------------------------------------------ board ---
  function addToBoard(j, stage) {
    S.board[j.id] = { stage, added: today(), moved: today(), applied: stage === "Applied" ? today() : "", follow: "", next: "", notes: "", job: j };
    save(); renderFeed(); renderBoard();
  }
  function renderBoard() {
    const items = Object.entries(S.board);
    $("b-board").textContent = items.length || "";
    const by = Object.fromEntries(STAGES.map(([s]) => [s, []]));
    items.forEach(([id, it]) => (by[it.stage] || by.Applied).push([id, it]));
    const live = new Set(DATA.jobs.filter(j => !j.closed).map(j => j.id));
    $("board").innerHTML = STAGES.map(([s, color]) => `
      <section class="col" data-stage="${s}" aria-label="${s}">
        <h3><i style="background:${color}"></i>${s}<span>${by[s].length}</span></h3>
        ${by[s].sort((a, b) => (b[1].moved || "").localeCompare(a[1].moved || "")).map(([id, it]) => {
          // show today's visa odds and match when the role is still in the feed
          const fresh = DATA.jobs.find(x => x.id === id);
          const j = fresh ? Object.assign({}, it.job, { visa: fresh.visa, visa_basis: fresh.visa_basis, match: fresh.match }) : it.job, due = it.follow && it.follow <= today() && s !== "Rejected";
          const closed = DATA.jobs.length && j.url && !live.has(id) && !String(id).startsWith("manual-");
          return `<button type="button" class="bcard" draggable="true" data-id="${esc(id)}">
            ${j.match != null ? `<span class="mm ${matchCls(j.match)}">${j.match}%</span>` : ""}
            <span class="t">${esc(j.title)}</span><span class="c">${esc(j.company)} · ${esc(j.location || j.region || "")}</span>
            <span class="c">Visa ${visaTxt(j.visa ?? -1)}${closed ? " · posting closed" : ""}</span>
            <span class="nx">${it.next ? esc(it.next) + " · " : ""}${it.follow ? `<span class="${due ? "due" : ""}">follow up ${esc(it.follow)}</span>` : it.applied ? "applied " + esc(it.applied) : "added " + esc(it.added)}</span>
          </button>`;
        }).join("")}
      </section>`).join("");
    const count = s => (by[s] || []).length, active = items.length - count("Rejected");
    const dueN = items.filter(([, it]) => it.follow && it.follow <= today() && it.stage !== "Rejected").length;
    $("boardStats").innerHTML = [["Active applications", active], ["Technical tests", count("Technical test")], ["In consideration", count("In consideration")], ["Follow-ups due", dueN], ["Rejected", count("Rejected")]]
      .map(([l, n], i) => `<div class="kpi" style="--k:${["var(--accent)", "var(--warn)", "#C084FC", "var(--good)", "var(--bad)"][i]}"><span>${l}</span><b>${n}</b></div>`).join("");
  }
  // drag and drop
  $("board").addEventListener("dragstart", e => { const c = e.target.closest(".bcard"); if (c) e.dataTransfer.setData("text/plain", c.dataset.id); });
  // while dragging a card, moving near the left or right edge scrolls the stages sideways
  document.querySelector(".board-scroll").addEventListener("dragover", e => {
    const box = e.currentTarget, r = box.getBoundingClientRect(), edge = 80;
    if (e.clientX > r.right - edge) box.scrollLeft += 18; else if (e.clientX < r.left + edge) box.scrollLeft -= 18;
  });
  $("board").addEventListener("dragover", e => { const col = e.target.closest(".col"); if (col) { e.preventDefault(); col.classList.add("drop"); } });
  $("board").addEventListener("dragleave", e => { const col = e.target.closest(".col"); if (col) col.classList.remove("drop"); });
  $("board").addEventListener("drop", e => {
    const col = e.target.closest(".col"); if (!col) return; e.preventDefault(); col.classList.remove("drop");
    const id = e.dataTransfer.getData("text/plain"), it = S.board[id]; if (!it) return;
    move(it, col.dataset.stage); save(); renderBoard(); toast(`Moved to ${col.dataset.stage}`);
  });
  function move(it, stage) { if (it.stage !== stage) { it.stage = stage; it.moved = today(); if (stage === "Applied" && !it.applied) it.applied = today(); } }
  $("board").addEventListener("click", e => { const c = e.target.closest(".bcard"); if (c) openCard(c.dataset.id); });

  // card dialog
  $("d-stage").innerHTML = STAGES.map(([s]) => `<option>${s}</option>`).join("");
  function openCard(id) {
    const it = S.board[id]; if (!it) return; editing = id;
    $("cardDlgTitle").textContent = it.job.title;
    $("cardDlgSub").textContent = `${it.job.company} · ${it.job.location || it.job.region || ""} · match ${it.job.match ?? "?"}% · visa ${visaTxt(it.job.visa ?? -1)}`;
    $("d-stage").value = it.stage; $("d-applied").value = it.applied || ""; $("d-follow").value = it.follow || "";
    $("d-next").value = it.next || ""; $("d-notes").value = it.notes || "";
    const a = $("d-open"); if (it.job.url) { a.href = it.job.url; a.hidden = false; } else a.hidden = true;
    $("cardDlg").showModal();
  }
  $("cardForm").addEventListener("submit", e => {
    if (e.submitter && e.submitter.value === "save" && editing) {
      const it = S.board[editing];
      move(it, $("d-stage").value);
      it.applied = $("d-applied").value; it.follow = $("d-follow").value; it.next = $("d-next").value.trim(); it.notes = $("d-notes").value;
      save(); renderBoard(); toast("Saved");
    }
  });
  $("d-cv").addEventListener("click", () => { if (editing) makeCV(S.board[editing].job); });
  $("d-studio").addEventListener("click", () => { if (editing) { const j = S.board[editing].job; $("cardDlg").close(); openStudio(j); } });
  $("d-letter").addEventListener("click", () => { if (editing) makeLetter(S.board[editing].job); });
  $("d-remove").addEventListener("click", () => {
    if (!editing) return;
    const btn = $("d-remove");
    if (btn.dataset.confirm !== "1") { btn.dataset.confirm = "1"; btn.textContent = "Click again to remove"; return; }
    delete S.board[editing]; btn.dataset.confirm = ""; btn.textContent = "Remove";
    save(); $("cardDlg").close(); renderBoard(); renderFeed(); toast("Removed from board");
  });
  $("cardDlg").addEventListener("close", () => { const b = $("d-remove"); b.dataset.confirm = ""; b.textContent = "Remove"; });

  // manual add
  $("addRoleBtn").addEventListener("click", () => { $("addForm").reset(); $("addDlg").showModal(); });
  $("addForm").addEventListener("submit", async e => {
    if (!e.submitter || e.submitter.value !== "add") return;
    await Match.load();
    const title = $("a-title").value.trim(), jd = $("a-jd").value;
    const sc = jd.trim() ? Match.score(title, jd) : { match: null, matched: [], missing: [], flag: "" };
    const j = { id: "manual-" + Date.now(), title, company: $("a-company").value.trim(), url: $("a-url").value.trim(), location: $("a-loc").value.trim(),
      region: $("a-reg").value, kind: Match.kind(title), match: sc.match, matched: sc.matched, missing: sc.missing, flag: sc.flag, visa: null, source: "Added by you" };
    addToBoard(j, "Applied"); show("board"); toast("Added to Applied, dated today");
  });

  // -------------------------------------------------------- companies ---
  function renderCompanies() {
    const q = $("cq").value.toLowerCase();
    const list = COMPANIES.filter(c => !q || [c.name, c.region, c.note, c.ats].join(" ").toLowerCase().includes(q));
    const mapped = COMPANIES.filter(c => c.token || c.custom_page).length;
    $("b-co").textContent = COMPANIES.length || "";
    $("coCount").textContent = `${list.length} shown · ${mapped} of ${COMPANIES.length} have a readable job board`;
    const sp = { explicit: "Says it sponsors", known: "Known sponsor", "employer-led": "Employer-led permit", verify: "Check licence", none: "No history" };
    $("coBody").innerHTML = list.map(c => `<tr>
      <td><b>${c.careers ? `<a href="${esc(c.careers)}" target="_blank" rel="noopener">${esc(c.name)}</a>` : esc(c.name)}</b><br><span class="mono">${esc(c.source || "")}</span></td>
      <td>${esc(c.region || "")}</td>
      <td>${c.token ? `<span class="ok">Board found</span> · ${esc(c.ats)}` : c.custom_page ? `<span class="pend">Own careers site</span>` : `<span class="pend">Being mapped</span>`}</td>
      <td>${esc(sp[c.sponsor] || c.sponsor || "")}</td>
      <td>${esc(c.note || "")}</td></tr>`).join("");
  }
  $("cq").addEventListener("input", renderCompanies);

  // ------------------------------------------------------- discovered ---
  function repoInfo() {
    const host = location.hostname, seg = location.pathname.split("/").filter(Boolean)[0];
    if (host.endsWith(".github.io")) return { owner: host.split(".")[0], repo: seg || host };
    return null;
  }
  function renderDisc() {
    const items = (DISC.items || []).filter(d => d.status !== "approved" && !S.skipped[d.name]);
    $("b-disc").textContent = items.length || "";
    $("discGrid").innerHTML = items.length ? items.map(d => `<article class="card" data-name="${esc(d.name)}">
      <div class="chips"><span class="tag new">${esc(d.licence || "Sponsor")}</span><span class="tag">${esc(d.town || "")}</span></div>
      <h2>${esc(d.name)}</h2>
      <div class="co">Job board: ${esc(d.ats)} · found ${esc(d.found)}</div>
      <div class="roles">${(d.roles || []).map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a> <span class="co">${esc(r.location || "")}</span>`).join("<br>")}</div>
      <div class="actions"><button type="button" class="btn sm primary" data-act="track">Track company</button><button type="button" class="btn sm ghost" data-act="skip">Skip</button></div>
    </article>`).join("") : `<div class="empty">Nothing new yet. The weekly check runs on Monday mornings.</div>`;
  }
  $("discGrid").addEventListener("click", e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const name = b.closest(".card").dataset.name, d = DISC.items.find(x => x.name === name); if (!d) return;
    if (b.dataset.act === "skip") { S.skipped[name] = today(); save(); renderDisc(); return; }
    const r = repoInfo();
    if (!r) { toast("Open this from your GitHub Pages address to approve companies."); return; }
    // the request is encrypted with your passcode, so the public issue shows nothing readable
    Vault.seal({ name: d.name, town: d.town, ats: d.ats, token: d.token, licence: d.licence, region: "UK" }, PASS).then(box => {
      const body = "Private request from Job Octo. Submit it as it is.\n\n```json\n" + JSON.stringify(box) + "\n```";
      const url = `https://github.com/${r.owner}/${r.repo}/issues/new?title=${encodeURIComponent("Track company")}&body=${encodeURIComponent(body)}`;
      window.open(url, "_blank", "noopener");
      toast("Submit the GitHub issue that opened; the company is added within a minute.");
    });
  });

  // --------------------------------------------------- backup / import ---
  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(S, null, 1)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `job-hunt-hq-backup-${today()}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $("importFile").addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try { const d = JSON.parse(await f.text()); if (!d.board) throw new Error("not a Job Hunt HQ backup"); S = Object.assign(load(), d); save(); renderAll(); toast("Backup restored"); }
    catch (err) { toast("Import failed: " + err.message); }
    e.target.value = "";
  });

  function renderAll() { renderFeed(); renderBoard(); renderCompanies(); renderDisc(); }

  // ------------------------------------------------------- my details ---
  function applyProfile() { PROFILE = S.profileOverride ? Object.assign({}, BASE_PROFILE, S.profileOverride) : BASE_PROFILE; }
  function fillDetails() { $("profileText").value = JSON.stringify(PROFILE, null, 2); }
  $("profileSave").addEventListener("click", () => {
    try { const d = JSON.parse($("profileText").value); S.profileOverride = d; save(); applyProfile(); toast("Saved on this device. Export a backup to keep it."); }
    catch (err) { toast("Not saved: the text is not valid JSON (" + err.message + ")"); }
  });
  $("profileReset").addEventListener("click", () => { delete S.profileOverride; save(); applyProfile(); fillDetails(); toast("Back to the CV details stored in your vault"); });

  // ------------------------------------------------------------ theme ---
  // Follows the system until the toggle is used; the choice is remembered on this device.
  function currentTheme() { return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"); }
  document.querySelectorAll("[data-theme-toggle]").forEach(b => b.addEventListener("click", () => {
    const next = currentTheme() === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("jobocto.theme", next); } catch (e) {}
    toast(next === "light" ? "Light mode" : "Dark mode");
  }));

  // ------------------------------------------------------------- lock ---
  const PASS_KEY = "jobhunthq.pass";
  function remembered() { try { return localStorage.getItem(PASS_KEY) || ""; } catch (e) { return ""; } }
  async function unlock(pass, remember) {
    const box = await getJSON("data/vault.json", null);
    if (!box) { $("lockMsg").textContent = "No data found yet. Finish the setup steps in the README."; return false; }
    let bundle;
    try { bundle = await Vault.open(box, pass); } catch (e) { $("lockMsg").textContent = "That passcode does not open this board."; return false; }
    try { remember ? localStorage.setItem(PASS_KEY, pass) : localStorage.removeItem(PASS_KEY); } catch (e) { /* private mode */ }
    PASS = pass;
    DATA = bundle["jobs.json"] || { jobs: [] };
    // target countries only (older data may still hold roles from elsewhere, e.g. Pakistan)
    const OK = new Set(["UK", "Europe", "Sweden", "Turkey", "New Zealand", "US", "Remote from India"]);
    const OFF = /\b(pakistan|karachi|lahore|islamabad|dubai|uae|saudi|riyadh|qatar|doha|egypt|cairo|bangalore|bengaluru|hyderabad|mumbai|gurgaon|noida|singapore|manila|jakarta)\b/i;
    DATA.jobs = (DATA.jobs || []).filter(j => OK.has(j.region) && !(OFF.test(j.location || "") && !/london|uk|europe|amsterdam|berlin|dublin|stockholm/i.test(j.location || ""))); COMPANIES = (bundle["companies.json"] || {}).companies || [];
    DISC = bundle["discovered.json"] || { items: [] }; BASE_PROFILE = bundle["profile.json"] || null; applyProfile();
    document.body.classList.remove("locked"); $("lock").hidden = true;
    const when = DATA.generated_at ? new Date(DATA.generated_at) : null;
    $("refresh").parentElement.classList.toggle("stale", !!DATA.seeded_by_hand || !when || (Date.now() - when) > 36 * 3600e3);
    $("refresh").textContent = DATA.seeded_by_hand ? "Starter list. Waiting for the first daily run."
      : when ? `Updated ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${DATA.companies_checked ?? "?"} boards checked` : "Waiting for the first daily run";
    renderAll(); fillDetails();
    renderTplPicker(); renderJdRecent();
    show(["jd", "feed", "board", "companies", "discovered", "rules", "details"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "feed");
    S.lastVisit = today(); save();
    Match.load();
    return true;
  }
  $("lockForm").addEventListener("submit", async e => {
    e.preventDefault(); $("lockMsg").textContent = "Opening…";
    await unlock($("lockPass").value, $("lockRemember").checked);
  });
  $("lockBtn").addEventListener("click", () => { try { localStorage.removeItem(PASS_KEY); } catch (e) {} location.reload(); });

  // ------------------------------------------------------------- boot ---
  (async function boot() {
    const pass = remembered();
    if (!pass || !(await unlock(pass, true))) { $("lock").hidden = false; $("lockPass").focus(); }
  })();
})();
