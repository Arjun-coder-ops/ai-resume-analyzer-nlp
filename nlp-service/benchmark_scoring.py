"""
Reproducible Scoring Quality & Explainability Benchmark for ResumeIQ
Deterministic evaluation fixtures covering:
- Strongly relevant software engineering candidates
- Completely unrelated professions (e.g. culinary / pastry)
- Career changers (QA to backend engineering)
- Candidates with missing / sparse experience (recent graduates)
- Varied job description wording (synonyms / paraphrasing)
- Empty or failed skill extractions
- Cross-job matrix comparisons (same candidate against two different jobs)
"""

import unittest
import math
from app import compute_industry_ats_score, run_analysis, _clamp_pillar


# ────────────────────────────────────────────────────────────
# DETERMINISTIC BENCHMARK FIXTURES
# ────────────────────────────────────────────────────────────

CANDIDATE_SWE_ALEX = {
    "name": "Alex Dev",
    "resume_data": {
        "candidate_info": {
            "name": "Alex Dev",
            "email": "alex.dev@cloudtech.io",
            "phone": "+1-555-019-2834",
            "linkedin": "https://linkedin.com/in/alexdev",
            "github": "https://github.com/alexdev"
        },
        "skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "Redis", "CI/CD", "AWS", "Microservices"],
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
            {"name": "Cluster Monitor", "description": "Engineered real-time Kubernetes cluster monitoring tool in Python with 2,000 stars."}
        ],
        "certifications": ["AWS Certified Solutions Architect Professional"]
    },
    "text": (
        "Alex Dev - Senior Software Engineer. alex.dev@cloudtech.io https://linkedin.com/in/alexdev https://github.com/alexdev. "
        "Bachelor of Science in Computer Science, Magna Cum Laude, GPA 3.9. Architected, engineered, developed, optimized, automated, "
        "integrated microservices using Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL, Redis. Achieved 99.99% uptime and reduced latency by 45%."
    )
}

CANDIDATE_PASTRY_PIERRE = {
    "name": "Pierre Baker",
    "resume_data": {
        "candidate_info": {
            "name": "Pierre Baker",
            "email": "pierre.baker@patisserie.com",
            "phone": "+1-555-321-9876",
            "linkedin": "https://linkedin.com/in/chefpierre"
        },
        "skills": ["Pastry Arts", "Sourdough Fermentation", "Cake Decoration", "Chocolate Tempering", "Food Safety", "Inventory Control"],
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
                "role": "Assistant Baker",
                "company": "French Patisserie",
                "details": [
                    "Prepared delicate French pastries, croissants, and chocolate ganache for high-volume morning rushes.",
                    "Maintained HACCP food safety standards and inspected kitchen sanitation daily."
                ]
            }
        ],
        "education": [
            {"degree": "Culinary Arts Diploma", "institution": "Pastry Institute"}
        ],
        "projects": [],
        "certifications": ["ServSafe Certified Food Manager"]
    },
    "text": (
        "Pierre Baker - Head Pastry Chef. pierre.baker@patisserie.com https://linkedin.com/in/chefpierre. "
        "Culinary Arts Diploma. Supervised, trained, optimized bakery operations. Baked 500 loaves of sourdough daily, "
        "reduced food waste by 18%, managed recipe formulations and food safety."
    )
}

CANDIDATE_CAREER_CHANGER_JORDAN = {
    "name": "Jordan Lee",
    "resume_data": {
        "candidate_info": {
            "name": "Jordan Lee",
            "email": "jordan.lee@techmail.io",
            "phone": "+1-555-442-1199",
            "linkedin": "https://linkedin.com/in/jordanlee"
        },
        "skills": ["Python", "SQL", "Selenium", "Automated Testing", "Git", "PyTest", "REST APIs"],
        "experience": [
            {
                "role": "QA Automation Engineer",
                "company": "QualitySoft Solutions",
                "details": [
                    "Developed automated integration test suites in Python and PyTest covering 200+ REST API endpoints.",
                    "Wrote complex SQL validation queries for database regression testing.",
                    "Contributed bug fixes in Python backend repository, resolving 15 issues."
                ]
            }
        ],
        "education": [
            {"degree": "Bachelor of Science in Mathematics", "institution": "State University"}
        ],
        "projects": [
            {"name": "API Tester", "description": "Built open source API testing harness in Python with 300 active users."}
        ],
        "certifications": ["ISTQB Certified Tester"]
    },
    "text": (
        "Jordan Lee - QA Automation Engineer transitioning to Backend Development. jordan.lee@techmail.io https://linkedin.com/in/jordanlee. "
        "B.S. in Mathematics. Developed, built, resolved testing automation in Python, SQL, REST APIs, Git. Covered 200+ endpoints with 15 bug fixes."
    )
}

CANDIDATE_RECENT_GRAD_TAYLOR = {
    "name": "Taylor Smith",
    "resume_data": {
        "candidate_info": {
            "name": "Taylor Smith",
            "email": "taylor.smith@edu.org",
            "phone": "+1-555-883-2940",
            "github": "https://github.com/taylorsmith"
        },
        "skills": ["Python", "Java", "Data Structures", "Algorithms", "Git"],
        "experience": [],  # 0 professional experience entries
        "education": [
            {"degree": "Bachelor of Science in Computer Science", "institution": "City University"}
        ],
        "projects": [
            {
                "name": "Mini Compiler",
                "description": "Implemented abstract syntax tree parser and code generator in Python for academic senior capstone."
            }
        ],
        "certifications": []
    },
    "text": (
        "Taylor Smith - Recent Graduate. taylor.smith@edu.org https://github.com/taylorsmith. "
        "Bachelor of Science in Computer Science, GPA 3.7 with honors. Implemented, developed algorithms in Python and Java. Capstone compiler project."
    )
}

JOB_SWE_BACKEND = (
    "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
    "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
)

JOB_BAKERY_CHEF = (
    "Head Pastry Chef & Bakery Manager. Seeking an experienced pastry chef with expertise in "
    "artisan sourdough fermentation, delicate French pastry arts, cake decoration, recipe formulations, and kitchen inventory control."
)

JOB_SWE_VARIED_WORDING = (
    "Cloud Backend Developer. Looking for a skilled technologist adept in writing server-side APIs in Python, "
    "managing relational data persistence like Postgres, and orchestrating container environments."
)


# ────────────────────────────────────────────────────────────
# BENCHMARK TEST SUITE
# ────────────────────────────────────────────────────────────

class TestResumeScoringBenchmark(unittest.TestCase):

    # ── Benchmark 1: Bidirectional Cross-Job Relevance Matrix ──
    def test_benchmark_cross_job_relevance_matrix(self):
        """
        Tests the same candidate across two fundamentally different jobs to verify
        that the scoring engine measures role relevance, not static person quality.
        """
        # 1A: SWE Alex against SWE Job
        matched_swe = ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"]
        score_alex_swe, breakdown_alex_swe, lvl_alex_swe = compute_industry_ats_score(
            CANDIDATE_SWE_ALEX["resume_data"],
            JOB_SWE_BACKEND,
            matched_swe,
            [],
            CANDIDATE_SWE_ALEX["text"]
        )
        self.assertGreaterEqual(score_alex_swe, 85, "Alex against SWE job must be Exceptional Match")
        self.assertEqual(lvl_alex_swe, "Exceptional Match")
        self.assertGreaterEqual(breakdown_alex_swe["experience_alignment"]["score"], 20)

        # 1B: SWE Alex against Pastry Chef Job
        score_alex_pastry, breakdown_alex_pastry, lvl_alex_pastry = compute_industry_ats_score(
            CANDIDATE_SWE_ALEX["resume_data"],
            JOB_BAKERY_CHEF,
            [],
            ["Sourdough", "Pastry Arts", "Cake Decoration", "Food Safety"],
            CANDIDATE_SWE_ALEX["text"]
        )
        self.assertLess(score_alex_pastry, 50, "Alex against Pastry job must be Needs Optimization")
        self.assertEqual(lvl_alex_pastry, "Needs Optimization")
        self.assertLessEqual(breakdown_alex_pastry["experience_alignment"]["score"], 6, "SWE experience for Pastry job must be <= 6")

        # 1C: Pastry Pierre against Pastry Chef Job
        matched_pastry = ["Pastry Arts", "Sourdough", "Cake Decoration", "Food Safety", "Inventory Control"]
        score_pierre_pastry, breakdown_pierre_pastry, lvl_pierre_pastry = compute_industry_ats_score(
            CANDIDATE_PASTRY_PIERRE["resume_data"],
            JOB_BAKERY_CHEF,
            matched_pastry,
            [],
            CANDIDATE_PASTRY_PIERRE["text"]
        )
        self.assertGreaterEqual(score_pierre_pastry, 65, "Pierre against Pastry job must score high (>= 65)")
        self.assertGreaterEqual(breakdown_pierre_pastry["experience_alignment"]["score"], 15)

        # 1D: Pastry Pierre against SWE Job
        score_pierre_swe, breakdown_pierre_swe, lvl_pierre_swe = compute_industry_ats_score(
            CANDIDATE_PASTRY_PIERRE["resume_data"],
            JOB_SWE_BACKEND,
            [],
            ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            CANDIDATE_PASTRY_PIERRE["text"]
        )
        self.assertLess(score_pierre_swe, 50, "Pierre against SWE job must be Needs Optimization")
        self.assertEqual(lvl_pierre_swe, "Needs Optimization")
        self.assertLessEqual(breakdown_pierre_swe["experience_alignment"]["score"], 6, "Pastry experience for SWE job must be <= 6")

        # Verify Delta: Alex's score drops dramatically when evaluated against the wrong role
        self.assertGreater(score_alex_swe - score_alex_pastry, 40, "Role relevance delta must be > 40 points")
        # Verify Delta: Pierre's score drops dramatically when evaluated against the wrong role
        self.assertGreater(score_pierre_pastry - score_pierre_swe, 30, "Role relevance delta must be > 30 points")

    # ── Benchmark 2: Career Changer Evaluation ──────────────────
    def test_benchmark_career_changer(self):
        """
        QA engineer transitioning to Backend SWE:
        - Has Python, SQL, REST APIs (partial match)
        - Lacks FastAPI, Docker, Kubernetes, AWS
        - Expected: Good Match (50-69 pts), NOT 0 and NOT 90.
        """
        matched_skills = ["Python", "REST APIs", "SQL"]
        missing_skills = ["FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"]

        score, breakdown, match_lvl = compute_industry_ats_score(
            CANDIDATE_CAREER_CHANGER_JORDAN["resume_data"],
            JOB_SWE_BACKEND,
            matched_skills,
            missing_skills,
            CANDIDATE_CAREER_CHANGER_JORDAN["text"]
        )

        self.assertGreaterEqual(score, 45, "Career changer with related programming background should score >= 45")
        self.assertLess(score, 75, "Career changer lacking core cloud requirements should not score >= 75")
        self.assertIn("explanation", breakdown["experience_alignment"])
        self.assertIn("explanation", breakdown["skills_match"])
        # Skills match should be partial: 3 / 8 = 37.5% of 40 = ~15 pts
        self.assertGreaterEqual(breakdown["skills_match"]["score"], 10)
        self.assertLessEqual(breakdown["skills_match"]["score"], 20)

    # ── Benchmark 3: Recent Graduate / Missing Experience ────────
    def test_benchmark_recent_graduate_missing_experience(self):
        """
        Recent CS graduate with 0 professional experience:
        - Skills match is partial
        - Experience score MUST be 0/25
        - Education score is high (12/15)
        - Total score reflects lack of experience
        """
        matched_skills = ["Python"]
        missing_skills = ["FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"]

        score, breakdown, match_lvl = compute_industry_ats_score(
            CANDIDATE_RECENT_GRAD_TAYLOR["resume_data"],
            JOB_SWE_BACKEND,
            matched_skills,
            missing_skills,
            CANDIDATE_RECENT_GRAD_TAYLOR["text"]
        )

        self.assertEqual(breakdown["experience_alignment"]["score"], 0, "Candidate with 0 experience must receive 0/25")
        self.assertIn("No verifiable professional experience", breakdown["experience_alignment"]["explanation"])
        self.assertGreaterEqual(breakdown["education_credentials"]["score"], 10, "CS degree must be rewarded")
        self.assertLess(score, 55, "Graduate lacking professional experience should not score >= 55")

    # ── Benchmark 4: Varied Wording & Synonyms Resilience ─────────
    def test_benchmark_varied_wording_resilience(self):
        """
        Tests whether candidate experience matches when the job description uses
        synonymous phrasing (e.g. 'writing server-side APIs in Python', 'container environments')
        """
        matched_skills = ["Python", "Postgres", "Containers"]
        missing_skills = []

        score, breakdown, match_lvl = compute_industry_ats_score(
            CANDIDATE_SWE_ALEX["resume_data"],
            JOB_SWE_VARIED_WORDING,
            matched_skills,
            missing_skills,
            CANDIDATE_SWE_ALEX["text"]
        )

        # Candidate should still receive high experience alignment due to semantic embedding similarity
        self.assertGreaterEqual(breakdown["experience_alignment"]["score"], 18, "Semantic similarity must bridge varied phrasing")
        self.assertGreaterEqual(score, 70, "Strong candidate against paraphrased JD must score >= 70")

    # ── Benchmark 5: Empty / Inadequate Job Description ──────────
    def test_benchmark_empty_skill_job_description(self):
        """
        Vague JD with no identifiable technical skills:
        - Matched skills = 0, Missing skills = 0
        - Skills score MUST be 0/40 (NO 32/40 inflation)
        """
        score, breakdown, match_lvl = compute_industry_ats_score(
            CANDIDATE_SWE_ALEX["resume_data"],
            "Friendly workplace looking for an enthusiastic person for office tasks.",
            [],
            [],
            CANDIDATE_SWE_ALEX["text"]
        )

        self.assertEqual(breakdown["skills_match"]["score"], 0, "No skills extracted must award 0/40")
        self.assertIn("No identifiable technical skills", breakdown["skills_match"]["explanation"])

    # ── Benchmark 6: Documented Explainability for All Pillars ───
    def test_benchmark_explainability_contract(self):
        """
        Verifies every pillar includes human-readable explanations and structured evidence
        for auditing and transparency.
        """
        score, breakdown, match_lvl = compute_industry_ats_score(
            CANDIDATE_SWE_ALEX["resume_data"],
            JOB_SWE_BACKEND,
            ["Python", "FastAPI", "Docker", "AWS"],
            ["PostgreSQL"],
            CANDIDATE_SWE_ALEX["text"]
        )

        required_pillars = ["skills_match", "experience_alignment", "education_credentials", "content_impact", "ats_parseability"]
        for p in required_pillars:
            self.assertIn(p, breakdown)
            pillar_dict = breakdown[p]
            self.assertIn("explanation", pillar_dict, f"Pillar {p} must have an explanation")
            self.assertIn("evidence", pillar_dict, f"Pillar {p} must have structured evidence")
            self.assertIsInstance(pillar_dict["evidence"], dict, f"Evidence for {p} must be a dict")
            self.assertTrue(len(pillar_dict["explanation"]) > 10, f"Explanation for {p} must be meaningful")


if __name__ == '__main__':
    unittest.main()
