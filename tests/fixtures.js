// Shared test data: the Clera Backend Engineer posting (from the live listing and the requirements
// Mayur described) and two versions of a CV in the site's profile shape.
const CLERA_JD = `Backend Engineer
Clera · Berlin, Germany (on-site)

About Clera
Clera is building AI-native operations infrastructure for private markets. We are a pre-seed team backed by leading investors.

What you'll do
• Own backend systems for fund accounting, reporting, reconciliation and treasury automation
• Build permissions, auditability and observability into the core platform
• Design hosted and self-hosted deployments with infrastructure as code
• Work closely with product to ship features end to end
• Drive AI-native development practices across the team

Requirements
• 1-6 years of backend engineering experience
• Production experience with TypeScript and NestJS
• Production experience with PostgreSQL and Prisma
• Infrastructure as code with Terraform or Pulumi
• A strong focus on reliability, security, observability and auditability
• Experience building with AI or LLMs
• Comfortable in a small, fast-moving team
• Eligibility to work in Germany; visa sponsorship is not available

Nice to have
• Experience with Inngest or Mastra
• React and Tailwind
• Knowledge of fund accounting or private markets

What we offer
• €70,000 - €110,000 and early-stage equity
• Python meetups, a learning budget and a Kubernetes study group
• Equal opportunity employer`;

// CV 1: TypeScript, PostgreSQL, Terraform and a lot of AI; no NestJS, no Prisma.
const CV_BASE = {
  name: "Test Candidate",
  experience: [
    { title: "Backend Engineer", org: "Malvox, Southampton, UK", dates: "Jan 2025 - Sep 2025", bullets: [
      { text: "Designed the PostgreSQL data model and REST integrations in TypeScript and Python for 3 UK Government data services." },
      { text: "Secured sensitive data with OAuth2, JWT, TLS and AES-256 encryption, with audit logs on every change." },
      { text: "Deployed services on AWS with Docker and Terraform, with Prometheus and Grafana monitoring." } ] },
    { title: "Software Engineer", org: "Capgemini Engineering, Pune, India", dates: "Nov 2021 - Nov 2024", bullets: [
      { text: "Owned resolution of 40+ production defects in Python and C++ on Linux, cutting MTTR by 25%." },
      { text: "Built 5 Python automation tools that cut manual investigation time by around 80%." } ] },
  ],
  projects: [
    { text: "AI engineering platform. Marks code submissions with LLMs, RAG, LangChain and the OpenAI API, with tool-calling agents." },
    { text: "SotonBuddy. Campus chatbot fine-tuned from Llama with LoRA in PyTorch." },
  ],
  skill_groups: [
    { label: "Languages", items: ["Python", "TypeScript", "SQL"] },
    { label: "Data", items: ["PostgreSQL", "Redis"] },
    { label: "Platform", items: ["Docker", "Kubernetes", "Terraform", "AWS", "GitHub Actions"] },
    { label: "AI", items: ["LLMs", "RAG", "LangChain"] },
  ],
  education: [{ degree: "MSc Software Engineering", org: "University of Southampton, UK", dates: "Sep 2024 - Sep 2025" }],
  certifications: ["AWS Certified Cloud Practitioner"],
};
const SUMMARY = "Backend Software Engineer with 4+ years building production Python and TypeScript services, PostgreSQL data models and LLM applications.";

// CV 2: the same CV with NestJS and Prisma shown in an experience bullet.
const CV_NEST = JSON.parse(JSON.stringify(CV_BASE));
CV_NEST.experience[0].bullets.unshift({ text: "Built NestJS services in TypeScript with Prisma on PostgreSQL for the case-management API." });
CV_NEST.skill_groups[0].items.push("NestJS"); CV_NEST.skill_groups[1].items.push("Prisma");

module.exports = { CLERA_JD, CV_BASE, CV_NEST, SUMMARY };
