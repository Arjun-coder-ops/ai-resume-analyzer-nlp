# app.py - Flask NLP microservice for resume analysis
# ============================================================
# Endpoints:
#   POST /analyze  - Accept PDF + job description, return analysis
#   GET  /health   - Health check
# ============================================================

import os
import re
import tempfile
import fitz  # PyMuPDF
import spacy
from flask import Flask, request, jsonify
from flask_cors import CORS
from skills_db import ALL_SKILLS

# ── Load spaCy English model ─────────────────────────────────
# Run: python -m spacy download en_core_web_sm
try:
    nlp = spacy.load("en_core_web_sm")
    print("✅ spaCy model loaded: en_core_web_sm")
except OSError:
    print("❌ spaCy model not found. Run: python -m spacy download en_core_web_sm")
    nlp = None

app = Flask(__name__)
CORS(app)

# ── Config ───────────────────────────────────────────────────
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH


# ────────────────────────────────────────────────────────────
# UTILITY FUNCTIONS
# ────────────────────────────────────────────────────────────

def extract_text_from_pdf(file_bytes: bytes) -> str:
    """
    Extract all text from a PDF using PyMuPDF.
    Returns concatenated text from all pages.
    """
    text = ""
    try:
        # Open PDF from bytes
        with fitz.open(stream=file_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text("text") + "\n"
    except Exception as e:
        raise ValueError(f"Failed to extract PDF text: {str(e)}")

    if not text.strip():
        raise ValueError("PDF appears to be empty or image-only. Please use a text-based PDF.")

    return text.lower()  # Normalize to lowercase


def extract_skills_from_text(text: str) -> list:
    """
    Extract skills from text using:
    1. Direct keyword matching against our skills database
    2. Multi-word phrase matching (e.g., "machine learning", "react native")
    """
    found_skills = set()

    # Normalize text: remove special chars, extra spaces
    normalized = re.sub(r'[^\w\s\.\+\#]', ' ', text.lower())
    normalized = re.sub(r'\s+', ' ', normalized)

    # Match each skill from our database
    for skill in ALL_SKILLS:
        # Use word boundary matching for accurate detection
        # Escape special chars in skill name (e.g., c++, .net)
        escaped = re.escape(skill)
        pattern = r'(?<!\w)' + escaped + r'(?!\w)'
        if re.search(pattern, normalized):
            found_skills.add(skill)

    return sorted(list(found_skills))


def generate_suggestions(missing_skills: list, matched_skills: list, score: float) -> list:
    """
    Generate actionable improvement suggestions based on analysis results.
    """
    suggestions = []

    # Score-based suggestions
    if score < 30:
        suggestions.append(
            "Your resume needs significant improvement. Consider tailoring it specifically for this role."
        )
    elif score < 50:
        suggestions.append(
            "Your resume partially matches this job. Focus on adding the missing technical skills."
        )
    elif score < 75:
        suggestions.append(
            "Good match! A few key additions could make your resume stand out more."
        )
    else:
        suggestions.append(
            "Excellent match! Your resume is well-aligned with this job description."
        )

    # Missing skills suggestions
    if missing_skills:
        top_missing = missing_skills[:5]  # Top 5 most impactful
        skills_str = ", ".join(top_missing)
        suggestions.append(
            f"Add these missing skills to your resume: {skills_str}."
        )
        suggestions.append(
            "Consider adding projects, certifications, or coursework that demonstrate these skills."
        )

    # General ATS tips
    suggestions.append(
        "Use exact keywords from the job description — ATS systems match keywords precisely."
    )
    suggestions.append(
        "Quantify your achievements with numbers (e.g., 'improved performance by 40%')."
    )
    suggestions.append(
        "Ensure your resume is in a clean, parseable format — avoid tables, columns, or images."
    )

    # If missing many skills
    if len(missing_skills) > 10:
        suggestions.append(
            "This role requires a broad skillset you may not have yet — consider upskilling via online courses."
        )

    return suggestions


# ────────────────────────────────────────────────────────────
# ROUTES
# ────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        "status": "OK",
        "service": "NLP Resume Analyzer",
        "spacy_loaded": nlp is not None,
        "skills_count": len(ALL_SKILLS),
    })


@app.route('/analyze', methods=['POST'])
def analyze():
    """
    Main analysis endpoint.
    Expects: multipart/form-data
        - resume: PDF file
        - job_description: string
    Returns: JSON with score, matched_skills, missing_skills, suggestions
    """
    # ── Validate inputs ──────────────────────────────────────
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files['resume']
    job_description = request.form.get('job_description', '').strip()

    if not resume_file.filename:
        return jsonify({"error": "Resume file is empty"}), 400

    if not resume_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400

    if len(job_description) < 50:
        return jsonify({"error": "Job description is too short (min 50 characters)"}), 400

    # ── Extract text from PDF ────────────────────────────────
    try:
        pdf_bytes = resume_file.read()
        resume_text = extract_text_from_pdf(pdf_bytes)
    except ValueError as e:
        return jsonify({"error": str(e)}), 422
    except Exception as e:
        return jsonify({"error": f"Failed to process PDF: {str(e)}"}), 500

    # ── Extract skills from resume ───────────────────────────
    resume_skills = extract_skills_from_text(resume_text)

    # ── Extract skills from job description ─────────────────
    jd_text = job_description.lower()
    jd_skills = extract_skills_from_text(jd_text)

    # ── Calculate matches ────────────────────────────────────
    resume_set = set(resume_skills)
    jd_set = set(jd_skills)

    matched = sorted(list(resume_set.intersection(jd_set)))
    missing = sorted(list(jd_set - resume_set))

    # ── ATS Score: matched / total JD skills * 100 ──────────
    if len(jd_set) > 0:
        score = round((len(matched) / len(jd_set)) * 100, 1)
    else:
        # If JD has no recognized skills, use a base score
        score = 50.0

    # Clamp score between 0 and 100
    score = max(0.0, min(100.0, score))

    # ── Generate suggestions ─────────────────────────────────
    suggestions = generate_suggestions(missing, matched, score)

    # ── Build and return response ────────────────────────────
    response = {
        "score": score,
        "matched_skills": matched,
        "missing_skills": missing,
        "suggestions": suggestions,
        "meta": {
            "resume_skills_found": len(resume_skills),
            "jd_skills_found": len(jd_skills),
            "total_skills_checked": len(ALL_SKILLS),
        }
    }

    print(f"✅ Analysis complete: score={score}, matched={len(matched)}, missing={len(missing)}")
    return jsonify(response)


# ────────────────────────────────────────────────────────────
# Error handlers
# ────────────────────────────────────────────────────────────

@app.errorhandler(413)
def too_large(e):
    return jsonify({"error": "File is too large. Maximum size is 10MB."}), 413


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🐍 NLP Service starting on port {port}")
    print(f"📚 Skills database: {len(ALL_SKILLS)} skills loaded")
    app.run(host='0.0.0.0', port=port, debug=os.environ.get('FLASK_ENV') == 'development')
