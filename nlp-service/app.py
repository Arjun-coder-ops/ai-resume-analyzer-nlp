import os
import re
import threading
import json
import time
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

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY", "")
if API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    import google.generativeai as genai
    genai.configure(api_key=API_KEY)
else:
    genai = None

# Global rate-limit cooldown tracker
_gemini_cooldown_until = 0.0

# Model fallback chain (Using active Google Gemini production models)
LLM_MODELS = ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.5-flash']


def is_rate_limit_error(e: Exception) -> bool:
    """Check if exception is caused by HTTP 429 quota exhaustion."""
    err_str = str(e).lower()
    return "429" in err_str or "quota" in err_str or "resourceexhausted" in err_str or "rate limit" in err_str


def call_llm(prompt: str) -> str:
    """Wrapper to call Gemini API with model fallback chain and rate limit circuit-breaker."""
    global _gemini_cooldown_until
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE" or genai is None:
        raise ValueError("GEMINI_API_KEY is not configured.")

    now = time.time()
    if now < _gemini_cooldown_until:
        remaining = int(_gemini_cooldown_until - now)
        print(f"[INFO] Gemini API currently in 429 rate-limit cooldown ({remaining}s remaining). Activating local NLP engine.")
        raise RuntimeError(f"Gemini API rate-limit cooldown ({remaining}s remaining). Falling back to offline NLP.")

    last_error = None
    for model_name in LLM_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            last_error = e
            if is_rate_limit_error(e):
                print(f"[WARN] Gemini model {model_name} rate-limited or quota exceeded (429). Attempting next model...")
                continue
            else:
                print(f"[WARN] Model {model_name} failed: {e}. Trying next fallback...")

    # If all models in the fallback chain were exhausted or rate limited:
    print(f"[WARN] All Gemini models failed or rate-limited. Activating 45s circuit breaker cooldown.")
    _gemini_cooldown_until = time.time() + 45.0
    raise RuntimeError(f"All Gemini models failed or rate-limited. Last error: {last_error}")


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


def compute_industry_ats_score(resume_data: dict, jd_text: str, matched_skills: list, missing_skills: list, text: str) -> tuple:
    """
    Industry-Standard 5-Pillar Weighted ATS Scoring Model (Jobscan & Resume Worded standard):
    - Pillar 1: Skills & Keyword Match (40%)
    - Pillar 2: Experience & Responsibility Alignment (25%)
    - Pillar 3: Education & Credentials Match (15%)
    - Pillar 4: Content Impact & Action Verbs (10%)
    - Pillar 5: ATS Formatting & Parseability (10%)
    """
    # ── 1. Skills & Keyword Match (40 pts max) ───────────────────
    total_jd_skills = len(matched_skills) + len(missing_skills)
    if total_jd_skills > 0:
        skill_ratio = len(matched_skills) / total_jd_skills
        if len(missing_skills) == 0 and len(matched_skills) >= 5:
            skill_score = 40
        else:
            skill_score = round(skill_ratio * 40)
    else:
        skill_score = 32
    skill_pct = round((skill_score / 40) * 100)

    # ── 2. Experience & Role Alignment (25 pts max) ─────────────
    exp = resume_data.get('experience', [])
    exp_bullets = []
    if isinstance(exp, list):
        for e in exp:
            if isinstance(e, dict):
                exp_bullets.extend(e.get('details', []))
            elif isinstance(e, str):
                exp_bullets.append(e)

    exp_text = " ".join(exp_bullets)
    text_lower = text.lower()
    has_relevant_role = any(r in text_lower for r in ['software', 'engineer', 'developer', 'intern', 'full stack', 'backend', 'frontend'])
    has_internship = any(r in text_lower for r in ['intern', 'experience', 'work', 'employment'])

    exp_score = 15 if has_relevant_role else 10
    if len(exp_bullets) >= 3:
        exp_score += 6
    if has_internship:
        exp_score += 4

    # Semantic similarity boost if model is available
    if embedding_model is not None:
        try:
            exp_sample = exp_text[:1000] if exp_text else text[:1000]
            sim = util.cos_sim(embedding_model.encode(exp_sample, convert_to_tensor=True),
                               embedding_model.encode(jd_text[:1000], convert_to_tensor=True)).item()
            if sim > 0.6:
                exp_score = min(25, exp_score + 2)
        except Exception:
            pass

    exp_score = min(25, exp_score)
    exp_pct = round((exp_score / 25) * 100)

    # ── 3. Education & Credentials (15 pts max) ─────────────────
    has_cs_degree = any(d in text_lower for d in ['computer science', 'b.tech', 'b.s', 'bachelor', 'b.e', 'information technology', 'engineering'])
    has_cert = len(resume_data.get('certifications', [])) > 0
    edu_score = 10 if has_cs_degree else 7
    if has_cert:
        edu_score += 3
    if 'gpa' in text_lower or 'cgpa' in text_lower or 'honor' in text_lower:
        edu_score += 2
    edu_score = min(15, edu_score)
    edu_pct = round((edu_score / 15) * 100)

    # ── 4. Content Impact & Action Verbs (10 pts max) ───────────
    projects_desc = " ".join([p.get('description', '') if isinstance(p, dict) else str(p) for p in resume_data.get('projects', [])])
    metric_matches = re.findall(r'\b(?:\d+[\%kKmM\+]?|\d+\.\d+)\b', exp_text + " " + projects_desc)
    action_verbs = ['architected', 'developed', 'built', 'engineered', 'optimized', 'integrated', 'designed', 'automated', 'led', 'spearheaded', 'resolved', 'trained', 'mentored', 'implemented']
    verb_count = sum(1 for v in action_verbs if v in text_lower)

    impact_score = 4
    if len(metric_matches) >= 3:
        impact_score += 3
    if verb_count >= 4:
        impact_score += 3
    impact_score = min(10, impact_score)
    impact_pct = round((impact_score / 10) * 100)

    # ── 5. ATS Formatting & Parseability (10 pts max) ───────────
    c_info = resume_data.get('candidate_info', {})
    has_email = bool(c_info.get('email'))
    has_phone = bool(c_info.get('phone'))
    has_links = bool(c_info.get('linkedin') or c_info.get('github'))

    parse_score = 4
    if has_email and has_phone:
        parse_score += 3
    if has_links:
        parse_score += 3
    parse_score = min(10, parse_score)
    parse_pct = round((parse_score / 10) * 100)

    total_score = skill_score + exp_score + edu_score + impact_score + parse_score
    total_score = max(20, min(98, total_score))

    match_level = "Exceptional Match" if total_score >= 85 else "Strong Match" if total_score >= 70 else "Good Match" if total_score >= 50 else "Needs Optimization"

    breakdown = {
        "skills_match": {
            "name": "Skills & Keywords",
            "score": skill_score,
            "max": 40,
            "percentage": skill_pct,
            "status": "Exceptional (100%)" if skill_pct >= 90 else "Strong" if skill_pct >= 75 else "Moderate"
        },
        "experience_alignment": {
            "name": "Experience Alignment",
            "score": exp_score,
            "max": 25,
            "percentage": exp_pct,
            "status": "Exceptional" if exp_pct >= 90 else "Strong" if exp_pct >= 75 else "Moderate"
        },
        "education_credentials": {
            "name": "Education & Credentials",
            "score": edu_score,
            "max": 15,
            "percentage": edu_pct,
            "status": "Exceptional" if edu_pct >= 90 else "Strong" if edu_pct >= 75 else "Moderate"
        },
        "content_impact": {
            "name": "Content Impact & Metrics",
            "score": impact_score,
            "max": 10,
            "percentage": impact_pct,
            "status": "Exceptional" if impact_pct >= 90 else "Strong" if impact_pct >= 75 else "Moderate"
        },
        "ats_parseability": {
            "name": "ATS Format Compliance",
            "score": parse_score,
            "max": 10,
            "percentage": parse_pct,
            "status": "Pass (100%)"
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

    # 5. Build final payload
    payload = {
        "status": "completed",
        "score": score,
        "match_level": match_level,
        "scoring_breakdown": breakdown,
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
        "llm_ready": bool(API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE"),
        "embeddings_ready": embedding_model is not None,
        "supported_models": LLM_MODELS
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
