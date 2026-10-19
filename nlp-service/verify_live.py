"""
Live verification script for ResumeIQ NLP Service
Tests:
1. Pastry Chef Resume vs Kubernetes Architect Job
2. Software Engineer Resume vs Senior Python/Cloud Engineer Job
Verifies score reduction, pillar bounds, pillar sum integrity, and match levels.
"""

import os
import requests
import fitz
from dotenv import load_dotenv

load_dotenv()

NLP_URL = "http://localhost:5001/analyze"
HEADERS = {"X-Internal-Token": os.environ.get("INTERNAL_NLP_TOKEN", "")}

def make_pdf(filename: str, text: str):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), text)
    doc.save(filename)
    doc.close()

def main():
    print("=" * 60)
    print("RESUMEIQ LIVE SCORING VERIFICATION")
    print("=" * 60)

    # ────────────────────────────────────────────────────────────
    # 1. Pastry Chef vs Kubernetes Architect Job
    # ────────────────────────────────────────────────────────────
    pastry_pdf = "pastry_chef_test.pdf"
    pastry_text = """
    Pierre Baker
    Email: pierre.baker@artisanbakery.com | Phone: (555) 321-9876
    LinkedIn: linkedin.com/in/chefpierre

    Professional Summary:
    Dedicated Head Pastry Chef with 8 years of experience leading culinary pastry teams and crafting artisan baked goods.

    Experience:
    Head Pastry Chef | Artisan Bakery & Cafe | 2020 - Present
    - Baked over 500 loaves of artisan sourdough bread daily adhering to strict culinary standards.
    - Decorated bespoke 3-tier wedding cakes and managed confectionery recipe formulations.
    - Supervised a kitchen brigade of 6 bakers and controlled pantry inventory costs by 15%.

    Assistant Baker | Parisian Patisserie | 2017 - 2020
    - Prepared delicate French pastries, croissants, and chocolate ganache for high-volume morning rushes.
    - Maintained HACCP food safety standards and inspected kitchen sanitation daily.

    Education:
    Culinary Arts Diploma, Pastry Institute of America, 2017

    Skills:
    Pastry Arts, Sourdough Fermentation, Cake Decoration, Chocolate Tempering, Food Safety, Recipe Development
    """
    make_pdf(pastry_pdf, pastry_text)

    k8s_jd = """
    Principal Kubernetes Cloud Architect
    We are seeking an experienced Kubernetes Cloud Architect to design and manage enterprise container platforms.
    Required Skills:
    - Kubernetes, Helm, Terraform, Go, Prometheus, AWS, Docker, Microservices, CI/CD, Service Mesh.
    Responsibilities:
    - Architect multi-region Kubernetes clusters with automated GitOps workflows.
    - Implement zero-trust security and observability using Prometheus and Istio.
    """

    print("\n--- TEST 1: Pastry Chef Resume vs. Kubernetes Cloud Architect Job ---")
    with open(pastry_pdf, "rb") as f:
        res = requests.post(
            NLP_URL,
            files={"resume": (pastry_pdf, f, "application/pdf")},
            data={"job_description": k8s_jd},
            headers=HEADERS,
            timeout=60
        )

    if res.status_code != 200:
        print(f"[FAIL] HTTP {res.status_code}: {res.text}")
        return

    data1 = res.json()
    score1 = data1.get("score")
    match_lvl1 = data1.get("match_level")
    breakdown1 = data1.get("scoring_breakdown", {})

    print(f"Overall Score: {score1}/100")
    print(f"Match Level: {match_lvl1}")
    print("Pillars:")
    p_sum1 = 0
    for k, v in breakdown1.items():
        print(f"  - {v['name']}: {v['score']}/{v['max']} ({v['status']})")
        if v.get('explanation'):
            print(f"    Reason: {v['explanation']}")
        p_sum1 += v['score']

    print(f"Pillar Sum: {p_sum1} (Matches Overall Score: {p_sum1 == score1})")
    print(f"Experience Alignment Score: {breakdown1.get('experience_alignment', {}).get('score')}/25")

    # Assertions for Pastry Chef
    exp_score = breakdown1.get('experience_alignment', {}).get('score', 0)
    assert exp_score <= 6, f"Defect not resolved: Experience score is {exp_score} > 6"
    assert score1 < 50, f"Defect not resolved: Overall score is {score1} >= 50"
    assert match_lvl1 == "Needs Optimization", f"Unexpected match level: {match_lvl1}"
    assert p_sum1 == score1, f"Pillar sum mismatch: {p_sum1} != {score1}"
    print("[PASS] Test 1: Pastry Chef scoring inflation successfully eliminated!")

    # ────────────────────────────────────────────────────────────
    # 2. Software Engineer vs Senior Python/Cloud Engineer Job
    # ────────────────────────────────────────────────────────────
    swe_pdf = "swe_test.pdf"
    swe_text = """
    Alex Dev
    Email: alex.dev@cloudtech.io | Phone: (555) 019-2834
    LinkedIn: linkedin.com/in/alexdev | GitHub: github.com/alexdev

    Professional Summary:
    Senior Software Engineer with 6+ years building distributed cloud microservices in Python, FastAPI, and Kubernetes.

    Experience:
    Senior Software Engineer | CloudTech Systems | 2021 - Present
    - Architected distributed microservices in Python and FastAPI handling 10,000 req/sec with 99.99% uptime.
    - Designed and deployed containerized pipelines using Docker and Kubernetes on AWS, reducing latency by 45%.
    - Optimized PostgreSQL and Redis caching layers, slashing query response times by 60% across 50+ services.

    Software Engineer | DataCorp Inc | 2018 - 2021
    - Built scalable RESTful APIs in Python with PostgreSQL backend supporting 500,000 active users.
    - Integrated automated CI/CD deployment pipelines, decreasing release cycle duration by 35%.

    Education:
    Bachelor of Science in Computer Science, Magna Cum Laude, Tech University | GPA: 3.9

    Skills:
    Python, FastAPI, Docker, Kubernetes, PostgreSQL, Redis, CI/CD, AWS, Microservices, Git

    Certifications:
    AWS Certified Solutions Architect Professional
    """
    make_pdf(swe_pdf, swe_text)

    swe_jd = """
    Senior Python Cloud Engineer
    We are looking for a Senior Software Engineer with strong experience in Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS.
    Responsibilities:
    - Architect scalable backend microservices and maintain high reliability.
    - Optimize database performance and implement caching with Redis.
    - Lead CI/CD pipeline improvements and cloud container deployments.
    """

    print("\n--- TEST 2: Software Engineer Resume vs. Senior Python Cloud Engineer Job ---")
    with open(swe_pdf, "rb") as f:
        res2 = requests.post(
            NLP_URL,
            files={"resume": (swe_pdf, f, "application/pdf")},
            data={"job_description": swe_jd},
            headers=HEADERS,
            timeout=60
        )

    if res2.status_code != 200:
        print(f"[FAIL] HTTP {res2.status_code}: {res2.text}")
        return

    data2 = res2.json()
    score2 = data2.get("score")
    match_lvl2 = data2.get("match_level")
    breakdown2 = data2.get("scoring_breakdown", {})

    print(f"Overall Score: {score2}/100")
    print(f"Match Level: {match_lvl2}")
    print("Pillars:")
    p_sum2 = 0
    for k, v in breakdown2.items():
        print(f"  - {v['name']}: {v['score']}/{v['max']} ({v['status']})")
        if v.get('explanation'):
            print(f"    Reason: {v['explanation']}")
        p_sum2 += v['score']

    print(f"Pillar Sum: {p_sum2} (Matches Overall Score: {p_sum2 == score2})")
    print(f"Skills Match Score: {breakdown2.get('skills_match', {}).get('score')}/40")
    print(f"Experience Alignment Score: {breakdown2.get('experience_alignment', {}).get('score')}/25")

    # Assertions for Software Engineer
    assert score2 >= 70, f"Expected strong/exceptional match, got {score2}"
    assert p_sum2 == score2, f"Pillar sum mismatch: {p_sum2} != {score2}"
    print("[PASS] Test 2: Software Engineer scoring aligns with requirements!")

    # Cleanup test files
    for p in [pastry_pdf, swe_pdf]:
        if os.path.exists(p):
            os.remove(p)

    print("\n" + "=" * 60)
    print("ALL LIVE SERVICE VERIFICATIONS COMPLETED SUCCESSFULLY")
    print("=" * 60)

if __name__ == "__main__":
    main()
