import os
import threading
import fitz  # PyMuPDF
import requests
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from sentence_transformers import SentenceTransformer, util
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Config & Models ─────────────────────────────────────────
MAX_CONTENT_LENGTH = 10 * 1024 * 1024  # 10 MB
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH

# Load the sentence transformer model
print("🔄 Loading sentence-transformers model...")
try:
    embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Model loaded: all-MiniLM-L6-v2")
except Exception as e:
    print(f"❌ Failed to load embedding model: {e}")
    embedding_model = None

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY", "")
if API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE":
    genai.configure(api_key=API_KEY)

# ────────────────────────────────────────────────────────────
# LLM Extraction Logic
# ────────────────────────────────────────────────────────────
def call_llm(prompt: str) -> str:
    """Wrapper to call Gemini API."""
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        raise ValueError("GEMINI_API_KEY is not configured.")
    
    model = genai.GenerativeModel('gemini-2.5-flash')
    response = model.generate_content(prompt)
    return response.text

def extract_resume_data(text: str) -> dict:
    prompt = f"""
You are an expert ATS (Applicant Tracking System). Extract the following information from the resume text provided below. 
Return ONLY a valid JSON object with the exact following schema, nothing else:
{{
  "skills": ["skill1", "skill2"],
  "experience": "A concise summary of their work experience (2-3 sentences max).",
  "education": "A concise summary of their education (1-2 sentences max).",
  "projects": ["Project 1 name/desc", "Project 2 name/desc"]
}}

Resume Text:
------
{text}
------
"""
    try:
        res = call_llm(prompt)
        res = res.replace("```json", "").replace("```", "").strip()
        return json.loads(res)
    except Exception as e:
        print(f"LLM extraction error: {e}")
        return {"skills": [], "experience": "Failed to extract (LLM Error)", "education": "Failed to extract", "projects": []}

def get_suggestions_and_missing(resume_text: str, jd_text: str) -> dict:
    prompt = f"""
You are an expert Tech Recruiter. Compare the resume to the job description.
Identify missing key skills and provide brief ATS optimization suggestions.
Return ONLY a valid JSON object with the exact following schema, nothing else:
{{
  "missing_skills": ["missing_skill1", "missing_skill2"],
  "suggestions": ["suggestion1", "suggestion2", "suggestion3"]
}}

Job Description:
{jd_text}

Resume Context:
{resume_text}
"""
    try:
        res = call_llm(prompt)
        res = res.replace("```json", "").replace("```", "").strip()
        return json.loads(res)
    except Exception as e:
        print(f"LLM gap analysis error: {e}")
        return {"missing_skills": [], "suggestions": ["Could not parse tips due to LLM error."]}

# ────────────────────────────────────────────────────────────
# Async Worker
# ────────────────────────────────────────────────────────────
def process_analysis(pdf_bytes: bytes, job_description: str, webhook_url: str):
    print(f"🔄 Starting background analysis job (Webhook: {webhook_url})")
    
    payload = {
        "status": "failed",
        "error": "Unknown error"
    }

    try:
        # 1. Extract Text
        text = ""
        with fitz.open(stream=pdf_bytes, filetype="pdf") as doc:
            for page in doc:
                text += page.get_text("text") + "\n"
                
        if len(text.strip()) < 50:
            raise ValueError("PDF is empty or unreadable.")

        # 2. Extract structured data via LLM
        print("🧠 Calling LLM to extract resume data...")
        resume_data = extract_resume_data(text)
        
        # 3. Compute Semantic Similarity Score vs JD
        if embedding_model is None:
            raise Exception("Embedding model is not loaded.")
        
        print("🧮 Computing semantic similarity...")
        resume_embed = embedding_model.encode(text, convert_to_tensor=True)
        jd_embed = embedding_model.encode(job_description, convert_to_tensor=True)
        cosine_score = util.cos_sim(resume_embed, jd_embed).item()
        
        score_percent = max(0, min(100, round(cosine_score * 100)))
        
        # 4. LLM for Missing Skills & Suggestions
        print("🧠 Calling LLM for gap analysis...")
        gap_data = get_suggestions_and_missing(text, job_description)
        
        # 5. Build final webhook payload
        payload = {
            "status": "completed",
            "score": score_percent,
            "matched_skills": resume_data.get("skills", []),
            "missing_skills": gap_data.get("missing_skills", []),
            "suggestions": gap_data.get("suggestions", []),
            "experience": resume_data.get("experience", ""),
            "education": resume_data.get("education", ""),
            "projects": resume_data.get("projects", [])
        }
        print(f"✅ Analysis complete. Semantic Score: {score_percent}")

    except Exception as e:
        print(f"❌ Analysis failed: {e}")
        payload = {"status": "failed", "error": str(e)}

    # Send webhook back to Node.js
    if webhook_url:
        print(f"📡 Sending webhook back to {webhook_url}")
        try:
            requests.post(webhook_url, json=payload, timeout=10)
            print("✅ Webhook delivered")
        except requests.RequestException as e:
            print(f"❌ Failed to reach webhook: {e}")

# ────────────────────────────────────────────────────────────
# ROUTES
# ────────────────────────────────────────────────────────────

@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        "status": "OK",
        "service": "AI Resume Analyzer",
        "llm_ready": bool(API_KEY and API_KEY != "YOUR_GEMINI_API_KEY_HERE"),
        "embeddings_ready": embedding_model is not None
    })

@app.route('/analyze/async', methods=['POST'])
def analyze_async():
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file provided"}), 400

    resume_file = request.files['resume']
    job_description = request.form.get('job_description', '').strip()
    webhook_url = request.form.get('webhook_url', '').strip()

    if not resume_file.filename or not resume_file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported"}), 400

    if not webhook_url:
        return jsonify({"error": "webhook_url is required for async processing"}), 400
        
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        return jsonify({"error": "GEMINI_API_KEY is missing on the server"}), 500

    pdf_bytes = resume_file.read()

    # Start the worker thread
    thread = threading.Thread(
        target=process_analysis,
        args=(pdf_bytes, job_description, webhook_url)
    )
    thread.daemon = True
    thread.start()

    return jsonify({"success": True, "message": "Analysis started in background"}), 202

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5001))
    print(f"\n🚀 AI Service starting on port {port}")
    if not API_KEY or API_KEY == "YOUR_GEMINI_API_KEY_HERE":
        print("⚠️ WARNING: GEMINI_API_KEY is NOT SET. LLM extraction will fail.")
    app.run(host='0.0.0.0', port=port, debug=False)
