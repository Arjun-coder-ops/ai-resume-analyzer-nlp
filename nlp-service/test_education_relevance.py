"""
Deterministic Regression Tests for Role-Aware Education and Certification Scoring
Covers:
Case A: Computer science degree applying for a software engineering role.
Case B: Nursing qualification applying for a nursing role.
Case C: Accounting qualification applying for an accounting role.
Case D: Culinary qualification applying for a chef role.
Case E: Computer science degree applying for a chef role.
Case F: Relevant cloud certification applying for a cloud engineering role.
Case G: Food-safety certification applying for a software engineering role.
Case H: Missing education or certification information.
Case I: A job description with no explicit education requirement.
Case J: A job description with a clearly stated mandatory professional credential.
"""

import unittest
from app import compute_industry_ats_score, _detect_role_domain, ROLE_DOMAINS


class TestEducationCertificationRelevance(unittest.TestCase):

    # ── Case A: CS degree applying for software engineering role ─────────
    def test_case_a_cs_degree_for_swe_role(self):
        jd_text = "Senior Python Developer. Architect microservices and scalable cloud APIs."
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ"}],
            "certifications": []
        }
        text = "Bachelor of Science in Computer Science from Tech Univ. Python developer."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["evidence"]["target_domain"], "software")
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])
        self.assertEqual(edu["score"], 10, "CS degree should earn full primary 10 pts for SWE role")
        self.assertIn("domain-relevant qualification in Software", edu["explanation"])

    # ── Case B: Nursing qualification applying for a nursing role ─────────
    def test_case_b_nursing_degree_for_nursing_role(self):
        jd_text = "Registered Nurse (RN) - Acute Care. Provide patient care in hospital telemetry unit."
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Nursing (BSN)", "institution": "Health College"}],
            "certifications": ["Registered Nurse (RN) License"]
        }
        text = "BSN - Bachelor of Science in Nursing from Health College. Registered Nurse (RN) License."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["patient care"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["evidence"]["target_domain"], "healthcare")
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])
        self.assertGreaterEqual(edu["score"], 13, "Nursing degree (10) + relevant RN cert (3) should earn >= 13 pts")
        self.assertIn("Healthcare", edu["explanation"])

    # ── Case C: Accounting qualification applying for an accounting role ──
    def test_case_c_accounting_degree_for_accounting_role(self):
        jd_text = "Senior Staff Accountant. Responsible for general ledger, monthly financial closing, and audits."
        resume_data = {
            "education": [{"degree": "Bachelor of Commerce in Accounting", "institution": "Business School"}],
            "certifications": ["CPA - Certified Public Accountant"]
        }
        text = "Bachelor of Commerce in Accounting. CPA - Certified Public Accountant."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["general ledger"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["evidence"]["target_domain"], "finance")
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])
        self.assertGreaterEqual(edu["score"], 13, "Accounting degree (10) + CPA (3) should earn >= 13 pts")
        self.assertIn("Finance", edu["explanation"])

    # ── Case D: Culinary qualification applying for a chef role ──────────
    def test_case_d_culinary_qualification_for_chef_role(self):
        jd_text = "Head Pastry Chef. Oversee artisan bakery operations, sourdough fermentation, and confectionery."
        resume_data = {
            "education": [{"degree": "Culinary Arts Diploma", "institution": "Pastry Institute"}],
            "certifications": ["ServSafe Food Protection Manager"]
        }
        text = "Culinary Arts Diploma from Pastry Institute. ServSafe Food Protection Manager."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["sourdough"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["evidence"]["target_domain"], "culinary")
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])
        self.assertGreaterEqual(edu["score"], 13, "Culinary degree (10) + ServSafe (3) should earn >= 13 pts for Chef")
        self.assertIn("Culinary", edu["explanation"])

    # ── Case E: CS degree applying for a chef role (Contrast Test) ───────
    def test_case_e_cs_degree_for_chef_role(self):
        """
        Critical defect fix: Under prior logic, CS degree earned 10 pts for ANY job,
        outscoring culinary degrees for chef roles. Now CS should earn general degree points (6),
        strictly lower than a domain-relevant culinary qualification (10).
        """
        jd_text = "Head Pastry Chef. Oversee artisan bakery operations and sourdough recipe formulations."
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ"}],
            "certifications": []
        }
        text = "Bachelor of Science in Computer Science from Tech Univ."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, [], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["evidence"]["target_domain"], "culinary")
        self.assertFalse(edu["evidence"]["domain_relevant_degree"], "CS is not domain-relevant to Culinary")
        self.assertEqual(edu["score"], 6, "CS degree should receive non-domain general education baseline (6 pts)")
        self.assertIn("unrelated to target culinary domain", edu["explanation"])

    # ── Case F: Relevant cloud certification applying for cloud role ─────
    def test_case_f_relevant_cloud_certification_for_cloud_role(self):
        jd_text = "Cloud Infrastructure Engineer. Deploy AWS and Kubernetes clusters."
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ"}],
            "certifications": ["AWS Certified Solutions Architect Professional"]
        }
        text = "B.S. in Computer Science. AWS Certified Solutions Architect Professional."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["AWS"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(len(edu["evidence"]["relevant_certifications"]), 1)
        self.assertEqual(len(edu["evidence"]["unrelated_certifications"]), 0)
        self.assertEqual(edu["score"], 13, "CS degree (10) + relevant AWS cert (3) should equal 13 pts")
        self.assertIn("domain-relevant certification", edu["explanation"])

    # ── Case G: Food-safety certification applying for software role ─────
    def test_case_g_food_safety_cert_for_software_role(self):
        """
        Critical defect fix: Under prior logic, ANY certification in the list earned +3 pts.
        Now, ServSafe food handler certification should earn 0 pts for a software engineering role.
        """
        jd_text = "Senior Software Engineer. Backend systems in Python and Docker."
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ"}],
            "certifications": ["ServSafe Food Handler Certification"]
        }
        text = "Bachelor of Science in Computer Science. ServSafe Food Handler Certification."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(len(edu["evidence"]["relevant_certifications"]), 0, "ServSafe should not be relevant to Software")
        self.assertEqual(len(edu["evidence"]["unrelated_certifications"]), 1)
        self.assertEqual(edu["score"], 10, "CS degree (10) + unrelated cert (0) should remain 10 pts, NOT 13")
        self.assertIn("unrelated to target software domain (0 pts)", edu["explanation"])

    # ── Case H: Missing education and certification information ─────────
    def test_case_h_missing_education_and_certifications(self):
        jd_text = "Senior Software Engineer with Python and Docker."
        resume_data = {
            "education": [],
            "certifications": []
        }
        text = "Senior worker with general experience."

        score, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertEqual(edu["score"], 0, "Missing education and certifications must award 0 pts")
        self.assertEqual(edu["evidence"]["degree_level"], "None Identified")
        self.assertIn("No collegiate degree or recognized vocational qualification identified", edu["explanation"])

    # ── Case I: Job description with no explicit education requirement ──
    def test_case_i_jd_with_no_explicit_education_requirement(self):
        """
        When a job description does not specify 'degree required', candidate is evaluated
        by domain alignment without arbitrary penalties.
        """
        jd_text = "Senior Python Developer. Build REST APIs, optimize PostgreSQL queries, and maintain unit test coverage."
        # Candidate 1: Has relevant degree
        res1 = compute_industry_ats_score(
            {"education": [{"degree": "B.S. in Computer Science"}], "certifications": []},
            jd_text, ["Python"], [], "B.S. in Computer Science"
        )
        self.assertEqual(res1[1]["education_credentials"]["score"], 10)
        self.assertFalse(res1[1]["education_credentials"]["evidence"]["mandatory_credential_required"])

        # Candidate 2: Self-taught without degree or certs
        res2 = compute_industry_ats_score(
            {"education": [], "certifications": []},
            jd_text, ["Python"], [], "Self taught programmer with 5 years experience"
        )
        self.assertEqual(res2[1]["education_credentials"]["score"], 0)
        self.assertGreaterEqual(res2[0], 0)

    # ── Case J: Job description with clearly stated mandatory credential ─
    def test_case_j_jd_with_mandatory_credential(self):
        # Scenario: Nursing role with mandatory RN license
        jd_mandatory_rn = "Staff Nurse - Intensive Care. Active RN license required. BLS certification mandatory."

        # Subcase J1: Candidate holds mandatory RN license
        resume_with_rn = {
            "education": [{"degree": "BSN Nursing"}],
            "certifications": ["Registered Nurse (RN) License", "BLS Certified"]
        }
        text_with_rn = "BSN Nursing. Registered Nurse (RN) License. BLS Certified."
        _, breakdown1, _ = compute_industry_ats_score(resume_with_rn, jd_mandatory_rn, ["nursing"], [], text_with_rn)
        edu1 = breakdown1["education_credentials"]

        self.assertTrue(edu1["evidence"]["mandatory_credential_required"])
        self.assertTrue(edu1["evidence"]["mandatory_credential_matched"])
        self.assertEqual(edu1["score"], 14, "BSN (10) + mandatory RN credential match (4) should equal 14 pts")
        self.assertIn("mandatory credential", edu1["explanation"])

        # Subcase J2: Candidate has nursing degree but lacks stated mandatory RN credential
        resume_no_rn = {
            "education": [{"degree": "BSN Nursing"}],
            "certifications": []
        }
        text_no_rn = "BSN Nursing graduate."
        _, breakdown2, _ = compute_industry_ats_score(resume_no_rn, jd_mandatory_rn, ["nursing"], [], text_no_rn)
        edu2 = breakdown2["education_credentials"]

        self.assertTrue(edu2["evidence"]["mandatory_credential_required"])
        self.assertFalse(edu2["evidence"]["mandatory_credential_matched"])
        self.assertEqual(edu2["score"], 10, "Candidate lacking mandatory cert receives only degree base (10 pts)")
        self.assertIn("lacks stated mandatory credential", edu2["explanation"])

    # ── Preferred Credential Distinction ──────────────────────────────────
    def test_case_preferred_credential_handling(self):
        jd_preferred_aws = "Senior Cloud Developer. Python development. AWS Certified Solutions Architect preferred."
        
        # Candidate 1: Has preferred AWS certification
        resume_with_aws = {
            "education": [{"degree": "Bachelor of Science in Computer Science"}],
            "certifications": ["AWS Certified Solutions Architect"]
        }
        text_with_aws = "B.S. in Computer Science. AWS Certified Solutions Architect."
        _, breakdown1, _ = compute_industry_ats_score(resume_with_aws, jd_preferred_aws, ["Python"], [], text_with_aws)
        edu1 = breakdown1["education_credentials"]
        self.assertTrue(edu1["evidence"]["preferred_credential_required"])
        self.assertTrue(edu1["evidence"]["preferred_credential_matched"])
        self.assertEqual(edu1["score"], 13)
        self.assertIn("preferred credential", edu1["explanation"])

        # Candidate 2: Does not have preferred AWS certification (should NOT be penalized)
        resume_no_aws = {
            "education": [{"degree": "Bachelor of Science in Computer Science"}],
            "certifications": []
        }
        text_no_aws = "B.S. in Computer Science. Python developer."
        _, breakdown2, _ = compute_industry_ats_score(resume_no_aws, jd_preferred_aws, ["Python"], [], text_no_aws)
        edu2 = breakdown2["education_credentials"]
        self.assertTrue(edu2["evidence"]["preferred_credential_required"])
        self.assertFalse(edu2["evidence"]["preferred_credential_matched"])
        self.assertEqual(edu2["score"], 10, "Lacking a preferred cert must not deduct points from degree score")
        self.assertNotIn("lacks stated mandatory", edu2["explanation"])

    # ── Structured vs Raw Text Asymmetry ─────────────────────────────────
    def test_case_structured_education_fallback(self):
        """Verify that degrees in resume_data['education'] are recognized even if raw text is sparse."""
        jd_text = "Software Engineer. Python development."
        resume_data = {
            "education": [{"degree": "B.Tech in Computer Science and Engineering", "institution": "State University"}],
            "certifications": []
        }
        sparse_text = "John Doe - Software Developer."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], sparse_text)
        edu = breakdown["education_credentials"]
        self.assertEqual(edu["score"], 10)
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])

    def test_case_raw_text_degree_without_structured_data(self):
        """Verify that degrees in raw text are identified even if resume parser returned empty structured education."""
        jd_text = "Software Engineer. Python development."
        resume_data = {"education": [], "certifications": []}
        raw_text = "Jane Doe. Education: Bachelor of Science in Computer Science from Univ. Skills: Python."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], raw_text)
        edu = breakdown["education_credentials"]
        self.assertEqual(edu["score"], 10)
        self.assertTrue(edu["evidence"]["domain_relevant_degree"])

    # ── In-Progress / Incomplete Degree Handling ──────────────────────────
    def test_case_in_progress_degree_partial_credit(self):
        """Verify that an in-progress degree does not receive full completion credit."""
        jd_text = "Software Engineer. Python backend APIs."
        resume_data = {
            "education": [{"degree": "Candidate for B.S. in Computer Science (Expected May 2027)", "institution": "Tech Univ"}],
            "certifications": []
        }
        text = "Candidate for B.S. in Computer Science (Expected May 2027). Python developer."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertTrue(edu["evidence"]["degree_in_progress"], "Degree must be flagged as in-progress")
        self.assertEqual(edu["score"], 7, "In-progress degree should receive partial credit (7 pts), not full 10 pts")
        self.assertIn("in-progress/anticipated qualification in Software", edu["explanation"])
        self.assertIn("Expected graduation", edu["explanation"])

    def test_case_completed_degree_takes_precedence_over_in_progress(self):
        """Candidate holding completed BS while pursuing MS receives full completed degree credit."""
        jd_text = "Software Engineer. Python microservices."
        resume_data = {
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "State Univ", "year": "2023"},
                {"degree": "Master of Science in Computer Science (In progress, Expected 2026)", "institution": "Tech Univ"}
            ],
            "certifications": []
        }
        text = "B.S. in Computer Science (2023). Pursuing M.S. in Computer Science (Expected 2026)."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertFalse(edu["evidence"]["degree_in_progress"], "Completed degree takes precedence over in-progress degree")
        self.assertEqual(edu["score"], 10, "Should receive full 10 pts for completed Bachelor's degree")

    # ── Ambiguous Job Descriptions Role Detection ────────────────────────
    def test_case_ambiguous_roles_detection(self):
        """
        Verify that ambiguous/interdisciplinary roles are classified by functional responsibilities
        rather than employer industry alone.
        """
        # 1. Healthcare Software Engineer -> software (responsibilities are backend services, not clinical care)
        jd_health_swe = "Healthcare Software Engineer. Architect Python microservices, Docker, AWS, and HL7 FHIR APIs."
        domain_health_swe = _detect_role_domain(jd_health_swe)
        self.assertEqual(domain_health_swe, "software")

        # 2. FinTech Data Engineer -> software (responsibilities are ETL pipelines & SQL, not CPA accounting)
        jd_fintech_de = "FinTech Data Engineer. Build scalable ETL pipelines, SQL data models, and Python Kafka consumers for banking transactions."
        domain_fintech_de = _detect_role_domain(jd_fintech_de)
        self.assertEqual(domain_fintech_de, "software")

        # 3. Technical Product Manager -> product (responsibilities are product roadmaps & agile, not coding)
        jd_tech_pm = "Technical Product Manager. Drive product vision, user stories, agile sprint planning, and roadmap with engineering teams."
        domain_tech_pm = _detect_role_domain(jd_tech_pm)
        self.assertEqual(domain_tech_pm, "product")

        # 4. Hospital Financial Analyst -> finance (responsibilities are budgets & audits, not patient care)
        jd_hosp_fa = "Hospital Financial Analyst. Manage hospital network budgets, general ledger, and annual financial audits in healthcare operations."
        domain_hosp_fa = _detect_role_domain(jd_hosp_fa)
        self.assertEqual(domain_hosp_fa, "finance")

        # 5. AI Engineer in a pharmaceutical company -> software (responsibilities are PyTorch & ML models)
        jd_pharma_ai = "AI Engineer in a pharmaceutical company. Train PyTorch deep learning models, python computer vision, and NLP for drug discovery."
        domain_pharma_ai = _detect_role_domain(jd_pharma_ai)
        self.assertEqual(domain_pharma_ai, "software")

    # ── Missing Mandatory Credential with Other Certifications ───────────
    def test_case_missing_mandatory_credential_with_other_certs(self):
        """Candidate holding other certifications still receives explicit notice of missing mandatory credential."""
        jd_mandatory_rn = "Acute Care Nurse. Active RN license required. BSN degree required."
        resume_data = {
            "education": [{"degree": "BSN Nursing"}],
            "certifications": ["AWS Certified Cloud Practitioner", "ServSafe Food Safety"]
        }
        text = "BSN Nursing. AWS Certified Cloud Practitioner. ServSafe Food Safety."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_mandatory_rn, ["nursing"], [], text)
        edu = breakdown["education_credentials"]

        self.assertTrue(edu["evidence"]["mandatory_credential_required"])
        self.assertFalse(edu["evidence"]["mandatory_credential_matched"])
        self.assertIn("lacks stated mandatory credential (rn)", edu["explanation"])
        self.assertEqual(edu["score"], 10, "Lacking mandatory cert must not award cert points (remains at 10 pts degree base)")

    # ── Multiple Certifications Cap Enforcement ───────────────────────────
    def test_case_multiple_certifications_cannot_exceed_ceiling(self):
        """Pillar score cannot exceed 15 even with multiple certs, degree, and honors."""
        jd_text = "Senior Cloud Architect. Python and Kubernetes."
        resume_data = {
            "education": [{"degree": "Master of Science in Computer Science"}],
            "certifications": [
                "AWS Solutions Architect Professional",
                "CKA Certified Kubernetes Administrator",
                "CISSP Certified Information Systems Security",
                "Terraform Certified Associate"
            ]
        }
        text = "M.S. in Computer Science. GPA 4.0 Magna Cum Laude. AWS Solutions Architect Professional, CKA, CISSP, Terraform."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertLessEqual(edu["score"], 15, "Education pillar must never exceed 15 points")
        self.assertEqual(edu["score"], 15)

    # ── Explicit Required Degree Missing ──────────────────────────────────
    def test_case_required_degree_missing_from_resume(self):
        jd_req_deg = "Software Engineer. Bachelor's degree required. Python, Docker."
        resume_data = {"education": [], "certifications": []}
        text = "Self-taught programmer with Python and Docker experience."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_req_deg, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertTrue(edu["evidence"]["degree_required_in_jd"])
        self.assertEqual(edu["score"], 0)
        self.assertIn("No collegiate degree or recognized vocational qualification identified for required education", edu["explanation"])

    # ── Preferred Degree Missing (Unpenalized) ─────────────────────────────
    def test_case_preferred_degree_missing_from_resume(self):
        jd_pref_deg = "Software Engineer. Master's degree preferred. Python, Docker."
        resume_data = {"education": [{"degree": "Bachelor of Science in Computer Science"}], "certifications": []}
        text = "B.S. in Computer Science. Python, Docker."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_pref_deg, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertTrue(edu["evidence"]["degree_preferred_in_jd"])
        self.assertEqual(edu["score"], 10, "Candidate with Bachelor's when Master's is preferred should receive full 10 pts without penalty")

    # ── Section 2: In-Progress Degree When Job Explicitly Accepts Enrolled ───
    def test_case_in_progress_degree_accepted_by_role_internship(self):
        """In-progress degree receives full credit when job description accepts current students or interns."""
        jd_intern = "Software Engineering Intern. Current students enrolled in Computer Science or related degree accepted. Python."
        resume_data = {
            "education": [{"degree": "B.S. in Computer Science (Currently Pursuing, Expected May 2027)", "institution": "Tech Univ"}],
            "certifications": []
        }
        text = "Currently pursuing B.S. in Computer Science (Expected May 2027). Python development."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_intern, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertTrue(edu["evidence"]["job_accepts_enrolled"])
        self.assertTrue(edu["evidence"]["degree_in_progress"])
        self.assertEqual(edu["score"], 10, "Enrolled candidate in student-welcoming role receives full 10 pts")
        self.assertIn("in-progress qualification in Software", edu["explanation"])
        self.assertNotIn("completed", edu["explanation"].lower(), "Explanation must never describe in-progress degree as completed")

    # ── Section 2: In-Progress Degree When Role Requires Completed Degree ───
    def test_case_in_progress_degree_when_role_requires_completed_degree(self):
        """In-progress degree receives partial credit (7 pts) and warning when role requires completed degree."""
        jd_req_completed = "Senior Software Engineer. Bachelor's degree required. Python, Cloud APIs."
        resume_data = {
            "education": [{"degree": "Candidate for B.S. in Computer Science (Expected Dec 2026)", "institution": "State Univ"}],
            "certifications": []
        }
        text = "Candidate for B.S. in Computer Science (Expected Dec 2026). Python."
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_req_completed, ["Python"], [], text)
        edu = breakdown["education_credentials"]

        self.assertFalse(edu["evidence"]["job_accepts_enrolled"])
        self.assertTrue(edu["evidence"]["degree_in_progress"])
        self.assertTrue(edu["evidence"]["degree_required_in_jd"])
        self.assertEqual(edu["score"], 7, "In-progress degree receives partial credit (7 pts) when completed degree is required")
        self.assertIn("Target role specifies completed degree", edu["explanation"])
        self.assertNotIn("completed", edu["explanation"].lower().split("[")[0], "Scoring explanation must never describe in-progress degree as completed")
        # Check structured warning
        warn_types = [w["type"] for w in edu["evidence"]["structured_warnings"]]
        self.assertIn("in_progress_degree_for_completed_role", warn_types)

    # ── Section 2: Relevant Completed Diploma Without Bachelor's Degree ───────
    def test_case_relevant_completed_diploma_without_bachelors(self):
        """Completed trade or culinary diploma without a bachelor's degree receives full 10 pts for domain role."""
        # 1. Culinary Diploma for Chef Role
        jd_chef = "Sous Chef. Oversee kitchen line, food prep, and culinary sanitation."
        resume_chef = {
            "education": [{"degree": "Culinary Diploma", "institution": "Institute of Culinary Arts", "year": "2020"}],
            "certifications": []
        }
        text_chef = "Culinary Diploma from Institute of Culinary Arts (2020). Chef experience."
        _, breakdown_chef, _ = compute_industry_ats_score(resume_chef, jd_chef, ["kitchen"], [], text_chef)
        edu_chef = breakdown_chef["education_credentials"]
        self.assertEqual(edu_chef["score"], 10, "Culinary diploma should receive full domain 10 pts for Chef role")
        self.assertTrue(edu_chef["evidence"]["domain_relevant_degree"])

        # 2. Trade Diploma for Electrician Role
        jd_elec = "Maintenance Technician / Electrician. Industrial wiring and electrical maintenance."
        resume_elec = {
            "education": [{"degree": "Trade Diploma in Electrical Technology", "institution": "Vocational Tech"}],
            "certifications": []
        }
        text_elec = "Trade Diploma in Electrical Technology from Vocational Tech. Industrial electrician."
        _, breakdown_elec, _ = compute_industry_ats_score(resume_elec, jd_elec, ["electrical"], [], text_elec)
        edu_elec = breakdown_elec["education_credentials"]
        self.assertEqual(edu_elec["score"], 10, "Trade diploma should receive full domain 10 pts for Electrician role")
        self.assertTrue(edu_elec["evidence"]["domain_relevant_degree"])

    # ── Section 2: Completed Bachelor's with In-Progress Master's (Raw Text) ───
    def test_case_completed_bachelors_with_inprogress_masters_raw_text(self):
        """Candidate holding completed BS while pursuing MS in raw text receives full completed credit (10 pts)."""
        jd_text = "Software Engineer. Python backend services."
        resume_data = {"education": [], "certifications": []}  # empty structured data to test raw text resolution
        raw_text = (
            "Alex Smith\n"
            "EDUCATION\n"
            "Bachelor of Science in Computer Science, Tech University, 2021.\n"
            "Master of Science in Computer Science, Stanford University, Expected Dec 2026.\n"
            "SKILLS: Python, Microservices."
        )
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], raw_text)
        edu = breakdown["education_credentials"]

        self.assertFalse(edu["evidence"]["degree_in_progress"], "Completed Bachelor's degree takes precedence over in-progress Master's")
        self.assertEqual(edu["score"], 10, "Must receive full 10 pts for completed Bachelor's degree")

    # ── Section 2: Conflicting or Incomplete Graduation Dates ───────────────────
    def test_case_conflicting_or_incomplete_graduation_dates(self):
        """Degree is credited without inventing graduation dates or hallucinating evidence."""
        jd_text = "Software Engineer. Python microservices."

        # Case A: Degree with no date at all (incomplete)
        resume_no_date = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Univ of Washington"}],
            "certifications": []
        }
        text_no_date = "Bachelor of Science in Computer Science from Univ of Washington."
        _, breakdown_no_date, _ = compute_industry_ats_score(resume_no_date, jd_text, ["Python"], [], text_no_date)
        edu_no_date = breakdown_no_date["education_credentials"]
        self.assertEqual(edu_no_date["score"], 10, "Degree without dates receives valid credit without inventing dates")

        # Case B: Conflicting dates (e.g. 2020 - 2019)
        resume_conflict = {
            "education": [{"degree": "Bachelor of Science in Computer Science", "institution": "Tech College", "year": "2020 - 2019"}],
            "certifications": []
        }
        text_conflict = "Bachelor of Science in Computer Science (2020 - 2019)."
        _, breakdown_conflict, _ = compute_industry_ats_score(resume_conflict, jd_text, ["Python"], [], text_conflict)
        edu_conflict = breakdown_conflict["education_credentials"]
        self.assertEqual(edu_conflict["score"], 10, "Degree with conflicting date strings evaluates safely without error")

    # ── Section 1: Missing Mandatory Qualification with High Overall Score ─────
    def test_case_missing_mandatory_qualification_with_high_overall_score(self):
        """A candidate with a high overall score still produces an explicit mandatory credential warning."""
        jd_nurse = (
            "Registered Nurse - Critical Care Unit.\n"
            "Must have active RN license required.\n"
            "BSN degree required.\n"
            "Skills: patient care, triage, electronic health records."
        )
        # Strong experience, metrics, perfect ATS parseability, BSN degree, but NO RN license
        resume_data = {
            "education": [{"degree": "BSN in Nursing", "institution": "State Medical"}],
            "certifications": [],  # Missing RN license!
            "candidate_info": {"email": "nurse@hospital.org", "phone": "555-0199", "linkedin": "linkedin.com/in/nurse"},
            "experience": [
                {"role": "Clinical Care Coordinator", "company": "General Hospital", "details": ["Managed 45 patient admissions daily", "Spearheaded acute care triage protocols improving patient throughput by 32%"]},
                {"role": "Staff Care Specialist", "company": "Metro Clinic", "details": ["Led 12 staff in acute clinical operations", "Optimized medical record documentation saving 15 hours weekly"]}
            ],
            "projects": [{"name": "Telemetry Study", "description": "Researched vital sign telemetry protocols for 200 ICU beds"}]
        }
        text = (
            "Jane Nurse. nurse@hospital.org. 555-0199. linkedin.com/in/nurse\n"
            "BSN in Nursing from State Medical.\n"
            "Clinical Care Coordinator with patient care, triage, and electronic health records.\n"
            "Managed 45 patient admissions daily. Spearheaded acute care triage protocols improving patient throughput by 32%.\n"
            "Led 12 staff in acute clinical operations. Optimized medical record documentation saving 15 hours weekly."
        )

        total_score, breakdown, match_level = compute_industry_ats_score(
            resume_data, jd_nurse, ["patient care", "triage", "electronic health records"], [], text
        )
        edu = breakdown["education_credentials"]

        # Candidate has high overall score (Strong/Exceptional match)
        self.assertGreaterEqual(total_score, 75, "Candidate has strong qualifications yielding a high overall score")
        self.assertIn(match_level, ["Strong Match", "Exceptional Match"])
        # BUT mandatory credential is explicitly flagged
        self.assertTrue(edu["evidence"]["mandatory_credential_required"])
        self.assertFalse(edu["evidence"]["mandatory_credential_matched"])
        self.assertIn("RN", edu["evidence"]["mandatory_credentials_missing"])
        self.assertTrue(len(edu["evidence"]["warnings"]) > 0, "Missing mandatory credential must emit explicit warning")
        self.assertIn("Missing mandatory credential", edu["evidence"]["warnings"][0])
        # Explanation must reflect missing mandatory credential
        self.assertIn("lacks stated mandatory credential (rn)", edu["explanation"])

    # ── Section 1: Mandatory vs Preferred Credential Distinction ───────────────
    def test_case_mandatory_vs_preferred_credential_distinction(self):
        """A missing mandatory qualification cannot be confused with a missing preferred qualification."""
        jd_text = (
            "Senior Cloud Architect.\n"
            "Active AWS certification is mandatory.\n"
            "PMP certification is preferred.\n"
            "Required skills: Python, Kubernetes, Docker."
        )
        # Candidate has PMP (preferred), but lacks AWS (mandatory)
        resume_data = {
            "education": [{"degree": "Bachelor of Science in Computer Science"}],
            "certifications": ["PMP - Project Management Professional"]
        }
        text = "B.S. in Computer Science. PMP - Project Management Professional. Python, Kubernetes, Docker."

        _, breakdown, _ = compute_industry_ats_score(
            resume_data, jd_text, ["Python", "Kubernetes", "Docker"], [], text
        )
        edu = breakdown["education_credentials"]
        ev = edu["evidence"]

        # Mandatory checks:
        self.assertTrue(ev["mandatory_credential_required"])
        self.assertFalse(ev["mandatory_credential_matched"])
        self.assertIn("AWS", ev["mandatory_credentials_missing"])

        # Preferred checks:
        self.assertTrue(ev["preferred_credential_required"])
        self.assertTrue(ev["preferred_credential_matched"])
        self.assertIn("PMP - Project Management Professional", ev["preferred_credentials_matched"])
        self.assertEqual(len(ev["preferred_credentials_missing"]), 0)

        # Warnings must only complain about mandatory AWS, NEVER about PMP
        warning_texts = " ".join(ev["warnings"])
        self.assertIn("AWS", warning_texts)
        self.assertNotIn("PMP", warning_texts, "Preferred credentials must never generate mandatory warnings")

    # ── Section 1: UI Non-Disqualification Disclaimer ─────────────────────────
    def test_case_qualification_evidence_includes_disclaimer(self):
        """Evidence payload contains explicit non-disqualification disclaimer."""
        jd_text = "Software Engineer. Python development."
        resume_data = {"education": [{"degree": "B.S. in Computer Science"}], "certifications": []}
        _, breakdown, _ = compute_industry_ats_score(resume_data, jd_text, ["Python"], [], "B.S. CS")
        edu = breakdown["education_credentials"]

        self.assertIn("disclaimer", edu["evidence"])
        self.assertIn("not an automatic disqualification", edu["evidence"]["disclaimer"])


if __name__ == '__main__':
    unittest.main()


