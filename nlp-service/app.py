import os
import re
import threading
import json
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

# Model fallback chain
LLM_MODELS = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-flash-latest', 'gemini-pro']


def call_llm(prompt: str) -> str:
    """Wrapper to call Gemini API with model fallback chain."""
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE" or genai is None:
        raise ValueError("GEMINI_API_KEY is not configured.")

    last_error = None
    for model_name in LLM_MODELS:
        try:
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            if response and response.text:
                return response.text
        except Exception as e:
            last_error = e
            print(f"[WARN] Model {model_name} failed: {e}. Trying next fallback...")

    raise RuntimeError(f"All Gemini models failed. Last error: {last_error}")


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
    """Compare resume against job description to identify matched & missing skills and ATS tips."""
    prompt = f"""
You are an expert Technical Recruiter and ATS specialist.
Compare the resume text and candidate skills against the target Job Description.

Job Description:
------
{jd_text}
------

Resume Skills Identified:
------
{', '.join(resume_skills) if resume_skills else 'None listed'}
------

Full Resume Context:
------
{resume_text}
------

Perform an ATS gap analysis and return ONLY a valid JSON object with the exact schema below, with no markdown fences, no commentary:
{{
  "matched_skills": ["Skills required or preferred in the Job Description that ARE found in the resume"],
  "missing_skills": ["Key skills, frameworks, or tools required in the Job Description that are MISSING from the resume"],
  "suggestions": [
    "Actionable tip 1 tailored specifically to this job description and resume gap",
    "Actionable tip 2",
    "Actionable tip 3",
    "Actionable tip 4"
  ]
}}
"""
    try:
        raw_res = call_llm(prompt)
        parsed = clean_and_parse_json(raw_res)
        return {
            "matched_skills": parsed.get("matched_skills", []),
            "missing_skills": parsed.get("missing_skills", []),
            "suggestions": parsed.get("suggestions", [])
        }
    except Exception as e:
        print(f"[WARN] LLM gap analysis fallback triggered: {e}")
        # Rule-based fallback comparison
        jd_lower = jd_text.lower()
        matched = []
        for s in resume_skills:
            if s.lower() in jd_lower:
                matched.append(s)

        # Common tech keywords in JD not in resume
        potential_jd_skills = re.findall(r'\b[A-Za-z0-9#+.-]{2,15}\b', jd_text)
        resume_lower = resume_text.lower()
        missing = []
        for token in set(potential_jd_skills):
            if len(token) > 2 and token.lower() in jd_lower and token.lower() not in resume_lower:
                if token.lower() not in ["with", "have", "must", "work", "role", "team", "will", "from", "that", "this", "able"]:
                    missing.append(token)
                    if len(missing) >= 8:
                        break

        suggestions = [
            "Tailor your resume bullet points to include exact keywords and phrases from the job description.",
            "Quantify your accomplishments with measurable metrics (e.g., % improvement, revenue growth, users reached).",
            "Highlight core relevant technical skills prominently in your skills section near the top.",
            "Ensure all required qualifications and certifications are explicitly stated."
        ]
        return {
            "matched_skills": list(dict.fromkeys(matched)),
            "missing_skills": list(dict.fromkeys(missing[:8])),
            "suggestions": suggestions
        }


def calculate_semantic_score(resume_text: str, jd_text: str, matched_count: int, total_skills: int) -> int:
    """Compute ATS compatibility score using SentenceTransformers with robust lexical fallback."""
    try:
        if embedding_model is not None:
            resume_embed = embedding_model.encode(resume_text, convert_to_tensor=True)
            jd_embed = embedding_model.encode(jd_text, convert_to_tensor=True)
            cosine_score = util.cos_sim(resume_embed, jd_embed).item()
            score_percent = max(0, min(100, round(cosine_score * 100)))
            return score_percent
    except Exception as e:
        print(f"Embedding calculation warning: {e}")

    # Lexical fallback based on skill match ratio + token overlap
    resume_tokens = set(re.findall(r'\b\w{3,}\b', resume_text.lower()))
    jd_tokens = set(re.findall(r'\b\w{3,}\b', jd_text.lower()))
    if not jd_tokens:
        return 50

    overlap = len(resume_tokens.intersection(jd_tokens)) / len(jd_tokens)
    skill_ratio = (matched_count / max(1, total_skills)) if total_skills > 0 else 0.5
    blended = (overlap * 0.4 + skill_ratio * 0.6) * 100
    return max(10, min(95, round(blended)))


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
    total_skills = len(matched_skills) + len(missing_skills)

    # 4. Compute Semantic Compatibility Score
    score = calculate_semantic_score(text, job_description, len(matched_skills), total_skills)

    # 5. Build final payload
    payload = {
        "status": "completed",
        "score": score,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "extracted_skills": resume_skills,
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
