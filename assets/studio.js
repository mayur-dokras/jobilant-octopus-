/* Tailor studio: edit the tailored CV, see the PDF update, and check three scores.
   Scoring follows what resume scanners and ATS vendors describe publicly: keyword overlap with
   the job description (weighted by how often and where a term appears), job title alignment,
   standard section headings, parseable contact details and dates, single-column text formatting,
   length, and quality signals such as action verbs and measurable results.
   Scores are a diagnostic, not a verdict: 80+ strong, 70-79 competitive, 60-69 fix gaps, under 60 high risk. */
window.Studio = (function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const VERBS = /^(Built|Designed|Owned|Led|Delivered|Resolved|Reduced|Developed|Executed|Applied|Created|Implemented|Automated|Migrated|Shipped|Wrote|Improved|Deployed|Launched|Managed|Coordinated|Integrated|Optimised|Optimized|Engineered|Established|Introduced|Maintained|Ran|Debugged|Mentored|Analysed|Analyzed|Data|AI|Link2Feed|Topic-based|Java)\b/;
  const BANNED = ["passionate", "results-driven", "leveraged", "leverage", "spearheaded", "utilised", "utilized", "delve", "robust", "seamless", "cutting-edge", "dynamic", "synergy", "go-getter", "team player", "hard-working", "detail-oriented"];
  const BAD_CHARS = /[–—‘’“”…]/;
  const band = n => n >= 80 ? ["Strong", "hi"] : n >= 70 ? ["Competitive", "hi"] : n >= 60 ? ["Fix the gaps", "mid"] : ["High risk", "lo"];

  let ctx = null, timer = null, building = 0;

  function jdDefault(job) {
    return job.description || [job.title, (job.matched || []).join(", "), (job.missing || []).join(", "), job.note || ""].join("\n");
  }
  const nums = t => (String(t).match(/\d+(?:[.,]\d+)?%?\+?/g) || []).sort().join(",");

  // ------------------------------------------------------------------ scores ---
  function score(t, p, j, meta, jd, original) {
    const cv = CV.plainText(p, j), cvL = cv.toLowerCase(), jdL = jd.toLowerCase();
    const summary = String(j.summary).replace(/\*\*/g, "");
    const terms = Match.found(jd);
    // weight: 2 when the term is in the job title or repeated in the JD, else 1
    const weighted = terms.map(k => ({ k, w: (Match.test(k, ctx.job.title) || Match.count(k, jd) > 1) ? 2 : 1, on: Match.test(k, cv), inSum: Match.test(k, summary) }));
    const wAll = weighted.reduce((n, x) => n + x.w, 0) || 1, wOn = weighted.filter(x => x.on).reduce((n, x) => n + x.w, 0);
    const coverage = terms.length ? wOn / wAll : 0.6;
    const missingHave = weighted.filter(x => !x.on && Match.has(x.k)), missingGap = weighted.filter(x => !x.on && !Match.has(x.k));
    const titleWords = (ctx.job.title || "").toLowerCase().split(/[^a-z+]+/).filter(w => w.length > 2 && !/senior|junior|mid|level|team|the|and/.test(w));
    const sub = [p.first_title, j.second_title].join(" ").toLowerCase();
    const titleHit = titleWords.length ? titleWords.filter(w => sub.includes(w)).length / titleWords.length : 1;
    const top = [...weighted].sort((a, b) => b.w - a.w).slice(0, 6), topInSum = top.length ? top.filter(x => x.inSum).length / top.length : 1;
    const words = cv.split(/\s+/).length;
    const expB = p.experience.flatMap(e => e.bullets.map(b => b.text)), allB = expB.concat(p.projects.map(b => b.text));
    const quant = expB.filter(b => /\d/.test(b)).length / (expB.length || 1);
    const verbs = expB.filter(b => VERBS.test(b.trim())).length / (expB.length || 1);
    const banned = BANNED.filter(w => cvL.includes(w));
    const badChars = BAD_CHARS.test(cv);
    // facts must survive editing: every number in the original bullets still appears, nothing new invented
    const origNums = original.experience.flatMap(e => e.bullets.map(b => typeof b === "string" ? b : b.text)).join(" ");
    const origAll = origNums + " " + original.projects.map(b => typeof b === "string" ? b : b.text).join(" ") + " 4+ " + JSON.stringify(original.summaries || {});
    const newNums = [...new Set((expB.join(" ") + " " + summary + " " + allB.join(" ")).match(/\d+(?:[.,]\d+)?/g) || [])].filter(n => !origAll.includes(n));
    const lostNums = (origNums.match(/\d+(?:[.,]\d+)?%?/g) || []).filter(n => !cv.includes(n.replace("%", "")));
    const yrsAsked = Math.max(0, ...[...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs)/gi)].map(m => +m[1]).filter(n => n <= 15));
    const sumWords = summary.split(/\s+/).length;

    const S = (label, pts, max, tip) => ({ label, pts: Math.round(pts * 10) / 10, max, tip: pts < max - 0.01 ? tip : "" });

    const match = [
      S("Hard skills from the JD found in your CV (weighted)", 80 * coverage, 80, missingHave.length
        ? `On your skills list but not on this CV: ${missingHave.map(x => x.k).join(", ")}. If you have really used them, add them to the skills line and, if they matter for this role, to the summary.`
        : `The remaining JD skills are real gaps (${missingGap.map(x => x.k).join(", ") || "none"}). Do not add them; name them honestly in the cover letter.`),
      S("Role title alignment", 20 * titleHit, 20, `Your subtitle does not echo the posting's title "${ctx.job.title}". Pick the closest second title you can defend (e.g. Python Developer or MLOps Engineer).`),
    ];
    let matchPenalty = 0, matchNotes = [];
    if (yrsAsked > 4) { matchPenalty = Math.min(15, 5 * (yrsAsked - 4)); matchNotes.push(`The JD asks for ${yrsAsked}+ years; you have 4+. Apply only if the posting treats years as a guide, and show depth with numbers.`); }
    if (terms.length < 5) matchNotes.push("The JD text is short, so this score is an estimate. Paste the full job description above for an exact result.");

    const ats = [
      S("Keyword match", 40 * coverage, 40, missingHave.length ? `Use the posting's exact wording for skills you have and show them: ${missingHave.map(x => x.k).join(", ")}.` : ""),
      S("Job title match", 10 * titleHit, 10, "Use a second title that matches the posting's title wording."),
      S("Keywords placed in the summary", 5 * topInSum, 5, `Name the posting's top skills in the summary too: ${top.filter(x => !x.inSum && x.on).map(x => x.k).join(", ") || "already covered"}. Systems weight a keyword more when it appears near the top.`),
      S("Standard section headings", 10, 10, ""),
      S("Contact details parseable (email, phone, location, LinkedIn)", [p.contact.email, p.contact.phone, p.contact.location, (p.contact.links || [])[0]].filter(Boolean).length * 2.5, 10, "Keep email, phone, city and LinkedIn as plain text in the body, not in a page header."),
      S("Single column, text PDF, standard font, no tables or images", 10, 10, ""),
      S("Consistent date format", p.experience.every(e => /^[A-Z][a-z]{2} \d{4} - ([A-Z][a-z]{2} \d{4}|Present)$/.test(e.dates)) ? 5 : 2, 5, "Use one date format everywhere: \"Nov 2021 - Nov 2024\"."),
      S("One page, 450 to 850 words", (meta.pages === 1 ? 5 : 0) + (words >= 450 && words <= 850 ? 5 : 2.5), 10, meta.pages > 1 ? "The CV runs onto a second page. Shorten a bullet or the summary." : `The CV has ${words} words. Aim for 450 to 850.`),
    ];
    const ready = [
      S("Facts unchanged (numbers, titles, employers, dates)", (newNums.length || lostNums.length) ? 0 : 20, 20,
        newNums.length ? `New numbers appear that are not in your original CV: ${newNums.join(", ")}. Only use figures you can defend.` : `Numbers from your original bullets are missing: ${[...new Set(lostNums)].join(", ")}. Do not drop metrics without a reason.`),
      S("Summary within 5 lines", meta.lines <= 5 ? 15 : 0, 15, `The summary takes ${meta.lines} lines. Cut a clause or a sentence to get back to 5.`),
      S("Summary length 45 to 110 words", sumWords >= 45 && sumWords <= 110 ? 5 : 2, 5, `The summary has ${sumWords} words.`),
      S("Experience bullets start with an action verb", 15 * verbs, 15, "Start every bullet with a verb that shows ownership: Built, Designed, Owned, Led, Delivered, Reduced."),
      S("Experience bullets with a measurable result", 15 * Math.min(1, quant / 0.6), 15, "Aim for a number in at least 60% of experience bullets (counts, %, time saved), using only real figures."),
      S("No banned buzzwords", banned.length ? 0 : 10, 10, `Remove: ${banned.join(", ")}.`),
      S("Plain punctuation (no long dashes, curly quotes, ellipses)", badChars ? 0 : 10, 10, "Replace long dashes with commas or full stops and use straight quotes."),
      S("Bullets no longer than about 3 lines", allB.every(b => b.split(/\s+/).length <= 48) ? 5 : 2, 5, "Split or tighten any bullet over about 45 words."),
      S("Summary opens with title and years", /^\W*(\*\*)?[A-Z][A-Za-z ]+(Engineer|Developer)\b.*4\+ years/.test(String(j.summary).slice(0, 120)) ? 5 : 0, 5, "Open the summary with your title and 4+ years."),
    ];
    const total = arr => Math.round(arr.reduce((n, x) => n + x.pts, 0) / arr.reduce((n, x) => n + x.max, 0) * 100);
    return {
      match: { n: Math.max(0, total(match) - matchPenalty), parts: match, notes: matchNotes, matched: weighted.filter(x => x.on).map(x => x.k), gaps: missingGap.map(x => x.k), addable: missingHave.map(x => x.k) },
      ats: { n: total(ats), parts: ats, notes: [] },
      ready: { n: total(ready), parts: ready, notes: [] },
      words,
    };
  }

  // ------------------------------------------------------------------ render ---
  function ringSVG(n) {
    const [, cls] = band(n), r = 30, c = 2 * Math.PI * r;
    return `<svg viewBox="0 0 72 72" class="sring ${cls}" aria-hidden="true"><circle cx="36" cy="36" r="${r}" class="trk"/><circle cx="36" cy="36" r="${r}" class="val" stroke-dasharray="${c * n / 100} ${c}" transform="rotate(-90 36 36)"/><text x="36" y="41" text-anchor="middle">${n}</text></svg>`;
  }
  function scoreCard(title, what, s) {
    const tips = s.parts.filter(x => x.tip).map(x => x.tip).concat(s.notes);
    const [label] = band(s.n);
    return `<section class="score">
      <div class="score-top">${ringSVG(s.n)}<div><h3>${title}</h3><span class="band b-${band(s.n)[1]}">${label}</span><p>${what}</p></div></div>
      <details ${tips.length ? "open" : ""}><summary>How to improve <span class="pill">${tips.length}</span></summary>
        ${tips.length ? `<ul>${tips.map(t => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="m">Nothing to fix here.</p>`}</details>
      <details><summary>How this is calculated</summary><table class="calc">${s.parts.map(x => `<tr><td>${esc(x.label)}</td><td>${x.pts}/${x.max}</td></tr>`).join("")}</table></details>
    </section>`;
  }
  function renderScores(r) {
    $("st-scores").innerHTML =
      scoreCard("ATS score", "How well an applicant tracking system can read this CV and match it to the posting.", r.ats) +
      scoreCard("JD match", "Share of the posting's hard skills your CV shows, weighted by importance, plus title fit.", r.match) +
      scoreCard("Readiness", "Recruiter-facing quality: facts intact, summary length, action verbs, measurable results, clean wording.", r.ready) +
      `<section class="score kw"><h3>Keywords from this posting</h3>
        <div class="skills">${r.match.matched.map(k => `<span class="sk">${esc(k)}</span>`).join("")}${r.match.addable.map(k => `<span class="sk add" title="You have this; add it">${esc(k)} +</span>`).join("")}${r.match.gaps.map(k => `<span class="sk miss" title="Real gap; do not add">${esc(k)}</span>`).join("")}</div>
        <p class="m">Green: on your CV. Blue +: you have it but this CV does not show it. Red: a real gap; mention it in the cover letter instead.</p></section>`;
  }

  function readForm() {
    return {
      second: $("st-second").value, summary: $("st-summary").value.trim(), skills: $("st-skills").value,
      bullets: ctx.base.experience.map((e, i) => $("st-b" + i).value.split("\n").map(x => x.trim()).filter(Boolean)),
      projects: $("st-projects").value.split("\n").map(x => x.trim()).filter(Boolean), jd: $("st-jd").value,
    };
  }
  function fillForm(t) {
    $("st-second").innerHTML = [...new Set([t.second, ...CV.SECOND_TITLES])].map(x => `<option${x === t.second ? " selected" : ""}>${esc(x)}</option>`).join("");
    $("st-summary").value = t.summary; $("st-skills").value = t.skills; $("st-projects").value = t.projects.join("\n");
    $("st-roles").innerHTML = ctx.base.experience.map((e, i) => `<label for="st-b${i}">${esc(e.title)} <span class="m">· ${esc(e.org.split(",")[0])} · ${esc(e.dates)}</span>
      <textarea id="st-b${i}" rows="${Math.max(3, (t.bullets[i] || []).length * 2 + 1)}">${esc((t.bullets[i] || []).join("\n"))}</textarea></label>`).join("");
    $("st-jd").value = t.jd || jdDefault(ctx.job);
  }

  async function refresh() {
    const my = ++building;
    $("st-status").textContent = "Updating preview…";
    const t = readForm();
    ctx.store.set(t);
    const [p, j] = CV.applyTailor(ctx.base, ctx.job, t);
    const r = await CV.build(p, j);
    if (my !== building) return;
    ctx.def = r.def;
    const meta = { pages: r.pages, lines: r.lines };
    renderScores(score(t, p, j, meta, t.jd || jdDefault(ctx.job), ctx.base));
    $("st-status").textContent = `${r.pages === 1 ? "1 page" : r.pages + " pages"} · body ${r.used[0]}pt · summary ${r.lines} line${r.lines === 1 ? "" : "s"}${r.squeezed ? " · too long, text squeezed" : ""}`;
    $("st-status").classList.toggle("warn", r.pages > 1 || r.lines > 5 || !!r.squeezed);
    pdfMake.createPdf(r.def).getBuffer(async buf => {
      if (my !== building) return;
      try { await paint(new Uint8Array(buf), my); } catch (e) { $("st-status").textContent += " · preview failed: " + e.message; }
    });
  }
  // Render every page to a canvas with pdf.js (works the same on desktop and phone).
  let pdfjsReady = null;
  function loadPdfjs() {
    if (!pdfjsReady) pdfjsReady = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = "assets/vendor/pdf.min.js";
      s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = "assets/vendor/pdf.worker.min.js"; res(); };
      s.onerror = () => rej(new Error("preview library did not load")); document.head.appendChild(s);
    });
    return pdfjsReady;
  }
  async function paint(data, my) {
    await loadPdfjs();
    const pdf = await pdfjsLib.getDocument({ data }).promise, box = $("st-frame");
    const width = Math.min(760, box.clientWidth - 40 || 600), dpr = Math.min(2, window.devicePixelRatio || 1);
    const canvases = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i), v0 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: width / v0.width * dpr });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height; c.setAttribute("aria-label", "Page " + i);
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
      canvases.push(c);
    }
    if (my !== building) return;
    box.replaceChildren(...canvases);
  }
  const later = () => { clearTimeout(timer); timer = setTimeout(refresh, 700); };

  async function open(job, profile, store, makeLetter) {
    await Match.load();
    ctx = { job, base: CV.upgrade(profile), store, makeLetter, def: null };
    $("st-title").textContent = job.title; $("st-sub").textContent = `${job.company} · ${job.location || job.region || ""}`;
    $("studio").showModal(); loadPdfjs().catch(() => {});
    $("st-status").textContent = "Building the tailored version…"; $("st-scores").innerHTML = ""; $("st-frame").replaceChildren();
    const saved = store.get();
    const t = saved && saved.summary ? saved : Object.assign(await CV.tailored(profile, job), { jd: saved && saved.jd });
    fillForm(t); refresh();
  }
  function init() {
    $("st-form").addEventListener("input", later);
    $("st-reset").addEventListener("click", async () => {
      const jd = $("st-jd").value; ctx.store.set(null);
      fillForm(Object.assign(await CV.tailored(ctx.base, ctx.job), { jd })); refresh();
    });
    $("st-dl").addEventListener("click", () => { if (ctx && ctx.def) CV.downloadDef(ctx.def, ctx.job.company); });
    $("st-letter").addEventListener("click", () => ctx && ctx.makeLetter(ctx.job));
    $("st-close").addEventListener("click", () => $("studio").close());
    $("studio").addEventListener("close", () => { clearTimeout(timer); building++; });
    $("st-tabs").addEventListener("click", e => {
      const b = e.target.closest("button[data-pane]"); if (!b) return;
      $("st-tabs").querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
      $("studio").dataset.pane = b.dataset.pane;
    });
  }
  return { open, init, score };
})();
