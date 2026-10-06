/* Skills match in the browser, for roles you add by hand. Uses the same
   term list as the daily feed (data/terms.json, written by scoring.py). */
window.Match = (function () {
  let compiled = null, have = new Set();
  async function load() {
    if (compiled) return;
    try {
      const r = await fetch("data/terms.json", { cache: "no-cache" });
      const d = await r.json();
      compiled = Object.entries(d.terms).map(([k, v]) => [k, new RegExp(v, "i")]);
      have = new Set(d.have);
    } catch (e) { compiled = []; }
  }
  function score(title, text, yearsHave = 4) {
    const all = `${title} ${text}`;
    const found = (compiled || []).filter(([, rx]) => rx.test(all)).map(([k]) => k);
    const matched = found.filter(k => have.has(k)), missing = found.filter(k => !have.has(k));
    let pct = found.length < 3 ? 60 : Math.round(100 * matched.length / found.length);
    let flag = found.length < 3 ? "JD thin: match estimated" : "";
    if (found.length >= 3 && found.length < 5) { pct = Math.min(pct, 75); flag = "Short JD: match capped at 75%"; }
    const yrs = [...(text || "").matchAll(/(\d{1,2})\s*\+?\s*(?:-\s*\d{1,2}\s*)?(?:years|yrs)/gi)].map(m => +m[1]).filter(n => n > 0 && n <= 15);
    if (yrs.length && Math.max(...yrs) > yearsHave) {
      const need = Math.max(...yrs);
      pct -= Math.min(15, 5 * (need - yearsHave));
      flag = (flag ? flag + "; " : "") + `Stretch: asks ${need}+ yrs`;
    }
    return { match: Math.max(0, Math.min(98, pct)), matched: matched.slice(0, 12), missing: missing.slice(0, 8), flag };
  }
  function kind(title) {
    const t = (title || "").toLowerCase();
    if (/ml ?ops|ml platform|ml infra|platform|infrastructure|site reliability|\bsre\b|devops|developer experience/.test(t)) return "MLOps";
    if (/machine learning|\bml\b|\bai\b|applied ai|llm|genai|gen ai/.test(t)) return "AI";
    return "Backend";
  }
  return { load, score, kind };
})();
