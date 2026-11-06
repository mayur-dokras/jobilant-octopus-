// Daily step after fetch_jobs.py: re-score every role with the same engine the site uses
// (assets/jdscore.js), against the CV the site would build for that role.
//   node scripts/rescore.js
// Reads data/jobs.json, data/profile.json and data/_jd_full.json (full posting text written by
// fetch_jobs.py), updates match / matched / missing / flag / fit / description, and deletes _jd_full.json.
// If anything goes wrong it leaves the fetch_jobs.py scores in place.
const fs = require("fs");
const path = require("path");
const DATA = path.join(__dirname, "..", "data");
const read = f => JSON.parse(fs.readFileSync(path.join(DATA, f), "utf8"));
const fullPath = path.join(DATA, "_jd_full.json");

function main() {
  if (!fs.existsSync(path.join(DATA, "jobs.json")) || !fs.existsSync(path.join(DATA, "profile.json"))) {
    console.log("rescore: jobs.json or profile.json not found (is the vault open?), skipping");
    return;
  }
  const JD = require("../assets/jdscore.js");
  // cv.js is written for the browser; it only needs a window object to load
  global.window = global;
  require("../assets/cv.js");
  const CV = global.CV;
  const doc = read("jobs.json"), profile = CV.upgrade(read("profile.json"));
  const full = fs.existsSync(fullPath) ? read("_jd_full.json") : {};
  let n = 0, changed = 0;
  doc.jobs.forEach(j => {
    const text = full[j.id] || j.description;
    if (!text || text.length < 80 || j.closed) return;
    let summary = "";
    try { summary = String(CV.composeSummary(profile, j) || "").replace(/\*\*/g, ""); } catch (e) { /* summary is optional evidence */ }
    const r = JD.score(text, profile, { summary, visa: j.visa });
    if (r.pct !== j.match) changed++;
    j.match = r.pct;
    j.matched = r.covered.slice(0, 12);
    j.missing = r.missing.slice(0, 8);
    j.flag = r.reason.replace(/^\d+%, /, "");
    j.fit = { reason: r.reason, missingMust: r.missingMust, blockers: r.blockers.map(b => b.text), related: r.related.map(x => `${x.item} (via ${x.via})`) };
    if (full[j.id]) j.description = JD.relevantText(full[j.id]);
    n++;
  });
  doc.jobs.sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0) || b.match - a.match || b.visa - a.visa);
  doc.scored_by = "jdscore";
  fs.writeFileSync(path.join(DATA, "jobs.json"), JSON.stringify(doc, null, 1));
  console.log(`rescore: ${n} roles scored with the JD engine, ${changed} scores changed`);
}

try { main(); } catch (e) { console.log("rescore: failed, keeping the fetch_jobs.py scores:", e.message); }
finally { try { fs.unlinkSync(fullPath); } catch (e) { /* already gone */ } }
