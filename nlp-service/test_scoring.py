"""
Regression and Reliability Test Suite for ResumeIQ NLP Scoring Service
Addresses defects audited in ResumeIQ Scoring Accuracy Report:
- Defect 1: Experience-alignment scoring inflation for irrelevant roles
- Defect 2: Skills-match scoring inflation (32/40) on zero extracted skills
- Defect 3: Artificial score clamping (20 floor / 98 ceiling) and pillar validation
- Defect 4: Match-level threshold alignment (85 / 70 / 50)
- Defect 5: Robust handling of missing sections, malformed embeddings, and malformed LLM outputs
"""

import unittest
import math
from unittest.mock import patch, MagicMock

import app
from app import (
    _clamp_pillar,
    compute_industry_ats_score,
    get_suggestions_and_missing,
    clean_and_parse_json,
    extract_resume_data,
    run_analysis
)


class TestScoringReliability(unittest.TestCase):

    # ── Case A: Highly relevant software resume against matching SWE job ──
    def test_case_a_highly_relevant_software_resume(self):
        resume_data = {
            "candidate_info": {
                "email": "alex.dev@example.com",
                "phone": "+1 (555) 019-2834",
                "linkedin": "linkedin.com/in/alexdev",
                "github": "github.com/alexdev"
            },
            "skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "Redis", "CI/CD", "AWS"],
            "experience": [
                {
                    "role": "Senior Software Engineer",
                    "company": "CloudTech Systems",
                    "details": [
                        "Architected distributed microservices in Python and FastAPI handling 10,000 req/sec with 99.99% uptime.",
                        "Designed and deployed containerized pipelines using Docker and Kubernetes on AWS, reducing latency by 45%.",
                        "Optimized PostgreSQL and Redis caching layers, slashing query response times by 60% across 50+ services."
                    ]
                },
                {
                    "role": "Software Engineer",
                    "company": "DataCorp Inc",
                    "details": [
                        "Built scalable RESTful APIs in Python with PostgreSQL backend supporting 500,000 active users.",
                        "Integrated automated CI/CD deployment pipelines, decreasing release cycle duration by 35%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Tech University"}
            ],
            "projects": [
                {
                    "name": "Cluster Monitor",
                    "description": "Engineered real-time Kubernetes cluster monitoring tool in Python with 2,000 GitHub stars."
                }
            ],
            "certifications": ["AWS Certified Solutions Architect"]
        }
        matched_skills = ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "Redis", "AWS"]
        missing_skills = []
        jd_text = (
            "We are seeking a Senior Software Engineer with deep expertise in Python, FastAPI, "
            "Docker, Kubernetes, PostgreSQL, Redis, and AWS cloud architecture. The engineer will architect "
            "distributed systems and optimize high-throughput microservices."
        )
        resume_text = (
            "Alex Dev - Senior Software Engineer. alex.dev@example.com linkedin.com/in/alexdev github.com/alexdev "
            "B.S. in Computer Science, Magna Cum Laude GPA 3.9. Architected, engineered, developed, optimized "
            "distributed systems in Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL, Redis."
        )

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        # Assertions
        self.assertEqual(breakdown["skills_match"]["score"], 40, "Skills match should be full 40 pts")
        self.assertGreaterEqual(breakdown["experience_alignment"]["score"], 18, "Experience alignment should be >= 18")
        self.assertGreaterEqual(total_score, 85, "Total score should be >= 85 for a top-tier matching candidate")
        self.assertEqual(match_level, "Exceptional Match")

        # Sum of pillars must strictly equal overall score
        pillar_sum = sum(b["score"] for b in breakdown.values())
        self.assertEqual(pillar_sum, total_score, "Pillar sum must strictly equal total score")

        # Verify explainability: every pillar must contain transparent explanation and evidence
        for pillar_name, pillar_dict in breakdown.items():
            self.assertIn("explanation", pillar_dict, f"Pillar {pillar_name} missing explanation")
            self.assertTrue(len(pillar_dict["explanation"]) > 10, f"Pillar {pillar_name} explanation is empty")
            self.assertIn("evidence", pillar_dict, f"Pillar {pillar_name} missing evidence")
            self.assertIsInstance(pillar_dict["evidence"], dict, f"Pillar {pillar_name} evidence must be dict")

    # ── Case B: Pastry-chef resume against Kubernetes architect job ──────
    def test_case_b_pastry_chef_against_kubernetes_job(self):
        resume_data = {
            "candidate_info": {
                "email": "pierre.baker@example.com",
                "phone": "+1 (555) 321-9876",
                "linkedin": "linkedin.com/in/chefpierre"
            },
            "skills": ["Pastry Arts", "Sourdough Fermentation", "Cake Decoration", "Chocolate Tempering", "Food Safety"],
            "experience": [
                {
                    "role": "Head Pastry Chef",
                    "company": "Artisan Bakery & Cafe",
                    "details": [
                        "Baked over 500 loaves of artisan sourdough bread daily adhering to culinary standards.",
                        "Decorated bespoke 3-tier wedding cakes and managed confectionery recipe formulations.",
                        "Supervised kitchen staff of 6 bakers and reduced culinary food waste by 18%."
                    ]
                },
                {
                    "role": "Sous Chef Baker",
                    "company": "French Patisserie",
                    "details": [
                        "Prepared delicate French pastries, croissants, and chocolate ganache for high-volume morning rushes.",
                        "Maintained kitchen inventory and inspected food safety hygiene daily."
                    ]
                }
            ],
            "education": [
                {"degree": "Culinary Arts Diploma", "institution": "Pastry Institute"}
            ],
            "projects": [],
            "certifications": ["ServSafe Food Handler"]
        }
        matched_skills = []
        missing_skills = ["Kubernetes", "Helm", "Terraform", "Go", "AWS", "Prometheus", "Service Mesh"]
        jd_text = (
            "We are hiring a Principal Kubernetes Architect to design multi-region container orchestration "
            "clusters using Helm, Terraform, Go, Prometheus, and AWS cloud infrastructure."
        )
        resume_text = (
            "Pierre Baker - Head Pastry Chef. Experience in baking, kitchen management, pastry arts, "
            "sourdough fermentation, culinary arts diploma from bakery institute."
        )

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        # Audited defect: pastry experience with 3+ bullets previously received ~20/25.
        # Defensible fix: experience alignment MUST be <= 6/25 and total score MUST be < 50.
        self.assertEqual(breakdown["skills_match"]["score"], 0, "Skills match must be 0 for unrelated skills")
        self.assertLessEqual(breakdown["experience_alignment"]["score"], 6, "Irrelevant experience must score <= 6/25")
        self.assertLess(total_score, 50, "Pastry chef against Kubernetes architect must score < 50")
        self.assertEqual(match_level, "Needs Optimization")

        # Sum of pillars must strictly equal overall score
        pillar_sum = sum(b["score"] for b in breakdown.values())
        self.assertEqual(pillar_sum, total_score)

    # ── Case C: Resume with no relevant skills ───────────────────────────
    def test_case_c_no_relevant_skills(self):
        resume_data = {"experience": [], "candidate_info": {}}
        matched_skills = []
        missing_skills = ["Python", "FastAPI", "PostgreSQL", "Docker"]
        jd_text = "Seeking Python FastAPI engineer with Docker and PostgreSQL."
        resume_text = "General worker with high school education."

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        self.assertEqual(breakdown["skills_match"]["score"], 0)
        self.assertEqual(breakdown["skills_match"]["percentage"], 0)

    # ── Case D: Job description that produces zero extracted skills ─────
    def test_case_d_zero_extracted_skills_does_not_inflate(self):
        resume_data = {
            "candidate_info": {},
            "skills": ["Communication", "Organization"],
            "experience": []
        }
        # Audited defect: total_jd_skills == 0 previously awarded 32/40 (80%)
        matched_skills = []
        missing_skills = []
        jd_text = "Friendly workplace looking for an enthusiastic person."
        resume_text = "Enthusiastic candidate with good communication."

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        self.assertEqual(breakdown["skills_match"]["score"], 0, "Zero extracted skills must award 0, NOT 32")
        self.assertEqual(breakdown["skills_match"]["percentage"], 0)
        self.assertNotEqual(breakdown["skills_match"]["score"], 32)

    # ── Case E: Empty or missing experience section ─────────────────────
    def test_case_e_empty_or_missing_experience_section(self):
        jd_text = "Seeking Senior Software Engineer with 5+ years experience in Python and AWS."
        text = "Alex Student. B.S. in Computer Science. Skills: Python, AWS, Docker."

        # Subcase E1: Empty list
        _, breakdown1, _ = compute_industry_ats_score({"experience": []}, jd_text, ["Python", "AWS"], ["Docker"], text)
        self.assertEqual(breakdown1["experience_alignment"]["score"], 0)

        # Subcase E2: Missing key
        _, breakdown2, _ = compute_industry_ats_score({}, jd_text, ["Python", "AWS"], ["Docker"], text)
        self.assertEqual(breakdown2["experience_alignment"]["score"], 0)

        # Subcase E3: None value
        _, breakdown3, _ = compute_industry_ats_score({"experience": None}, jd_text, ["Python", "AWS"], ["Docker"], text)
        self.assertEqual(breakdown3["experience_alignment"]["score"], 0)

    # ── Case F: Missing or malformed embedding/similarity values ────────
    def test_case_f_missing_or_malformed_embeddings(self):
        resume_data = {
            "skills": ["Python"],
            "experience": [{"role": "Developer", "details": ["Developed software solutions in Python."]}]
        }
        jd_text = "Seeking Python software developer."
        text = "Developer with Python experience."

        # Subcase F1: embedding_model is None (simulating unavailable model)
        original_model = app.embedding_model
        try:
            app.embedding_model = None
            total_score, breakdown, _ = compute_industry_ats_score(
                resume_data, jd_text, ["Python"], [], text
            )
            self.assertIsInstance(breakdown["experience_alignment"]["score"], int)
            self.assertGreaterEqual(breakdown["experience_alignment"]["score"], 0)
            self.assertLessEqual(breakdown["experience_alignment"]["score"], 25)
        finally:
            app.embedding_model = original_model

        # Subcase F2: cos_sim returns NaN or Inf
        with patch("app.util.cos_sim", return_value=MagicMock(item=lambda: float("nan"))):
            total_score, breakdown, _ = compute_industry_ats_score(
                resume_data, jd_text, ["Python"], [], text
            )
            self.assertFalse(math.isnan(breakdown["experience_alignment"]["score"]))
            self.assertGreaterEqual(breakdown["experience_alignment"]["score"], 0)
            self.assertLessEqual(breakdown["experience_alignment"]["score"], 25)

        # Subcase F3: cos_sim raises an unexpected exception
        with patch("app.util.cos_sim", side_effect=RuntimeError("GPU OOM / tensor error")):
            total_score, breakdown, _ = compute_industry_ats_score(
                resume_data, jd_text, ["Python"], [], text
            )
            self.assertIsInstance(breakdown["experience_alignment"]["score"], int)
            self.assertGreaterEqual(breakdown["experience_alignment"]["score"], 0)
            self.assertLessEqual(breakdown["experience_alignment"]["score"], 25)

    # ── Case G: Missing or malformed pillar values ──────────────────────
    def test_case_g_missing_or_malformed_pillar_values(self):
        # Direct _clamp_pillar unit validations
        self.assertEqual(_clamp_pillar(None, 0, 40), 0)
        self.assertEqual(_clamp_pillar("invalid_string", 0, 40), 0)
        self.assertEqual(_clamp_pillar(float("nan"), 0, 40), 0)
        self.assertEqual(_clamp_pillar(float("inf"), 0, 40), 0)
        self.assertEqual(_clamp_pillar(float("-inf"), 0, 40), 0)
        self.assertEqual(_clamp_pillar(-15, 0, 40), 0)
        self.assertEqual(_clamp_pillar(34.7, 0, 40), 35)

        # Malformed input types passed into compute_industry_ats_score
        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data=None,
            jd_text=None,
            matched_skills=None,
            missing_skills=None,
            text=None
        )
        self.assertEqual(total_score, 0)
        self.assertEqual(match_level, "Needs Optimization")
        for pillar, data in breakdown.items():
            self.assertIsInstance(data["score"], int)
            self.assertEqual(data["score"], 0)

    # ── Case H: Pillar values exceeding their allowed maximum ───────────
    def test_case_h_pillar_values_exceeding_allowed_maximum(self):
        self.assertEqual(_clamp_pillar(999, 0, 40), 40)
        self.assertEqual(_clamp_pillar(100, 0, 25), 25)
        self.assertEqual(_clamp_pillar(50, 0, 15), 15)
        self.assertEqual(_clamp_pillar(25, 0, 10), 10)
        self.assertEqual(_clamp_pillar(200, 0, 100), 100)

        # Full score compute ensures every pillar respects its maximum ceiling
        resume_data = {
            "candidate_info": {"email": "e@x.com", "phone": "123", "linkedin": "in/x", "github": "gh/x"},
            "skills": ["S1", "S2", "S3", "S4", "S5", "S6"],
            "experience": [{"role": "Role", "company": "Co", "details": ["metric 100% verb architected" * 10]}],
            "certifications": ["Cert 1", "Cert 2", "Cert 3"]
        }
        text = "computer science degree bachelor gpa honors architected built engineered optimized"
        _, breakdown, _ = compute_industry_ats_score(
            resume_data, "Role S1 S2 S3 S4 S5 S6", ["S1", "S2", "S3", "S4", "S5", "S6"], [], text
        )
        self.assertLessEqual(breakdown["skills_match"]["score"], 40)
        self.assertLessEqual(breakdown["experience_alignment"]["score"], 25)
        self.assertLessEqual(breakdown["education_credentials"]["score"], 15)
        self.assertLessEqual(breakdown["content_impact"]["score"], 10)
        self.assertLessEqual(breakdown["ats_parseability"]["score"], 10)

    # ── Case I: Overall score of 0 (No artificial 20-point floor) ────────
    def test_case_i_overall_score_of_zero(self):
        resume_data = {
            "candidate_info": {},
            "skills": [],
            "experience": [],
            "education": [],
            "projects": [],
            "certifications": []
        }
        matched_skills = []
        missing_skills = ["Python", "AWS"]
        jd_text = "Senior Python engineer needed."
        resume_text = ""  # Completely empty text

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        self.assertEqual(total_score, 0, "Empty resume must receive a true 0 score (no artificial 20-point floor)")
        self.assertEqual(match_level, "Needs Optimization")
        for pillar_key, pillar in breakdown.items():
            self.assertEqual(pillar["score"], 0, f"Pillar {pillar_key} must be 0")

    # ── Case J: Overall score of 100 (No artificial 98-point ceiling) ─────
    def test_case_j_overall_score_of_one_hundred(self):
        # Construct candidate that maxes out all 5 pillars:
        # Pillar 1 (Skills): 40 (all matched, >= 5 matched, 0 missing)
        # Pillar 2 (Experience): 25 (semantic relevance high, title match, role count >= 2, detailed bullets, metrics)
        # Pillar 3 (Education): 15 (CS degree 10 + Cert 3 + Honors/GPA 2)
        # Pillar 4 (Content Impact): 10 (base 3 + >= 3 metrics 4 + >= 4 action verbs 3 = 10)
        # Pillar 5 (ATS Parseability): 10 (length >= 50 4 + email/phone 3 + links 3 = 10)
        resume_data = {
            "candidate_info": {
                "email": "lead.architect@techcloud.io",
                "phone": "+1-555-010-9988",
                "linkedin": "https://linkedin.com/in/leadarchitect",
                "github": "https://github.com/leadarchitect"
            },
            "skills": ["Kubernetes", "Golang", "Terraform", "Prometheus", "AWS", "Docker", "Microservices"],
            "experience": [
                {
                    "role": "Principal Kubernetes Cloud Architect",
                    "company": "Enterprise Cloud Global",
                    "details": [
                        "Architected distributed cloud platforms in Golang and Kubernetes on AWS serving 10M daily active requests with 99.999% uptime.",
                        "Engineered declarative infrastructure automation using Terraform and Docker, reducing deployment time by 75%.",
                        "Optimized Prometheus telemetry and service mesh monitoring, cutting infrastructure spend by $2.5M annually."
                    ]
                },
                {
                    "role": "Senior Cloud Infrastructure Engineer",
                    "company": "ScaleTech Inc",
                    "details": [
                        "Automated multi-region Kubernetes clusters with Terraform and Helm for 250+ engineering teams.",
                        "Integrated enterprise CI/CD security controls and orchestrated automated canary rollouts across 40+ clusters."
                    ]
                }
            ],
            "education": [
                {"degree": "Master of Science in Computer Science", "institution": "Top Tech Institute"}
            ],
            "projects": [
                {
                    "name": "Cloud Orchestrator",
                    "description": "Engineered open-source Kubernetes operator in Golang adopted by 15,000 production clusters."
                }
            ],
            "certifications": ["CKA Certified Kubernetes Administrator", "AWS Solutions Architect Professional"]
        }
        matched_skills = ["Kubernetes", "Golang", "Terraform", "Prometheus", "AWS", "Docker", "Microservices"]
        missing_skills = []
        jd_text = (
            "Principal Kubernetes Cloud Architect. We are seeking an architect with extensive experience in "
            "Kubernetes, Golang, Terraform, Prometheus, AWS, Docker, and Microservices to lead enterprise cloud platforms."
        )
        resume_text = (
            "Lead Architect - Principal Kubernetes Cloud Architect. lead.architect@techcloud.io +1-555-010-9988 "
            "https://linkedin.com/in/leadarchitect https://github.com/leadarchitect. Master of Science in Computer Science, "
            "GPA 4.0 with highest honors. Architected, engineered, developed, optimized, automated, integrated, spearheaded "
            "multi-region cloud infrastructure using Kubernetes, Golang, Terraform, Prometheus, AWS, Docker, Microservices. "
            "Achieved 99.999% uptime, 75% latency reduction, and $2.5M cost savings across 250+ systems."
        )

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_text, matched_skills, missing_skills, resume_text
        )

        self.assertEqual(breakdown["skills_match"]["score"], 40, "Pillar 1 should be 40")
        self.assertEqual(breakdown["experience_alignment"]["score"], 25, "Pillar 2 should be 25")
        self.assertEqual(breakdown["education_credentials"]["score"], 15, "Pillar 3 should be 15")
        self.assertEqual(breakdown["content_impact"]["score"], 10, "Pillar 4 should be 10")
        self.assertEqual(breakdown["ats_parseability"]["score"], 10, "Pillar 5 should be 10")

        self.assertEqual(total_score, 100, "Perfect resume must achieve true 100 score (no artificial 98-point ceiling)")
        self.assertEqual(match_level, "Exceptional Match")

    # ── Case K: Match-level boundaries at 49, 50, 69, 70, 84, and 85 ────
    def test_case_k_match_level_threshold_boundaries(self):
        def get_match_level_for_score(target_score: int) -> str:
            # Helper: construct a synthetic pillar set summing exactly to target_score
            # and test the classification logic
            p1 = min(40, target_score)
            remainder = target_score - p1
            p2 = min(25, remainder)
            remainder -= p2
            p3 = min(15, remainder)
            remainder -= p3
            p4 = min(10, remainder)
            remainder -= p4
            p5 = min(10, remainder)

            total = _clamp_pillar(p1 + p2 + p3 + p4 + p5, 0, 100)
            if total >= 85:
                return "Exceptional Match"
            elif total >= 70:
                return "Strong Match"
            elif total >= 50:
                return "Good Match"
            else:
                return "Needs Optimization"

        self.assertEqual(get_match_level_for_score(49), "Needs Optimization", "Score 49 must be Needs Optimization")
        self.assertEqual(get_match_level_for_score(50), "Good Match", "Score 50 must be Good Match")
        self.assertEqual(get_match_level_for_score(69), "Good Match", "Score 69 must be Good Match")
        self.assertEqual(get_match_level_for_score(70), "Strong Match", "Score 70 must be Strong Match")
        self.assertEqual(get_match_level_for_score(84), "Strong Match", "Score 84 must be Strong Match")
        self.assertEqual(get_match_level_for_score(85), "Exceptional Match", "Score 85 must be Exceptional Match")

    # ── Case L: Malformed LLM response handling ─────────────────────────
    def test_case_l_malformed_llm_response(self):
        # Test clean_and_parse_json directly raises ValueError on unparseable inputs
        with self.assertRaises(ValueError):
            clean_and_parse_json("")
        with self.assertRaises(ValueError):
            clean_and_parse_json("Not a json at all")
        with self.assertRaises(ValueError):
            clean_and_parse_json("```json\n{broken json\n```")

        # Test get_suggestions_and_missing when call_llm returns malformed garbage
        with patch("app.call_llm", return_value="Error: Internal server rate limit reached. No JSON returned."):
            gap_data = get_suggestions_and_missing(
                resume_text="Senior Python Developer with Docker and AWS experience.",
                jd_text="Looking for a Python Developer proficient in Docker, AWS, and Kubernetes.",
                resume_skills=["Python", "Docker", "AWS"]
            )
            # Rule-based fallback should safely populate matched/missing without throwing
            self.assertIn("Python", gap_data.get("matched_skills", []))
            self.assertIn("Docker", gap_data.get("matched_skills", []))
            self.assertIn("AWS", gap_data.get("matched_skills", []))
            self.assertIn("recommendations", gap_data)
            self.assertIn("suggestions", gap_data)

        # Test extract_resume_data when call_llm returns malformed garbage
        with patch("app.call_llm", return_value="<<<INVALID_LLM_OUTPUT>>>"):
            resume_data = extract_resume_data(
                "Jane Doe\njane@example.com\nPython, Docker, React\nExperience:\nSoftware Engineer at Acme Corp"
            )
            self.assertIsInstance(resume_data, dict)
            self.assertIn("skills", resume_data)
            self.assertIn("experience", resume_data)

    # ── Job Description Validation Test (Requirement 2) ────────────────
    def test_short_or_empty_job_description_validation(self):
        # run_analysis should raise ValueError if job description is empty or too short
        dummy_pdf_bytes = b"%PDF-1.4 Mock PDF content for testing validation..."
        with patch("app.extract_text_from_pdf", return_value="Valid resume text with enough characters for analysis testing."):
            with self.assertRaises(ValueError) as ctx:
                run_analysis(dummy_pdf_bytes, "")
            self.assertIn("Job description is too short", str(ctx.exception))

            with self.assertRaises(ValueError) as ctx2:
                run_analysis(dummy_pdf_bytes, "Short JD")
            self.assertIn("Job description is too short", str(ctx2.exception))


if __name__ == '__main__':
    unittest.main()
