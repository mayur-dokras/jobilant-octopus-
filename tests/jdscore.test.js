// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert/strict");
const J = require("../assets/jdscore.js");
const { CLERA_JD, CV_BASE, CV_NEST, SUMMARY } = require("./fixtures.js");

const run = (jd, cv, opts = {}) => J.score(jd, cv, Object.assign({ summary: SUMMARY }, opts));
const item = (r, name) => [...r.must, ...r.resp, ...r.nice].flatMap(x => x.items).find(x => x.label === name || x.k === name);

test("1. Clera JD + CV without NestJS and Prisma: 60% or less, both listed as missing must-haves", () => {
  const r = run(CLERA_JD, CV_BASE);
  assert.ok(r.pct <= 60, `score ${r.pct}`);
  assert.ok(r.missingMust.includes("NestJS"), r.missingMust.join());
  assert.ok(r.missingMust.includes("Prisma"), r.missingMust.join());
  assert.match(r.reason, /missing 2 must-haves: NestJS, Prisma/);
});

test("2. Same JD + CV with NestJS and Prisma in an experience bullet: 85% or more", () => {
  const r = run(CLERA_JD, CV_NEST);
  assert.ok(r.pct >= 85, `score ${r.pct} (${r.reason})`);
  assert.equal(item(r, "NestJS").status, "covered");
  assert.equal(item(r, "Prisma").status, "covered");
  assert.deepEqual(r.missingMust, []);
});

test("3. 'Terraform or Pulumi' + CV with Terraform only: requirement fully met", () => {
  const jd = "Requirements\n• Infrastructure with Terraform or Pulumi\n• Production Python";
  const r = run(jd, CV_BASE);
  const req = r.must.find(x => /Terraform or Pulumi/.test(x.text));
  assert.equal(req.items.length, 1, "one item satisfied by either tool");
  assert.equal(req.items[0].label, "Terraform or Pulumi");
  assert.equal(req.status, "covered");
  assert.equal(req.credit, 1);
});

test("4. 'Must be enrolled in a Bachelor's degree' + completed MSc: blocker shown", () => {
  const jd = "Requirements\n• You must be enrolled in a Bachelor's degree in Computer Science\n• Python and SQL";
  const r = run(jd, CV_BASE);
  const b = r.blockers.find(x => x.type === "enrolment");
  assert.ok(b, "enrolment blocker");
  assert.match(b.text, /completed degree \(MSc Software Engineering\)/);
});

test("5. 'BigQuery (currently learning)' + JD requiring BigQuery: 0.25 at most, marked as learning", () => {
  const cv = JSON.parse(JSON.stringify(CV_BASE));
  cv.skill_groups[1].items.push("BigQuery (currently learning)");
  const r = run("Requirements\n• Production experience with BigQuery", cv);
  const x = item(r, "BigQuery");
  assert.equal(x.status, "learning");
  assert.ok(x.credit <= 0.25, `credit ${x.credit}`);
  assert.ok(r.suggestions.some(s => s.item === "BigQuery" && /currently learning/.test(s.text)));
});

test("6. 'Python meetups' in the benefits section does not count toward Python", () => {
  const jd = "Requirements\n• Production experience with Go and Kafka\n\nBenefits\n• Python meetups every month\n• Gym membership";
  const r = run(jd, CV_BASE);
  assert.equal(item(r, "Python"), undefined, "Python is not a requirement");
  assert.ok(!r.covered.includes("Python"));
  assert.ok(!r.trace.some(t => /Python meetups/.test(t.label)));
});

test("7. CV with TypeScript only + JD requiring NestJS: NestJS not covered, TypeScript shown as related", () => {
  const cv = { experience: [{ title: "Engineer", org: "Acme", dates: "Jan 2020 - Jan 2024", bullets: [{ text: "Built TypeScript services for billing." }] }], projects: [], skill_groups: [{ label: "Languages", items: ["TypeScript"] }] };
  const r = run("Requirements\n• Production experience with NestJS", cv);
  const x = item(r, "NestJS");
  assert.equal(x.status, "related");
  assert.equal(x.via, "TypeScript");
  assert.equal(x.credit, 0.3);
  assert.ok(r.missing.includes("NestJS"));
  assert.ok(!r.covered.includes("NestJS"));
  assert.ok(r.related.some(x => x.item === "NestJS" && x.via === "TypeScript"));
});

// ---- extra checks on the rules behind the score

test("AND requirement with one of two tools gets half credit", () => {
  const r = run("Requirements\n• Production experience with PostgreSQL and Prisma", CV_BASE);
  assert.equal(r.must[0].items.length, 2);
  assert.equal(r.must[0].credit, 0.5);
  assert.equal(r.must[0].status, "partial");
});

test("'such as' examples: any one tool meets the requirement", () => {
  const r = run("Requirements\n• Experience with a message broker such as Kafka, RabbitMQ or SQS", { experience: [{ title: "E", org: "A", dates: "Jan 2020 - Jan 2024", bullets: [{ text: "Ran RabbitMQ queues for order events." }] }], projects: [], skill_groups: [] });
  assert.equal(r.must[0].items.length, 1);
  assert.equal(r.must[0].credit, 1);
});

test("Parent never satisfies a framework: Python is not Django, Docker is not Kubernetes, AWS is not CloudFormation", () => {
  const cv = { experience: [{ title: "E", org: "A", dates: "Jan 2020 - Jan 2024", bullets: [{ text: "Python services on AWS in Docker." }] }], projects: [], skill_groups: [] };
  const r = run("Requirements\n• Django\n• Kubernetes\n• CloudFormation\n• Spring Boot", cv);
  ["Django", "Kubernetes", "CloudFormation", "Spring Boot"].forEach(k => assert.notEqual(item(r, k).status, "covered", k));
  assert.equal(item(r, "Spring Boot").status, "missing", "Java not on CV, so not even related");
});

test("Aliases: Postgres = PostgreSQL, k8s = Kubernetes, GH Actions = GitHub Actions", () => {
  const cv = { experience: [{ title: "E", org: "A", dates: "Jan 2020 - Jan 2024", bullets: [{ text: "Ran Postgres on k8s with GH Actions pipelines." }] }], projects: [], skill_groups: [] };
  const r = run("Requirements\n• PostgreSQL\n• Kubernetes\n• GitHub Actions", cv);
  ["PostgreSQL", "Kubernetes", "GitHub Actions"].forEach(k => assert.equal(item(r, k).status, "covered", k));
});

test("Evidence weights: experience 1.0, project 0.8, summary 0.6, skills list 0.5", () => {
  const cv = { experience: [{ title: "E", org: "A", dates: "Jan 2020 - Jan 2024", bullets: [{ text: "Built Kafka consumers." }] }],
    projects: [{ text: "Side project with Redis." }], skill_groups: [{ label: "Tools", items: ["Helm"] }] };
  const r = J.score("Requirements\n• Kafka\n• Redis\n• Ansible\n• Helm", cv, { summary: "Engineer who uses Ansible daily." });
  assert.equal(item(r, "Kafka").credit, 1);
  assert.equal(item(r, "Redis").credit, 0.8);
  assert.equal(item(r, "Ansible").credit, 0.6);
  assert.equal(item(r, "Helm").credit, 0.5);
});

test("One missing must-have caps at 70%", () => {
  const cv = { experience: [{ title: "E", org: "A", dates: "Jan 2018 - Jan 2024", bullets: [{ text: "Python, FastAPI, PostgreSQL and Docker services." }] }], projects: [], skill_groups: [] };
  const r = run("Requirements\n• Python\n• FastAPI\n• PostgreSQL\n• Docker\n• Rust", cv);
  assert.deepEqual(r.missingMust, ["Rust"]);
  assert.ok(r.pct <= 70, `score ${r.pct}`);
});

test("Years: short CV loses points, longer CV gets no bonus", () => {
  const cv = years => ({ experience: [{ title: "E", org: "A", dates: `Jan ${2024 - years} - Jan 2024`, bullets: [{ text: "Python and PostgreSQL services." }] }], projects: [], skill_groups: [] });
  const jd = "Requirements\n• 5+ years of experience with Python and PostgreSQL";
  const short = run(jd, cv(2)), long = run(jd, cv(10)), exact = run(jd, cv(5));
  assert.equal(short.years.have, 2);
  assert.equal(short.years.penalty, 15);
  assert.equal(long.pct, exact.pct);
  assert.ok(short.pct < exact.pct);
  assert.ok(short.warnings.some(w => w.type === "years"));
});

test("Clera blockers: no visa sponsorship and eligibility to work in Germany", () => {
  const r = run(CLERA_JD, CV_BASE);
  assert.ok(r.blockers.some(b => b.type === "sponsorship"));
  assert.ok(r.blockers.some(b => b.type === "location" && /Germany/.test(b.text)));
  assert.ok(r.warnings.some(w => w.type === "location"), "on-site warning");
});

test("Every point is traceable: trace rows add up to the raw score", () => {
  const r = run(CLERA_JD, CV_NEST);
  const reqRows = r.trace.filter(t => /^(Must|Role|Nice) · /.test(t.label));
  const got = reqRows.reduce((n, t) => n + t.pts, 0), max = reqRows.reduce((n, t) => n + t.max, 0);
  assert.ok(Math.abs(100 * got / max - r.raw) < 1, `${100 * got / max} vs ${r.raw}`);
  r.must.forEach(m => m.items.filter(x => x.status === "covered").forEach(x => assert.ok(x.proof, `${x.label} has a CV line`)));
});

test("Score is rounded to the nearest 5 and the reason line starts with it", () => {
  const r = run(CLERA_JD, CV_BASE);
  assert.equal(r.pct % 5, 0);
  assert.ok(r.reason.startsWith(r.pct + "%, "));
});

test("One-line postings from job boards are split into sections", () => {
  const flat = CLERA_JD.replace(/\n+/g, " ");
  const a = run(CLERA_JD, CV_BASE), b = run(flat, CV_BASE);
  assert.deepEqual(b.missingMust, a.missingMust);
  assert.equal(b.pct, a.pct);
});

test("relevantText keeps requirements and blockers, drops the company and benefits", () => {
  const t = J.relevantText(CLERA_JD);
  assert.match(t, /Prisma/); assert.match(t, /sponsorship is not available/);
  assert.doesNotMatch(t, /Python meetups/); assert.doesNotMatch(t, /pre-seed team/);
  assert.equal(run(t, CV_BASE).pct, run(CLERA_JD, CV_BASE).pct);
});

test("CV quality checks: changed facts, left-out items, unconfirmed tools, length", () => {
  const cv = JSON.parse(JSON.stringify(CV_BASE));
  cv.education[0].dates = "Sep 2024 - Sep 2026";
  cv.projects = cv.projects.slice(0, 1);
  cv.certifications = [];
  cv.skill_groups.push({ label: "Monitoring", items: ["Datadog"] });
  const q = J.quality(cv, CV_BASE, { pages: 2, maxPages: 1, summary: SUMMARY });
  const has = (type, rx) => q.some(x => x.type === type && rx.test(x.text));
  assert.ok(has("facts", /Degree dates differ/));
  assert.ok(has("missing", /Project left out: SotonBuddy/));
  assert.ok(has("missing", /Certification left out/));
  assert.ok(has("unconfirmed", /Datadog/));
  assert.ok(has("length", /2 pages/));
  assert.ok(!has("unconfirmed", /PostgreSQL/), "PostgreSQL is backed by a bullet");
});
