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
    const sub = [p.first_title, j.first_title, j.second_title].join(" ").toLowerCase();
    const titleHit = titleWords.length ? titleWords.filter(w => sub.includes(w)).length / titleWords.length : 1;
    const top = [...weighted].sort((a, b) => b.w - a.w).slice(0, 6), topInSum = top.length ? top.filter(x => x.inSum).length / top.length : 1;
    const words = cv.split(/\s+/).length, maxPages = meta.maxPages || 1, wordMax = maxPages > 1 ? 1150 : 850;
    const expB = p.experience.flatMap(e => e.bullets.map(b => b.text)), allB = expB.concat(p.projects.map(b => b.text));
    const quant = expB.filter(b => /\d/.test(b)).length / (expB.length || 1);
    const verbs = expB.filter(b => VERBS.test(b.trim())).length / (expB.length || 1);
    const banned = BANNED.filter(w => cvL.includes(w));
    const badChars = BAD_CHARS.test(cv);
    // facts must survive editing: every number in the original bullets still appears, nothing new invented
    // numbers are checked against the automatic version for this job (relevance trimming may leave bullets out)
    const auto = ctx.auto || { bullets: original.experience.map(e => e.bullets.map(b => typeof b === "string" ? b : b.text)), projects: [] };
    const origNums = auto.bullets.flat().join(" ");
    const origAll = origNums + " " + original.projects.map(b => typeof b === "string" ? b : b.text).join(" ") + " 4+ " + JSON.stringify(original.summaries || {});
    const newNums = [...new Set((expB.join(" ") + " " + summary + " " + allB.join(" ")).match(/\d+(?:[.,]\d+)?/g) || [])].filter(n => !origAll.includes(n));
    const lostNums = (origNums.match(/\d+(?:[.,]\d+)?%?/g) || []).filter(n => !cv.includes(n.replace("%", "")));
    const yrsAsked = Math.max(0, ...[...jd.matchAll(/(\d{1,2})\s*\+?\s*(?:(?:-|to|–)\s*\d{1,2}\s*)?\+?\s*(?:years|yrs)/gi)].map(m => +m[1]).filter(n => n <= 15));
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
      S(maxPages > 1 ? `Up to 2 pages, 450 to ${wordMax} words` : "One page, 450 to 850 words", (meta.pages <= maxPages ? 5 : 0) + (words >= 450 && words <= wordMax ? 5 : 2.5), 10, meta.pages > maxPages ? `The CV runs past ${maxPages === 1 ? "one page" : "two pages"}. Shorten a bullet or the summary.` : `The CV has ${words} words. Aim for 450 to ${wordMax}.`),
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
      yrsAsked, titleHit, jobTitle: ctx.job.title, sub: [j.first_title || p.first_title, j.second_title].filter(Boolean).join(" | "),
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
  // Requirements in the posting that a CV cannot prove or that need a decision before applying.
  const LANG = "german|french|dutch|swedish|spanish|italian|polish|turkish|japanese|mandarin|portuguese|danish|norwegian|finnish|czech|hebrew|arabic|korean";
  const CHECKS = [
    [new RegExp(`\\b(${LANG})\\b[^.;]{0,50}\\b(fluen|native|required|proficien|c1|c2|b2|business[- ]level|essential|must)`, "i"), m => `Language: the posting asks for ${m[1][0].toUpperCase() + m[1].slice(1)}. Apply only if you can work in it.`],
    [new RegExp(`\\b(fluen\\w*|native|proficien\\w*|business[- ]level)\\b[^.;]{0,30}\\b(${LANG})\\b`, "i"), m => `Language: the posting asks for ${m[2][0].toUpperCase() + m[2].slice(1)}. Apply only if you can work in it.`],
    [/\b(phd|doctorate|doctoral)\b/i, () => "Education: a PhD is mentioned. Check whether it is required or only preferred."],
    [/\b(security clearance|sc clearance|dv clearance|eligible for clearance|clearance required)\b/i, () => "Security clearance is mentioned. It usually needs citizenship or long UK residence."],
    [/(not|unable to|cannot|can't|do not|won't|will not)\s+(be able to\s+)?(offer|provide|sponsor|support)[^.]{0,40}(visa|sponsor)|no visa sponsorship|without (the need for )?sponsorship|must (already )?have (the )?(full )?right to work/i, () => "Sponsorship: the posting says it will not sponsor a visa."],
    [/\b(team lead|people management|line[- ]manag\w*|manage a team of)\b/i, () => "People management is expected. Show mentoring and ownership, but do not claim a lead title."],
    [/\b(aws|azure|gcp|google cloud|kubernetes|cka|ckad|terraform)\b[^.]{0,25}\bcertifi(ed|cation)/i, m => { const c = /^(cka|ckad|aws|gcp)$/i.test(m[1]) ? m[1].toUpperCase() : m[1][0].toUpperCase() + m[1].slice(1); return `Certification: the posting mentions ${/^[aeiou]/i.test(c) ? "an" : "a"} ${c} certification you do not list.`; }],
    [/\bon-?call\b/i, () => "On-call rota mentioned. Your 40+ production defects and MTTR work is the evidence to point to."],
    [/\b(\d)\s*days?\s*(a|per)\s*week\s*(in|on-?site|at)\b|\bfully on-?site\b|\bon-?site only\b/i, () => "Office attendance: the role is fully or partly on-site."],
  ];
  function gapsCard(r) {
    const jd = ($("st-jd").value || "");
    const rows = [];
    r.match.gaps.forEach(k => rows.push(["gap", `${k}`, "Not on your CV. Do not add it; name it honestly in the cover letter."]));
    r.match.addable.forEach(k => rows.push(["fix", k, "You have this skill but this CV does not show it.", k]));
    if (r.yrsAsked > 4) rows.push(["check", `${r.yrsAsked}+ years asked`, "You have 4+. Apply if the posting treats years as a guide, and lead with numbers."]);
    if (r.titleHit < 1) rows.push(["check", "Title", `The posting says "${r.jobTitle}"; your subtitle says "${r.sub}". Pick the closest second title you can defend.`]);
    const seen = new Set();
    CHECKS.forEach(([rx, say]) => { const m = jd.match(rx); if (m) { const t = say(m); if (!seen.has(t)) { seen.add(t); rows.push(["check", t.split(":")[0].replace(/ is .*| mentioned.*/, ""), t.includes(":") ? t.slice(t.indexOf(":") + 1).trim() : t]); } } });
    const n = { gap: r.match.gaps.length, fix: r.match.addable.length, check: rows.filter(x => x[0] === "check").length };
    return `<section class="score gaps"><h3>Gaps between your CV and this JD</h3>
      <div class="gap-sum"><span class="g-gap">${n.gap} skill gap${n.gap === 1 ? "" : "s"}</span><span class="g-fix">${n.fix} quick fix${n.fix === 1 ? "" : "es"}</span><span class="g-check">${n.check} to check</span></div>
      ${rows.length ? `<ul class="gap-list">${rows.map(([t, k, msg, add]) => `<li class="g-${t}"><b>${esc(k)}</b><span>${esc(msg)}</span>${add ? `<button type="button" class="btn sm" data-add-skill="${esc(add)}">Add to skills</button>` : ""}</li>`).join("")}</ul>` : `<p class="m">No gaps found. Paste the full posting for a complete check.</p>`}
    </section>`;
  }
  function renderScores(r) {
    $("st-scores").innerHTML = gapsCard(r) +
      scoreCard("ATS score", "How well an applicant tracking system can read this CV and match it to the posting.", r.ats) +
      scoreCard("JD match", "Share of the posting's hard skills your CV shows, weighted by importance, plus title fit.", r.match) +
      scoreCard("Readiness", "Recruiter-facing quality: facts intact, summary length, action verbs, measurable results, clean wording.", r.ready) +
      `<section class="score kw"><h3>Keywords from this posting</h3>
        <div class="skills">${r.match.matched.map(k => `<span class="sk">${esc(k)}</span>`).join("")}${r.match.addable.map(k => `<span class="sk add" title="You have this; add it">${esc(k)} +</span>`).join("")}${r.match.gaps.map(k => `<span class="sk miss" title="Real gap; do not add">${esc(k)}</span>`).join("")}</div>
        <p class="m">Green: on your CV. Blue +: you have it but this CV does not show it. Red: a real gap; mention it in the cover letter instead.</p></section>` +
      (window.Prep ? `<section class="score"><h3>Interview prep</h3>${Prep.html(Object.assign({}, ctx.job, { description: $("st-jd").value }), ctx.base)}</section>` : "");
  }

  function readForm() {
    return {
      second: $("st-second").value, summary: $("st-summary").value.trim(), skills: $("st-skills").value,
      bullets: ctx.base.experience.map((e, i) => $("st-b" + i).value.split("\n").map(x => x.trim()).filter(Boolean)),
      projects: $("st-projects").value.split("\n").map(x => x.trim()).filter(Boolean), jd: $("st-jd").value,
      template: ctx.template, reloc: $("st-reloc").value,
    };
  }
  function fillTemplates() {
    const rec = recommend(ctx.job);
    $("st-tpls").innerHTML = Object.entries(CV.TEMPLATES).map(([k, T]) => `<button type="button" class="tpl" data-tpl="${k}" aria-pressed="${k === ctx.template}" title="${esc(T.desc)}">
      <span class="tpl-thumb t-${k}" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
      <span class="tpl-name">${esc(T.name)}</span>
      <span class="tpl-meta">${T.regions.map(r => `<em>${r}</em>`).join("")}${k === rec ? '<em class="rec">Best fit</em>' : ""}</span></button>`).join("");
    const T = CV.TEMPLATES[ctx.template];
    $("st-tpl-desc").textContent = `${T.name} · ${T.pages === 1 ? "one page" : "up to two pages"}. ${T.desc}`;
  }
  // US tech postings read best in Jake's layout; everywhere else Mayur's own style.
  function recommend(job) { return job.region === "US" ? "jake" : "octo"; }
  function fillForm(t) {
    fillTitles(t.second);
    fillTemplates();
    $("st-summary").value = t.summary; $("st-skills").value = t.skills; $("st-projects").value = t.projects.join("\n");
    $("st-reloc").value = typeof t.reloc === "string" ? t.reloc : CV.relocation(ctx.job);
    $("st-roles").innerHTML = ctx.base.experience.map((e, i) => `<label for="st-b${i}">${esc(e.title)} <span class="m">· ${esc(e.org.split(",")[0])} · ${esc(e.dates)}</span>
      <textarea id="st-b${i}" rows="${Math.max(3, (t.bullets[i] || []).length * 2 + 1)}">${esc((t.bullets[i] || []).join("\n"))}</textarea></label>`).join("");
    $("st-jd").value = t.jd || jdDefault(ctx.job);
  }

  // Second titles: the built-in list plus up to 8 of Mayur's own, kept in this browser.
  const TKEY = "jobocto.titles";
  function ownTitles() { try { return JSON.parse(localStorage.getItem(TKEY) || "[]"); } catch (e) { return []; } }
  function saveTitles(list) { try { localStorage.setItem(TKEY, JSON.stringify(list)); } catch (e) {} }
  function fillTitles(selected) {
    const own = ownTitles();
    const all = [...new Set([selected, ...own, ...CV.SECOND_TITLES].filter(Boolean))];
    $("st-second").innerHTML = all.map(x => `<option${x === selected ? " selected" : ""}>${esc(x)}</option>`).join("");
    $("st-title-list").innerHTML = own.length ? own.map(x => `<span class="chip">${esc(x)}<button type="button" data-title="${esc(x)}" aria-label="Remove ${esc(x)}">×</button></span>`).join("")
      : `<span class="m">Your own titles appear here and stay for next time.</span>`;
  }
  function note(m) { const t = $("toast"); if (!t) return; t.textContent = m; t.classList.add("show"); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), 3200); }
  function addTitle() {
    const v = $("st-title-new").value.trim().replace(/\s+/g, " ");
    if (!v) return;
    const own = ownTitles();
    if (/\b(senior|lead|principal|staff|head|architect|manager)\b/i.test(v)) { note("Keep the subtitle at your level: Senior, Lead, Principal, Staff, Head, Architect and Manager titles are left out on purpose."); return; }
    if (!own.some(x => x.toLowerCase() === v.toLowerCase()) && !CV.SECOND_TITLES.some(x => x.toLowerCase() === v.toLowerCase())) {
      if (own.length >= 8) { note("You can keep up to 8 of your own titles. Remove one first."); return; }
      own.push(v); saveTitles(own);
    }
    $("st-title-new").value = "";
    fillTitles(v); later();
  }
  function removeTitle(v) {
    saveTitles(ownTitles().filter(x => x !== v));
    const cur = $("st-second").value;
    fillTitles(cur === v ? CV.SECOND_TITLES[0] : cur); if (cur === v) later();
  }

  async function refresh() {
    const my = ++building;
    $("st-status").textContent = "Updating preview…";
    const t = readForm();
    ctx.store.set(t);
    const [p, j0] = CV.applyTailor(ctx.base, ctx.job, t), j = Object.assign(j0, { template: ctx.template });
    let r;
    try { r = await CV.build(p, j); } catch (e) { $("st-status").textContent = "Could not build: " + e.message; return; }
    if (my !== building) return;
    ctx.def = r.def;
    const meta = { pages: r.pages, lines: r.lines, maxPages: r.maxPages || 1 };
    const res = score(t, p, j, meta, t.jd || jdDefault(ctx.job), ctx.base);
    renderScores(res);
    if (ctx.store.scores) ctx.store.scores({ ats: res.ats.n, match: res.match.n, ready: res.ready.n, gaps: res.match.gaps.length, template: ctx.template });
    const T = CV.TEMPLATES[ctx.template];
    $("st-status").textContent = `${T.name} · ${r.pages === 1 ? "1 page" : r.pages + " pages"} · body ${r.used[0]}pt · summary ${r.lines} line${r.lines === 1 ? "" : "s"}${r.squeezed ? " · too long, text squeezed" : ""}`;
    $("st-status").classList.toggle("warn", r.pages > (r.maxPages || 1) || r.lines > 5 || !!r.squeezed);
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
    const saved0 = store.get();
    ctx = { job, base: CV.upgrade(profile), store, makeLetter, def: null, template: (saved0 && saved0.template) || job.template || "octo" };
    $("st-title").textContent = job.title; $("st-sub").textContent = `${job.company} · ${job.location || job.region || ""}`;
    $("studio").showModal(); loadPdfjs().catch(() => {});
    $("st-status").textContent = "Building the tailored version…"; $("st-scores").innerHTML = ""; $("st-frame").replaceChildren();
    const saved = store.get();
    const auto = await CV.tailored(profile, Object.assign({}, job, { template: ctx.template }));
    ctx.auto = auto;
    const t = saved && saved.summary ? saved : Object.assign(auto, { jd: saved && saved.jd });
    fillForm(t); refresh();
  }
  function init() {
    $("st-form").addEventListener("input", e => { if (e.target.id !== "st-title-new") later(); });
    $("st-title-add").addEventListener("click", addTitle);
    $("st-title-new").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addTitle(); } });
    $("st-title-list").addEventListener("click", e => { const b = e.target.closest("[data-title]"); if (b) removeTitle(b.dataset.title); });
    $("st-reset").addEventListener("click", async () => {
      const jd = $("st-jd").value; ctx.store.set(null);
      const auto = await CV.tailored(ctx.base, Object.assign({}, ctx.job, { template: ctx.template })); ctx.auto = auto;
      fillForm(Object.assign(auto, { jd })); refresh();
    });
    $("st-dl").addEventListener("click", () => { if (ctx && ctx.def) CV.downloadDef(ctx.def, ctx.job.company); });
    // switching template rebuilds the automatic version for that layout (page limits differ),
    // unless the CV has hand edits, which are kept as typed
    $("st-tpls").addEventListener("click", async e => {
      const b = e.target.closest("[data-tpl]"); if (!b || !ctx || b.dataset.tpl === ctx.template) return;
      ctx.template = b.dataset.tpl; fillTemplates();
      const cur = readForm(), edited = ctx.auto && (cur.summary !== ctx.auto.summary || cur.skills !== ctx.auto.skills || JSON.stringify(cur.bullets) !== JSON.stringify(ctx.auto.bullets) || cur.projects.join("\n") !== ctx.auto.projects.join("\n") || cur.second !== ctx.auto.second);
      $("st-status").textContent = "Switching template…";
      if (!edited) {
        const auto = await CV.tailored(ctx.base, Object.assign({}, ctx.job, { template: ctx.template })); ctx.auto = auto;
        fillForm(Object.assign(auto, { jd: cur.jd }));
      }
      refresh();
    });
    // "Add to skills" in the gaps card: the skill goes on the skills line that fits it best
    $("st-scores").addEventListener("click", e => {
      const b = e.target.closest("[data-add-skill]"); if (!b) return;
      const k = b.dataset.addSkill, lines = $("st-skills").value.split("\n");
      const pick = /llm|rag|langchain|openai|hugging|fine|lora|agent|prompt|pytorch|tensorflow|vector/i.test(k) ? /ai|llm/i
        : /mlflow|airflow|dvc|docker|kubernetes|helm|terraform|jenkins|ci\/cd|github actions|linux/i.test(k) ? /mlops|platform|deploy/i
        : /sql|postgres|mysql|mongo|redis/i.test(k) ? /databases/i : /aws|azure|gcp/i.test(k) ? /cloud/i
        : /prometheus|grafana|elk|datadog|opentelemetry|observab|oauth/i.test(k) ? /observab|security/i : /pytest|test/i.test(k) ? /quality/i : /backend/i;
      let i = lines.findIndex(l => pick.test(l.split(":")[0])); if (i < 0) i = 0;
      lines[i] = lines[i].replace(/\s*$/, "") + (lines[i].includes(":") ? ", " : "") + k;
      $("st-skills").value = lines.join("\n"); note(`${k} added to "${lines[i].split(":")[0]}"`); refresh();
    });
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
