import os
import re
import threading
import json
import time
import math
import fitz  # PyMuPDF
import requests
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Config & Models ─────────────────────────────────────────
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Sentence Transformer setup
embedding_model = None
print("[NLP] Initializing sentence-transformers model...")
try:
    from sentence_transformers import SentenceTransformer, util
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("[SUCCESS] Model loaded: all-MiniLM-L6-v2")
except Exception as e:
    print(f"[WARN] sentence-transformers model not loaded ({e}). Using lexical fallback scoring.")

# Configure Groq API (High-speed Llama-3.3-70B with 14,400 daily requests)
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "").strip()

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY", "").strip()
if API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    import google.generativeai as genai
    genai.configure(api_key=API_KEY)
else:
    genai = None

# Global rate-limit cooldown tracker
_gemini_cooldown_until = 0.0

# Per-model cooldown dictionary to avoid re-querying models that are currently quota-exhausted
_model_cooldowns = {}

# Model fallback chain: gemini-2.5-flash is PRIMARY (#1). Fallbacks are ONLY used when 2.5 limits are reached.
LLM_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash']


def is_rate_limit_error(e: Exception) -> bool:
    """Check if exception is caused by HTTP 429 quota exhaustion."""
    err_str = str(e).lower()
    return "429" in err_str or "quota" in err_str or "resourceexhausted" in err_str or "rate limit" in err_str


GROQ_MODELS = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant']


def call_groq(prompt: str) -> str:
    """Execute inference via Groq LPU using high-performance open models (14,400 requests/day free tier)."""
    if not GROQ_API_KEY:
        raise ValueError("GROQ_API_KEY is not configured.")
    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }

    last_err = None
    for model_name in GROQ_MODELS:
        try:
            payload = {
                "model": model_name,
                "messages": [
                    {
                        "role": "system",
                        "content": "You are an elite ATS recruitment algorithm and structured resume evaluation expert. Respond ONLY with a single valid JSON object strictly adhering to the requested schema without markdown formatting or commentary."
                    },
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                "temperature": 0.1,
                "response_format": {"type": "json_object"}
            }
            resp = requests.post(url, headers=headers, json=payload, timeout=25)
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
            else:
                last_err = f"Groq {model_name} HTTP {resp.status_code}: {resp.text}"
                print(f"[WARN] {last_err}. Trying next Groq model...")
        except Exception as e:
            last_err = str(e)
            print(f"[WARN] Groq {model_name} exception: {e}. Trying next Groq model...")

    raise RuntimeError(f"All Groq models failed. Last error: {last_err}")


def call_llm(prompt: str) -> str:
    """
    Unified LLM caller:
    1. If GROQ_API_KEY is configured, uses Groq (Llama-3.3-70B) for ultra-fast, 14,400 req/day processing.
    2. Falls back to Google Gemini models chain if Groq fails or is not configured.
    3. Seamlessly falls back to local SentenceTransformers NLP if both external APIs are unavailable.
    """
    global _gemini_cooldown_until

    # ── 1. Groq Cloud Engine (Primary when configured) ─────────────────
    if GROQ_API_KEY:
        try:
            print("[LLM] Executing analysis with Groq (Llama-3.3-70b-versatile)...")
            res = call_groq(prompt)
            if res and res.strip():
                return res
        except Exception as e:
            print(f"[WARN] Groq request failed: {e}. Falling back to Gemini/Local...")

    # ── 2. Google Gemini Fallback ─────────────────────────────────────
    if API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE" and genai is not None:
        now = time.time()
        if now < _gemini_cooldown_until:
            remaining = int(_gemini_cooldown_until - now)
            print(f"[INFO] All Gemini models currently in cooldown ({remaining}s remaining). Activating local NLP engine.")
            raise RuntimeError(f"Gemini API cooldown ({remaining}s remaining). Falling back to offline NLP.")

        last_error = None
        for model_name in LLM_MODELS:
            # If this model recently hit a 429 quota limit, skip it until cooldown expires
            if model_name in _model_cooldowns and now < _model_cooldowns[model_name]:
                continue

            try:
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(prompt)
                if response and response.text:
                    return response.text
            except Exception as e:
                last_error = e
                if is_rate_limit_error(e):
                    print(f"[WARN] Gemini model {model_name} quota hit (429). Setting 5m cooldown. Trying next fallback...")
                    _model_cooldowns[model_name] = now + 300.0
                    continue
                else:
                    print(f"[WARN] Model {model_name} failed: {e}. Trying next fallback...")

        # If all models in the fallback chain were exhausted or rate limited:
        print(f"[WARN] All Gemini models failed or rate-limited. Activating 45s circuit breaker cooldown.")
        _gemini_cooldown_until = time.time() + 45.0
        raise RuntimeError(f"All Gemini models failed or rate-limited. Last error: {last_error}")

    raise RuntimeError("No external LLM provider available. Triggering local NLP fallback.")


def clean_and_parse_json(raw_text: str) -> dict:
    """Safely extract and parse JSON from model output."""
    text = raw_text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
    text = text.strip()

    try:
        return json.loads(text)
    except Exception:
        # Extract the outermost JSON object
        match = re.search(r'(\{[\s\S]*\})', text)
        if match:
            try:
                return json.loads(match.group(1))
            except Exception:
                pass
        raise ValueError("Could not parse valid JSON from LLM response.")


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extract full text from PDF with reading-order sorting and block fallback."""
    full_text = ""
    with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
        for page in doc:
            page_text = page.get_text("text", sort=True)
            if not page_text or not page_text.strip():
                # Block fallback for multi-column / complex layouts
                blocks = page.get_text("blocks")
                page_text = "\n".join(
                    [b[4] for b in blocks if isinstance(b, (list, tuple)) and len(b) > 4 and isinstance(b[4], str)]
                )
            full_text += page_text + "\n"

    # Clean redundant empty lines
    cleaned = re.sub(r'\n{3,}', '\n\n', full_text).strip()
    return cleaned


# ────────────────────────────────────────────────────────────
# Rule-Based Local Fallback Parser
# ────────────────────────────────────────────────────────────
def fallback_extract_resume_data(text: str) -> dict:
    """
    Robust local regex-based parser that guarantees NO section is skipped
    if the LLM service is temporarily offline or rate-limited.
    """
    lines = [line.strip() for line in text.split('\n') if line.strip()]

    # 1. Contact / Candidate Info
    email_match = re.search(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+', text)
    phone_match = re.search(r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}', text)
    linkedin_match = re.search(r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+', text, re.IGNORECASE)
    github_match = re.search(r'(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+', text, re.IGNORECASE)

    name = lines[0] if lines else "Candidate"
    # Filter out common false names
    if any(k in name.lower() for k in ["resume", "curriculum", "cv", "page", "email"]):
        name = lines[1] if len(lines) > 1 else "Candidate"

    candidate_info = {
        "name": name,
        "email": email_match.group(0) if email_match else "",
        "phone": phone_match.group(0) if phone_match else "",
        "location": "",
        "linkedin": linkedin_match.group(0) if linkedin_match else "",
        "github": github_match.group(0) if github_match else "",
        "portfolio": ""
    }

    # 2. Section segmentation by regex headers
    section_patterns = {
        "summary": r'(?:professional\s+summary|summary|profile|about\s+me|objective)',
        "experience": r'(?:work\s+experience|professional\s+experience|experience|employment\s+history|work\s+history)',
        "education": r'(?:education|academic\s+background|qualifications|academic\s+history)',
        "skills": r'(?:technical\s+skills|skills\s*&?\s*competencies|core\s+competencies|skills|technologies)',
        "projects": r'(?:projects|personal\s+projects|academic\s+projects|key\s+projects)',
        "certifications": r'(?:certifications|certificates|licenses\s*&?\s*certifications|licenses)',
        "languages": r'(?:languages|language\s+proficiency)',
        "achievements": r'(?:awards|honors|achievements|recognitions)'
    }

    # Identify section indices
    sections = {}
    current_section = "intro"
    section_content = {k: [] for k in section_patterns.keys()}
    section_content["intro"] = []

    for line in lines:
        matched_sec = None
        for sec_name, pattern in section_patterns.items():
            if re.match(r'^(?:' + pattern + r')[:\s]*$', line, re.IGNORECASE):
                matched_sec = sec_name
                break
        if matched_sec:
            current_section = matched_sec
        else:
            if current_section in section_content:
                section_content[current_section].append(line)

    summary = " ".join(section_content.get("summary", [])) or " ".join(section_content.get("intro", [])[:3])

    # Extract Skills
    raw_skills = section_content.get("skills", [])
    skills_list = []
    for s_line in raw_skills:
        parts = re.split(r'[,|•·\/\t;]', s_line)
        for p in parts:
            p_clean = p.strip()
            if p_clean and len(p_clean) < 40 and not p_clean.endswith(':'):
                skills_list.append(p_clean)
    if not skills_list:
        common_tech = ["Python", "JavaScript", "TypeScript", "React", "Node.js", "Java", "C++", "C#", "SQL",
                       "MongoDB", "PostgreSQL", "AWS", "Azure", "Docker", "Kubernetes", "Git", "HTML", "CSS", "REST API"]
        for tech in common_tech:
            if re.search(r'\b' + re.escape(tech) + r'\b', text, re.IGNORECASE):
                skills_list.append(tech)

    # Extract Experience entries
    exp_lines = section_content.get("experience", [])
    experience = []
    if exp_lines:
        current_exp = {"role": exp_lines[0], "company": "", "duration": "", "details": []}
        for el in exp_lines[1:]:
            if el.startswith(('•', '-', '*', '–')):
                current_exp["details"].append(el.lstrip('•-*– ').strip())
            elif not current_exp["company"]:
                current_exp["company"] = el
            elif not current_exp["duration"] and any(yr in el for yr in ['20', '19', 'Present', 'current']):
                current_exp["duration"] = el
            else:
                current_exp["details"].append(el)
        experience.append(current_exp)

    # Extract Education entries
    edu_lines = section_content.get("education", [])
    education = []
    if edu_lines:
        education.append({
            "degree": edu_lines[0],
            "institution": edu_lines[1] if len(edu_lines) > 1 else "",
            "year": edu_lines[2] if len(edu_lines) > 2 else "",
            "gpa": "",
            "details": " ".join(edu_lines[3:]) if len(edu_lines) > 3 else ""
        })

    # Extract Projects
    proj_lines = section_content.get("projects", [])
    projects = []
    if proj_lines:
        projects.append({
            "name": proj_lines[0],
            "description": " ".join(proj_lines[1:]),
            "technologies": []
        })

    return {
        "candidate_info": candidate_info,
        "summary": summary,
        "skills": list(dict.fromkeys(skills_list)),
        "experience": experience,
        "education": education,
        "projects": projects,
        "certifications": section_content.get("certifications", []),
        "languages": section_content.get("languages", []),
        "achievements": section_content.get("achievements", [])
    }


# ────────────────────────────────────────────────────────────
# LLM Extraction Logic
# ────────────────────────────────────────────────────────────
def extract_resume_data(text: str) -> dict:
    """Extract comprehensive structured resume data with full details."""
    prompt = f"""
You are an expert ATS (Applicant Tracking System) and Senior Technical Recruiter.
Extract ALL information and sections from the resume text provided below without omitting or truncating any section.

Return ONLY a valid JSON object matching the exact schema below, with no markdown fences, no surrounding commentary, and no extra text:
{{
  "candidate_info": {{
    "name": "Candidate Full Name or empty string",
    "email": "Email address or empty string",
    "phone": "Phone number or empty string",
    "location": "City, State/Country or empty string",
    "linkedin": "LinkedIn profile URL or handle or empty string",
    "github": "GitHub profile URL or handle or empty string",
    "portfolio": "Portfolio/Website URL or empty string"
  }},
  "summary": "Full professional summary, objective, or profile statement from the resume, or empty string",
  "skills": ["Skill1", "Skill2", "Skill3", ... all technical, tool, domain, and soft skills listed],
  "experience": [
    {{
      "role": "Job Title / Role",
      "company": "Company / Organization Name",
      "duration": "Start Date - End Date (e.g. Jan 2021 - Present)",
      "location": "City, State or Remote if mentioned",
      "details": [
        "Key accomplishment or responsibility bullet point 1",
        "Key accomplishment or responsibility bullet point 2"
      ]
    }}
  ],
  "education": [
    {{
      "degree": "Degree / Major (e.g. B.S. in Computer Science)",
      "institution": "University / College / School Name",
      "year": "Graduation year or date range",
      "gpa": "GPA if mentioned, else empty string",
      "details": "Relevant coursework, honors, or activities if mentioned"
    }}
  ],
  "projects": [
    {{
      "name": "Project Name",
      "description": "Comprehensive description of project and candidate's role",
      "technologies": ["Tech 1", "Tech 2"],
      "link": "Project URL or GitHub link if mentioned"
    }}
  ],
  "certifications": [
    "Certification or License name, issuing organization, year"
  ],
  "languages": [
    "Language and proficiency (e.g. English (Fluent))"
  ],
  "achievements": [
    "Awards, honors, publications, or notable achievements mentioned"
  ]
}}

Resume Text:
------
{text}
------
"""
    try:
        raw_res = call_llm(prompt)
        parsed = clean_and_parse_json(raw_res)

        # Ensure all required keys exist
        required_keys = ["candidate_info", "summary", "skills", "experience", "education", "projects", "certifications", "languages", "achievements"]
        fallback = fallback_extract_resume_data(text)
        for k in required_keys:
            if k not in parsed or not parsed[k]:
                parsed[k] = fallback.get(k, [] if isinstance(fallback.get(k), list) else "")

        return parsed
    except Exception as e:
        print(f"[WARN] LLM extraction fallback triggered: {e}")
        return fallback_extract_resume_data(text)


def get_suggestions_and_missing(resume_text: str, jd_text: str, resume_skills: list) -> dict:
    """
    Perform professional, industry-standard ATS gap analysis.
    Focuses exclusively on resume content, keywords, phrasing, and metric density (no cover letter fluff).
    """
    prompt = f"""
You are an elite ATS Algorithm & Senior Technical Recruiter at a top tech company (like Google/Amazon/Meta).
Evaluate this resume strictly against the target Job Description to identify matched skills, missing requirements, and high-impact resume improvements.

Target Job Description:
------
{jd_text}
------

Identified Resume Skills:
------
{', '.join(resume_skills) if resume_skills else 'None specifically listed'}
------

Full Resume Text:
------
{resume_text}
------

CRITICAL INSTRUCTIONS:
- Do NOT provide advice about cover letters, application forms, interview availability, or generic filler.
- Focus ONLY on actionable improvements to the RESUME itself (keywords, bullet points, impact metrics, action verbs, and section organization).
- Categorize recommendations into the exact 4 ATS categories below.

Return ONLY a valid JSON object matching this exact schema:
{{
  "matched_skills": [
    "Technical and domain skills from the job description that ARE demonstrated in the resume"
  ],
  "missing_skills": [
    "Important skills, tools, or requirements from the job description that are MISSING or weakly mentioned in the resume"
  ],
  "recommendations": {{
    "keyword_placement": [
      "Specific advice on where to place or repeat critical matched keywords in the Summary and top Experience bullets for maximum ATS keyword density"
    ],
    "quantifiable_impact": [
      "Specific advice on where to add measurable metrics (%, scale, latency, user counts, performance numbers) to strengthen bullet points"
    ],
    "action_verbs": [
      "Guidance on using high-impact engineering power verbs (e.g., Architected, Optimized, Spearheaded) instead of passive phrasing"
    ],
    "ats_compliance": [
      "ATS formatting and readability verification (standard headers, single-stream text flow, contact info completeness)"
    ]
  }},
  "suggestions": [
    "Top actionable resume improvement 1",
    "Top actionable resume improvement 2",
    "Top actionable resume improvement 3",
    "Top actionable resume improvement 4"
  ]
}}
"""
    try:
        raw_res = call_llm(prompt)
        parsed = clean_and_parse_json(raw_res)

        recs = parsed.get("recommendations", {})
        suggestions = parsed.get("suggestions", [])
        if not suggestions:
            # Flatten recommendations into suggestions list
            for cat_list in recs.values():
                if isinstance(cat_list, list):
                    suggestions.extend(cat_list)

        return {
            "matched_skills": parsed.get("matched_skills", []),
            "missing_skills": parsed.get("missing_skills", []),
            "recommendations": recs,
            "suggestions": suggestions[:5]
        }
    except Exception as e:
        print(f"[WARN] LLM gap analysis fallback triggered: {e}")
        # Rule-based fallback comparison
        jd_lower = jd_text.lower()
        matched = []
        for s in resume_skills:
            if s.lower() in jd_lower:
                matched.append(s)

        potential_jd_skills = re.findall(r'\b[A-Za-z0-9#+.-]{2,15}\b', jd_text)
        resume_lower = resume_text.lower()
        missing = []
        for token in set(potential_jd_skills):
            if len(token) > 2 and token.lower() in jd_lower and token.lower() not in resume_lower:
                if token.lower() not in ["with", "have", "must", "work", "role", "team", "will", "from", "that", "this", "able", "year", "years"]:
                    missing.append(token)
                    if len(missing) >= 6:
                        break

        recs = {
            "keyword_placement": [
                f"Ensure top matched keywords ({', '.join(matched[:4]) if matched else 'core tech skills'}) appear in both your Skills section and in the first bullet of your work experience."
            ],
            "quantifiable_impact": [
                "Quantify achievements across project and work experience bullets (e.g. % performance increase, active user scale, or latency reduction)."
            ],
            "action_verbs": [
                "Begin all accomplishment bullets with active engineering verbs like 'Architected', 'Engineered', and 'Optimized'."
            ],
            "ats_compliance": [
                "Your standard section headings (Summary, Experience, Education, Skills, Projects) pass 100% of automated ATS parser checks."
            ]
        }
        suggestions = [
            "Ensure core technical keywords appear in both your Skills list and top work experience bullets for maximum ATS keyword density.",
            "Quantify achievements with measurable metrics (e.g., % improvement, throughput, or scale) in every experience entry.",
            "Start each bullet point with a strong active power verb (e.g., 'Architected', 'Engineered', 'Optimized').",
            "Verify complete contact information (Email, Phone, LinkedIn, GitHub) is present at the top of your resume."
        ]
        return {
            "matched_skills": list(dict.fromkeys(matched)),
            "missing_skills": list(dict.fromkeys(missing[:6])),
            "recommendations": recs,
            "suggestions": suggestions
        }


def _clamp_pillar(val, min_val: int = 0, max_val: int = 100) -> int:
    """Validate and clamp numeric pillar score safely within [min_val, max_val]."""
    try:
        if val is None:
            return min_val
        num = float(val)
        if not math.isfinite(num):
            return min_val
        return max(min_val, min(max_val, round(num)))
    except (TypeError, ValueError):
        return min_val


ROLE_DOMAINS = {
    "software": {
        "title_anchors": [
            "software engineer", "software developer", "data engineer", "ai engineer",
            "machine learning engineer", "ml engineer", "cloud engineer", "cloud architect",
            "backend developer", "frontend developer", "fullstack developer", "devops engineer",
            "systems engineer", "platform engineer", "sre", "programmer", "developer", "engineer"
        ],
        "keywords": [
            "software", "developer", "engineer", "programming", "backend", "frontend", "fullstack",
            "cloud", "devops", "kubernetes", "docker", "python", "java", "golang", "react", "node",
            "aws", "database", "sql", "api", "microservices", "computer", "linux", "git", "ci/cd",
            "platform engineer", "sre", "systems engineer", "data engineer", "ai engineer", "etl", "pipeline"
        ],
        "primary_degrees": [
            "computer science", "software engineering", "information technology", "computer engineering",
            "data science", "informatics", "b.tech", "m.tech", "bca", "mca", "b.e", "b.s in computer",
            "bachelor of science in computer", "master of science in computer"
        ],
        "allied_degrees": [
            "mathematics", "statistics", "physics", "electrical engineering", "information systems",
            "applied mathematics", "computational"
        ],
        "relevant_certs": [
            "aws", "azure", "gcp", "kubernetes", "cka", "ckad", "terraform", "cissp", "comptia",
            "cisco", "ccna", "certified developer", "solutions architect", "scrum", "pmp", "linux",
            "red hat", "rhce", "security+", "network+"
        ]
    },
    "healthcare": {
        "title_anchors": [
            "nurse", "registered nurse", "staff nurse", "physician", "doctor", "pharmacist",
            "medical director", "clinical specialist", "nurse practitioner", "telemetry nurse"
        ],
        "keywords": [
            "nurse", "nursing", "rn", "lpn", "patient", "clinical", "hospital", "medical", "healthcare",
            "physician", "doctor", "pharmacist", "pharmacy", "clinic", "health care", "icu", "telemetry",
            "acute care", "pediatric", "patient care"
        ],
        "primary_degrees": [
            "nursing", "bsn", "msn", "medicine", "m.d", "b.sc nursing", "bachelor of science in nursing",
            "pharmacy", "pharm.d", "physiotherapy", "biomedical science", "public health", "health administration"
        ],
        "allied_degrees": [
            "biology", "health sciences", "kinesiology", "psychology", "life sciences", "chemistry"
        ],
        "relevant_certs": [
            "rn", "registered nurse", "bls", "acls", "cpr", "pals", "cna", "board certified",
            "nclex", "licensed practical nurse", "ccrn", "nurse practitioner"
        ]
    },
    "finance": {
        "title_anchors": [
            "financial analyst", "accountant", "staff accountant", "senior accountant",
            "auditor", "controller", "bookkeeper", "finance manager", "director of finance", "cpa"
        ],
        "keywords": [
            "accountant", "accounting", "auditor", "audit", "finance", "financial", "banking",
            "controller", "cpa", "tax", "treasury", "bookkeeper", "bookkeeping", "payroll", "general ledger",
            "financial analyst", "financial modeling", "budget", "revenue cycle"
        ],
        "primary_degrees": [
            "accounting", "finance", "chartered accountant", "b.com", "m.com", "commerce",
            "accountancy", "financial economics", "bachelor of commerce"
        ],
        "allied_degrees": [
            "economics", "business administration", "mba", "business", "actuarial science", "management"
        ],
        "relevant_certs": [
            "cpa", "cfa", "cma", "cia", "acca", "chartered accountant", "series 7", "series 63",
            "enrolled agent", "fmva", "quickbooks"
        ]
    },
    "culinary": {
        "title_anchors": [
            "chef", "pastry chef", "head chef", "executive chef", "sous chef", "cook", "baker",
            "line cook", "pastry cook"
        ],
        "keywords": [
            "chef", "pastry", "cook", "baker", "bakery", "culinary", "kitchen", "restaurant",
            "food and beverage", "f&b", "catering", "patisserie", "confectionery", "sourdough", "culinary arts"
        ],
        "primary_degrees": [
            "culinary arts", "culinary", "pastry arts", "baking", "hospitality management",
            "hotel management", "diploma in culinary", "food science", "culinary diploma", "associates in culinary"
        ],
        "allied_degrees": [
            "nutrition", "hospitality", "food service management", "restaurant management"
        ],
        "relevant_certs": [
            "servsafe", "food handler", "food manager", "food safety", "haccp",
            "certified executive chef", "certified sous chef", "sommelier"
        ]
    },
    "product": {
        "title_anchors": [
            "product manager", "technical product manager", "product owner", "program manager",
            "scrum master", "product lead", "head of product", "vp of product", "group product manager"
        ],
        "keywords": [
            "product manager", "product management", "program manager", "product owner",
            "scrum master", "business analyst", "operations manager", "strategy", "user stories",
            "roadmap", "sprint planning", "backlog", "agile"
        ],
        "primary_degrees": [
            "business administration", "mba", "management", "information systems",
            "computer science", "engineering", "economics"
        ],
        "allied_degrees": [
            "marketing", "communications", "finance", "industrial engineering"
        ],
        "relevant_certs": [
            "pmp", "capm", "csm", "scrum master", "pspo", "prince2", "product owner",
            "agile certified", "lean six sigma"
        ]
    },
    "trades": {
        "title_anchors": [
            "electrician", "plumber", "hvac technician", "mechanic", "machinist", "welder",
            "maintenance technician", "carpenter", "lineman"
        ],
        "keywords": [
            "electrician", "plumber", "hvac", "carpenter", "welder", "mechanic", "machinist",
            "technician", "maintenance technician", "construction", "electrical", "refrigeration"
        ],
        "primary_degrees": [
            "vocational", "apprenticeship", "trade diploma", "electrical technology", "hvac technology",
            "mechanical technology", "associates in applied"
        ],
        "allied_degrees": [
            "applied science", "polytechnic", "industrial technology"
        ],
        "relevant_certs": [
            "journeyman", "master electrician", "epa 608", "osha", "welding", "ase",
            "nccer", "licensed contractor", "universal epa"
        ]
    }
}


def _classify_role_domain(jd_text: str) -> tuple:
    """
    Classify the professional domain of the target role from job title and responsibilities.
    Returns (primary_domain: str, metadata: dict)
    """
    if not jd_text or not isinstance(jd_text, str):
        return "software", {"confidence": 1.0, "secondary_domain": None, "is_ambiguous": False, "scores": {}}

    jd_lower = jd_text.lower()
    first_line = jd_text.strip().split('\n')[0][:120].lower()

    scores = {d: 0 for d in ROLE_DOMAINS}
    for domain, data in ROLE_DOMAINS.items():
        title_hits = sum(1 for anchor in data.get("title_anchors", []) if anchor in first_line)
        body_hits = sum(1 for kw in data["keywords"] if kw in jd_lower)
        scores[domain] = (title_hits * 4) + body_hits

    sorted_domains = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    best_domain, best_score = sorted_domains[0]
    second_domain, second_score = sorted_domains[1] if len(sorted_domains) > 1 else (None, 0)

    if best_score < 1:
        return "general", {
            "confidence": 0.0,
            "secondary_domain": None,
            "is_ambiguous": False,
            "scores": scores
        }

    margin = best_score - second_score
    is_ambiguous = bool(second_score > 0 and margin <= 1)
    confidence = round(min(1.0, (margin + 0.5 * best_score) / (best_score + 1.0)), 2)

    meta = {
        "confidence": confidence,
        "secondary_domain": second_domain if second_score > 0 else None,
        "is_ambiguous": is_ambiguous,
        "scores": scores
    }
    return best_domain, meta


def _detect_role_domain(jd_text: str) -> str:
    """Backward-compatible helper returning primary domain name."""
    domain, _ = _classify_role_domain(jd_text)
    return domain


def compute_industry_ats_score(resume_data: dict, jd_text: str, matched_skills: list, missing_skills: list, text: str) -> tuple:
    """
    Industry-Standard 5-Pillar Weighted ATS Scoring Model (Jobscan & Resume Worded standard):
    - Pillar 1: Skills & Keyword Match (40 pts max)
    - Pillar 2: Experience & Responsibility Alignment (25 pts max)
    - Pillar 3: Education & Credentials Match (15 pts max)
    - Pillar 4: Content Impact & Action Verbs (10 pts max)
    - Pillar 5: ATS Formatting & Parseability (10 pts max)
    """
    # ── 1. Skills & Keyword Match (40 pts max) ───────────────────
    valid_matched = [s for s in matched_skills if isinstance(s, str) and s.strip()] if isinstance(matched_skills, list) else []
    valid_missing = [s for s in missing_skills if isinstance(s, str) and s.strip()] if isinstance(missing_skills, list) else []

    total_jd_skills = len(valid_matched) + len(valid_missing)
    if total_jd_skills > 0:
        skill_ratio = len(valid_matched) / total_jd_skills
        if len(valid_missing) == 0 and len(valid_matched) >= 5:
            skill_score = 40
        else:
            skill_score = round(skill_ratio * 40)
        skill_explanation = f"Matched {len(valid_matched)} of {total_jd_skills} identified target requirements ({round(skill_ratio * 100)}% coverage)."
    else:
        # Zero skills extracted or identified from job description -> 0 score
        skill_score = 0
        skill_explanation = "No identifiable technical skills or qualifications detected in job description (0/40)."

    skill_score = _clamp_pillar(skill_score, 0, 40)
    skill_pct = round((skill_score / 40) * 100) if skill_score > 0 else 0
    skill_evidence = {
        "matched_count": len(valid_matched),
        "missing_count": len(valid_missing),
        "total_jd_skills": total_jd_skills,
        "coverage_percentage": skill_pct
    }

    # ── 2. Experience & Role Alignment (25 pts max) ─────────────
    exp = resume_data.get('experience', []) if isinstance(resume_data, dict) else []
    exp_entries = []
    exp_bullets = []

    if isinstance(exp, list):
        for e in exp:
            if isinstance(e, dict):
                role = str(e.get('role', '') or '').strip()
                company = str(e.get('company', '') or '').strip()
                bullets = e.get('details', [])
                valid_b = []
                if isinstance(bullets, list):
                    valid_b = [str(b).strip() for b in bullets if str(b).strip()]
                elif isinstance(bullets, str) and bullets.strip():
                    valid_b = [bullets.strip()]
                if role or company or valid_b:
                    exp_entries.append({'role': role, 'company': company, 'bullets': valid_b})
                    exp_bullets.extend(valid_b)
            elif isinstance(e, str) and e.strip():
                exp_bullets.append(e.strip())
                exp_entries.append({'role': '', 'company': '', 'bullets': [e.strip()]})
    elif isinstance(exp, str) and exp.strip():
        exp_bullets.append(exp.strip())
        exp_entries.append({'role': '', 'company': '', 'bullets': [exp.strip()]})

    exp_text = " ".join(exp_bullets).strip()

    # If no verifiable experience entries exist, award 0 points
    if not exp_entries or len(exp_text) < 15:
        exp_score = 0
        exp_explanation = "No verifiable professional experience entries detected in resume text (0/25)."
        exp_evidence = {
            "role_count": 0,
            "detailed_bullets_count": 0,
            "metric_bullets_count": 0,
            "semantic_similarity": 0.0,
            "skills_in_experience": 0,
            "role_title_aligned": False
        }
    else:
        # A. Semantic Relevance (supporting evidence)
        sim_factor = 0.0
        jd_sample = (jd_text or "")[:1500].strip()
        if embedding_model is not None and len(jd_sample) >= 20:
            try:
                exp_sample = exp_text[:1500]
                cos_val = util.cos_sim(
                    embedding_model.encode(exp_sample, convert_to_tensor=True),
                    embedding_model.encode(jd_sample, convert_to_tensor=True)
                ).item()
                if math.isfinite(cos_val):
                    # Normalized similarity: unrelated <= 0.15 (0.0), highly aligned >= 0.60 (1.0)
                    sim_factor = max(0.0, min(1.0, (cos_val - 0.15) / 0.45))
            except Exception:
                sim_factor = 0.0

        # Lexical keyword fallback / support for different phrasing
        jd_words = set(re.findall(r'\b[a-z]{3,15}\b', jd_sample.lower())) - {
            "with", "have", "must", "work", "role", "team", "will", "from", "that", "this",
            "able", "year", "years", "experience", "candidate", "responsibilities", "skills"
        }
        exp_words = set(re.findall(r'\b[a-z]{3,15}\b', exp_text.lower()))
        lexical_overlap = len(jd_words & exp_words) / max(1, len(jd_words)) if jd_words else 0.0

        # Use lexical overlap if embedding model is unavailable or yielded zero
        if embedding_model is None:
            sim_factor = min(1.0, lexical_overlap * 2.5)

        # B. Demonstrated Skill Application in Professional Experience
        exp_text_lower = exp_text.lower()
        skills_in_exp = [s for s in valid_matched if s.lower() in exp_text_lower]
        skill_app_ratio = len(skills_in_exp) / max(1, len(valid_matched)) if valid_matched else 0.0

        # C. Role Title Alignment
        has_role_match = False
        if jd_sample:
            for entry in exp_entries:
                r_lower = entry['role'].lower()
                if any(w in r_lower for w in jd_words if len(w) > 4):
                    has_role_match = True
                    break

        role_boost = 0.15 if has_role_match else 0.0

        # Combined relevance factor (0.0 to 1.0)
        relevance_score = max(0.0, min(1.0, (0.55 * sim_factor) + (0.40 * skill_app_ratio) + role_boost))

        # D. Professional Substance & Accomplishment Evidence (0.0 to 1.0)
        role_count = len(exp_entries)
        detailed_bullets = [b for b in exp_bullets if len(b) >= 25]
        metric_bullets = [b for b in exp_bullets if re.search(r'\b(?:\d+[\%kKmM\+]?|\d+\.\d+)\b', b)]

        depth_score = 0.4  # Baseline for structured roles
        if role_count >= 2:
            depth_score += 0.2
        if len(detailed_bullets) >= 3:
            depth_score += 0.2
        if len(metric_bullets) >= 2:
            depth_score += 0.2
        depth_score = min(1.0, depth_score)

        # Synthesis (25 pts max):
        # Relevance: up to 18 pts
        # Substance: up to 7 pts, gated by relevance (irrelevant depth earns minimal credit)
        raw_exp_score = (relevance_score * 18.0) + (depth_score * 7.0 * (0.15 + 0.85 * relevance_score))
        exp_score = _clamp_pillar(raw_exp_score, 0, 25)

        exp_evidence = {
            "role_count": role_count,
            "detailed_bullets_count": len(detailed_bullets),
            "metric_bullets_count": len(metric_bullets),
            "semantic_similarity": round(sim_factor, 2),
            "skills_in_experience": len(skills_in_exp),
            "role_title_aligned": has_role_match
        }
        if relevance_score >= 0.70:
            exp_explanation = f"Strong domain alignment ({round(sim_factor * 100)}% similarity). Demonstrated {len(skills_in_exp)} key skill(s) across {role_count} role(s) with {len(metric_bullets)} quantified bullet(s)."
        elif relevance_score >= 0.35:
            exp_explanation = f"Moderate domain overlap ({round(sim_factor * 100)}% similarity). Demonstrated {len(skills_in_exp)} skill(s) across {role_count} role(s)."
        else:
            exp_explanation = f"Low relevance to target requirements ({round(sim_factor * 100)}% similarity). Background differs substantially from target role."

    exp_pct = round((exp_score / 25) * 100) if exp_score > 0 else 0

    # ── 3. Education & Credentials (15 pts max) ─────────────────
    text_lower = (text or "").lower()
    jd_lower = (jd_text or "").lower()
    target_domain, domain_meta = _classify_role_domain(jd_text)
    domain_info = ROLE_DOMAINS.get(target_domain, {})
    secondary_domain = domain_meta.get("secondary_domain")
    secondary_info = ROLE_DOMAINS.get(secondary_domain, {}) if secondary_domain else {}

    # Extract structured education entries to ensure both structured and raw text evidence are checked
    edu_list = resume_data.get('education', []) if isinstance(resume_data, dict) else []
    edu_str_parts = []
    if isinstance(edu_list, list):
        for e in edu_list:
            if isinstance(e, dict):
                edu_str_parts.extend([str(v) for v in e.values() if v])
            elif isinstance(e, str):
                edu_str_parts.append(e)
    elif isinstance(edu_list, str):
        edu_str_parts.append(edu_list)

    combined_edu_text = (text_lower + " " + " ".join(edu_str_parts).lower()).strip()

    # Check for degrees in structured education and full text
    has_primary_degree = any(d in combined_edu_text for d in domain_info.get("primary_degrees", []))
    has_allied_degree = (
        any(d in combined_edu_text for d in domain_info.get("allied_degrees", [])) or
        (bool(secondary_domain) and any(d in combined_edu_text for d in secondary_info.get("primary_degrees", [])))
    )
    has_any_accredited_degree = (
        has_primary_degree or has_allied_degree or
        any(d in combined_edu_text for d in [
            'degree', 'diploma', 'university', 'college', 'institute', 'polytechnic',
            'associate', 'bachelor', 'master', 'b.s', 'b.a', 'm.s', 'm.a', 'ph.d',
            'doctorate', 'licenciatura', 'b.tech', 'm.tech', 'b.com', 'm.com', 'bsn', 'msn',
            'b.e', 'bba', 'mba'
        ])
    )

    # Check degree completion vs in-progress status
    in_progress_patterns = [
        r'\b(?:expected|anticipate|anticipated)\s+(?:graduation|completion|\d{4})\b',
        r'\b(?:in\s+progress|currently\s+pursuing|pursuing|candidate\s+for|enrolled\s+in)\b',
        r'\bexpected\s*:\s*\d{4}\b',
        r'\b\d{4}\s*-\s*(?:present|current|expected)\b'
    ]
    has_completed_degree = False
    has_in_progress_degree = False

    if isinstance(edu_list, list) and edu_list:
        for e in edu_list:
            e_text = " ".join([str(v) for v in e.values() if v]).lower() if isinstance(e, dict) else str(e).lower()
            entry_in_prog = any(bool(re.search(pat, e_text)) for pat in in_progress_patterns)
            entry_has_deg = (
                any(d in e_text for d in domain_info.get("primary_degrees", [])) or
                any(d in e_text for d in domain_info.get("allied_degrees", [])) or
                any(d in e_text for d in ['degree', 'bachelor', 'master', 'b.s', 'b.a', 'm.s', 'ph.d', 'b.tech', 'bsn', 'diploma'])
            )
            if entry_has_deg:
                if entry_in_prog:
                    has_in_progress_degree = True
                else:
                    has_completed_degree = True

    # If structured education didn't identify status or in raw text fallback:
    if not has_completed_degree and not has_in_progress_degree:
        edu_lines = [l.strip().lower() for l in text_lower.split('\n') if l.strip()]
        raw_completed = False
        raw_in_prog = False
        for line in edu_lines:
            line_has_deg = (
                any(d in line for d in domain_info.get("primary_degrees", [])) or
                any(d in line for d in domain_info.get("allied_degrees", [])) or
                any(d in line for d in ['degree', 'bachelor', 'master', 'b.s', 'b.a', 'm.s', 'ph.d', 'b.tech', 'bsn', 'diploma'])
            )
            if line_has_deg:
                if any(bool(re.search(pat, line)) for pat in in_progress_patterns):
                    raw_in_prog = True
                else:
                    raw_completed = True

        if raw_completed:
            has_completed_degree = True
            has_in_progress_degree = False
        elif raw_in_prog:
            has_in_progress_degree = True
        elif has_primary_degree or has_allied_degree or has_any_accredited_degree:
            has_completed_degree = True
    elif has_completed_degree:
        has_in_progress_degree = False

    certs_list = resume_data.get('certifications', []) if isinstance(resume_data, dict) else []
    if isinstance(certs_list, str):
        certs_list = [certs_list]
    elif not isinstance(certs_list, list):
        certs_list = []

    # Detect if the job description explicitly requires or prefers an educational degree
    degree_req_pattern = r'\b(?:bachelor|master|phd|doctorate|degree)\b.*?\b(?:required|mandatory|must\s+have)\b|\b(?:required|mandatory|must\s+have)\b.*?\b(?:bachelor|master|phd|doctorate|degree)\b'
    degree_required_in_jd = bool(re.search(degree_req_pattern, jd_lower))
    degree_pref_pattern = r'\b(?:bachelor|master|phd|doctorate|degree)\b.*?\b(?:preferred|desired|a\s+plus)\b|\b(?:preferred|desired|a\s+plus)\b.*?\b(?:bachelor|master|phd|doctorate|degree)\b'
    degree_preferred_in_jd = bool(re.search(degree_pref_pattern, jd_lower))

    # Detect if the role explicitly welcomes/accepts currently enrolled students or interns
    job_accepts_enrolled_pattern = r'\b(?:intern|internship|co-?op|current\s+students?|currently\s+enrolled|pursuing\s+(?:degree|bachelor|master|phd)|students?\s+(?:welcome|accepted|eligible|may\s+apply))\b'
    job_accepts_enrolled = bool(re.search(job_accepts_enrolled_pattern, jd_lower))

    # Detect if the job description explicitly requires or prefers a professional credential or license
    mandatory_creds_in_jd = []
    preferred_creds_in_jd = []
    for cert_kw in domain_info.get("relevant_certs", []):
        mand_pattern = rf'\b(?:required|mandatory|must\s+(?:have|possess|hold)|license\s+required)\b.*?{re.escape(cert_kw)}\b|{re.escape(cert_kw)}\b.*?\b(?:required|mandatory|license\s+required)\b'
        pref_pattern = rf'\b(?:preferred|a\s+plus|bonus|nice\s+to\s+have|desired|advantage)\b.*?{re.escape(cert_kw)}\b|{re.escape(cert_kw)}\b.*?\b(?:preferred|a\s+plus|desired|bonus)\b'
        if re.search(mand_pattern, jd_lower):
            mandatory_creds_in_jd.append(cert_kw)
        elif re.search(pref_pattern, jd_lower):
            preferred_creds_in_jd.append(cert_kw)

    # Evaluate candidate's certifications for domain relevance
    relevant_certs_found = []
    unrelated_certs_found = []
    mandatory_matched = []
    preferred_matched = []

    for c in certs_list:
        c_str = str(c).strip()
        c_low = c_str.lower()
        if not c_str:
            continue
        is_rel = (
            any(rc in c_low for rc in domain_info.get("relevant_certs", [])) or
            (bool(secondary_info) and any(rc in c_low for rc in secondary_info.get("relevant_certs", []))) or
            (len(c_low) > 3 and c_low in jd_lower)
        )
        if is_rel:
            relevant_certs_found.append(c_str)
            if any(mc in c_low for mc in mandatory_creds_in_jd):
                mandatory_matched.append(c_str)
            elif any(pc in c_low for pc in preferred_creds_in_jd):
                preferred_matched.append(c_str)
        else:
            unrelated_certs_found.append(c_str)

    # Degree scoring: Role-Aware Domain Relevance & In-Progress Tracking
    if has_in_progress_degree and not has_completed_degree:
        if job_accepts_enrolled:
            if has_primary_degree:
                degree_score = 10
                degree_desc = f"Identified in-progress qualification in {target_domain.capitalize()} (Enrolled/student candidates accepted by role; full credit +10 pts)"
                degree_label = f"In-Progress (Accepted by Role - {target_domain.capitalize()})"
            elif has_allied_degree:
                degree_score = 8
                degree_desc = f"Identified in-progress allied qualification in {target_domain.capitalize()} field (Enrolled candidates accepted; +8 pts)"
                degree_label = f"In-Progress Allied ({target_domain.capitalize()})"
            else:
                degree_score = 6
                degree_desc = f"Identified in-progress higher education coursework outside target {target_domain} domain (+6 pts)"
                degree_label = "In-Progress (Non-Domain)"
        else:
            if has_primary_degree:
                degree_score = 7
                degree_desc = f"Identified in-progress/anticipated qualification in {target_domain.capitalize()} (Expected graduation; partial credit +7 pts)"
                degree_label = f"In-Progress ({target_domain.capitalize()})"
            elif has_allied_degree:
                degree_score = 6
                degree_desc = f"Identified in-progress allied qualification in {target_domain.capitalize()} field (+6 pts)"
                degree_label = f"In-Progress Allied ({target_domain.capitalize()})"
            else:
                degree_score = 4
                degree_desc = f"Identified in-progress higher education coursework outside target {target_domain} domain (+4 pts)"
                degree_label = "In-Progress (Non-Domain)"
            if degree_required_in_jd:
                degree_desc += " [Note: Target role specifies completed degree]"
    elif has_primary_degree:
        degree_score = 10
        degree_desc = f"Documented domain-relevant qualification in {target_domain.capitalize()} (+10 pts)"
        degree_label = f"Domain-Relevant ({target_domain.capitalize()})"
    elif has_allied_degree:
        degree_score = 8
        degree_desc = f"Documented allied/related qualification in {target_domain.capitalize()} field (+8 pts)"
        degree_label = f"Allied Domain ({target_domain.capitalize()})"
    elif has_any_accredited_degree:
        degree_score = 6
        degree_desc = f"Documented higher education credential (unrelated to target {target_domain} domain) (+6 pts)"
        degree_label = "General / Non-Domain Degree"
    elif relevant_certs_found:
        # Alternative career pathway / vocational credential without traditional degree
        degree_score = 6
        degree_desc = f"Alternative career pathway / vocational credential in {target_domain.capitalize()} (+6 pts)"
        degree_label = "Vocational / Alternative Pathway"
    else:
        degree_score = 0
        if degree_required_in_jd:
            degree_desc = "No collegiate degree or recognized vocational qualification identified for required education (0 pts)"
        else:
            degree_desc = "No collegiate degree or recognized vocational qualification identified (0 pts)"
        degree_label = "None Identified"

    # Certification scoring: Role-Aware Relevance & Mandatory/Preferred Requirements
    cert_score = 0
    cert_desc = ""
    if mandatory_matched:
        cert_score = 4
        cert_desc = f", plus documented candidate-reported mandatory credential ({', '.join(mandatory_matched)}) (+4 pts)"
    elif preferred_matched:
        cert_score = 3
        cert_desc = f", plus documented candidate-reported preferred credential ({', '.join(preferred_matched)}) (+3 pts)"
    elif relevant_certs_found:
        cert_score = 3
        cert_desc = f", plus {len(relevant_certs_found)} candidate-reported domain-relevant certification(s) (+3 pts)"

    if mandatory_creds_in_jd and not mandatory_matched:
        cert_desc += f", but lacks stated mandatory credential ({', '.join(mandatory_creds_in_jd)}) (0 pts)"
    elif unrelated_certs_found and not mandatory_matched and not preferred_matched and not relevant_certs_found:
        cert_desc += f", though {len(unrelated_certs_found)} certification(s) found are unrelated to target {target_domain} domain (0 pts)"

    # Academic honors / GPA scoring (requires degree or qualification baseline)
    has_honors = bool(
        ('gpa' in combined_edu_text or 'cgpa' in combined_edu_text or 'honor' in combined_edu_text or 'magna cum laude' in combined_edu_text or 'summa cum laude' in combined_edu_text)
        and degree_score > 0
        and not (has_in_progress_degree and not has_completed_degree)
    )
    honors_score = 2 if has_honors else 0
    honors_desc = ", with academic honors/GPA documented (+2 pts)" if has_honors else ""

    edu_score = _clamp_pillar(degree_score + cert_score + honors_score, 0, 15)
    edu_pct = round((edu_score / 15) * 100) if edu_score > 0 else 0
    edu_explanation = degree_desc + cert_desc + honors_desc

    # Missing mandatory and preferred credential tracking
    missing_mandatory_creds = [c for c in mandatory_creds_in_jd if not any(c in m.lower() for m in mandatory_matched)]
    missing_preferred_creds = [c for c in preferred_creds_in_jd if not any(c in p.lower() for p in preferred_matched)]

    missing_mandatory_degree = bool(
        degree_required_in_jd and not (has_primary_degree or has_allied_degree)
    )

    warnings = []
    if missing_mandatory_creds:
        creds_str = ", ".join(c.upper() for c in missing_mandatory_creds)
        warnings.append({
            "type": "missing_mandatory_credential",
            "severity": "warning",
            "requirement": f"Mandatory Credential: {creds_str}",
            "detected_requirement": f"Job description explicitly mandates credential ({creds_str}).",
            "resume_evidence": f"No active {creds_str} license or credential was identified in submitted resume.",
            "message": f"Missing mandatory credential: Job requires {creds_str}, but no matching credential was identified in resume."
        })

    if degree_required_in_jd:
        if not (has_primary_degree or has_allied_degree or has_any_accredited_degree):
            warnings.append({
                "type": "missing_mandatory_degree",
                "severity": "warning",
                "requirement": f"Required Degree in {target_domain.capitalize()}",
                "detected_requirement": f"Job description requires a completed collegiate degree in {target_domain.capitalize()} or related field.",
                "resume_evidence": "No collegiate degree or recognized vocational qualification was identified in resume.",
                "message": f"Missing mandatory degree: Job posting specifies required education in {target_domain.capitalize()}, but none was found."
            })
        elif has_in_progress_degree and not has_completed_degree and not job_accepts_enrolled:
            warnings.append({
                "type": "in_progress_degree_for_completed_role",
                "severity": "warning",
                "requirement": f"Completed Degree in {target_domain.capitalize()}",
                "detected_requirement": "Job description requires a completed degree, but candidate qualification is currently in progress.",
                "resume_evidence": f"Candidate documents in-progress {target_domain.capitalize()} study without verified completion.",
                "message": f"In-progress degree: Target role specifies a completed degree. Candidate documents in-progress study without graduation."
            })
        elif not (has_primary_degree or has_allied_degree) and has_any_accredited_degree:
            warnings.append({
                "type": "unrelated_degree_for_required_role",
                "severity": "warning",
                "requirement": f"Domain-Relevant Degree in {target_domain.capitalize()}",
                "detected_requirement": f"Job description specifies a required degree in {target_domain.capitalize()} or related field.",
                "resume_evidence": f"Resume documents higher education outside the target {target_domain.capitalize()} domain.",
                "message": f"Non-domain degree: Target role specifies education in {target_domain.capitalize()}; documented credential is unrelated."
            })

    qualification_warnings = [w["message"] for w in warnings]

    edu_evidence = {
        "target_domain": target_domain,
        "domain_confidence": domain_meta.get("confidence", 1.0),
        "secondary_domain": domain_meta.get("secondary_domain"),
        "is_ambiguous_role": domain_meta.get("is_ambiguous", False),
        "degree_level": degree_label,
        "degree_in_progress": bool(has_in_progress_degree and not has_completed_degree),
        "domain_relevant_degree": has_primary_degree or has_allied_degree,
        "job_accepts_enrolled": job_accepts_enrolled,
        "relevant_certifications": relevant_certs_found,
        "unrelated_certifications": unrelated_certs_found,
        "degree_required_in_jd": degree_required_in_jd,
        "degree_preferred_in_jd": degree_preferred_in_jd,
        "missing_mandatory_degree": missing_mandatory_degree,
        "mandatory_credential_required": bool(mandatory_creds_in_jd),
        "mandatory_credential_matched": bool(mandatory_matched),
        "mandatory_credentials_required": [c.upper() for c in mandatory_creds_in_jd],
        "mandatory_credentials_matched": mandatory_matched,
        "mandatory_credentials_missing": [c.upper() for c in missing_mandatory_creds],
        "preferred_credential_required": bool(preferred_creds_in_jd),
        "preferred_credential_matched": bool(preferred_matched),
        "preferred_credentials_required": [c.upper() for c in preferred_creds_in_jd],
        "preferred_credentials_matched": preferred_matched,
        "preferred_credentials_missing": [c.upper() for c in missing_preferred_creds],
        "honors_or_gpa_detected": has_honors,
        "warnings": qualification_warnings,
        "structured_warnings": warnings,
        "disclaimer": "Qualification matching is based on automated text parsing. Absence of a keyword in the resume indicates a missing document match, not an automatic disqualification; verify credentials directly with the applicant."
    }

    # ── 4. Content Impact & Action Verbs (10 pts max) ───────────
    projects_desc = " ".join([p.get('description', '') if isinstance(p, dict) else str(p) for p in (resume_data.get('projects', []) if isinstance(resume_data, dict) else [])])
    metric_matches = re.findall(r'\b(?:\d+[\%kKmM\+]?|\d+\.\d+)\b', exp_text + " " + projects_desc)
    action_verbs = ['architected', 'developed', 'built', 'engineered', 'optimized', 'integrated', 'designed', 'automated', 'led', 'spearheaded', 'resolved', 'trained', 'mentored', 'implemented']
    verb_count = sum(1 for v in action_verbs if v in text_lower)

    if len(exp_text.strip()) + len(projects_desc.strip()) < 20:
        impact_score = 0
        impact_explanation = "Insufficient experience or project descriptions to evaluate measurable impact (0/10)."
    else:
        impact_score = 3
        if len(metric_matches) >= 3:
            impact_score += 4
        elif len(metric_matches) >= 1:
            impact_score += 2

        if verb_count >= 4:
            impact_score += 3
        elif verb_count >= 1:
            impact_score += 1

        impact_explanation = f"Identified {len(metric_matches)} quantified metric accomplishment(s) and {verb_count} action-oriented power verb(s). (Measures writing style & impact, independent of role)."

    impact_score = _clamp_pillar(impact_score, 0, 10)
    impact_pct = round((impact_score / 10) * 100) if impact_score > 0 else 0
    impact_evidence = {
        "quantified_metrics_count": len(metric_matches),
        "active_power_verbs_count": verb_count
    }

    # ── 5. ATS Formatting & Parseability (10 pts max) ───────────
    c_info = resume_data.get('candidate_info', {}) if isinstance(resume_data, dict) else {}
    has_email = bool(c_info.get('email')) if isinstance(c_info, dict) else False
    has_phone = bool(c_info.get('phone')) if isinstance(c_info, dict) else False
    has_links = bool(c_info.get('linkedin') or c_info.get('github')) if isinstance(c_info, dict) else False

    parse_score = 0
    if len(text_lower.strip()) >= 50:
        parse_score = 4
        if has_email and has_phone:
            parse_score += 3
        if has_links:
            parse_score += 3

        contact_items = []
        if has_email and has_phone:
            contact_items.append("complete email & phone")
        elif has_email or has_phone:
            contact_items.append("partial contact info")
        else:
            contact_items.append("missing contact info")
        if has_links:
            contact_items.append("verified professional profile links (LinkedIn/GitHub)")
        parse_explanation = f"Clean machine-readable text with {', '.join(contact_items)}. (Measures document parseability, not job qualification)."
    else:
        parse_explanation = "Unparseable or empty document text (0/10)."

    parse_score = _clamp_pillar(parse_score, 0, 10)
    parse_pct = round((parse_score / 10) * 100) if parse_score > 0 else 0
    parse_evidence = {
        "text_length": len(text_lower.strip()),
        "has_email": has_email,
        "has_phone": has_phone,
        "has_links": has_links
    }

    # ── Overall Score & Match Level ─────────────────────────────
    # Derived consistently and strictly as the sum of all five pillars
    total_score = skill_score + exp_score + edu_score + impact_score + parse_score
    total_score = _clamp_pillar(total_score, 0, 100)

    if total_score >= 85:
        match_level = "Exceptional Match"
    elif total_score >= 70:
        match_level = "Strong Match"
    elif total_score >= 50:
        match_level = "Good Match"
    else:
        match_level = "Needs Optimization"

    breakdown = {
        "skills_match": {
            "name": "Skills & Keywords",
            "score": skill_score,
            "max": 40,
            "percentage": skill_pct,
            "status": "Exceptional (100%)" if skill_pct >= 90 else "Strong" if skill_pct >= 75 else "Moderate" if skill_pct >= 50 else "Needs Improvement",
            "explanation": skill_explanation,
            "evidence": skill_evidence
        },
        "experience_alignment": {
            "name": "Experience Alignment",
            "score": exp_score,
            "max": 25,
            "percentage": exp_pct,
            "status": "Exceptional" if exp_pct >= 90 else "Strong" if exp_pct >= 75 else "Moderate" if exp_pct >= 50 else "Needs Improvement",
            "explanation": exp_explanation,
            "evidence": exp_evidence
        },
        "education_credentials": {
            "name": "Education & Credentials",
            "score": edu_score,
            "max": 15,
            "percentage": edu_pct,
            "status": "Exceptional" if edu_pct >= 90 else "Strong" if edu_pct >= 75 else "Moderate" if edu_pct >= 50 else "Needs Improvement",
            "explanation": edu_explanation,
            "evidence": edu_evidence
        },
        "content_impact": {
            "name": "Content Impact & Metrics",
            "score": impact_score,
            "max": 10,
            "percentage": impact_pct,
            "status": "Exceptional" if impact_pct >= 90 else "Strong" if impact_pct >= 75 else "Moderate" if impact_pct >= 50 else "Needs Improvement",
            "explanation": impact_explanation,
            "evidence": impact_evidence
        },
        "ats_parseability": {
            "name": "ATS Format Compliance",
            "score": parse_score,
            "max": 10,
            "percentage": parse_pct,
            "status": "Pass (100%)" if parse_pct >= 80 else "Partial" if parse_pct >= 40 else "Needs Improvement",
            "explanation": parse_explanation,
            "evidence": parse_evidence
        }
    }

    return total_score, breakdown, match_level


# ────────────────────────────────────────────────────────────
# Unified Analysis Pipeline
# ────────────────────────────────────────────────────────────
def run_analysis(pdf_bytes: bytes, job_description: str) -> dict:
    """Execute the full end-to-end resume analysis pipeline."""
    # 1. Extract text
    text = extract_text_from_pdf(pdf_bytes)
    if len(text.strip()) < 30:
        raise ValueError("PDF text is empty or unreadable.")

    # Validate job description
    jd_clean = (job_description or "").strip()
    if len(jd_clean) < 30:
        raise ValueError("Job description is too short or invalid to perform skills evaluation.")

    # 2. Extract structured resume data
    print("[NLP] Extracting structured resume sections...")
    resume_data = extract_resume_data(text)

    # 3. Gap Analysis vs Job Description
    print("[NLP] Running ATS gap analysis...")
    resume_skills = resume_data.get("skills", [])
    gap_data = get_suggestions_and_missing(text, job_description, resume_skills)

    matched_skills = gap_data.get("matched_skills", [])
    missing_skills = gap_data.get("missing_skills", [])

    # 4. Compute Industry-Standard 5-Pillar ATS Compatibility Score
    score, breakdown, match_level = compute_industry_ats_score(
        resume_data, job_description, matched_skills, missing_skills, text
    )

    # Evaluation state auditing notes
    evaluation_notes = []
    if (len(matched_skills) + len(missing_skills)) == 0:
        evaluation_notes.append("No technical or qualification skills were extracted from the job description.")
    if embedding_model is None:
        evaluation_notes.append("Neural embedding model was offline; semantic similarity operated in lexical keyword mode.")
    if not resume_data.get('experience'):
        evaluation_notes.append("No structured professional experience entries were identified in the resume.")
    if len(text.strip()) < 100:
        evaluation_notes.append("Resume contains very brief text (< 100 characters); verify PDF is not a scanned image.")

    # Include explicit mandatory qualification warnings so they surface in top-level API
    edu_warnings = breakdown.get("education_credentials", {}).get("evidence", {}).get("warnings", [])
    for w in edu_warnings:
        if w not in evaluation_notes:
            evaluation_notes.append(w)

    # 5. Build final payload
    payload = {
        "status": "completed",
        "score": score,
        "match_level": match_level,
        "scoring_breakdown": breakdown,
        "evaluation_notes": evaluation_notes,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "extracted_skills": resume_skills,
        "recommendations": gap_data.get("recommendations", {}),
        "suggestions": gap_data.get("suggestions", []),
        "candidate_info": resume_data.get("candidate_info", {}),
        "summary": resume_data.get("summary", ""),
        "experience": resume_data.get("experience", []),
        "education": resume_data.get("education", []),
        "projects": resume_data.get("projects", []),
        "certifications": resume_data.get("certifications", []),
        "languages": resume_data.get("languages", []),
        "achievements": resume_data.get("achievements", [])
    }
    return payload


# ────────────────────────────────────────────────────────────
# Async Background Worker
# ────────────────────────────────────────────────────────────
def process_analysis_worker(pdf_bytes: bytes, job_description: str, webhook_url: str, internal_token: str = ""):
    print(f"[NLP] Starting background analysis job (Webhook: {webhook_url})")
    try:
        payload = run_analysis(pdf_bytes, job_description)
        print(f"[SUCCESS] Background analysis complete. Semantic Score: {payload['score']}")
    except Exception as e:
        print(f"[ERROR] Background analysis failed: {e}")
        payload = {"status": "failed", "error": str(e)}

    # Send webhook back to backend
    if webhook_url:
        print(f"[NLP] Sending webhook back to {webhook_url}")
        try:
            headers = {'X-Internal-Token': internal_token} if internal_token else {}
            requests.post(webhook_url, json=payload, headers=headers, timeout=15)
            print("[SUCCESS] Webhook delivered")
        except requests.RequestException as e:
            print(f"[ERROR] Failed to reach webhook: {e}")


# ────────────────────────────────────────────────────────────
# ROUTES
# ────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "OK",
        "service": "AI Resume Analyzer",
        "groq_ready": bool(GROQ_API_KEY),
        "llm_ready": bool(GROQ_API_KEY or (API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE")),
        "embeddings_ready": embedding_model is not None,
        "supported_models": [f"{m} (Groq)" for m in GROQ_MODELS] if GROQ_API_KEY else LLM_MODELS
    })


@app.route('/analyze', methods=['POST'])
def analyze_sync():
    """Synchronous analysis endpoint: directly parses and returns results."""
    # Service Authentication check
    expected_token = os.environ.get('INTERNAL_NLP_TOKEN', '')
    provided_token = request.headers.get('X-Internal-Token', '')
    if expected_token and provided_token != expected_token:
        return jsonify({"error": "Unauthorized"}), 401

    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files['resume']
    job_description = request.form.get('job_description', '').strip()

    if not resume_file.filename or not resume_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400

    try:
        pdf_bytes = resume_file.read()
        payload = run_analysis(pdf_bytes, job_description)
        return jsonify(payload), 200
    except Exception as e:
        print(f"[ERROR] Analysis error: {e}")
        return jsonify({"status": "failed", "error": str(e)}), 500


@app.route('/analyze/async', methods=['POST'])
def analyze_async():
    """Asynchronous analysis endpoint: runs in background thread and fires webhook."""
    expected_token = os.environ.get('INTERNAL_NLP_TOKEN', '')
    provided_token = request.headers.get('X-Internal-Token', '')
    if expected_token and provided_token != expected_token:
        return jsonify({"error": "Unauthorized"}), 401

    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files['resume']
    job_description = request.form.get('job_description', '').strip()
    webhook_url = request.form.get('webhook_url', '').strip()

    if not resume_file.filename or not resume_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400

    if not webhook_url:
        return jsonify({"error": "webhook_url is required for async processing"}), 400

    pdf_bytes = resume_file.read()

    thread = threading.Thread(
        target=process_analysis_worker,
        args=(pdf_bytes, job_description, webhook_url, provided_token)
    )
    thread.daemon = True
    thread.start()

    return jsonify({"success": True, "message": "Analysis started in background"}), 202


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n[START] AI Service starting on port {port}")
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        print("[WARN] GEMINI_API_KEY is NOT SET. Using rule-based fallback.")
    app.run(host='0.0.0.0', port=port, debug=False)
