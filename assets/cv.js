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
    const terms = lc(job.matched || []);
    const first = { MLOps: "MLOps and Platform", AI: "AI and LLMs", Backend: "Backend and APIs" }[job.kind] || "Backend and APIs";
    const groups = profile.skill_groups.map(g => {
      const items = [...g.items].sort((a, b) => hits(b, terms) - hits(a, terms));
      return { label: g.label, items, score: items.reduce((n, i) => n + hits(i, terms), 0) + (g.label === first ? 100 : 0) };
    });
    return groups.sort((a, b) => b.score - a.score);
  }
  function orderBullets(list, job) {
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
  const JOINED = /(\S*[-/]\S* ?)/;
  function keepJoined(runs) {
    const out = [];
    (Array.isArray(runs) ? runs : [runs]).forEach(r => {
      const base = typeof r === "string" ? { text: r } : r;
      String(base.text).split(JOINED).filter(x => x !== "").forEach(part => {
        const piece = Object.assign({}, base, { text: part });
        if (JOINED.test(part) && /[-/]/.test(part) && !/^\s/.test(part)) piece.noWrap = true;
        out.push(piece);
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

  function doc(profile, job, fs = 9.5, gap = 2.4) {
    const p = profile, c = p.contact;
    const sub = [p.first_title, secondTitle(p, job), p.experience_tag].join("  |  ");
    const reloc = relocation(job);
    const contact = [c.location, reloc, c.phone, c.email].filter(Boolean).join("  |  ");
    const summary = boldRuns(p.summaries[summaryKey(job)], job.matched || []);
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
  async function build(profile, job) {
    let fs = null;
    for (let f = 10.6; f >= 8.95; f = Math.round((f - 0.1) * 100) / 100) {
      const m = await measure(doc(profile, job, f, 2.4), 2.4);
      if (m.pages === 1 && m.sumLines <= 5) { fs = f; break; }
    }
    if (fs === null) return { def: doc(profile, job, 9.0, 0.4), used: [9.0, 0.4] };
    // spread leftover space over the section gaps: largest gap (up to 9pt) that still fits one page
    let lo = 2.4, hi = 9;
    for (let i = 0; i < 6; i++) {
      const mid = (lo + hi) / 2, m = await measure(doc(profile, job, fs, mid), mid);
      if (m.pages === 1) lo = mid; else hi = mid;
    }
    const gap = Math.max(2.4, lo - 0.3);
    return { def: doc(profile, job, fs, gap), used: [fs, gap] };
  }
  async function download(profile, job) {
    if (!window.pdfMake) throw new Error("PDF library did not load");
    const { def, used } = await build(profile, job);
    const safe = (job.company || "Company").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "");
    pdfMake.createPdf(def).download(`Mayur_Dokras_CV_${safe}.pdf`);
    return { second: secondTitle(profile, job), summary: summaryKey(job), fontSize: used[0] };
  }

  return { download, doc, secondTitle };
})();
