"""
Comprehensive Evaluation Suite & Labeled Benchmark for ResumeIQ
================================================================
Senior Applied NLP & ML Evaluation Benchmark containing 25 curated,
deterministically labeled candidate-job evaluation pairs spanning:
1. Strongly relevant senior candidates (SWE, Healthcare, Finance)
2. Partial matches (meeting 50-60% of requirements)
3. Completely unrelated professions (Pastry vs SWE, Nursing vs Cloud, etc.)
4. Career changers (QA -> Backend SWE, Financial Analyst -> TPM)
5. Recent graduates (0 experience, CS degree, academic projects)
6. In-progress degrees (expected graduation vs completed degree required)
7. In-progress degrees for student-friendly roles (internships / co-ops)
8. Missing mandatory credentials (unlicensed RN, non-CPA auditor)
9. Preferred vs mandatory credentials (AWS preferred vs required)
10. Synonyms and paraphrased job titles
11. Adversarial keyword-stuffed resumes (repeated keywords with 0 experience evidence)
12. Skills listed without experience application evidence
13. Missing or malformed sections (missing education, missing experience, missing contact info)
14. Multi-column / fragmented layout simulation
15. Ambiguous / interdisciplinary roles (Health Informatics, Data Platform PM)
16. Seniority differentiation (Junior vs Staff/Lead)
"""

import math
import re
from typing import Dict, List, Any, Tuple

# ────────────────────────────────────────────────────────────
# 25 CURATED LABELED BENCHMARK FIXTURES
# ────────────────────────────────────────────────────────────

BENCHMARK_FIXTURES: List[Dict[str, Any]] = [
    # ── 1. Strongly Relevant SWE Candidate ──
    {
        "id": "TC-01-SWE-STRONG",
        "archetype": "Strongly relevant senior software engineer",
        "category": "Strongly Relevant",
        "candidate": {
            "candidate_info": {
                "name": "Alex Mercer",
                "email": "alex.mercer@cloudinfra.io",
                "phone": "+1-555-019-2834",
                "linkedin": "https://linkedin.com/in/alexmercer",
                "github": "https://github.com/alexmercer"
            },
            "skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "Redis", "AWS", "CI/CD", "Microservices"],
            "experience": [
                {
                    "role": "Senior Backend Engineer",
                    "company": "CloudTech Systems",
                    "duration": "2021 - Present",
                    "details": [
                        "Architected distributed microservices in Python and FastAPI handling 10,000 req/sec with 99.99% uptime.",
                        "Designed and deployed containerized pipelines using Docker and Kubernetes on AWS, reducing latency by 45%.",
                        "Optimized PostgreSQL and Redis caching layers, slashing query response times by 60% across 50+ services."
                    ]
                },
                {
                    "role": "Software Developer",
                    "company": "DataCorp Inc",
                    "duration": "2018 - 2021",
                    "details": [
                        "Built scalable RESTful APIs in Python with PostgreSQL backend supporting 500,000 active users.",
                        "Integrated automated CI/CD deployment pipelines, decreasing release cycle duration by 35%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Tech University", "year": "2018", "gpa": "3.8"}
            ],
            "projects": [
                {"name": "Cluster Monitor", "description": "Engineered real-time Kubernetes cluster monitoring tool in Python with 2,000 stars."}
            ],
            "certifications": ["AWS Certified Solutions Architect"]
        },
        "text": (
            "Alex Mercer - Senior Backend Engineer. alex.mercer@cloudinfra.io +1-555-019-2834 https://linkedin.com/in/alexmercer https://github.com/alexmercer. "
            "Bachelor of Science in Computer Science, Magna Cum Laude, GPA 3.8. Architected, engineered, developed, optimized, automated, "
            "integrated microservices using Python, FastAPI, Docker, Kubernetes, AWS, PostgreSQL, Redis. Achieved 99.99% uptime and reduced latency by 45%."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": ["Redis", "Microservices"],
            "mandatory_credentials": [],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 100),
            "expected_warnings": [],
            "reference_rank": 1
        }
    },

    # ── 2. Strongly Relevant Healthcare Candidate (Licensed RN) ──
    {
        "id": "TC-02-HEALTHCARE-LICENSED",
        "archetype": "Licensed Registered Nurse with BSN applying for ICU Acute Care",
        "category": "Strongly Relevant",
        "candidate": {
            "candidate_info": {
                "name": "Sarah Jenkins",
                "email": "sarah.jenkins@hospital.org",
                "phone": "+1-555-492-1029",
                "linkedin": "https://linkedin.com/in/sarahjenkinsrn"
            },
            "skills": ["Patient Care", "ICU", "Telemetry", "ACLS", "BLS", "Acute Care", "Clinical Pharmacology", "Ventilator Management"],
            "experience": [
                {
                    "role": "Staff Registered Nurse - ICU",
                    "company": "Metropolitan Medical Center",
                    "duration": "2020 - Present",
                    "details": [
                        "Provided acute patient care to critically ill telemetry and ICU patients with 100% medication administration accuracy.",
                        "Administered ACLS emergency protocols and managed mechanical ventilators across 12-bed intensive care unit.",
                        "Collaborated with multidisciplinary healthcare teams, reducing patient hospital readmission rates by 18%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Nursing (BSN)", "institution": "State University of Health Sciences", "year": "2020"}
            ],
            "projects": [],
            "certifications": ["Registered Nurse (RN) License", "BLS", "ACLS"]
        },
        "text": (
            "Sarah Jenkins, BSN, RN. sarah.jenkins@hospital.org +1-555-492-1029 https://linkedin.com/in/sarahjenkinsrn. "
            "Bachelor of Science in Nursing (BSN). Registered Nurse (RN) License, ACLS, BLS. Staff Registered Nurse - ICU. "
            "Provided acute patient care in telemetry and ICU units with 100% medication accuracy across 12-bed unit. Reduced readmission by 18%."
        ),
        "job_description": (
            "Registered Nurse (RN) - Intensive Care Unit (ICU). Required License: RN, Registered Nurse. "
            "Seeking licensed clinical professional with Bachelor of Science in Nursing (BSN), patient care expertise, and telemetry experience."
        ),
        "expected": {
            "required_skills": ["Patient Care", "ICU", "Telemetry"],
            "preferred_skills": ["ACLS", "Ventilator Management"],
            "mandatory_credentials": ["RN"],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 100),
            "expected_warnings": [],
            "reference_rank": 2
        }
    },

    # ── 3. Strongly Relevant Finance Candidate (Certified CPA) ──
    {
        "id": "TC-03-FINANCE-CPA",
        "archetype": "Certified Public Accountant with B.Com applying for Senior Staff Accountant",
        "category": "Strongly Relevant",
        "candidate": {
            "candidate_info": {
                "name": "David Ross",
                "email": "david.ross@advisory.com",
                "phone": "+1-555-883-9102",
                "linkedin": "https://linkedin.com/in/davidrosscpa"
            },
            "skills": ["General Ledger", "Financial Closing", "GAAP", "Tax Preparation", "Auditing", "SOX Compliance", "Financial Reporting"],
            "experience": [
                {
                    "role": "Senior Accountant",
                    "company": "Kensington Financial Partners",
                    "duration": "2019 - Present",
                    "details": [
                        "Managed monthly and year-end financial closing processes adhering strictly to GAAP standards across $45M portfolio.",
                        "Reconciled complex general ledger accounts and audited balance sheet entries, eliminating $120k in reconciliation discrepancies.",
                        "Led annual internal SOX compliance audits and streamlined reporting workflows by 25%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Commerce in Accounting", "institution": "City University School of Business", "year": "2019"}
            ],
            "projects": [],
            "certifications": ["CPA - Certified Public Accountant"]
        },
        "text": (
            "David Ross, CPA. david.ross@advisory.com +1-555-883-9102 https://linkedin.com/in/davidrosscpa. "
            "Bachelor of Commerce in Accounting. CPA - Certified Public Accountant. Senior Accountant. "
            "Managed general ledger reconciliation, GAAP financial closing for $45M portfolio, audited entries, eliminating $120k discrepancies. Led SOX audits."
        ),
        "job_description": (
            "Senior Staff Accountant. Mandatory Requirement: CPA license required. "
            "Must possess Bachelor's degree in Accounting or Commerce, deep GAAP proficiency, general ledger reconciliation, and auditing experience."
        ),
        "expected": {
            "required_skills": ["General Ledger", "GAAP", "Auditing", "Financial Closing"],
            "preferred_skills": ["SOX Compliance"],
            "mandatory_credentials": ["CPA"],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 100),
            "expected_warnings": [],
            "reference_rank": 3
        }
    },

    # ── 4. Partial Match Candidate (Mid-Level SWE) ──
    {
        "id": "TC-04-SWE-PARTIAL",
        "archetype": "Software developer with Python and SQL but lacking Cloud & Kubernetes",
        "category": "Partial Match",
        "candidate": {
            "candidate_info": {
                "name": "Marcus Vance",
                "email": "marcus.vance@inbox.com",
                "phone": "+1-555-772-4019",
                "github": "https://github.com/marcusv"
            },
            "skills": ["Python", "Django", "PostgreSQL", "Git", "REST APIs", "Unit Testing"],
            "experience": [
                {
                    "role": "Python Web Developer",
                    "company": "WebCraft Studios",
                    "duration": "2022 - Present",
                    "details": [
                        "Developed web applications in Python and Django with PostgreSQL database backends.",
                        "Implemented RESTful endpoints and increased automated test coverage by 30%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Information Technology", "institution": "State College", "year": "2022"}
            ],
            "projects": [
                {"name": "Blog Engine", "description": "Built open source content management engine in Python."}
            ],
            "certifications": []
        },
        "text": (
            "Marcus Vance - Python Web Developer. marcus.vance@inbox.com https://github.com/marcusv. "
            "Bachelor of Science in Information Technology. Developed web applications in Python, Django, PostgreSQL, Git, REST APIs. Increased test coverage by 30%."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": ["Microservices"],
            "mandatory_credentials": [],
            "expected_match_level": "Good Match",
            "reference_score_range": (50, 68),
            "expected_warnings": [],
            "reference_rank": 7
        }
    },

    # ── 5. Completely Unrelated: Pastry Chef applying for Cloud Engineer ──
    {
        "id": "TC-05-UNRELATED-PASTRY-FOR-SWE",
        "archetype": "Pastry chef with culinary diploma applying for Senior Cloud Engineer",
        "category": "Completely Unrelated",
        "candidate": {
            "candidate_info": {
                "name": "Pierre Dubois",
                "email": "pierre@boulangerie.com",
                "phone": "+1-555-321-9876",
                "linkedin": "https://linkedin.com/in/chefpierre"
            },
            "skills": ["Pastry Arts", "Sourdough Fermentation", "Cake Decoration", "HACCP", "Food Safety", "Menu Planning"],
            "experience": [
                {
                    "role": "Head Pastry Chef",
                    "company": "Artisan Bakery",
                    "duration": "2018 - Present",
                    "details": [
                        "Baked over 500 loaves of artisan sourdough bread daily adhering to culinary standards.",
                        "Supervised kitchen staff of 6 bakers and reduced culinary food waste by 18%."
                    ]
                }
            ],
            "education": [
                {"degree": "Diploma in Culinary Arts", "institution": "Culinary Academy", "year": "2018"}
            ],
            "projects": [],
            "certifications": ["ServSafe Food Manager"]
        },
        "text": (
            "Pierre Dubois - Head Pastry Chef. pierre@boulangerie.com https://linkedin.com/in/chefpierre. "
            "Diploma in Culinary Arts. Baked 500 loaves of sourdough daily, managed staff of 6, reduced food waste by 18%, ServSafe Food Manager."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (0, 45),
            "expected_warnings": [],
            "reference_rank": 24
        }
    },

    # ── 6. Completely Unrelated: Software Engineer applying for Head Pastry Chef ──
    {
        "id": "TC-06-UNRELATED-SWE-FOR-PASTRY",
        "archetype": "Software engineer applying for Head Pastry Chef",
        "category": "Completely Unrelated",
        "candidate": {
            "candidate_info": {
                "name": "Alex Mercer",
                "email": "alex.mercer@cloudinfra.io",
                "phone": "+1-555-019-2834"
            },
            "skills": ["Python", "FastAPI", "Docker", "Kubernetes", "AWS"],
            "experience": [
                {
                    "role": "Senior Backend Engineer",
                    "company": "CloudTech",
                    "duration": "2021 - Present",
                    "details": ["Architected distributed systems in Python handling 10,000 req/sec with 99.99% uptime."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ", "year": "2020"}
            ],
            "projects": [],
            "certifications": ["AWS Solutions Architect"]
        },
        "text": (
            "Alex Mercer - Senior Backend Engineer. alex.mercer@cloudinfra.io. B.S. in Computer Science. "
            "Architected distributed systems in Python, Docker, Kubernetes, AWS. 99.99% uptime."
        ),
        "job_description": (
            "Head Pastry Chef & Bakery Manager. Seeking an experienced pastry chef with expertise in "
            "artisan sourdough fermentation, delicate French pastry arts, cake decoration, recipe formulations, and kitchen inventory control."
        ),
        "expected": {
            "required_skills": ["Pastry Arts", "Sourdough Fermentation", "Cake Decoration", "Recipe Formulations"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (0, 45),
            "expected_warnings": [],
            "reference_rank": 25
        }
    },

    # ── 7. Career Changer: QA Automation Engineer to Backend Software Engineer ──
    {
        "id": "TC-07-CAREER-CHANGER-QA-TO-SWE",
        "archetype": "QA automation engineer transitioning to backend development",
        "category": "Career Changer",
        "candidate": {
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
                    "duration": "2021 - Present",
                    "details": [
                        "Developed automated integration test suites in Python and PyTest covering 200+ REST API endpoints.",
                        "Wrote complex SQL validation queries for database regression testing.",
                        "Contributed bug fixes in Python backend repository, resolving 15 issues."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Mathematics", "institution": "State University", "year": "2021"}
            ],
            "projects": [
                {"name": "API Tester", "description": "Built open source API testing harness in Python with 300 active users."}
            ],
            "certifications": ["ISTQB Certified Tester"]
        },
        "text": (
            "Jordan Lee - QA Automation Engineer transitioning to Backend Development. jordan.lee@techmail.io https://linkedin.com/in/jordanlee. "
            "B.S. in Mathematics. Developed, built, resolved testing automation in Python, SQL, REST APIs, Git. Covered 200+ endpoints with 15 bug fixes."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Good Match",
            "reference_score_range": (50, 69),
            "expected_warnings": [],
            "reference_rank": 9
        }
    },

    # ── 8. Recent Graduate: CS Degree with 0 Professional Experience ──
    {
        "id": "TC-08-RECENT-GRADUATE",
        "archetype": "Recent graduate with CS degree, capstone project, and zero work history",
        "category": "Recent Graduate",
        "candidate": {
            "candidate_info": {
                "name": "Taylor Smith",
                "email": "taylor.smith@edu.org",
                "phone": "+1-555-883-2940",
                "github": "https://github.com/taylorsmith"
            },
            "skills": ["Python", "FastAPI", "Docker", "Algorithms", "Git"],
            "experience": [],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "City University", "year": "2024", "gpa": "3.9"}
            ],
            "projects": [
                {
                    "name": "Mini Cloud",
                    "description": "Implemented containerized microservices in Python and FastAPI with Docker for academic senior capstone."
                }
            ],
            "certifications": []
        },
        "text": (
            "Taylor Smith - Recent Graduate. taylor.smith@edu.org https://github.com/taylorsmith. "
            "Bachelor of Science in Computer Science, Magna Cum Laude, GPA 3.9. Implemented containerized microservices in Python and FastAPI with Docker."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (40, 54),
            "expected_warnings": [],
            "reference_rank": 14
        }
    },

    # ── 9. In-Progress Degree for Degree-Mandated Role ──
    {
        "id": "TC-09-IN-PROGRESS-DEGREE-MANDATORY",
        "archetype": "Student pursuing degree (expected 2026) applying for role requiring completed degree",
        "category": "In-Progress Degree",
        "candidate": {
            "candidate_info": {
                "name": "Kevin Zhang",
                "email": "kevin.z@student.edu",
                "phone": "+1-555-901-2244"
            },
            "skills": ["Python", "FastAPI", "Docker", "PostgreSQL", "Git"],
            "experience": [
                {
                    "role": "Junior Developer Intern",
                    "company": "TechStart Inc",
                    "duration": "Summer 2023",
                    "details": ["Built backend REST endpoints in Python with PostgreSQL, improving query response by 20%."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science (Expected May 2026)", "institution": "State Univ", "year": "Expected 2026"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Kevin Zhang. kevin.z@student.edu +1-555-901-2244. Bachelor of Science in Computer Science - Currently pursuing, Expected May 2026. "
            "Junior Developer Intern at TechStart Inc. Built backend REST endpoints in Python with PostgreSQL, improving response by 20%."
        ),
        "job_description": (
            "Backend Systems Engineer. Mandatory Requirement: Bachelor's degree required. "
            "Candidate must have completed a collegiate degree in Computer Science or related field. Python and PostgreSQL required."
        ),
        "expected": {
            "required_skills": ["Python", "PostgreSQL"],
            "preferred_skills": ["FastAPI", "Docker"],
            "mandatory_credentials": [],
            "expected_match_level": "Good Match",
            "reference_score_range": (50, 68),
            "expected_warnings": ["in_progress_degree_for_completed_role"],
            "reference_rank": 11
        }
    },

    # ── 10. In-Progress Degree for Student / Internship Role ──
    {
        "id": "TC-10-IN-PROGRESS-DEGREE-INTERN",
        "archetype": "Student pursuing degree applying for internship explicitly welcoming students",
        "category": "In-Progress Degree",
        "candidate": {
            "candidate_info": {
                "name": "Kevin Zhang",
                "email": "kevin.z@student.edu",
                "phone": "+1-555-901-2244"
            },
            "skills": ["Python", "FastAPI", "Docker", "PostgreSQL", "Git"],
            "experience": [
                {
                    "role": "Junior Developer Intern",
                    "company": "TechStart Inc",
                    "duration": "Summer 2023",
                    "details": ["Built backend REST endpoints in Python with PostgreSQL, improving query response by 20%."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science (Expected May 2026)", "institution": "State Univ", "year": "Expected 2026"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Kevin Zhang. kevin.z@student.edu +1-555-901-2244. Bachelor of Science in Computer Science - Currently pursuing, Expected May 2026. "
            "Junior Developer Intern at TechStart Inc. Built backend REST endpoints in Python with PostgreSQL, improving response by 20%."
        ),
        "job_description": (
            "Software Engineering Co-Op / Intern. Current students welcome! Currently enrolled students pursuing degree in "
            "Computer Science or related field are eligible to apply. Experience with Python and PostgreSQL desired."
        ),
        "expected": {
            "required_skills": ["Python", "PostgreSQL"],
            "preferred_skills": ["FastAPI", "Docker"],
            "mandatory_credentials": [],
            "expected_match_level": "Strong Match",
            "reference_score_range": (70, 85),
            "expected_warnings": [],
            "reference_rank": 6
        }
    },

    # ── 11. Critical Defect Case: Unlicensed Nurse applying for Mandatory RN Role ──
    {
        "id": "TC-11-MISSING-MANDATORY-LICENSE-NURSE",
        "archetype": "Nurse assistant with nursing degree but lacking mandatory RN license",
        "category": "Missing Mandatory Credential",
        "candidate": {
            "candidate_info": {
                "name": "Emily Carter",
                "email": "emily.carter@healthnet.org",
                "phone": "+1-555-667-8901",
                "linkedin": "https://linkedin.com/in/emilycarter"
            },
            "skills": ["Patient Care", "ICU", "Telemetry", "ACLS", "BLS", "Clinical Documentation"],
            "experience": [
                {
                    "role": "Patient Care Technician",
                    "company": "Valley Hospital",
                    "duration": "2021 - Present",
                    "details": [
                        "Provided telemetry patient care and monitored vital signs for 40 ICU patients daily.",
                        "Administered basic clinical documentation and supported registered nursing staff with 100% adherence."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Nursing (BSN)", "institution": "Metro Nursing College", "year": "2021"}
            ],
            "projects": [],
            "certifications": ["BLS", "CNA"]  # LACKS MANDATORY RN LICENSE!
        },
        "text": (
            "Emily Carter. emily.carter@healthnet.org +1-555-667-8901 https://linkedin.com/in/emilycarter. "
            "Bachelor of Science in Nursing (BSN). Patient Care Technician at Valley Hospital. BLS, CNA. "
            "Monitored telemetry and ICU vital signs across 40 patients with 100% adherence."
        ),
        "job_description": (
            "Registered Nurse (RN) - Acute ICU. Required License: RN, Registered Nurse License Required. "
            "Must hold active and unencumbered Registered Nurse license to practice. Patient care and ICU telemetry required."
        ),
        "expected": {
            "required_skills": ["Patient Care", "ICU", "Telemetry"],
            "preferred_skills": ["ACLS"],
            "mandatory_credentials": ["RN"],
            "expected_match_level": "Needs Optimization",  # Disqualified by mandatory requirement
            "reference_score_range": (0, 49),
            "expected_warnings": ["missing_mandatory_credential"],
            "reference_rank": 18
        }
    },

    # ── 12. Missing Mandatory Degree: Candidate has experience but no collegiate degree for degree-required role ──
    {
        "id": "TC-12-MISSING-MANDATORY-DEGREE",
        "archetype": "Self-taught developer with no degree applying for role with mandatory degree requirement",
        "category": "Missing Mandatory Degree",
        "candidate": {
            "candidate_info": {
                "name": "Tom Miller",
                "email": "tom.miller@devs.net",
                "phone": "+1-555-992-1823"
            },
            "skills": ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"],
            "experience": [
                {
                    "role": "Software Developer",
                    "company": "StartUp Labs",
                    "duration": "2020 - Present",
                    "details": ["Built backend APIs in Python with PostgreSQL, handling 2M requests weekly."]
                }
            ],
            "education": [],  # NO DEGREE
            "projects": [],
            "certifications": []
        },
        "text": (
            "Tom Miller. tom.miller@devs.net +1-555-992-1823. Software Developer at StartUp Labs. "
            "Built backend APIs in Python, PostgreSQL, Docker, AWS. Handled 2M requests weekly."
        ),
        "job_description": (
            "Senior Systems Engineer. Mandatory Requirement: Bachelor degree required in Computer Science or Engineering. "
            "Must hold accredited collegiate degree to be considered. Python, FastAPI, and Docker required."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
            "preferred_skills": ["AWS"],
            "mandatory_credentials": [],
            "expected_match_level": "Good Match",
            "reference_score_range": (50, 68),
            "expected_warnings": ["missing_mandatory_degree"],
            "reference_rank": 12
        }
    },

    # ── 13. Preferred vs Mandatory Certifications: Has required, lacks preferred ──
    {
        "id": "TC-13-PREFERRED-CERT-ABSENT",
        "archetype": "Meets all required skills & degree, lacks preferred certification",
        "category": "Preferred vs Mandatory",
        "candidate": {
            "candidate_info": {
                "name": "Lisa Chen",
                "email": "lisa.chen@tech.com",
                "phone": "+1-555-112-3344"
            },
            "skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL"],
            "experience": [
                {
                    "role": "Cloud Developer",
                    "company": "SaaS Platform",
                    "duration": "2021 - Present",
                    "details": [
                        "Engineered microservices in Python and FastAPI deployed with Docker and Kubernetes, reducing build times by 40%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "State Univ", "year": "2021"}
            ],
            "projects": [],
            "certifications": []  # Lacks preferred AWS cert
        },
        "text": (
            "Lisa Chen. lisa.chen@tech.com +1-555-112-3344. Bachelor of Science in Computer Science. "
            "Cloud Developer at SaaS Platform. Engineered microservices in Python, FastAPI, Docker, Kubernetes, reducing build times by 40%."
        ),
        "job_description": (
            "Backend Engineer. Required: Python, FastAPI, Docker, Kubernetes. "
            "Preferred: AWS Certified Solutions Architect is a plus."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes"],
            "preferred_skills": ["AWS"],
            "mandatory_credentials": [],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 95),
            "expected_warnings": [],
            "reference_rank": 4
        }
    },

    # ── 14. Synonyms and Paraphrased Job Descriptions ──
    {
        "id": "TC-14-SYNONYMS-AND-PARAPHRASING",
        "archetype": "Candidate with standard terminology matched against heavily paraphrased job description",
        "category": "Synonyms & Semantic Paraphrasing",
        "candidate": {
            "candidate_info": {
                "name": "Robert Evans",
                "email": "robert.e@code.io",
                "phone": "+1-555-223-4455"
            },
            "skills": ["Python", "PostgreSQL", "Docker", "REST APIs", "Git"],
            "experience": [
                {
                    "role": "Server-Side Programmer",
                    "company": "Network Solutions",
                    "duration": "2020 - Present",
                    "details": [
                        "Constructed server-side web APIs in Python utilizing relational database persistence with PostgreSQL.",
                        "Containerized backend micro-applications with Docker, improving cluster delivery by 35%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Software Engineering", "institution": "Tech College", "year": "2020"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Robert Evans. robert.e@code.io +1-555-223-4455. B.S. in Software Engineering. "
            "Server-Side Programmer. Constructed server-side web APIs in Python utilizing relational database persistence with Postgres. Containerized apps with Docker."
        ),
        "job_description": (
            "Cloud Backend Developer. Looking for a skilled technologist adept in writing server-side APIs in Python, "
            "managing relational data persistence like Postgres, and orchestrating container environments."
        ),
        "expected": {
            "required_skills": ["Python", "Postgres", "Docker", "APIs"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Strong Match",
            "reference_score_range": (72, 88),
            "expected_warnings": [],
            "reference_rank": 5
        }
    },

    # ── 15. Adversarial: Keyword-Stuffed Resume (Cheating Attempt) ──
    {
        "id": "TC-15-ADVERSARIAL-KEYWORD-STUFFING",
        "archetype": "Resume with 30 keywords stuffed into list, but zero experience evidence",
        "category": "Adversarial & Keyword Stuffing",
        "candidate": {
            "candidate_info": {
                "name": "Spammy Candidate",
                "email": "spam@mail.com",
                "phone": "+1-555-000-1111"
            },
            "skills": [
                "Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS", "Redis",
                "Kafka", "GraphQL", "TypeScript", "React", "Terraform", "CI/CD", "Microservices"
            ],
            "experience": [
                {
                    "role": "Office Clerk",
                    "company": "Paper Mill",
                    "duration": "2022 - Present",
                    "details": [
                        "Filed paper records and answered front desk telephone calls.",
                        "Organized physical mail and scheduled internal room reservations."
                    ]
                }
            ],
            "education": [
                {"degree": "Associate in General Studies", "institution": "Community College", "year": "2022"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Spammy Candidate. spam@mail.com +1-555-000-1111. Associate in General Studies. "
            "Python FastAPI Docker Kubernetes PostgreSQL AWS Redis Kafka GraphQL TypeScript React Terraform CI/CD Microservices. "
            "Office Clerk at Paper Mill. Filed records and answered calls."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (35, 52),
            "expected_warnings": [],
            "reference_rank": 19
        }
    },

    # ── 16. Missing Contact Information (ATS Formatting Penalty) ──
    {
        "id": "TC-16-MISSING-CONTACT-INFO",
        "archetype": "Qualified candidate with missing phone number and LinkedIn",
        "category": "Missing Contact Info",
        "candidate": {
            "candidate_info": {
                "name": "Anonymous Dev",
                "email": "anon.dev@mailbox.org",
                "phone": "",
                "linkedin": "",
                "github": ""
            },
            "skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
            "experience": [
                {
                    "role": "Software Engineer",
                    "company": "Tech Corp",
                    "duration": "2021 - Present",
                    "details": ["Built microservices in Python with FastAPI and PostgreSQL, improving latency by 35% across 20 services."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ", "year": "2021"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Anonymous Dev. anon.dev@mailbox.org. B.S. in Computer Science. "
            "Software Engineer at Tech Corp. Built microservices in Python with FastAPI and PostgreSQL, improving latency by 35%."
        ),
        "job_description": (
            "Software Engineer. Python, FastAPI, Docker, and PostgreSQL required for microservices development."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Strong Match",
            "reference_score_range": (70, 84),
            "expected_warnings": [],
            "reference_rank": 8
        }
    },

    # ── 17. Multi-column / Layout Fragmented Extraction ──
    {
        "id": "TC-17-MULTICOLUMN-FRAGMENTED-LAYOUT",
        "archetype": "Sidebar multi-column resume where headings and text blocks are interleaved",
        "category": "Difficult Parseability",
        "candidate": {
            "candidate_info": {
                "name": "Chloe Bennett",
                "email": "chloe.b@design.io",
                "phone": "+1-555-334-9021",
                "linkedin": "https://linkedin.com/in/chloebennett"
            },
            "skills": ["Python", "SQL", "Docker", "Git"],
            "experience": [
                {
                    "role": "Junior Developer",
                    "company": "Creative Code",
                    "duration": "2022 - Present",
                    "details": ["Constructed database endpoints in Python with SQL, reducing error rates by 15%."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Informatics", "institution": "State University", "year": "2022"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Chloe Bennett chloe.b@design.io +1-555-334-9021 SKILLS Python SQL Docker Git "
            "EXPERIENCE Creative Code Junior Developer Constructed database endpoints in Python with SQL reducing error rates by 15% "
            "EDUCATION State University Bachelor of Science in Informatics 2022"
        ),
        "job_description": (
            "Junior Python Developer. Seeking developer with Python, SQL, and Docker experience to build database applications."
        ),
        "expected": {
            "required_skills": ["Python", "SQL", "Docker"],
            "preferred_skills": ["Git"],
            "mandatory_credentials": [],
            "expected_match_level": "Strong Match",
            "reference_score_range": (70, 85),
            "expected_warnings": [],
            "reference_rank": 10
        }
    },

    # ── 18. Interdisciplinary Role: Health Informatics Engineer ──
    {
        "id": "TC-18-INTERDISCIPLINARY-HEALTH-INFORMATICS",
        "archetype": "Candidate with both healthcare clinical and software background for Health Informatics role",
        "category": "Interdisciplinary Domain",
        "candidate": {
            "candidate_info": {
                "name": "Dr. Alan Foster",
                "email": "alan.foster@biotech.org",
                "phone": "+1-555-667-1122",
                "linkedin": "https://linkedin.com/in/alanfoster"
            },
            "skills": ["Python", "HL7", "FHIR", "EHR Systems", "SQL", "Data Science", "Clinical Informatics"],
            "experience": [
                {
                    "role": "Clinical Informatics Specialist",
                    "company": "HealthData Analytics",
                    "duration": "2020 - Present",
                    "details": [
                        "Architected automated clinical data pipelines in Python and SQL using FHIR protocols across 10 hospital systems.",
                        "Integrated EHR telemetry with machine learning pipelines, decreasing diagnosis lag by 30%."
                    ]
                }
            ],
            "education": [
                {"degree": "Master of Science in Health Informatics", "institution": "Medical University", "year": "2020"}
            ],
            "projects": [],
            "certifications": ["Certified Health Data Analyst"]
        },
        "text": (
            "Dr. Alan Foster. alan.foster@biotech.org +1-555-667-1122 https://linkedin.com/in/alanfoster. "
            "Master of Science in Health Informatics. Architected clinical data pipelines in Python, SQL, FHIR, HL7, EHR systems. Reduced lag by 30% across 10 hospital systems."
        ),
        "job_description": (
            "Health Informatics Engineer. Seeking specialist with expertise in Python, SQL, EHR integration, "
            "and healthcare FHIR protocols to architect clinical data integration pipelines."
        ),
        "expected": {
            "required_skills": ["Python", "SQL", "FHIR", "EHR Systems"],
            "preferred_skills": ["HL7", "Clinical Informatics"],
            "mandatory_credentials": [],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (82, 98),
            "expected_warnings": [],
            "reference_rank": 3
        }
    },

    # ── 19. Seniority Mismatch: Junior applying for Lead / Staff Architect role ──
    {
        "id": "TC-19-SENIORITY-MISMATCH-JUNIOR-FOR-STAFF",
        "archetype": "Junior developer with 1 year experience applying for Staff Principal Architect position",
        "category": "Seniority Mismatch",
        "candidate": {
            "candidate_info": {
                "name": "Ben Carter",
                "email": "ben.c@junior.io",
                "phone": "+1-555-443-8899"
            },
            "skills": ["Python", "FastAPI", "Git", "SQL"],
            "experience": [
                {
                    "role": "Junior Developer",
                    "company": "MiniApps LLC",
                    "duration": "2023 - Present",
                    "details": ["Assisted with backend bug fixes in Python and wrote basic SQL queries under supervision."]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "State Univ", "year": "2023"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Ben Carter. ben.c@junior.io +1-555-443-8899. B.S. in Computer Science. Junior Developer at MiniApps LLC. "
            "Assisted with bug fixes in Python, FastAPI, SQL under supervision."
        ),
        "job_description": (
            "Staff Principal Cloud Architect. Minimum 10+ years of industry experience required. "
            "Lead distributed system architecture, mentor 40+ senior engineers, establish cloud strategies across multi-region AWS infrastructure."
        ),
        "expected": {
            "required_skills": ["Architecture", "Distributed Systems", "AWS", "Cloud Strategy"],
            "preferred_skills": ["Mentorship"],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (35, 52),
            "expected_warnings": [],
            "reference_rank": 17
        }
    },

    # ── 20. Trade / Vocational Candidate: Commercial Electrician with Journeyman License ──
    {
        "id": "TC-20-TRADE-ELECTRICIAN-LICENSED",
        "archetype": "Journeyman Electrician with vocational diploma applying for Commercial Electrician",
        "category": "Trade / Vocational",
        "candidate": {
            "candidate_info": {
                "name": "James Sullivan",
                "email": "james.sullivan@sparkelectric.com",
                "phone": "+1-555-778-9900"
            },
            "skills": ["Electrical Wiring", "Conduit Bending", "Blueprints", "OSHA 30", "Circuit Breakers", "Switchgear"],
            "experience": [
                {
                    "role": "Journeyman Electrician",
                    "company": "Metro Power & Light",
                    "duration": "2018 - Present",
                    "details": [
                        "Installed commercial electrical switchgear and high-voltage wiring across 15 commercial building projects.",
                        "Interpreted electrical blueprints and executed conduit bending adhering 100% to National Electrical Code (NEC)."
                    ]
                }
            ],
            "education": [
                {"degree": "Vocational Apprenticeship Diploma in Electrical Technology", "institution": "IBEW Technical Training Center", "year": "2018"}
            ],
            "projects": [],
            "certifications": ["Journeyman Electrician License", "OSHA 30"]
        },
        "text": (
            "James Sullivan. james.sullivan@sparkelectric.com +1-555-778-9900. Journeyman Electrician License, OSHA 30. "
            "Vocational Apprenticeship Diploma in Electrical Technology. Installed high-voltage switchgear, electrical wiring across 15 commercial buildings. NEC blueprints."
        ),
        "job_description": (
            "Commercial Electrician. Required License: Journeyman Electrician license mandatory. "
            "Must possess commercial wiring, conduit bending, electrical blueprints, and switchgear installation experience."
        ),
        "expected": {
            "required_skills": ["Electrical Wiring", "Conduit Bending", "Blueprints", "Switchgear"],
            "preferred_skills": ["OSHA 30"],
            "mandatory_credentials": ["JOURNEYMAN"],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 100),
            "expected_warnings": [],
            "reference_rank": 2
        }
    },

    # ── 21. Trade Role with Missing Mandatory License: Electrician lacking Journeyman ──
    {
        "id": "TC-21-TRADE-ELECTRICIAN-UNLICENSED",
        "archetype": "Electrical helper lacking mandatory Journeyman license",
        "category": "Missing Mandatory Credential",
        "candidate": {
            "candidate_info": {
                "name": "Rick Sanchez",
                "email": "rick.helper@electric.com",
                "phone": "+1-555-888-7766"
            },
            "skills": ["Electrical Wiring", "Conduit Bending", "Blueprints"],
            "experience": [
                {
                    "role": "Electrician Helper",
                    "company": "Local Sparks",
                    "duration": "2022 - Present",
                    "details": ["Assisted electricians with conduit bending and pulling electrical wiring across 5 sites."]
                }
            ],
            "education": [],
            "projects": [],
            "certifications": ["OSHA 10"]  # Lacks mandatory Journeyman!
        },
        "text": (
            "Rick Sanchez. rick.helper@electric.com +1-555-888-7766. Electrician Helper at Local Sparks. OSHA 10. "
            "Assisted electricians with conduit bending, electrical wiring across 5 construction sites."
        ),
        "job_description": (
            "Commercial Electrician. Required License: Journeyman Electrician license mandatory. "
            "Must possess commercial wiring, conduit bending, electrical blueprints, and switchgear installation experience."
        ),
        "expected": {
            "required_skills": ["Electrical Wiring", "Conduit Bending", "Blueprints", "Switchgear"],
            "preferred_skills": ["OSHA 30"],
            "mandatory_credentials": ["JOURNEYMAN"],
            "expected_match_level": "Needs Optimization",  # Disqualified by mandatory license
            "reference_score_range": (0, 49),
            "expected_warnings": ["missing_mandatory_credential"],
            "reference_rank": 21
        }
    },

    # ── 22. Technical Product Manager (Cross-disciplinary) ──
    {
        "id": "TC-22-PRODUCT-TPM-STRONG",
        "archetype": "Technical Product Manager with CS degree and agile backlog ownership",
        "category": "Product / Management",
        "candidate": {
            "candidate_info": {
                "name": "Priya Sharma",
                "email": "priya.sharma@prodtech.com",
                "phone": "+1-555-332-8811",
                "linkedin": "https://linkedin.com/in/priyasharma"
            },
            "skills": ["Product Management", "Agile", "Scrum", "Roadmap", "User Stories", "Sprint Planning", "Jira", "SQL"],
            "experience": [
                {
                    "role": "Technical Product Manager",
                    "company": "Enterprise Cloud Solutions",
                    "duration": "2020 - Present",
                    "details": [
                        "Owned product roadmap and backlog for cloud platform serving 1.5M daily active users across 4 engineering pods.",
                        "Authored user stories and facilitated sprint planning, increasing team sprint velocity by 28%.",
                        "Leveraged SQL analytics to optimize user onboarding conversion funnels by 22%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "National Institute", "year": "2018"},
                {"degree": "MBA in Technology Management", "institution": "Global Business School", "year": "2020"}
            ],
            "projects": [],
            "certifications": ["Certified Scrum Product Owner (CSPO)", "PMP"]
        },
        "text": (
            "Priya Sharma - Technical Product Manager. priya.sharma@prodtech.com +1-555-332-8811 https://linkedin.com/in/priyasharma. "
            "B.S. in Computer Science, MBA. Certified Scrum Product Owner (CSPO), PMP. "
            "Owned product roadmap, sprint planning, user stories for 1.5M active users across 4 pods. Increased velocity by 28%, optimized conversion by 22%."
        ),
        "job_description": (
            "Technical Product Manager. We are seeking a product owner with strong technical background in "
            "product roadmap execution, Agile/Scrum sprint planning, backlog refinement, user stories, and SQL analytics."
        ),
        "expected": {
            "required_skills": ["Product Management", "Agile", "Roadmap", "User Stories", "Sprint Planning"],
            "preferred_skills": ["SQL", "CSPO"],
            "mandatory_credentials": [],
            "expected_match_level": "Exceptional Match",
            "reference_score_range": (85, 100),
            "expected_warnings": [],
            "reference_rank": 1
        }
    },

    # ── 23. Completely Malformed / Missing Experience Section ──
    {
        "id": "TC-23-MISSING-EXPERIENCE-SECTION",
        "archetype": "Resume with education and skills but completely missing experience section",
        "category": "Malformed / Missing Section",
        "candidate": {
            "candidate_info": {
                "name": "Jane Blank",
                "email": "jane.blank@mail.com",
                "phone": "+1-555-990-1122"
            },
            "skills": ["Python", "FastAPI", "Docker"],
            "experience": [],  # Completely missing
            "education": [
                {"degree": "Bachelor of Science in Computer Science", "institution": "Tech Univ", "year": "2023"}
            ],
            "projects": [],
            "certifications": []
        },
        "text": (
            "Jane Blank. jane.blank@mail.com +1-555-990-1122. Bachelor of Science in Computer Science from Tech Univ. "
            "Skills: Python, FastAPI, Docker, SQL, Git."
        ),
        "job_description": (
            "Senior Backend Engineer. 5+ years experience required. Python, FastAPI, Docker, and PostgreSQL required."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "PostgreSQL"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (30, 48),
            "expected_warnings": [],
            "reference_rank": 20
        }
    },

    # ── 24. Completely Malformed / Empty Resume ──
    {
        "id": "TC-24-EMPTY-SPARSE-TEXT",
        "archetype": "Malformed text with less than 50 characters",
        "category": "Malformed / Empty Text",
        "candidate": {
            "candidate_info": {"name": "", "email": "", "phone": ""},
            "skills": [],
            "experience": [],
            "education": [],
            "projects": [],
            "certifications": []
        },
        "text": "Curriculum Vitae. Contact me at my email.",
        "job_description": "Software Developer needed with Python and SQL.",
        "expected": {
            "required_skills": ["Python", "SQL"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (0, 15),
            "expected_warnings": [],
            "reference_rank": 25
        }
    },

    # ── 25. High Quantity Metrics without Domain Relevance ──
    {
        "id": "TC-25-HIGH-METRICS-IRRELEVANT-DOMAIN",
        "archetype": "Real estate agent with high metrics (45%, $12M, 500+ clients) applying for Senior Cloud Architect",
        "category": "High Metric Irrelevant Domain",
        "candidate": {
            "candidate_info": {
                "name": "Brad Sterling",
                "email": "brad.sterling@realty.com",
                "phone": "+1-555-889-3321",
                "linkedin": "https://linkedin.com/in/bradsterling"
            },
            "skills": ["Real Estate Sales", "Contract Negotiation", "Client Acquisition", "Cold Calling", "Property Management"],
            "experience": [
                {
                    "role": "Senior Real Estate Associate",
                    "company": "Sterling Properties",
                    "duration": "2019 - Present",
                    "details": [
                        "Closed 85 residential property contracts generating $25M in annual revenue with 100% quota attainment.",
                        "Expanded active client portfolio by 45% across 500+ prospective home buyers, slashing closing duration by 30%."
                    ]
                }
            ],
            "education": [
                {"degree": "Bachelor of Arts in Communications", "institution": "State University", "year": "2019"}
            ],
            "projects": [],
            "certifications": ["Licensed Real Estate Broker"]
        },
        "text": (
            "Brad Sterling. brad.sterling@realty.com +1-555-889-3321 https://linkedin.com/in/bradsterling. "
            "B.A. in Communications. Closed 85 property contracts generating $25M revenue with 100% quota attainment. "
            "Expanded client portfolio by 45% across 500+ buyers, reducing duration by 30%. Licensed Real Estate Broker."
        ),
        "job_description": (
            "Senior Python Cloud Engineer. We are seeking a senior backend software engineer with deep expertise in "
            "Python, FastAPI, Docker, Kubernetes, PostgreSQL, and AWS to architect scalable microservices and manage cloud deployments."
        ),
        "expected": {
            "required_skills": ["Python", "FastAPI", "Docker", "Kubernetes", "PostgreSQL", "AWS"],
            "preferred_skills": [],
            "mandatory_credentials": [],
            "expected_match_level": "Needs Optimization",
            "reference_score_range": (0, 45),
            "expected_warnings": [],
            "reference_rank": 23
        }
    }
]


# ────────────────────────────────────────────────────────────
# STATISTICAL EVALUATION RUNNER
# ────────────────────────────────────────────────────────────

def calculate_spearman_rho(ranks_a: List[float], ranks_b: List[float]) -> float:
    """Calculate Spearman's rank correlation coefficient (rho)."""
    n = len(ranks_a)
    if n < 2:
        return 1.0
    d_sq = sum((a - b) ** 2 for a, b in zip(ranks_a, ranks_b))
    return 1.0 - (6.0 * d_sq) / (n * (n ** 2 - 1))


def evaluate_benchmark(fixtures: List[Dict[str, Any]] = BENCHMARK_FIXTURES) -> Dict[str, Any]:
    """
    Executes all benchmark fixtures against ResumeIQ's scoring engine and returns
    comprehensive field extraction metrics, scoring accuracy, and ranking metrics.
    """
    from app import compute_industry_ats_score

    results = []
    category_matches = 0
    total_fixtures = len(fixtures)

    # Metric accumulators
    total_expected_skills = 0
    total_matched_skills = 0
    true_positives_skills = 0
    false_positives_skills = 0
    false_negatives_skills = 0

    mandatory_cred_expected_count = 0
    mandatory_cred_detected_count = 0
    mandatory_cred_false_positives = 0
    mandatory_cred_false_negatives = 0

    actual_scores = []
    reference_scores = []
    actual_ranks = []
    reference_ranks = []

    for fixture in fixtures:
        f_id = fixture["id"]
        c_data = fixture["candidate"]
        text = fixture["text"]
        jd = fixture["job_description"]
        expected = fixture["expected"]

        # Simulate skill matching based on candidate skills vs JD
        candidate_skills = c_data.get("skills", [])
        expected_req = expected.get("required_skills", [])
        expected_pref = expected.get("preferred_skills", [])
        all_expected_skills = set(s.lower() for s in expected_req + expected_pref)

        # Candidate skills matching JD
        c_skills_lower = set(s.lower() for s in candidate_skills)
        matched_skills = [s for s in candidate_skills if s.lower() in all_expected_skills or s.lower() in jd.lower()]
        missing_skills = [s for s in expected_req if s.lower() not in c_skills_lower]

        # Execute ResumeIQ scoring
        score, breakdown, match_level = compute_industry_ats_score(
            c_data, jd, matched_skills, missing_skills, text
        )

        expected_level = expected.get("expected_match_level")
        level_agrees = (match_level == expected_level)
        if level_agrees:
            category_matches += 1

        min_s, max_s = expected.get("reference_score_range", (0, 100))
        score_in_range = (min_s <= score <= max_s)

        # Mandatory Credential Requirement & Missing Warning Audit
        edu_ev = breakdown.get("education_credentials", {}).get("evidence", {})
        warnings = edu_ev.get("warnings", [])
        missing_mandatory_creds = edu_ev.get("mandatory_credentials_missing", [])

        # 1. Did the system detect that the JD mandates a credential?
        jd_mandates_cred = bool(expected.get("mandatory_credentials"))
        system_detected_jd_mandate = bool(edu_ev.get("mandatory_credential_required"))

        if jd_mandates_cred:
            mandatory_cred_expected_count += 1
            if system_detected_jd_mandate:
                mandatory_cred_detected_count += 1
            else:
                mandatory_cred_false_negatives += 1
        else:
            if system_detected_jd_mandate:
                mandatory_cred_false_positives += 1

        # 2. Did the system warn about a missing credential when expected?
        expected_missing_warning = ("missing_mandatory_credential" in expected.get("expected_warnings", []))
        emitted_missing_warning = bool(missing_mandatory_creds or any("missing mandatory credential" in w.lower() for w in warnings))

        # Skills Precision / Recall / F1 calculation
        expected_skills_set = set(s.lower() for s in (expected.get("required_skills", []) + expected.get("preferred_skills", [])))
        matched_skills_set = set(s.lower() for s in matched_skills)

        tp = len(matched_skills_set & expected_skills_set)
        fp = len(matched_skills_set - expected_skills_set)
        fn = len(expected_skills_set - matched_skills_set)

        true_positives_skills += tp
        false_positives_skills += fp
        false_negatives_skills += fn

        ref_score_mid = (min_s + max_s) / 2.0
        actual_scores.append(score)
        reference_scores.append(ref_score_mid)
        reference_ranks.append(expected.get("reference_rank", 10))

        results.append({
            "id": f_id,
            "archetype": fixture["archetype"],
            "category": fixture["category"],
            "score": score,
            "match_level": match_level,
            "expected_match_level": expected_level,
            "level_agrees": level_agrees,
            "score_in_range": score_in_range,
            "expected_range": (min_s, max_s),
            "jd_mandates_cred": jd_mandates_cred,
            "system_detected_jd_mandate": system_detected_jd_mandate,
            "expected_missing_warning": expected_missing_warning,
            "emitted_missing_warning": emitted_missing_warning,
            "warnings": warnings,
            "breakdown": breakdown
        })

    # Sort to determine actual ranks for Spearman correlation
    indexed_actual = sorted(enumerate(actual_scores), key=lambda x: x[1], reverse=True)
    actual_ranks = [0] * total_fixtures
    for rank, (orig_idx, _) in enumerate(indexed_actual, start=1):
        actual_ranks[orig_idx] = rank

    spearman_rho = calculate_spearman_rho(actual_ranks, reference_ranks)

    # Compute aggregate metrics
    category_agreement_rate = (category_matches / total_fixtures) * 100 if total_fixtures else 0
    mandatory_cred_recall = (
        (mandatory_cred_detected_count / mandatory_cred_expected_count) * 100
        if mandatory_cred_expected_count else 100.0
    )
    mandatory_cred_precision = (
        (mandatory_cred_detected_count / (mandatory_cred_detected_count + mandatory_cred_false_positives)) * 100
        if (mandatory_cred_detected_count + mandatory_cred_false_positives) else 100.0
    )

    skill_prec = true_positives_skills / (true_positives_skills + false_positives_skills) if (true_positives_skills + false_positives_skills) else 1.0
    skill_rec = true_positives_skills / (true_positives_skills + false_negatives_skills) if (true_positives_skills + false_negatives_skills) else 1.0
    skill_f1 = (2 * skill_prec * skill_rec) / (skill_prec + skill_rec) if (skill_prec + skill_rec) else 0.0

    return {
        "total_fixtures": total_fixtures,
        "category_matches": category_matches,
        "category_agreement_rate": round(category_agreement_rate, 2),
        "spearman_rank_correlation": round(spearman_rho, 3),
        "skills_metrics": {
            "precision": round(skill_prec * 100, 2),
            "recall": round(skill_rec * 100, 2),
            "f1": round(skill_f1 * 100, 2)
        },
        "mandatory_credentials": {
            "expected_count": mandatory_cred_expected_count,
            "detected_count": mandatory_cred_detected_count,
            "false_positives": mandatory_cred_false_positives,
            "false_negatives": mandatory_cred_false_negatives,
            "recall": round(mandatory_cred_recall, 2),
            "precision": round(mandatory_cred_precision, 2)
        },
        "results": results
    }


if __name__ == "__main__":
    import json
    report = evaluate_benchmark()
    print("\n" + "=" * 70)
    print("RESUMEIQ BENCHMARK EVALUATION RESULTS (25 FIXTURES)")
    print("=" * 70)
    print(f"Total Evaluated Fixtures:       {report['total_fixtures']}")
    print(f"Match Category Agreement Rate:  {report['category_agreement_rate']}%")
    print(f"Spearman Rank Correlation:      {report['spearman_rank_correlation']}")
    print(f"Mandatory Credential Precision: {report['mandatory_credentials']['precision']}%")
    print(f"Mandatory Credential Recall:    {report['mandatory_credentials']['recall']}%")
    print("-" * 70)
    print(f"{'Fixture ID':<35} {'Score':<7} {'Actual Level':<20} {'Expected Level':<20} {'Match?'}")
    print("-" * 70)
    for r in report["results"]:
        match_sym = "PASS" if r["level_agrees"] else "FAIL"
        print(f"{r['id']:<35} {r['score']:<7} {r['match_level']:<20} {r['expected_match_level']:<20} {match_sym}")
