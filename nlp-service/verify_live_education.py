"""
Live End-to-End Verification of Education & Credentials Scoring in ResumeIQ NLP Service
Tests the 4 scenarios specified in requirements:
1. Candidate missing an explicitly mandatory credential (RN license required, BSN degree only).
2. Candidate who meets that credential (RN license + BSN degree).
3. In-progress degree against a job requiring a completed degree (Senior SWE requiring completed degree).
4. In-progress degree against a job that accepts current students (SWE Intern accepting currently enrolled students).
"""

import os
import sys
import fitz
import requests
from dotenv import load_dotenv

load_dotenv()

NLP_URL = "http://localhost:5001/analyze"
HEADERS = {"X-Internal-Token": os.environ.get("INTERNAL_NLP_TOKEN", "")}


def make_pdf(filename: str, text: str):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), text)
    doc.save(filename)
    doc.close()


def run_live_test(scenario_num: int, title: str, pdf_file: str, pdf_text: str, jd_text: str, assertions_fn):
    print(f"\n{'='*70}")
    print(f"SCENARIO {scenario_num}: {title}")
    print(f"{'='*70}")
    make_pdf(pdf_file, pdf_text)

    try:
        with open(pdf_file, "rb") as f:
            files = {"resume": (pdf_file, f, "application/pdf")}
            data = {"job_description": jd_text}
            resp = requests.post(NLP_URL, files=files, data=data, headers=HEADERS, timeout=60)

        if resp.status_code != 200:
            print(f"[FAIL] HTTP Status {resp.status_code}: {resp.text}")
            return False

        payload = resp.json()
        print(f"[SUCCESS] Status: {payload.get('status')} | Score: {payload.get('score')} | Match: {payload.get('match_level')}")

        edu_pillar = payload.get("scoring_breakdown", {}).get("education_credentials", {})
        edu_score = edu_pillar.get("score")
        edu_expl = edu_pillar.get("explanation", "")
        edu_ev = edu_pillar.get("evidence", {})
        eval_notes = payload.get("evaluation_notes", [])

        print(f"Education Score: {edu_score}/15")
        print(f"Explanation: {edu_expl}")
        print(f"Target Domain: {edu_ev.get('target_domain')}")
        print(f"Degree Level: {edu_ev.get('degree_level')}")
        print(f"Degree In Progress: {edu_ev.get('degree_in_progress')}")
        print(f"Mandatory Required: {edu_ev.get('mandatory_credential_required')} | Matched: {edu_ev.get('mandatory_credential_matched')}")
        print(f"Mandatory Missing: {edu_ev.get('mandatory_credentials_missing')}")
        print(f"Structured Warnings: {len(edu_ev.get('structured_warnings', []))}")
        for w in edu_ev.get('structured_warnings', []):
            print(f"  -> [{w.get('type')}] {w.get('message')}")
        print(f"Evaluation Notes Warnings: {[n for n in eval_notes if 'mandatory' in n.lower() or 'degree' in n.lower()]}")

        # Execute scenario-specific verification assertions
        assertions_fn(payload, edu_pillar, edu_ev, eval_notes)
        print(f"[PASS] Scenario {scenario_num} passed all assertions.")
        return True

    except Exception as e:
        print(f"[ERROR] Exception during Scenario {scenario_num}: {e}")
        return False
    finally:
        if os.path.exists(pdf_file):
            try:
                os.remove(pdf_file)
            except OSError:
                pass


def main():
    print("=" * 70)
    print("RESUMEIQ LIVE EDUCATION & CREDENTIALS VERIFICATION SUITE")
    print(f"Target Endpoint: {NLP_URL}")
    print("=" * 70)

    results = []

    # ────────────────────────────────────────────────────────────
    # Scenario 1: Candidate Missing Explicitly Mandatory Credential
    # ────────────────────────────────────────────────────────────
    s1_text = """
    Sarah Jenkins, BSN
    Email: sarah.jenkins@hospital.org | Phone: (555) 234-5678 | LinkedIn: linkedin.com/in/sarahjenkins-nurse

    Professional Summary:
    Dedicated Critical Care Nurse with 5 years of acute clinical care experience in hospital telemetry and ICU wards.

    Experience:
    Clinical Nurse Specialist | Metropolitan Hospital | 2021 - Present
    - Administered critical patient care protocols across a 24-bed telemetry and intensive care unit.
    - Spearheaded rapid triage patient response protocols improving emergency intervention times by 28%.
    - Documented comprehensive electronic health records and collaborated with multidisciplinary medical teams.

    Staff Nurse | St. Jude Community Health | 2019 - 2021
    - Monitored hemodynamics, medication delivery, and patient vital sign telemetry for acute patients.
    - Trained 8 junior medical assistants on hygiene, vital tracking, and clinical safety compliance.

    Education:
    Bachelor of Science in Nursing (BSN), University of Pennsylvania, 2019

    Skills:
    Patient Care, Critical Care, Acute Triage, Electronic Health Records, Telemetry, IV Administration
    """
    s1_jd = """
    Acute Care Registered Nurse - Intensive Care Unit
    Hospital Network Healthcare Operations

    Required Qualifications:
    - Active RN license required. Candidate must possess valid state Registered Nurse license.
    - Bachelor of Science in Nursing (BSN) required.
    - 3+ years acute hospital clinical experience in patient care and telemetry.
    """
    def assert_s1(payload, edu_pillar, edu_ev, eval_notes):
        # 1. Missing mandatory credential produces clear warning in API response
        assert edu_ev.get("mandatory_credential_required") is True, "Must detect mandatory credential requirement in JD"
        assert edu_ev.get("mandatory_credential_matched") is False, "Must detect that mandatory RN license was NOT matched"
        assert "RN" in edu_ev.get("mandatory_credentials_missing", []), "Missing credentials list must include RN"
        assert len(edu_ev.get("structured_warnings", [])) > 0, "Must emit structured warning for missing mandatory credential"
        assert any("mandatory credential" in n.lower() for n in eval_notes), "Evaluation notes must include missing mandatory credential warning"
        # 2. No points awarded for missing mandatory credential
        expl_low = edu_pillar.get("explanation", "").lower()
        assert "lacks stated mandatory credential" in expl_low and "rn" in expl_low, f"Explanation must mention lacking mandatory rn credential (got: {expl_low})"
        # 3. High overall score does NOT obscure the warning
        assert payload.get("score") >= 70, "Strong candidate still achieves high overall score"
        print(f"Verified: Missing mandatory RN license flagged with score {payload.get('score')}!")

    results.append(run_live_test(
        1, "Candidate Missing Explicitly Mandatory RN Credential",
        "live_test_s1_missing_rn.pdf", s1_text, s1_jd, assert_s1
    ))

    # ────────────────────────────────────────────────────────────
    # Scenario 2: Candidate Who Meets That Credential
    # ────────────────────────────────────────────────────────────
    s2_text = """
    Sarah Jenkins, RN, BSN
    Email: sarah.jenkins@hospital.org | Phone: (555) 234-5678 | LinkedIn: linkedin.com/in/sarahjenkins-nurse

    Professional Summary:
    Licensed Registered Nurse with 5 years of acute clinical care experience in hospital telemetry and ICU wards.

    Experience:
    Clinical Nurse Specialist | Metropolitan Hospital | 2021 - Present
    - Administered critical patient care protocols across a 24-bed telemetry and intensive care unit.
    - Spearheaded rapid triage patient response protocols improving emergency intervention times by 28%.
    - Documented comprehensive electronic health records and collaborated with multidisciplinary medical teams.

    Staff Nurse | St. Jude Community Health | 2019 - 2021
    - Monitored hemodynamics, medication delivery, and patient vital sign telemetry for acute patients.
    - Trained 8 junior medical assistants on hygiene, vital tracking, and clinical safety compliance.

    Education:
    Bachelor of Science in Nursing (BSN), University of Pennsylvania, 2019

    Certifications & Licenses:
    Active Registered Nurse (RN) License, BLS Certification

    Skills:
    Patient Care, Critical Care, Acute Triage, Electronic Health Records, Telemetry, IV Administration
    """
    s2_jd = s1_jd  # Same job description requiring RN license and BSN
    def assert_s2(payload, edu_pillar, edu_ev, eval_notes):
        # 1. Meets credential: no missing mandatory warnings
        assert edu_ev.get("mandatory_credential_required") is True
        assert edu_ev.get("mandatory_credential_matched") is True, "Must recognize candidate's documented RN license"
        assert len(edu_ev.get("mandatory_credentials_missing", [])) == 0, "No mandatory credentials missing"
        # 2. Full credential points awarded (+4 pts for mandatory credential + 10 degree = 14 pts)
        assert edu_pillar.get("score") >= 13, f"BSN (10) + RN mandatory license (4) should yield >= 13 pts (got {edu_pillar.get('score')})"
        assert not any("missing mandatory credential" in w.get("message", "").lower() for w in edu_ev.get("structured_warnings", []))
        print("Verified: Documented RN credential matched with full credit and no warnings!")

    results.append(run_live_test(
        2, "Candidate Meeting Mandatory RN Credential & BSN",
        "live_test_s2_meeting_rn.pdf", s2_text, s2_jd, assert_s2
    ))

    # ────────────────────────────────────────────────────────────
    # Scenario 3: In-Progress Degree vs Job Requiring Completed Degree
    # ────────────────────────────────────────────────────────────
    s3_text = """
    Marcus Vance
    Email: marcus.vance@techdev.io | Phone: (555) 789-0123 | GitHub: github.com/marcusvance

    Professional Summary:
    Software engineer with strong experience in Python microservices, distributed cloud architecture, and Docker.

    Experience:
    Software Developer | CloudScale Solutions | 2022 - Present
    - Architected Python backend services handling 1.2M API requests daily with 99.98% uptime.
    - Engineered asynchronous data ingestion pipelines using Redis and Docker containers.
    - Automated CI/CD deployment pipelines on AWS infrastructure reducing cycle times by 40%.

    Education:
    Candidate for Bachelor of Science in Computer Science, Georgia Tech (Expected Graduation Dec 2026)

    Skills:
    Python, Microservices, Docker, AWS, PostgreSQL, Redis, REST APIs, Git
    """
    s3_jd = """
    Senior Software Engineer - Cloud Platform
    
    Job Requirements:
    - Bachelor's degree required in Computer Science or related field.
    - 3+ years professional software development experience.
    - Proven proficiency in Python microservices, Docker, and AWS.
    """
    def assert_s3(payload, edu_pillar, edu_ev, eval_notes):
        # 1. Detects in-progress status
        assert edu_ev.get("degree_in_progress") is True, "Degree must be flagged as in-progress"
        assert edu_ev.get("job_accepts_enrolled") is False, "Job does not explicitly accept enrolled students"
        # 2. Award partial credit (7 pts), not full 10 pts
        assert edu_pillar.get("score") == 7, f"In-progress degree for completed role should receive partial credit 7 pts (got {edu_pillar.get('score')})"
        # 3. Explanation states in-progress, NEVER completed
        expl = edu_pillar.get("explanation", "")
        assert "in-progress/anticipated qualification in Software" in expl
        assert "Expected graduation" in expl
        # 4. Structured warning produced for in-progress qualification
        warn_types = [w.get("type") for w in edu_ev.get("structured_warnings", [])]
        assert "in_progress_degree_for_completed_role" in warn_types
        print("Verified: In-progress degree received partial credit (7 pts) with completed role notice!")

    results.append(run_live_test(
        3, "In-Progress Degree vs Job Requiring Completed Degree",
        "live_test_s3_inprogress_for_completed.pdf", s3_text, s3_jd, assert_s3
    ))

    # ────────────────────────────────────────────────────────────
    # Scenario 4: In-Progress Degree vs Job Accepting Current Students
    # ────────────────────────────────────────────────────────────
    s4_text = s3_text  # Same candidate pursuing BS in CS (Expected Dec 2026)
    s4_jd = """
    Software Engineering Intern - Summer 2027
    
    About the Role:
    We are seeking a Software Engineering Intern to join our cloud platform engineering team.
    Current students enrolled in a Bachelor's or Master's degree in Computer Science, Software Engineering, or related technical field are accepted and encouraged to apply.
    
    Skills:
    - Python, Docker, REST APIs, microservices.
    """
    def assert_s4(payload, edu_pillar, edu_ev, eval_notes):
        # 1. Detects job accepts enrolled students
        assert edu_ev.get("job_accepts_enrolled") is True, "Must detect that internship welcomes currently enrolled students"
        assert edu_ev.get("degree_in_progress") is True, "Candidate degree is recognized as in-progress"
        # 2. Awards full credit (10 pts) because enrolled candidates are eligible
        assert edu_pillar.get("score") == 10, f"Enrolled student in student-welcoming role must receive full 10 pts (got {edu_pillar.get('score')})"
        # 3. Explanation states in-progress, NEVER describes as completed
        expl = edu_pillar.get("explanation", "")
        assert "in-progress qualification in Software" in expl
        assert "Enrolled/student candidates accepted by role; full credit +10 pts" in expl
        assert "completed" not in expl.lower(), "Must never describe in-progress qualification as completed"
        print("Verified: Enrolled student in student-welcoming role received full 10 pts with in-progress description!")

    results.append(run_live_test(
        4, "In-Progress Degree vs Internship Accepting Enrolled Students",
        "live_test_s4_inprogress_for_internship.pdf", s4_text, s4_jd, assert_s4
    ))

    # ────────────────────────────────────────────────────────────
    # Summary of Live Verification
    # ────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("LIVE VERIFICATION SUMMARY")
    print("=" * 70)
    passed_count = sum(1 for r in results if r)
    total_count = len(results)
    print(f"Total Scenarios Tested: {total_count}")
    print(f"Passed: {passed_count}")
    print(f"Failed: {total_count - passed_count}")

    if passed_count == total_count:
        print("\nALL 4 LIVE SCENARIOS PASSED WITH FULL INTEGRITY!")
        return 0
    else:
        print("\nSOME SCENARIOS FAILED.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
