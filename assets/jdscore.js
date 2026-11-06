/* Job Octo · JD scoring engine.
   Scores a CV against a job description the way a recruiter or ATS would read it:
   - the JD is split into sections: must-have x3, responsibilities x1.5, nice-to-have x1, company/benefits ignored
   - each bullet is one requirement; "A and B" needs both, "A or B" and "such as A, B" need one
   - named tools stay distinct (TypeScript does not count as NestJS); a related tool earns 0.3 and is labelled so
   - CV evidence is weighted by where it appears: experience 1.0, project 0.8, summary 0.6, skills list 0.5,
     and a skill marked "(currently learning)" or "(basic)" counts 0.25 at most
   - a missing must-have caps the score at 70%, two or more at 60%; short years cost points; eligibility rules are blockers
   Every point is traceable: report.trace lists each requirement, its weight, its credit and the CV line behind it.
   Works in the browser (window.JDScore) and in Node (require), so the daily run and the site agree. */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.JDScore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ------------------------------------------------------------ vocabulary ---
  // [canonical name, pattern, type]; type "tech" = a named tool, language or framework, "concept" = a practice or area.
  // Patterns are case-insensitive unless they start with "(?-i)" (then case-sensitive, for words like Go or Express).
  const VOCAB = [
    // languages
    ["Python", "\\bpython\\b", "tech"], ["Java", "\\bjava\\b(?!\\s*script)", "tech"], ["JavaScript", "\\bjavascript\\b|\\becmascript\\b", "tech"],
    ["TypeScript", "\\btypescript\\b", "tech"], ["Go", "(?-i)\\bGolang\\b|\\bGo\\b(?=\\s*(?:,|/|\\)|and\\b|or\\b|\\(|developer|engineer|services|microservices|programming|code|experience))|\\(Go\\)", "tech"],
    ["Rust", "\\brust\\b", "tech"], ["Scala", "\\bscala\\b", "tech"], ["Kotlin", "\\bkotlin\\b", "tech"], ["C#", "\\bc#|\\.net\\b", "tech"],
    ["C++", "\\bc\\+\\+", "tech"], ["Ruby", "\\bruby\\b", "tech"], ["PHP", "\\bphp\\b", "tech"], ["Bash", "\\bbash\\b|shell script", "tech"], ["SQL", "\\bsql\\b", "tech"],
    // frameworks
    ["NestJS", "\\bnest\\.?js\\b|\\bnestjs\\b", "tech"], ["Express", "(?-i)\\b[Ee]xpress\\.?js\\b|\\bExpressJS\\b|\\bExpress\\b(?!\\s+(?:interest|your|yourself|ideas))", "tech"], ["Node.js", "\\bnode\\.?js\\b|\\bnodejs\\b", "tech"],
    ["Fastify", "\\bfastify\\b", "tech"], ["Next.js", "\\bnext\\.?js\\b", "tech"], ["React", "\\breact\\b(?!\\s*native)", "tech"], ["React Native", "\\breact native\\b", "tech"],
    ["Vue", "\\bvue(\\.?js)?\\b", "tech"], ["Angular", "\\bangular\\b", "tech"], ["Tailwind", "\\btailwind\\b", "tech"],
    ["Django", "\\bdjango\\b", "tech"], ["Flask", "\\bflask\\b", "tech"], ["FastAPI", "\\bfast ?api\\b", "tech"], ["Spring Boot", "\\bspring ?boot\\b", "tech"],
    ["Spring", "\\bspring\\b(?!\\s*boot)(?=\\s*(?:,|/|\\)|and\\b|or\\b|framework|mvc|cloud|data|security))", "tech"], ["Rails", "\\bruby on rails\\b|\\brails\\b", "tech"],
    ["GraphQL", "\\bgraphql\\b", "tech"], ["gRPC", "\\bgrpc\\b", "tech"], ["REST APIs", "\\brest(ful)?\\b(?!\\s+of\\b)(?!\\s+assured)", "tech"],
    // data stores and ORMs
    ["PostgreSQL", "\\bpostgres(ql)?\\b|\\bpsql\\b", "tech"], ["MySQL", "\\bmysql\\b|\\bmariadb\\b", "tech"], ["MongoDB", "\\bmongo(db)?\\b", "tech"],
    ["Redis", "\\bredis\\b|\\bvalkey\\b", "tech"], ["SQLite", "\\bsqlite\\b", "tech"], ["DynamoDB", "\\bdynamo ?db\\b", "tech"], ["Cassandra", "\\bcassandra\\b", "tech"],
    ["Elasticsearch", "\\belastic ?search\\b|\\bopensearch\\b", "tech"], ["ClickHouse", "\\bclickhouse\\b", "tech"], ["Snowflake", "\\bsnowflake\\b", "tech"],
    ["BigQuery", "\\bbig ?query\\b", "tech"], ["Redshift", "\\bredshift\\b", "tech"], ["Databricks", "\\bdatabricks\\b", "tech"], ["dbt", "\\bdbt\\b", "tech"],
    ["Prisma", "\\bprisma\\b", "tech"], ["TypeORM", "\\btypeorm\\b", "tech"], ["Sequelize", "\\bsequelize\\b", "tech"], ["Drizzle", "\\bdrizzle\\b", "tech"],
    ["SQLAlchemy", "\\bsqlalchemy\\b", "tech"], ["Supabase", "\\bsupabase\\b", "tech"], ["Firebase", "\\bfirebase\\b", "tech"],
    // messaging and workflows
    ["Kafka", "\\bkafka\\b", "tech"], ["RabbitMQ", "\\brabbit ?mq\\b", "tech"], ["SQS", "\\bsqs\\b", "tech"], ["Kinesis", "\\bkinesis\\b", "tech"], ["Pub/Sub", "\\bpub ?/ ?sub\\b", "tech"],
    ["Celery", "\\bcelery\\b", "tech"], ["Inngest", "\\binngest\\b", "tech"], ["Temporal", "(?-i)\\bTemporal\\b(?!\\s+(?:data|pattern))", "tech"], ["Airflow", "\\bairflow\\b", "tech"],
    // cloud and infrastructure
    ["AWS", "\\baws\\b|amazon web services", "tech"], ["GCP", "\\bgcp\\b|google cloud", "tech"], ["Azure", "\\bazure\\b", "tech"],
    ["Docker", "\\bdocker\\b", "tech"], ["Kubernetes", "\\bkubernetes\\b|\\bk8s\\b|\\beks\\b|\\bgke\\b|\\baks\\b", "tech"], ["Helm", "\\bhelm\\b", "tech"],
    ["Terraform", "\\bterraform\\b", "tech"], ["Pulumi", "\\bpulumi\\b", "tech"], ["CloudFormation", "\\bcloud ?formation\\b", "tech"], ["AWS CDK", "\\b(aws )?cdk\\b", "tech"],
    ["Ansible", "\\bansible\\b", "tech"], ["ArgoCD", "\\bargo ?cd\\b", "tech"], ["Jenkins", "\\bjenkins\\b", "tech"],
    ["GitHub Actions", "\\bgithub actions\\b|\\bgh actions\\b", "tech"], ["GitLab CI", "\\bgitlab( ci)?\\b", "tech"], ["CircleCI", "\\bcircle ?ci\\b", "tech"],
    ["CI/CD", "\\bci ?/ ?cd\\b|continuous (integration|delivery|deployment)", "tech"], ["Linux", "\\blinux\\b", "tech"], ["Git", "\\bgit\\b", "tech"],
    // observability tools
    ["Prometheus", "\\bprometheus\\b", "tech"], ["Grafana", "\\bgrafana\\b", "tech"], ["Datadog", "\\bdata ?dog\\b", "tech"],
    ["OpenTelemetry", "\\bopen ?telemetry\\b|\\botel\\b", "tech"], ["ELK", "\\belk\\b|\\bkibana\\b|\\blogstash\\b", "tech"], ["Sentry", "\\bsentry\\b", "tech"],
    ["New Relic", "\\bnew ?relic\\b", "tech"], ["Splunk", "\\bsplunk\\b", "tech"],
    // ML and AI tools
    ["PyTorch", "\\bpytorch\\b|\\btorch\\b", "tech"], ["TensorFlow", "\\btensorflow\\b", "tech"], ["JAX", "\\bjax\\b", "tech"], ["scikit-learn", "\\bscikit|\\bsklearn\\b", "tech"],
    ["pandas", "\\bpandas\\b", "tech"], ["NumPy", "\\bnumpy\\b", "tech"], ["Spark", "\\bspark\\b|\\bpyspark\\b", "tech"], ["MLflow", "\\bmlflow\\b", "tech"],
    ["Kubeflow", "\\bkubeflow\\b", "tech"], ["SageMaker", "\\bsagemaker\\b", "tech"], ["Vertex AI", "\\bvertex ai\\b", "tech"], ["DVC", "\\bdvc\\b", "tech"],
    ["Hugging Face", "\\bhugging ?face\\b", "tech"], ["LangChain", "\\blangchain\\b", "tech"], ["LangGraph", "\\blanggraph\\b", "tech"], ["LlamaIndex", "\\bllama ?index\\b", "tech"],
    ["OpenAI API", "\\bopenai\\b", "tech"], ["Mastra", "\\bmastra\\b", "tech"], ["LoRA", "\\blora\\b|\\bqlora\\b|\\bpeft\\b", "tech"],
    ["Pinecone", "\\bpinecone\\b", "tech"], ["pgvector", "\\bpgvector\\b", "tech"],
    // testing and security tools
    ["Pytest", "\\bpytest\\b", "tech"], ["Jest", "\\bjest\\b", "tech"], ["Playwright", "\\bplaywright\\b", "tech"], ["Cypress", "\\bcypress\\b", "tech"], ["Selenium", "\\bselenium\\b", "tech"],
    ["OAuth2", "\\boauth ?2?\\b", "tech"], ["JWT", "\\bjwt\\b", "tech"],
    // concepts
    ["LLMs", "\\bllms?\\b|large language models?|\\bgpt-?\\d|\\bgen ?ai\\b|generative ai", "concept"],
    ["AI", "\\bai\\b(?![- ](generated|written))|artificial intelligence|machine learning|\\bml\\b", "concept"],
    ["RAG", "\\brag\\b|retrieval[- ]augmented", "concept"], ["AI Agents", "\\bagentic\\b|\\bai agents?\\b|multi-agent|tool[- ]calling|function[- ]calling", "concept"],
    ["Fine-Tuning", "\\bfine[- ]?tun", "concept"], ["Prompt Engineering", "prompt engineering", "concept"], ["Vector Databases", "vector (db|databases?|stores?|search)", "concept"],
    ["Microservices", "\\bmicro-?services?\\b", "concept"], ["Distributed Systems", "\\bdistributed systems?\\b", "concept"],
    ["APIs", "\\bapis?\\b|api design", "concept"], ["Observability", "\\bobservability\\b|\\bmonitoring\\b|\\btracing\\b|\\balerting\\b", "concept"],
    ["Reliability", "\\breliab\\w*|\\buptime\\b|\\bon-?call\\b|\\bincidents?\\b|\\bmttr\\b|\\bslos?\\b|\\bresilien\\w*|fault[- ]toleran\\w*", "concept"],
    ["Security", "\\bsecurity\\b|\\bsecur(e|ed|ing)\\b|\\bencrypt\\w*|\\bvulnerab\\w*", "concept"], ["Auditability", "\\baudit\\w*", "concept"],
    ["Infrastructure as Code", "infrastructure[- ]as[- ]code|\\biac\\b", "concept"], ["Containers", "\\bcontaineri[sz]\\w*|\\bcontainers?\\b", "concept"],
    ["Cloud", "\\bcloud\\b(?![- ]?(formation|native computing))", "concept"], ["Testing", "\\bunit tests?\\b|\\bintegration tests?\\b|\\btest automation\\b|\\btdd\\b|\\bautomated tests?\\b|\\btesting\\b", "concept"],
    ["Data Pipelines", "\\betl\\b|\\belt\\b|data pipelines?", "concept"], ["System Design", "\\bsystem design\\b|\\bsystems? architecture\\b", "concept"],
    ["Scalability", "\\bscalab\\w*|high[- ]traffic|\\bat scale\\b", "concept"],
  ];
  const TYPE = {}, RX = VOCAB.map(([k, src, type]) => {
    TYPE[k] = type;
    const cs = src.startsWith("(?-i)");
    return [k, new RegExp(cs ? src.slice(5) : src, cs ? "g" : "gi")];
  });
  const isTech = k => TYPE[k] === "tech";

  // Child -> what it proves too (NestJS work is TypeScript work). Never the other way round.
  const IMPLIES = {
    "NestJS": ["TypeScript", "Node.js"], "Express": ["Node.js"], "Fastify": ["Node.js"], "Next.js": ["React"], "React Native": ["React"],
    "Django": ["Python"], "Flask": ["Python"], "FastAPI": ["Python", "APIs"], "Pytest": ["Python", "Testing"], "SQLAlchemy": ["Python"], "pandas": ["Python"],
    "Spring Boot": ["Java", "Spring"], "Prisma": ["SQL"], "PostgreSQL": ["SQL"], "MySQL": ["SQL"],
    "Terraform": ["Infrastructure as Code"], "Pulumi": ["Infrastructure as Code"], "CloudFormation": ["Infrastructure as Code", "AWS"], "AWS CDK": ["Infrastructure as Code", "AWS"],
    "Docker": ["Containers"], "Kubernetes": ["Containers"], "Helm": ["Kubernetes"], "AWS": ["Cloud"], "GCP": ["Cloud"], "Azure": ["Cloud"],
    "Prometheus": ["Observability"], "Grafana": ["Observability"], "Datadog": ["Observability"], "OpenTelemetry": ["Observability"], "ELK": ["Observability"],
    "Sentry": ["Observability"], "New Relic": ["Observability"], "Splunk": ["Observability"],
    "LangChain": ["LLMs"], "LangGraph": ["LLMs", "AI Agents"], "LlamaIndex": ["LLMs"], "OpenAI API": ["LLMs"], "Mastra": ["LLMs", "AI Agents"], "RAG": ["LLMs"],
    "AI Agents": ["LLMs"], "Fine-Tuning": ["AI"], "LoRA": ["Fine-Tuning", "AI"], "LLMs": ["AI"], "PyTorch": ["AI"], "TensorFlow": ["AI"], "scikit-learn": ["AI"],
    "Hugging Face": ["AI"], "Pinecone": ["Vector Databases"], "pgvector": ["Vector Databases", "PostgreSQL"],
    "Jest": ["Testing"], "Playwright": ["Testing"], "Cypress": ["Testing"], "Selenium": ["Testing"], "OAuth2": ["Security"], "JWT": ["Security"],
    "REST APIs": ["APIs"], "GraphQL": ["APIs"], "gRPC": ["APIs"], "GitHub Actions": ["CI/CD"], "Jenkins": ["CI/CD"], "GitLab CI": ["CI/CD"], "CircleCI": ["CI/CD"], "ArgoCD": ["CI/CD"],
    "Airflow": ["Data Pipelines"], "Kafka": ["Distributed Systems"],
  };
  // Related but not equal: earns 0.3 and is shown as "related experience".
  const RELATED = {
    "NestJS": ["Express", "Node.js", "Fastify", "TypeScript"], "Express": ["NestJS", "Fastify", "Node.js"], "Fastify": ["Express", "NestJS"],
    "Node.js": ["TypeScript", "JavaScript"], "TypeScript": ["JavaScript"], "JavaScript": ["TypeScript"], "Next.js": ["React"], "React": ["Vue", "Angular", "Next.js"],
    "Prisma": ["TypeORM", "Sequelize", "Drizzle", "SQLAlchemy"], "TypeORM": ["Prisma", "Sequelize"], "Sequelize": ["Prisma", "TypeORM"], "Drizzle": ["Prisma"], "SQLAlchemy": ["Prisma", "Django"],
    "Django": ["Flask", "FastAPI"], "Flask": ["FastAPI", "Django"], "FastAPI": ["Flask", "Django"], "Spring Boot": ["Spring", "Java"],
    "PostgreSQL": ["MySQL"], "MySQL": ["PostgreSQL"], "MongoDB": ["DynamoDB"], "DynamoDB": ["MongoDB"],
    "BigQuery": ["Snowflake", "Redshift"], "Snowflake": ["BigQuery", "Redshift", "Databricks"], "Redshift": ["Snowflake", "BigQuery"], "Databricks": ["Spark", "Snowflake"], "Spark": ["Databricks"],
    "Kafka": ["RabbitMQ", "Kinesis", "Pub/Sub", "SQS"], "RabbitMQ": ["Kafka", "SQS"], "SQS": ["RabbitMQ", "Kafka"], "Kinesis": ["Kafka"], "Pub/Sub": ["Kafka"],
    "Inngest": ["Temporal", "Celery", "Airflow"], "Temporal": ["Inngest", "Celery", "Airflow"], "Celery": ["RabbitMQ", "Redis"],
    "AWS": ["GCP", "Azure"], "GCP": ["AWS", "Azure"], "Azure": ["AWS", "GCP"],
    "Kubernetes": ["Docker", "Helm"], "Docker": ["Kubernetes"], "Helm": ["Kubernetes"],
    "Terraform": ["Pulumi", "CloudFormation", "AWS CDK"], "Pulumi": ["Terraform", "AWS CDK"], "CloudFormation": ["Terraform", "AWS CDK"], "AWS CDK": ["CloudFormation", "Terraform"],
    "GitHub Actions": ["Jenkins", "GitLab CI", "CircleCI"], "Jenkins": ["GitHub Actions", "GitLab CI"], "GitLab CI": ["GitHub Actions", "Jenkins"], "ArgoCD": ["Helm", "GitHub Actions"],
    "Datadog": ["Prometheus", "Grafana", "New Relic"], "Prometheus": ["Grafana", "Datadog"], "Grafana": ["Prometheus", "Datadog"], "OpenTelemetry": ["Prometheus", "Datadog"], "New Relic": ["Datadog"],
    "PyTorch": ["TensorFlow", "JAX"], "TensorFlow": ["PyTorch"], "JAX": ["PyTorch"], "LangGraph": ["LangChain"], "LangChain": ["LlamaIndex", "LangGraph"], "LlamaIndex": ["LangChain"],
    "Mastra": ["LangChain", "LangGraph"], "Kubeflow": ["MLflow", "Airflow"], "MLflow": ["Kubeflow"], "SageMaker": ["MLflow", "Vertex AI"], "Vertex AI": ["SageMaker"],
    "Jest": ["Pytest"], "Pytest": ["Jest"], "Playwright": ["Cypress", "Selenium"], "Cypress": ["Playwright", "Selenium"], "Selenium": ["Playwright"],
    "Go": ["Rust"], "Kotlin": ["Java"], "Scala": ["Java"],
  };

  const W = { must: 3, resp: 1.5, nice: 1, about: 0 };
  const WHERE = { experience: 1.0, project: 0.8, summary: 0.6, skills: 0.5, other: 0.5 };
  const LEARNING = 0.25, RELATED_CREDIT = 0.3;
  const round5 = n => Math.max(0, Math.min(100, Math.round(n / 5) * 5));

  // --------------------------------------------------------------- headings ---
  const HEAD = [
    ["about", /^(about (us|the company|the team|our company|[A-Z][\w&.-]*( [A-Z][\w&.-]*)?)$|who we are|our (mission|story|values|culture|company)|the company|company description|what we offer|we offer|what('s| is) in it for you|benefits|perks|why (join|work)|compensation|salary|pay( range)?|equal (employment )?opportunit|eeo|diversity|accommodation|how to apply|(our |the )?(interview|hiring|recruitment|application) process|life at|working at|location|privacy|disclaimer)/i],
    ["nice", /^(nice[- ]to[- ]haves?|preferred( qualifications| skills| experience)?|bonus( points)?|(it'?s |would be )?a plus|pluses|good to have|desirable|extra credit|ideally|even better|brownie points)/i],
    ["must", /^(requirements?|minimum (qualifications|requirements)|basic qualifications|required (skills|qualifications|experience)|qualifications|what we('re| are) looking for|what you('ll| will)? (need|bring)|you (have|bring|should have|will need)|must[- ]haves?|mandatory|about you|who you are|your (profile|background|experience|skills)|skills( (and|&) experience)?|key skills|essential( skills)?|we('d| would) love|what we need)/i],
    ["resp", /^(responsibilities|key responsibilities|what you('ll| will) (do|work on|own|build|achieve)|your (role|day|daily|daily pitch|mission|responsibilities|impact|tasks)|the role|about the role|role overview|in this role|day[- ]to[- ]day|the job|the opportunity|tech stack|our (tech )?stack|stack|how you('ll| will) contribute)/i],
  ];
  const MUST_WORDS = /\b(must|required|requirement|essential|mandatory|you have|you bring|proven|strong|solid|hands-on|production experience|proficien\w*|expert\w*|experience (with|in))\b/i;
  const NICE_WORDS = /\b(nice[- ]to[- ]have|a plus|is a plus|bonus|preferred|advantage\w*|ideally|desirable|good to have|not required|would be great)\b/i;
  const ABOUT_WORDS = /\b(we are|we're|our (mission|team|customers|investors|story)|founded|backed by|raised|series [a-e]\b|seed round|pre-seed|headquarter\w*|we offer|benefits?|perks|holiday|vacation|pension|equity|stock options|salary|compensation|equal opportunit\w*|regardless of|meetups?|gym|lunch|offsite|hybrid working)\b/i;
  const YEARS_RX = /(\d{1,2})\s*\+?\s*(?:(?:-|–|—|to)\s*(\d{1,2})\s*)?\+?\s*(?:years|yrs)\b/gi;

  function headingOf(line) {
    const t = line.replace(/^[#*\s•\-–]+|[*:\s]+$/g, "").trim();
    if (!t || t.length > 70) return null;
    for (const [kind, rx] of HEAD) if (rx.test(t)) return kind;
    if (/:\s*$/.test(line) && t.length <= 70) {
      if (NICE_WORDS.test(t)) return "nice";
      if (/\b(benefit|offer|perk|about us|company)\b/i.test(t)) return "about";
      if (/\b(require|looking for|qualif|need|must)\b/i.test(t)) return "must";
      if (/\b(do|responsib|role|work on)\b/i.test(t)) return "resp";
    }
    return null;
  }

  // Postings from job boards often arrive as one long line; put bullets and inline headings on their own lines.
  function normalise(text) {
    let t = String(text || "").replace(/\r/g, "").replace(/[\u00a0\u202f]/g, " ");
    t = t.replace(/\s*[•▪◦●■►✓✔]\s*/g, "\n• ");
    const heads = /(Requirements|Minimum Qualifications|Basic Qualifications|Qualifications|Responsibilities|Key Responsibilities|What you(?:'ll| will) do|What we(?:'re| are) looking for|What you(?:'ll| will) bring|You (?:have|bring)|About you|Who you are|Nice to have|Nice-to-have|Preferred(?: qualifications)?|Bonus points|Benefits|What we offer|About us|About the role|The role|Tech stack|Our stack|Skills)\s*:/g;
    t = t.replace(heads, "\n$1:\n");
    // "...across the team Requirements" followed by bullets: the heading ends the line
    const tail = /^(.*\S)\s+(What you(?:'ll| will) do|What you(?:'ll| will) bring|What we(?:'re| are) looking for|What we offer|Requirements|Responsibilities|Key Responsibilities|Qualifications|Minimum Qualifications|Basic Qualifications|About you|Who you are|Nice to have|Nice-to-have|Bonus points|Preferred qualifications|Benefits|Perks|About us|About the role|The role|Tech stack|Our stack)$/;
    return t.split("\n").map(x => x.trim()).filter(Boolean).flatMap(l => { const m = l.match(tail); return m ? [m[1], m[2]] : [l]; });
  }

  function mentions(text, opts = {}) {
    const out = [];
    for (const [k, rx] of RX) {
      rx.lastIndex = 0;
      let m;
      while ((m = rx.exec(text))) { out.push({ k, s: m.index, e: m.index + m[0].length }); if (!m[0].length) rx.lastIndex++; }
    }
    // longest match wins where two overlap (e.g. "React Native" over "React", "AWS CDK" over "AWS")
    out.sort((a, b) => a.s - b.s || (b.e - b.s) - (a.e - a.s));
    const kept = [];
    for (const m of out) if (!kept.some(x => m.s < x.e && m.e > x.s)) kept.push(m);
    if (opts.dedupe === false) return kept;
    const seen = new Set();
    return kept.filter(m => !seen.has(m.k) && seen.add(m.k));
  }

  // One JD line -> items. "A and B" -> two items; "A or B", "A/B", "such as A, B", "(A, B)" -> one item satisfied by any.
  function itemsOf(line) {
    const ms = mentions(line);
    if (!ms.length) return [];
    const chains = [];
    let cur = null;
    ms.forEach((m, i) => {
      const gap = i ? line.slice(ms[i - 1].e, m.s) : "";
      const joins = i && /^[\s,;]*(?:(and\/or|and|or|&|\/|plus|as well as|\|)\s*)?[\s,]*$/i.test(gap);
      if (cur && joins) { cur.ms.push(m); const w = (gap.match(/and\/or|and|or|&|\/|plus|as well as|\|/i) || [""])[0].toLowerCase(); if (w) cur.joins.add(w); }
      else { cur = { ms: [m], joins: new Set(), before: line.slice(i ? ms[i - 1].e : 0, m.s) }; chains.push(cur); }
    });
    const items = [];
    chains.forEach(c => {
      const ex = /(such as|e\.?\s?g\.?|for example|for instance|like|including|incl\.?|e\.g\.,?)\s*[:(]?\s*$/i.test(c.before);
      const inParen = /\(\s*$/.test(c.before);
      const anyJoin = (c.joins.has("or") || c.joins.has("/") || c.joins.has("and/or") || c.joins.has("|")) && !c.joins.has("and") && !c.joins.has("&") && !c.joins.has("plus");
      if (c.ms.length > 1 && (ex || inParen || anyJoin)) items.push({ any: c.ms.map(m => m.k), example: ex || inParen });
      else c.ms.forEach(m => items.push({ any: [m.k], example: false }));
    });
    // a concept named next to its own tool ("observability tooling (Prometheus, Grafana)") is one requirement, not two
    return items;
  }

  // -------------------------------------------------------------- blockers ---
  const LANG = "german|french|dutch|swedish|spanish|italian|polish|turkish|japanese|mandarin|portuguese|danish|norwegian|finnish|czech|hebrew|arabic|korean";
  const BLOCKERS = [
    ["enrolment", /\b(must|should|need to|needs to) be (currently )?(enrolled|studying|a student)|\bcurrently (enrolled|studying|pursuing)\b|\b(enrolled|matriculated) (in|at) (a|an) [^.\n]{0,40}(degree|university|programme|program)|\bworking student\b|\bwerkstudent\b|\bfinal[- ]year (student|undergraduate)/i,
      (m, cv) => `Requires current enrolment in a degree${cv.degreesDone ? `. Your CV shows a completed degree (${cv.degreesDone}), so this role is not open to you` : ""}.`],
    ["phd", /\bph\.?\s?d\b[^.\n]{0,50}\b(required|essential|mandatory|is a must|needed)\b|\b(required|must have|must hold|need)\b[^.\n]{0,30}\bph\.?\s?d\b/i, () => "A PhD is required."],
    ["publications", /\bpublications?\b[^.\n]{0,60}\b(neurips|icml|iclr|cvpr|acl|emnlp|top[- ]tier|peer[- ]reviewed)\b|\bfirst[- ]author\b/i, () => "Publications at top research venues are expected."],
    ["location", /\b(must|need to|needs to|required to|should)\s+(already\s+)?(be\s+)?(live|living|reside|residing|based|located)\s+(in|within)\s+([\w .-]{1,30})|\b(eligib\w*|authori[sz]ed|permission|right) to work in (?:the )?([\w .-]{1,30})|\b(eu|us|uk|german|british|american) (citizen|citizenship|passport)s? (is |are )?(required|only)/i,
      m => `Location or work permit: ${m[0].replace(/\s+/g, " ").replace(/[;,.]\s*$/, "").trim()}.`, m => m[9] || /^[A-Z]/.test((m[6] || m[8] || "").replace(/^the /i, ""))],
    ["sponsorship", /(not|unable to|cannot|can't|do not|does not|don't|won't|will not)\s+(be able to\s+)?(offer|provide|sponsor|support)[^.\n]{0,40}(visa|sponsor|immigration)|\bno (visa )?sponsorship\b|\bvisa sponsorship is not (available|offered|possible)\b|without (the need for )?sponsorship/i, () => "No visa sponsorship."],
    ["ai-written", /\b(no|not accept\w*|do not|don't|won't|will not)\b[^.\n]{0,40}\b(ai|chatgpt|llm|gpt)[- ](generated|written)|\b(ai|chatgpt)[- ]generated (applications?|cvs?|resumes?|cover letters?|answers?)\b[^.\n]{0,40}\b(reject\w*|not|disqualif\w*|discard\w*)/i, () => "The company rejects AI-written applications. Write the answers yourself."],
    ["clearance", /\b(security clearance|sc clearance|dv clearance|clearance required|eligible for clearance)\b/i, () => "Security clearance is required."],
    ["language", new RegExp(`\\b(${LANG})\\b[^.;\\n]{0,40}\\b(fluen\\w*|native|required|proficien\\w*|c1|c2|business[- ]level|essential|must)\\b|\\b(fluen\\w*|native|proficien\\w*|business[- ]level)\\b[^.;\\n]{0,30}\\b(${LANG})\\b`, "i"),
      m => `Language: ${((m[1] || m[4]) || "").replace(/^\w/, c => c.toUpperCase())} is required.`],
  ];
  const ONSITE = /\b(\d)\s*days?\s*(a|per)\s*week\s*(in|on-?site|at)\b|\bon-?site\b(?!\s+(interview|visit))|\bin[- ]office\b/i;

  // ---------------------------------------------------------------- the JD ---
  function parseJD(text) {
    const lines = normalise(text), hasHeads = lines.some(l => headingOf(l));
    const reqs = [], blockers = [], blockerLines = new Set(), keep = [];
    let kind = hasHeads ? "intro" : null, years = 0, onsite = "";
    lines.forEach(raw => {
      const h = headingOf(raw);
      if (h) { kind = h; keep.push({ line: raw, kind: h, head: true }); return; }
      const line = raw.replace(/^[•\-–*\s]+/, "");
      BLOCKERS.forEach(([type, rx, say, ok]) => {
        const m = line.match(rx);
        if (m && (!ok || ok(m)) && kind !== "nice" && !NICE_WORDS.test(line)) { blockers.push({ type, rx: say, m, quote: line }); blockerLines.add(line); }
      });
      if (!onsite && ONSITE.test(line)) onsite = line;
      // which section weight applies to this line
      let k = kind;
      if (k === "intro" || k === null) k = NICE_WORDS.test(line) ? "nice" : ABOUT_WORDS.test(line) && !MUST_WORDS.test(line) ? "about" : MUST_WORDS.test(line) ? "must" : (k === "intro" && !/\byou\b/i.test(line) ? "about" : "resp");
      else if (k === "must" && NICE_WORDS.test(line)) k = "nice";
      else if (k === "resp" && NICE_WORDS.test(line)) k = "nice";
      if (k !== "about") for (const m of line.matchAll(YEARS_RX)) { const n = +m[1]; if (n > 0 && n <= 15 && !/\bago\b|\bold\b|founded|history/i.test(line)) years = Math.max(years, n); }
      keep.push({ line, kind: k });
      if (k === "about" || blockerLines.has(line)) return;
      // long paragraphs: one requirement per sentence
      const parts = line.length > 240 ? line.split(/(?<=[.;!?])\s+(?=[A-Z])/) : [line];
      parts.forEach(p => { const items = itemsOf(p); if (items.length) reqs.push({ kind: k, weight: W[k], text: p, items }); });
    });
    return { reqs, blockers, years, onsite, lines: keep, thin: reqs.length < 2 };
  }

  // Posting text worth keeping for later scoring: every section except company and benefits, plus blocker lines.
  function relevantText(text, max = 6000) {
    const p = parseJD(text), bl = new Set(p.blockers.map(b => b.quote));
    const out = [];
    p.lines.forEach(x => { if (x.kind !== "about" || bl.has(x.line) || x.line === p.onsite || x.head && x.kind !== "about") out.push(x.head ? x.line.replace(/:?\s*$/, ":") : "• " + x.line); });
    let s = out.join("\n");
    return s.length > max ? s.slice(0, max) : s;
  }

  // ---------------------------------------------------------------- the CV ---
  const LABEL_RX = /^\s*\(((?:currently\s+)?(?:learning|foundational|basic|beginner|familiar(?:ity)?|exposure))\)/i;
  function entriesFromProfile(p, extra = {}) {
    const E = [];
    const push = (text, where, from) => text && E.push({ text: String(text).replace(/\*\*/g, ""), where, from });
    (p.experience || []).forEach(e => (e.bullets || []).forEach(b => push(typeof b === "string" ? b : b.text, "experience", orgName(e.org))));
    (p.projects || []).forEach(b => { const t = typeof b === "string" ? b : b.text; push(t, "project", String(t).split(/[,.(:]/)[0].trim()); });
    if (extra.summary) push(extra.summary, "summary", "Summary");
    const groups = extra.skillGroups || p.skill_groups || [];
    groups.forEach(g => (g.items || []).forEach(it => push(it, "skills", "Skills: " + g.label)));
    (p.education || []).forEach(e => push([e.degree, e.org, e.notes].filter(Boolean).join(", "), "other", "Education"));
    (p.certifications || []).forEach(c => push(typeof c === "string" ? c : c.name, "other", "Certification"));
    return E;
  }
  const orgName = org => String(org || "").split(",")[0].trim();

  // A CV pasted or extracted as text: split by the usual headings.
  function entriesFromText(text) {
    const E = [];
    let where = "summary";
    String(text || "").split(/\n+/).map(l => l.trim()).filter(Boolean).forEach(l => {
      const h = l.replace(/[:\s]+$/, "").toLowerCase();
      if (/^(professional |work )?(experience|employment|work history)$/.test(h)) { where = "experience"; return; }
      if (/^(personal |selected |key )?projects$/.test(h)) { where = "project"; return; }
      if (/^(technical |key |core )?skills( and tools)?$|^tech(nical)? stack$/.test(h)) { where = "skills"; return; }
      if (/^(summary|profile|professional summary|about me|objective)$/.test(h)) { where = "summary"; return; }
      if (/^(education|certifications?|awards|publications|languages|interests)$/.test(h)) { where = "other"; return; }
      if (where === "skills") l.replace(/^[^:]{1,40}:\s*/, "").split(/,\s*(?![^()]*\))/).forEach(x => x.trim() && E.push({ text: x.trim(), where, from: "Skills" }));
      else E.push({ text: l.replace(/^[•\-–*\s]+/, ""), where, from: where === "experience" ? "Experience" : where === "project" ? "Project" : where === "summary" ? "Summary" : "CV" });
    });
    return E;
  }

  const MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11 };
  function yearsOf(datesList, now = new Date()) {
    const months = new Set();
    const rx = /(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s*(\d{4})\s*(?:-|–|—|to)\s*(present|current|now|(jan|feb|mar|apr|may|jun|jul|aug|sept?|oct|nov|dec)[a-z]*\.?\s*(\d{4}))/gi;
    datesList.forEach(d => { for (const m of String(d || "").matchAll(rx)) {
      const a = +m[2] * 12 + MON[m[1].toLowerCase()];
      const b = /present|current|now/i.test(m[3]) ? now.getFullYear() * 12 + now.getMonth() : +m[5] * 12 + MON[m[4].toLowerCase()];
      for (let x = a; x < b && x - a < 600; x++) months.add(x);
    } });
    return months.size ? Math.round(months.size / 12 * 10) / 10 : null;
  }

  // Build the evidence index for a CV: either a structured profile ({experience, projects, skill_groups, ...})
  // or plain text. opts.summary / opts.skillGroups override what the profile holds (the tailored CV).
  function cvIndex(cv, opts = {}) {
    const entries = typeof cv === "string" ? entriesFromText(cv) : entriesFromProfile(cv, opts);
    const best = {};               // canonical -> { credit, entry, label }
    const offer = (k, credit, entry, label, viaChild) => {
      const cur = best[k];
      if (!cur || credit > cur.credit) best[k] = { credit, entry, label, viaChild };
    };
    entries.forEach(en => {
      mentions(en.text).forEach(m => {
        const after = en.text.slice(m.e, m.e + 40), lab = after.match(LABEL_RX) || (en.where === "skills" ? en.text.match(/\(((?:currently\s+)?(?:learning|foundational|basic|beginner|familiar(?:ity)?|exposure))\)/i) : null);
        let credit = WHERE[en.where] ?? 0.5;
        const label = lab ? lab[1].toLowerCase() : "";
        if (label) credit = Math.min(credit, LEARNING);
        offer(m.k, credit, en, label);
        // what this tool proves too, one level and the next
        (IMPLIES[m.k] || []).forEach(p => { offer(p, credit, en, label, m.k); (IMPLIES[p] || []).forEach(q => offer(q, credit, en, label, m.k)); });
      });
    });
    let years = null, degreesDone = "";
    if (typeof cv === "string") {
      const sec = cv.split(/\n\s*(?:education|projects|skills|certifications)\b/i)[0];
      years = yearsOf([sec]);
      const m = cv.match(/\b(MSc|M\.Sc|MS|MEng|MBA|BSc|B\.Sc|BEng|B\.E\.|B\.Tech|BTech|Bachelor[^,\n]*|Master[^,\n]*)\b[^\n]{0,80}?\b(19|20)\d{2}\s*(?:-|–|to)\s*((19|20)\d{2})/);
      if (m && +m[3] <= new Date().getFullYear()) degreesDone = m[0].split(/[,|]/)[0].trim();
    } else {
      years = yearsOf((cv.experience || []).map(e => e.dates));
      const done = (cv.education || []).filter(e => { const y = String(e.dates || "").match(/(\d{4})\s*$/); return y && +y[1] <= new Date().getFullYear() && !/present|expected/i.test(e.dates); });
      degreesDone = done.map(e => e.degree.split(",")[0]).join(", ");
    }
    return { entries, best, years, degreesDone };
  }

  // ------------------------------------------------------------- the score ---
  const short = (t, n = 140) => { t = String(t || "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : t; };
  const proofOf = b => b ? `${b.entry.from}: ${short(b.entry.text)}${b.viaChild ? ` (via ${b.viaChild})` : ""}` : "";

  function creditFor(k, cv) {
    const b = cv.best[k];
    if (b && b.credit > 0) return { k, credit: b.credit, status: b.label ? "learning" : b.credit >= 0.95 ? "covered" : "partial", where: b.entry.where, tag: b.label, proof: proofOf(b) };
    const rel = (RELATED[k] || []).map(r => [r, cv.best[r]]).filter(([, x]) => x && x.credit > 0).sort((a, b) => b[1].credit - a[1].credit)[0];
    if (rel) return { k, credit: RELATED_CREDIT, status: "related", via: rel[0], proof: proofOf(rel[1]) };
    return { k, credit: 0, status: "missing", proof: "" };
  }

  function score(jdText, cv, opts = {}) {
    const jd = typeof jdText === "string" ? parseJD(jdText) : jdText;
    const idx = cv && cv.entries ? cv : cvIndex(cv, opts);
    const trace = [], rows = { must: [], resp: [], nice: [] };
    let wSum = 0, wGot = 0;
    jd.reqs.forEach(r => {
      // the same tool counts once per requirement
      const items = [], seen = new Set();
      r.items.forEach(it => {
        const key = it.any.join("|"); if (seen.has(key)) return; seen.add(key);
        const opts2 = it.any.map(k => creditFor(k, idx)).sort((a, b) => b.credit - a.credit);
        const best = opts2[0];
        items.push(Object.assign({ label: it.any.length > 1 ? it.any.join(it.example ? ", " : " or ") : it.any[0], any: it.any, tech: it.any.some(isTech), example: it.example }, best, { k: best.k }));
      });
      const credit = items.reduce((n, x) => n + x.credit, 0) / items.length;
      const status = credit >= 0.95 ? "covered" : items.some(x => x.credit >= 0.5 || x.status === "learning" && x.credit > 0) || credit >= 0.5 ? "partial" : credit > 0 ? "partial" : "missing";
      const row = { kind: r.kind, weight: r.weight, text: short(r.text, 160), credit, status, items };
      rows[r.kind].push(row);
      wSum += r.weight; wGot += r.weight * credit;
      trace.push({ label: `${{ must: "Must", resp: "Role", nice: "Nice" }[r.kind]} · ${short(r.text, 70)}`, pts: Math.round(r.weight * credit * 10) / 10, max: r.weight,
        note: items.map(x => `${x.label}: ${x.status}${x.via ? " via " + x.via : ""} (${Math.round(x.credit * 100) / 100})`).join("; ") });
    });
    const raw = wSum ? (wGot / wSum) * 100 : 50;

    // hard gates: named must-have tools with no direct evidence, and must-have lines with nothing at all
    const missingMust = [], seenMiss = new Set();
    rows.must.forEach(r => {
      r.items.forEach(x => { if (x.tech && (x.status === "missing" || x.status === "related") && !seenMiss.has(x.label)) { seenMiss.add(x.label); missingMust.push(x.label); } });
      if (r.credit === 0 && !r.items.some(x => x.tech)) { const l = r.items.map(x => x.label).join(", "); if (!seenMiss.has(l)) { seenMiss.add(l); missingMust.push(l); } }
    });
    let cap = 100, capWhy = "";
    if (missingMust.length >= 2) { cap = 60; capWhy = `${missingMust.length} must-haves missing: capped at 60%`; }
    else if (missingMust.length === 1) { cap = 70; capWhy = `1 must-have missing: capped at 70%`; }
    if (jd.thin) { cap = Math.min(cap, 70); capWhy = capWhy || "Few requirements could be read from this posting: capped at 70%"; }

    // years: points off when short, nothing extra when over
    const have = idx.years, need = jd.years;
    let yPen = 0;
    if (need && have != null && need - have > 0.25) yPen = Math.min(20, 5 * Math.ceil(need - have - 0.25));
    const capped = Math.min(raw, cap), afterYears = capped - yPen, pct = round5(afterYears);

    trace.push({ label: "Weighted coverage", pts: Math.round(raw), max: 100, note: `${Math.round(wGot * 10) / 10} of ${Math.round(wSum * 10) / 10} requirement points` });
    if (cap < 100 && capped < raw) trace.push({ label: capWhy, pts: -(Math.round((raw - capped) * 10) / 10), max: 0, note: missingMust.join(", ") });
    if (yPen) trace.push({ label: `Years: posting asks ${need}+, CV dates show ${have}`, pts: -yPen, max: 0, note: "5 points per year short" });
    trace.push({ label: "Rounded to the nearest 5", pts: pct, max: 100, note: "" });

    // blockers and warnings
    const blockers = [], seenB = new Set();
    jd.blockers.forEach(b => { const t = b.rx(b.m, idx); if (!seenB.has(t)) { seenB.add(t); blockers.push({ type: b.type, text: t, quote: short(b.quote, 160) }); } });
    const warnings = [];
    if (yPen) warnings.push({ type: "years", text: `The posting asks for ${need}+ years; your CV dates add up to ${have}. −${yPen} points.` });
    else if (need && have == null) warnings.push({ type: "years", text: `The posting asks for ${need}+ years; no dates were found on the CV to check.` });
    if (jd.onsite) warnings.push({ type: "location", text: `On-site: ${short(jd.onsite, 120)}` });
    if (typeof opts.visa === "number" && opts.visa >= 0 && opts.visa < 40 && !blockers.some(b => b.type === "sponsorship")) warnings.push({ type: "visa", text: `Visa odds from India are low (${opts.visa}%).` });

    // one-line reason
    const partialMust = rows.must.filter(r => r.status === "partial").flatMap(r => r.items.filter(x => x.status !== "covered" && !seenMiss.has(x.label)).map(x => x.label));
    let reason = missingMust.length ? `missing ${missingMust.length} must-have${missingMust.length > 1 ? "s" : ""}: ${missingMust.join(", ")}`
      : partialMust.length ? `must-haves only partly shown: ${[...new Set(partialMust)].slice(0, 4).join(", ")}`
      : rows.must.length ? "all must-haves covered" : "no must-have section found; scored on the role description";
    if (yPen) reason += `; asks ${need}+ years`;
    if (jd.thin) reason += "; short posting";

    // honest suggestions
    const suggestions = [], seenS = new Set();
    [...rows.must, ...rows.resp, ...rows.nice].forEach(r => r.items.forEach(x => {
      if (x.status === "covered" || seenS.has(x.label)) return; seenS.add(x.label);
      if (x.status === "related") suggestions.push({ item: x.label, kind: r.kind, text: `Show your ${x.via} work as related experience (${x.proof}). ${x.label} itself: learn it before you list it.` });
      else if (x.status === "missing") suggestions.push({ item: x.label, kind: r.kind, text: `Learn this. It is not on your CV, so do not add it.` });
      else if (x.status === "learning") suggestions.push({ item: x.label, kind: r.kind, text: `Marked "${x.tag}" on your CV, so it counts for 0.25 at most. Keep the label; a finished project with it would move it up.` });
      else if (x.where === "skills") suggestions.push({ item: x.label, kind: r.kind, text: `Only in your skills list. If you used it at work or in a project, name it in that bullet.` });
      else if (x.where === "summary") suggestions.push({ item: x.label, kind: r.kind, text: `Only in your summary. Back it with a bullet if you have used it.` });
      else if (x.where === "project" || x.where === "other") suggestions.push({ item: x.label, kind: r.kind, text: `Shown in a project, not at work. That is fine; mention it in the cover letter if it was substantial.` });
    }));

    const flat = k => rows[k].flatMap(r => r.items);
    return {
      pct, raw: Math.round(raw * 10) / 10, reason: `${pct}%, ${reason}`, cap, years: { need, have, penalty: yPen },
      blockers, warnings, must: rows.must, resp: rows.resp, nice: rows.nice, suggestions, trace, missingMust, thin: jd.thin,
      coverage: wSum ? wGot / wSum : 0,
      covered: [...new Set([...flat("must"), ...flat("resp"), ...flat("nice")].filter(x => x.status === "covered" || x.status === "partial").map(x => x.k))],
      missing: [...new Set([...flat("must"), ...flat("resp"), ...flat("nice")].filter(x => x.status === "missing" || x.status === "related").map(x => x.label))],
      related: [...flat("must"), ...flat("resp"), ...flat("nice")].filter(x => x.status === "related").map(x => ({ item: x.label, via: x.via, proof: x.proof })),
      learning: [...flat("must"), ...flat("resp"), ...flat("nice")].filter(x => x.status === "learning").map(x => x.k),
    };
  }

  // ------------------------------------------------------- CV quality checks ---
  // Separate from the score. cvDoc is the CV being sent (profile shape); saved is the candidate's saved profile.
  function quality(cvDoc, saved, opts = {}) {
    const out = [], norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    saved = saved || {};
    (saved.education || []).forEach(e => {
      const m = (cvDoc.education || []).find(x => norm(x.org).split(" ")[0] === norm(e.org).split(" ")[0] || norm(x.degree) === norm(e.degree));
      if (!m) out.push({ type: "missing", text: `Education "${e.degree}" from your profile is not on this CV.` });
      else {
        if (norm(m.degree) !== norm(e.degree)) out.push({ type: "facts", text: `Degree name differs from your profile: "${m.degree}" vs "${e.degree}".` });
        if (norm(m.dates) !== norm(e.dates)) out.push({ type: "facts", text: `Degree dates differ from your profile: "${m.dates}" vs "${e.dates}".` });
      }
    });
    (saved.experience || []).forEach(e => {
      const m = (cvDoc.experience || []).find(x => norm(orgName(x.org)) === norm(orgName(e.org)));
      if (m && (norm(m.title) !== norm(e.title) || norm(m.dates) !== norm(e.dates))) out.push({ type: "facts", text: `${orgName(e.org)}: title or dates differ from your profile ("${m.title}, ${m.dates}" vs "${e.title}, ${e.dates}").` });
    });
    const cvCerts = (cvDoc.certifications || []).map(c => norm(typeof c === "string" ? c : c.name));
    (saved.certifications || []).forEach(c => { const n = norm(typeof c === "string" ? c : c.name); if (!cvCerts.some(x => x.includes(n.slice(0, 20)))) out.push({ type: "missing", text: `Certification left out: ${typeof c === "string" ? c : c.name}.` }); });
    const projKey = t => norm(String(typeof t === "string" ? t : t.text).split(/[,.(:]/)[0]).slice(0, 30);
    const cvProj = (cvDoc.projects || []).map(projKey);
    (saved.projects || []).forEach(p => { const k = projKey(p); if (k && !cvProj.includes(k)) out.push({ type: "missing", text: `Project left out: ${String(typeof p === "string" ? p : p.text).split(/[,.(:]/)[0].trim()}${opts.maxPages === 1 ? " (one-page trimming may have dropped it)" : ""}.` }); });
    // tools only ever named in the skills list
    const proven = new Set();
    entriesFromProfile(Object.assign({}, cvDoc, { skill_groups: [] }), { summary: opts.summary }).filter(e => e.where !== "other").forEach(e => mentions(e.text).forEach(m => { proven.add(m.k); (IMPLIES[m.k] || []).forEach(p => proven.add(p)); }));
    const listed = [];
    (opts.skillGroups || cvDoc.skill_groups || []).forEach(g => (g.items || []).forEach(it => mentions(it).forEach(m => { if (isTech(m.k) && !proven.has(m.k) && !listed.includes(m.k)) listed.push(m.k); })));
    if (listed.length) out.push({ type: "unconfirmed", text: `Listed in skills but never shown in a bullet, project or summary: ${listed.join(", ")}. Back them with a bullet or be ready to explain them.` });
    if (opts.pages && opts.maxPages && opts.pages > opts.maxPages) out.push({ type: "length", text: `The CV runs to ${opts.pages} pages; this template is meant for ${opts.maxPages}.` });
    return out;
  }

  return { VOCAB: VOCAB.map(v => v[0]), TYPE, IMPLIES, RELATED, W, WHERE, parseJD, relevantText, cvIndex, entriesFromText, yearsOf, score, quality, round5, mentions, itemsOf, normalise };
});
