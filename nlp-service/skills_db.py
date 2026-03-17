# skills_db.py - Comprehensive predefined skills keyword database

# Organized by category for maintainability
SKILLS_DATABASE = {
    # ── Programming Languages ─────────────────────────────────
    "languages": [
        "python", "javascript", "typescript", "java", "c++", "c#", "c",
        "ruby", "go", "golang", "rust", "swift", "kotlin", "scala",
        "php", "r", "matlab", "perl", "dart", "elixir", "haskell",
        "lua", "julia", "groovy", "objective-c",
    ],

    # ── Frontend Frameworks & Libraries ──────────────────────
    "frontend": [
        "react", "reactjs", "react.js", "angular", "angularjs", "vue",
        "vuejs", "vue.js", "next.js", "nextjs", "nuxt.js", "nuxtjs",
        "svelte", "gatsby", "remix", "tailwind", "tailwindcss",
        "bootstrap", "material-ui", "mui", "chakra-ui", "ant design",
        "antd", "redux", "zustand", "mobx", "recoil", "webpack",
        "vite", "parcel", "babel", "sass", "less", "css", "html",
        "html5", "css3", "jquery", "d3.js", "d3", "three.js",
        "framer motion", "styled-components",
    ],

    # ── Backend Frameworks ────────────────────────────────────
    "backend": [
        "node.js", "nodejs", "express", "expressjs", "express.js",
        "django", "flask", "fastapi", "spring", "spring boot",
        "springboot", "rails", "ruby on rails", "laravel", "symfony",
        "asp.net", ".net", "dotnet", "gin", "fiber", "nestjs",
        "nest.js", "hapi", "koa", "strapi", "graphql", "rest api",
        "restful", "grpc", "microservices", "websockets",
    ],

    # ── Databases ─────────────────────────────────────────────
    "databases": [
        "mongodb", "mongoose", "mysql", "postgresql", "postgres",
        "sqlite", "redis", "elasticsearch", "cassandra", "dynamodb",
        "firebase", "supabase", "neo4j", "oracle", "sql server",
        "mariadb", "cockroachdb", "planetscale", "prisma", "sequelize",
        "typeorm", "sqlalchemy", "mongoose",
    ],

    # ── Cloud & DevOps ────────────────────────────────────────
    "cloud_devops": [
        "aws", "amazon web services", "azure", "gcp", "google cloud",
        "docker", "kubernetes", "k8s", "terraform", "ansible",
        "jenkins", "github actions", "gitlab ci", "circleci",
        "ci/cd", "devops", "nginx", "apache", "linux", "bash",
        "shell scripting", "serverless", "lambda", "ec2", "s3",
        "cloudformation", "helm", "prometheus", "grafana",
        "elk stack", "logstash", "kibana",
    ],

    # ── Data Science & ML ─────────────────────────────────────
    "data_ml": [
        "machine learning", "deep learning", "neural networks",
        "tensorflow", "pytorch", "keras", "scikit-learn", "sklearn",
        "pandas", "numpy", "matplotlib", "seaborn", "opencv",
        "nlp", "natural language processing", "computer vision",
        "data analysis", "data science", "statistics", "hadoop",
        "spark", "apache spark", "airflow", "dbt", "tableau",
        "power bi", "jupyter", "mlops", "llm", "transformers",
        "bert", "gpt", "langchain",
    ],

    # ── Mobile ────────────────────────────────────────────────
    "mobile": [
        "react native", "flutter", "android", "ios", "swift",
        "kotlin", "xamarin", "ionic", "expo",
    ],

    # ── Tools & Practices ─────────────────────────────────────
    "tools_practices": [
        "git", "github", "gitlab", "bitbucket", "jira", "confluence",
        "agile", "scrum", "kanban", "tdd", "bdd", "unit testing",
        "jest", "pytest", "selenium", "cypress", "playwright",
        "postman", "swagger", "openapi", "oauth", "jwt",
        "authentication", "authorization", "microservices",
        "system design", "oop", "solid principles", "design patterns",
        "linux", "unix", "vim", "vscode", "figma",
    ],

    # ── Blockchain & Others ───────────────────────────────────
    "emerging": [
        "blockchain", "solidity", "web3", "ethereum", "smart contracts",
        "cybersecurity", "penetration testing", "ethical hacking",
        "iot", "raspberry pi", "arduino", "embedded systems",
        "unity", "unreal engine", "game development",
    ],
}

# Flatten all skills into a single list (lowercase for matching)
ALL_SKILLS = []
for category, skills in SKILLS_DATABASE.items():
    ALL_SKILLS.extend([s.lower() for s in skills])

# Remove duplicates while preserving order
ALL_SKILLS = list(dict.fromkeys(ALL_SKILLS))
