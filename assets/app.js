/* Job Hunt HQ · page logic. Job data comes from data/*.json (updated by the
   GitHub Actions); your board, hidden roles and notes live in this browser's
   localStorage under one key, with Export / Import for backups. */
(function () {
  const STAGES = [
    ["Shortlisted", "#8aa0a6"], ["Applied", "#1f6f78"], ["In consideration", "#2f7fc1"], ["Technical test", "#c27a00"],
    ["HR round", "#7a5cc7"], ["Salary discussion", "#b4527a"], ["Accepted", "#1d7a46"], ["Rejected", "#a43a32"],
  ];
  const KIND = { MLOps: "MLOps / platform", Backend: "Backend / Python", AI: "AI / ML engineer" };
  const KEY = "jobhunthq.v1";
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const today = () => new Date().toISOString().slice(0, 10);

  let DATA = { jobs: [] }, COMPANIES = [], DISC = { items: [] }, PROFILE = null, BASE_PROFILE = null, PASS = "";
  let S = load();
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
    document.querySelectorAll(".tab").forEach(b => b.dataset.tab === tab ? b.setAttribute("aria-current", "page") : b.removeAttribute("aria-current"));
    document.querySelectorAll(".panel").forEach(p => p.hidden = p.id !== "tab-" + tab);
    if (location.hash.slice(1) !== tab) history.replaceState(null, "", "#" + tab);
  }
  document.querySelectorAll(".tab").forEach(b => b.addEventListener("click", () => show(b.dataset.tab)));

  // ------------------------------------------------------------- feed ---
  const matchCls = m => m >= 75 ? "m-hi" : m >= 60 ? "m-mid" : "m-lo";
  const visaTxt = v => v < 0 ? "N/A" : v + "%";
  const isNew = j => (j.first_seen || "") > prevVisit || j.first_seen === today();

  function renderFeed() {
    const q = $("q").value.toLowerCase(), k = $("f-kind").value, rg = $("f-reg").value;
    const mm = +$("f-match").value, mv = strong ? 70 : +$("f-visa").value, onlyNew = $("f-new").checked;
    const list = DATA.jobs.filter(j => !j.closed && !S.hidden[j.id] && !S.board[j.id])
      .filter(j => (!k || j.kind === k) && (!rg || j.region === rg) && j.match >= mm && (mv < 0 || j.visa < 0 || j.visa >= mv) && (!onlyNew || isNew(j)))
      .filter(j => !q || [j.title, j.company, j.location, (j.matched || []).join(" "), (j.missing || []).join(" ")].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (isNew(b) - isNew(a)) || b.match - a.match || b.visa - a.visa);
    $("feedGrid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty">No roles match these filters. Try a lower minimum match or visa odds.</div>`;
    const total = DATA.jobs.filter(j => !j.closed && !S.hidden[j.id] && !S.board[j.id]).length;
    $("feedCount").textContent = `${list.length} of ${total} open roles`;
    const n = DATA.jobs.filter(j => !j.closed && isNew(j) && !S.hidden[j.id] && !S.board[j.id]).length;
    $("b-feed").textContent = n ? n + " new" : "";
  }
  function card(j) {
    return `<article class="card" data-id="${esc(j.id)}">
      <div class="match ${matchCls(j.match)}" aria-label="Skills match ${j.match} percent">${j.match}%<small>match</small></div>
      <div class="chips">${isNew(j) ? '<span class="chip new">New</span>' : ""}<span class="chip">${KIND[j.kind] || j.kind}</span><span class="chip reg">${esc(j.region)}</span></div>
      <h2><a href="${esc(j.url)}" target="_blank" rel="noopener">${esc(j.title)}</a></h2>
      <div class="co">${esc(j.company)} · ${esc(j.location)}</div>
      <div class="skills">${(j.matched || []).length ? `<span class="have">✓ ${esc(j.matched.join(", "))}</span>` : ""}${(j.missing || []).filter(Boolean).length ? `<span class="miss">✗ ${esc(j.missing.join(", "))}</span>` : ""}</div>
      ${j.note ? `<div class="note">${esc(j.note)}</div>` : ""}
      ${j.flag ? `<div class="flag">${esc(j.flag)}</div>` : ""}
      <div class="note"><span class="chip visa">Visa ${visaTxt(j.visa)}</span> ${esc(j.visa_basis || "")}</div>
      <div class="note mono">${esc(j.source || "")}${j.posted ? " · posted " + esc(j.posted) : ""} · seen ${esc(j.first_seen || "")}</div>
      <div class="actions">
        <a class="btn small" href="${esc(j.url)}" target="_blank" rel="noopener">Open posting ↗</a>
        <button type="button" class="btn small primary" data-act="add">Add to board</button>
        <button type="button" class="btn small" data-act="cv">Download tailored CV</button>
        <button type="button" class="btn small" data-act="hide" aria-label="Hide this role">Hide</button>
      </div></article>`;
  }
  $("feedGrid").addEventListener("click", async e => {
    const b = e.target.closest("button[data-act]"); if (!b) return;
    const id = b.closest(".card").dataset.id, j = DATA.jobs.find(x => x.id === id); if (!j) return;
    if (b.dataset.act === "add") { addToBoard(j, "Shortlisted"); toast("Added to Shortlisted"); }
    if (b.dataset.act === "hide") { S.hidden[id] = today(); save(); renderFeed(); toast("Hidden. Use \"Unhide all\" to bring it back."); }
    if (b.dataset.act === "cv") await makeCV(j);
  });
  ["q", "f-kind", "f-reg", "f-match", "f-visa", "f-new"].forEach(id => $(id).addEventListener("input", renderFeed));
  $("unhide").addEventListener("click", () => { const n = Object.keys(S.hidden).length; S.hidden = {}; save(); renderFeed(); toast(n ? `${n} hidden roles back in the list` : "Nothing was hidden"); });
  $("f-strong").addEventListener("click", () => { strong = !strong; $("f-strong").setAttribute("aria-pressed", String(strong)); renderFeed(); });

  async function makeCV(j) {
    if (!PROFILE) { toast("CV profile not loaded"); return; }
    try {
      toast("Building your CV…");
      const r = await CV.download(PROFILE, j);
      toast(`CV ready: subtitle "${r.second}", ${r.summary} summary. Read it once before sending.`);
    } catch (err) { toast("Could not build the PDF: " + err.message); }
  }

  // ------------------------------------------------------------ board ---
  function addToBoard(j, stage) {
    S.board[j.id] = { stage, added: today(), moved: today(), applied: "", follow: "", next: "", notes: "", job: j };
    save(); renderFeed(); renderBoard();
  }
  function renderBoard() {
    const items = Object.entries(S.board);
    $("b-board").textContent = items.length || "";
    const by = Object.fromEntries(STAGES.map(([s]) => [s, []]));
    items.forEach(([id, it]) => (by[it.stage] || by.Shortlisted).push([id, it]));
    const live = new Set(DATA.jobs.filter(j => !j.closed).map(j => j.id));
    $("board").innerHTML = STAGES.map(([s, color]) => `
      <section class="col" data-stage="${s}" aria-label="${s}">
        <h3><i style="background:${color}"></i>${s}<span>${by[s].length}</span></h3>
        ${by[s].sort((a, b) => (b[1].moved || "").localeCompare(a[1].moved || "")).map(([id, it]) => {
          const j = it.job, due = it.follow && it.follow <= today() && !["Accepted", "Rejected"].includes(s);
          const closed = DATA.jobs.length && j.url && !live.has(id) && !String(id).startsWith("manual-");
          return `<button type="button" class="bcard" draggable="true" data-id="${esc(id)}">
            ${j.match != null ? `<span class="mm ${matchCls(j.match)}">${j.match}%</span>` : ""}
            <span class="t">${esc(j.title)}</span><span class="c">${esc(j.company)} · ${esc(j.location || j.region || "")}</span>
            <span class="c">Visa ${visaTxt(j.visa ?? -1)}${closed ? " · posting closed" : ""}</span>
            <span class="nx">${it.next ? esc(it.next) + " · " : ""}${it.follow ? `<span class="${due ? "due" : ""}">follow up ${esc(it.follow)}</span>` : it.applied ? "applied " + esc(it.applied) : "added " + esc(it.added)}</span>
          </button>`;
        }).join("")}
      </section>`).join("");
    const count = s => (by[s] || []).length, active = items.length - count("Accepted") - count("Rejected") - count("Shortlisted");
    const dueN = items.filter(([, it]) => it.follow && it.follow <= today() && !["Accepted", "Rejected"].includes(it.stage)).length;
    $("boardStats").innerHTML = [["Active applications", active], ["Technical tests", count("Technical test")], ["HR / salary stage", count("HR round") + count("Salary discussion")], ["Follow-ups due", dueN], ["Offers accepted", count("Accepted")]]
      .map(([l, n]) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`).join("");
  }
  // drag and drop
  $("board").addEventListener("dragstart", e => { const c = e.target.closest(".bcard"); if (c) e.dataTransfer.setData("text/plain", c.dataset.id); });
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
    addToBoard(j, "Shortlisted"); show("board"); toast("Added to Shortlisted");
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
      <div class="chips"><span class="chip">${esc(d.licence || "Sponsor")}</span><span class="chip reg">${esc(d.town || "")}</span></div>
      <h2>${esc(d.name)}</h2>
      <div class="co">Job board: ${esc(d.ats)} · found ${esc(d.found)}</div>
      <div class="skills">${(d.roles || []).map(r => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.title)}</a> <span class="note">${esc(r.location || "")}</span>`).join("<br>")}</div>
      <div class="actions"><button type="button" class="btn small primary" data-act="track">Track this company</button><button type="button" class="btn small" data-act="skip">Skip</button></div>
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
      const body = "Private request from Job Hunt HQ. Submit it as it is.\n\n```json\n" + JSON.stringify(box) + "\n```";
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
    DATA = bundle["jobs.json"] || { jobs: [] }; COMPANIES = (bundle["companies.json"] || {}).companies || [];
    DISC = bundle["discovered.json"] || { items: [] }; BASE_PROFILE = bundle["profile.json"] || null; applyProfile();
    document.body.classList.remove("locked"); $("lock").hidden = true;
    const when = DATA.generated_at ? new Date(DATA.generated_at) : null;
    $("refresh").textContent = DATA.seeded_by_hand ? "Starter list · first automatic run tomorrow morning"
      : when ? `Updated ${when.toLocaleDateString(undefined, { day: "numeric", month: "short" })} ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · ${DATA.companies_checked ?? "?"} boards checked` : "Waiting for the first daily run";
    renderAll(); fillDetails();
    show(["feed", "board", "companies", "discovered", "rules", "details"].includes(location.hash.slice(1)) ? location.hash.slice(1) : "feed");
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
