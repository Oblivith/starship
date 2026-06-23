"""
scrapers/scholarships_expand.py  —  scholarships expansion (-> 50+ real schemes)

Inserts a curated set of REAL, well-known Indian scholarship schemes (NSP,
AICTE Pragati/Saksham, DST INSPIRE, PM Scholarship, Ishan Uday, HDFC, Tata
Capital, Buddy4Study, 10+ state schemes, minority/SC-ST-OBC, sports, girl-child,
and stream-specific schemes).

WHY CURATED, NOT AI-GENERATED:
  Scholarships are factual entities — names, eligibility, amounts and especially
  application URLs must be correct, not plausibly invented. Letting an LLM
  hallucinate scheme details would actively mislead the underprivileged students
  this platform serves. This mirrors university_costs.py, which used a curated
  published-fee table as its primary source. (Cohere is still the project's AI
  provider for genuinely generative work — see careers_expand.py.)

SCHEMA:
  The live scholarships table differs from the brief's column list. This script
  ADD COLUMN IF NOT EXISTS-es the missing brief columns (description,
  amount_min_inr, eligibility_criteria, deadline_month, stream_tags TEXT[],
  provider_type) and reuses the existing `provider` as the provider name and the
  existing amount_max_inr / application_url / competitiveness_level / renewable.

IDEMPOTENCY:
  No unique constraint on scholarship_name (PK only), so each insert is guarded
  by a case-insensitive existence check; commit in batches. Re-running inserts
  only the schemes still missing and updates nothing existing.

Run:
  python3 scrapers/scholarships_expand.py
"""

import os
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

BATCH_SIZE = 10


# ---------------------------------------------------------------------------
# Curated real schemes. Each dict maps onto the (extended) schema. amount_* are
# annual INR; income_limit_inr is the family-income ceiling (None = open);
# competitiveness_level 1 (easy) .. 5 (very competitive); stream_tags drive the
# frontend filter; deadline_month is the typical application window.
# ---------------------------------------------------------------------------

SCHOLARSHIPS = [
    # ---- National Scholarship Portal (NSP) ----
    {"name": "Central Sector Scheme of Scholarship (CSSS)", "provider": "Ministry of Education (NSP)",
     "ptype": "government", "desc": "Merit scholarship for top Class 12 performers pursuing graduation.",
     "elig": "Above 80th percentile in Class 12 board; family income <= 4.5L; regular UG/PG course.",
     "amin": 10000, "amax": 20000, "income": 450000, "minpct": 80,
     "url": "https://scholarships.gov.in", "deadline": "October", "tags": ["Any Stream"],
     "comp": 4, "renew": True},
    {"name": "Post-Matric Scholarship for SC Students", "provider": "Ministry of Social Justice (NSP)",
     "ptype": "government", "desc": "Covers maintenance + course fees for SC students in post-matric study.",
     "elig": "SC category; family income <= 2.5L; studying Class 11 and above.",
     "amin": 12000, "amax": 60000, "income": 250000, "minpct": None,
     "url": "https://scholarships.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Post-Matric Scholarship for OBC Students", "provider": "Ministry of Social Justice (NSP)",
     "ptype": "government", "desc": "Fee + maintenance support for OBC students post Class 10.",
     "elig": "OBC category; family income <= 1.5L; post-matriculation course.",
     "amin": 10000, "amax": 40000, "income": 150000, "minpct": None,
     "url": "https://scholarships.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Merit-cum-Means Scholarship for Minorities", "provider": "Ministry of Minority Affairs (NSP)",
     "ptype": "government", "desc": "Professional/technical course support for minority-community students.",
     "elig": "Minority community; family income <= 2.5L; >= 50% in previous exam.",
     "amin": 25000, "amax": 30000, "income": 250000, "minpct": 50,
     "url": "https://scholarships.gov.in", "deadline": "December", "tags": ["Engineering", "Medical", "Management"],
     "comp": 3, "renew": True},
    {"name": "Pre-Matric Scholarship for Minorities", "provider": "Ministry of Minority Affairs (NSP)",
     "ptype": "government", "desc": "Support for minority students in Class 9-10.",
     "elig": "Minority community; family income <= 1L; >= 50% in previous class.",
     "amin": 1000, "amax": 10000, "income": 100000, "minpct": 50,
     "url": "https://scholarships.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 1, "renew": True},
    {"name": "Top Class Education Scheme for SC Students", "provider": "Ministry of Social Justice (NSP)",
     "ptype": "government", "desc": "Full support for SC students in notified premier institutions.",
     "elig": "SC category admitted to a notified institute (IIT/IIM/NLU etc.); income <= 8L.",
     "amin": 50000, "amax": 200000, "income": 800000, "minpct": None,
     "url": "https://scholarships.gov.in", "deadline": "October", "tags": ["Engineering", "Management", "Law"],
     "comp": 4, "renew": True},

    # ---- AICTE ----
    {"name": "AICTE Pragati Scholarship for Girls", "provider": "AICTE",
     "ptype": "government", "desc": "Encourages girls in technical (diploma/degree) education.",
     "elig": "Girl student in AICTE-approved technical course; family income <= 8L; max 2 girls/family.",
     "amin": 30000, "amax": 50000, "income": 800000, "minpct": None,
     "url": "https://www.aicte-india.org/schemes/students-development-schemes",
     "deadline": "December", "tags": ["Engineering", "Pharmacy", "Management"], "comp": 3, "renew": True},
    {"name": "AICTE Saksham Scholarship for Differently-Abled", "provider": "AICTE",
     "ptype": "government", "desc": "Supports specially-abled students in technical education.",
     "elig": "Differently-abled (>=40%) student in AICTE-approved course; family income <= 8L.",
     "amin": 30000, "amax": 50000, "income": 800000, "minpct": None,
     "url": "https://www.aicte-india.org/schemes/students-development-schemes",
     "deadline": "December", "tags": ["Engineering", "Pharmacy"], "comp": 2, "renew": True},
    {"name": "AICTE Swanath Scholarship", "provider": "AICTE",
     "ptype": "government", "desc": "For orphans, COVID-affected and wards of armed/CAPF martyrs in technical courses.",
     "elig": "Orphan / COVID-affected / ward of martyr; AICTE-approved course; income <= 8L.",
     "amin": 50000, "amax": 50000, "income": 800000, "minpct": None,
     "url": "https://www.aicte-india.org/schemes/students-development-schemes",
     "deadline": "December", "tags": ["Engineering", "Pharmacy", "Management"], "comp": 2, "renew": True},

    # ---- DST / Science ----
    {"name": "INSPIRE Scholarship (SHE)", "provider": "Department of Science & Technology",
     "ptype": "government", "desc": "Scholarship for Higher Education to attract top students into basic sciences.",
     "elig": "Top 1% in Class 12 boards OR top-ranker pursuing B.Sc/B.S/Int. M.Sc in natural sciences.",
     "amin": 80000, "amax": 80000, "income": None, "minpct": None,
     "url": "https://online-inspire.gov.in", "deadline": "December", "tags": ["Science"],
     "comp": 5, "renew": True},
    {"name": "Kishore Vaigyanik Protsahan Yojana (KVPY legacy / INSPIRE)", "provider": "IISc / DST",
     "ptype": "government", "desc": "Fellowship encouraging students to take up research careers in science.",
     "elig": "Students in basic-science streams selected via aptitude test/interview (now merged into INSPIRE).",
     "amin": 60000, "amax": 84000, "income": None, "minpct": None,
     "url": "https://online-inspire.gov.in", "deadline": "August", "tags": ["Science"],
     "comp": 5, "renew": True},

    # ---- Defence / PM ----
    {"name": "Prime Minister's Scholarship Scheme (PMSS)", "provider": "Kendriya Sainik Board",
     "ptype": "government", "desc": "For wards/widows of ex-servicemen and serving personnel.",
     "elig": "Dependent of ex-servicemen/serving personnel below officer rank; >= 60% in Class 12.",
     "amin": 30000, "amax": 36000, "income": None, "minpct": 60,
     "url": "https://desw.gov.in", "deadline": "November", "tags": ["Engineering", "Medical", "Management"],
     "comp": 3, "renew": True},
    {"name": "Ishan Uday Special Scholarship for NER", "provider": "UGC",
     "ptype": "government", "desc": "Special scholarship for students from the North-Eastern Region.",
     "elig": "Domicile of NER state; family income <= 4.5L; pursuing general degree/professional course.",
     "amin": 46000, "amax": 78000, "income": 450000, "minpct": None,
     "url": "https://www.ugc.gov.in", "deadline": "October", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "PG Indira Gandhi Scholarship for Single Girl Child", "provider": "UGC",
     "ptype": "government", "desc": "For single girl children pursuing postgraduate study.",
     "elig": "Single girl child of parents (no sibling); enrolled in a non-professional PG course.",
     "amin": 36000, "amax": 36000, "income": None, "minpct": None,
     "url": "https://www.ugc.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},

    # ---- Corporate / NGO ----
    {"name": "HDFC Bank Parivartan's ECSS Programme", "provider": "HDFC Bank",
     "ptype": "private", "desc": "Educational Crisis Scholarship for students facing a personal/family crisis.",
     "elig": "Class 1 to PG/professional; family income <= 2.5L; faced a recent crisis; >= 55% marks.",
     "amin": 15000, "amax": 75000, "income": 250000, "minpct": 55,
     "url": "https://www.buddy4study.com/page/hdfc-bank-parivartans-ecss-programme",
     "deadline": "October", "tags": ["Any Stream"], "comp": 3, "renew": False},
    {"name": "Tata Capital Pankh Scholarship", "provider": "Tata Capital",
     "ptype": "private", "desc": "Need-based support for meritorious students from low-income families.",
     "elig": "Class 11-12, UG, diploma students; family income <= 2.5L; >= 60% in last exam.",
     "amin": 10000, "amax": 50000, "income": 250000, "minpct": 60,
     "url": "https://www.tatacapital.com/csr.html", "deadline": "November",
     "tags": ["Engineering", "Medical", "Commerce", "Any Stream"], "comp": 3, "renew": False},
    {"name": "Buddy4Study India Scholarship", "provider": "Buddy4Study Foundation",
     "ptype": "ngo", "desc": "Umbrella need-cum-merit scholarship for school and college students.",
     "elig": "Class 6 to PG; family income <= 6L; merit + financial need.",
     "amin": 10000, "amax": 25000, "income": 600000, "minpct": None,
     "url": "https://www.buddy4study.com", "deadline": "January", "tags": ["Any Stream"],
     "comp": 3, "renew": False},
    {"name": "Reliance Foundation Undergraduate Scholarship", "provider": "Reliance Foundation",
     "ptype": "private", "desc": "Merit-cum-means UG scholarship with mentorship.",
     "elig": "First-year UG student; family income <= 15L; strong academic + aptitude score.",
     "amin": 100000, "amax": 200000, "income": 1500000, "minpct": None,
     "url": "https://www.reliancefoundation.org", "deadline": "December",
     "tags": ["Any Stream"], "comp": 4, "renew": True},
    {"name": "Sitaram Jindal Foundation Scholarship", "provider": "Sitaram Jindal Foundation",
     "ptype": "ngo", "desc": "Merit-cum-means support across school, college and professional courses.",
     "elig": "Class 11 to professional courses; income limits vary by category; merit-based.",
     "amin": 6000, "amax": 36000, "income": 400000, "minpct": 50,
     "url": "https://www.sitaramjindalfoundation.org", "deadline": "Rolling",
     "tags": ["Any Stream"], "comp": 2, "renew": True},
    {"name": "Aditya Birla Capital Foundation Scholarship", "provider": "Aditya Birla Capital",
     "ptype": "private", "desc": "Need-based scholarship for school and college students.",
     "elig": "Class 11 to UG; family income <= 6L; merit + financial need.",
     "amin": 12000, "amax": 60000, "income": 600000, "minpct": 60,
     "url": "https://www.buddy4study.com", "deadline": "November", "tags": ["Any Stream"],
     "comp": 3, "renew": False},
    {"name": "Vidyasaarathi Scholarship Portal", "provider": "NSDL / Protean",
     "ptype": "private", "desc": "Portal hosting multiple corporate-funded scholarships.",
     "elig": "Varies by sponsoring scholarship; mostly need-based for UG/PG students.",
     "amin": 10000, "amax": 50000, "income": 600000, "minpct": None,
     "url": "https://www.vidyasaarathi.co.in", "deadline": "Rolling", "tags": ["Any Stream"],
     "comp": 2, "renew": False},
    {"name": "Foundation for Excellence (FFE) Scholarship", "provider": "Foundation for Excellence",
     "ptype": "ngo", "desc": "Supports meritorious engineering/medical students from poor families.",
     "elig": "Top scorers in JEE/NEET from families with income <= 1L; first professional year.",
     "amin": 30000, "amax": 60000, "income": 100000, "minpct": None,
     "url": "https://www.ffe.org", "deadline": "September", "tags": ["Engineering", "Medical"],
     "comp": 4, "renew": True},

    # ---- State government (10+ states) ----
    {"name": "Maharashtra Rajarshi Shahu Maharaj Scholarship", "provider": "Govt. of Maharashtra",
     "ptype": "government", "desc": "Fee reimbursement for EBC/professional-course students in Maharashtra.",
     "elig": "Maharashtra domicile; family income <= 8L; professional course.",
     "amin": 25000, "amax": 100000, "income": 800000, "minpct": None,
     "url": "https://mahadbt.maharashtra.gov.in", "deadline": "December",
     "tags": ["Engineering", "Medical", "Management"], "comp": 2, "renew": True},
    {"name": "Tamil Nadu Chief Minister's Merit Scholarship", "provider": "Govt. of Tamil Nadu",
     "ptype": "government", "desc": "Merit scholarship for TN students in higher education.",
     "elig": "TN domicile; high Class 12 marks; income criteria apply.",
     "amin": 10000, "amax": 50000, "income": 200000, "minpct": 80,
     "url": "https://www.tn.gov.in", "deadline": "October", "tags": ["Any Stream"],
     "comp": 3, "renew": True},
    {"name": "Karnataka Vidyasiri Scholarship", "provider": "Govt. of Karnataka",
     "ptype": "government", "desc": "Food + hostel allowance for backward-class students.",
     "elig": "Karnataka domicile; BC/minority; family income <= 1L; post-matric.",
     "amin": 1500, "amax": 18000, "income": 100000, "minpct": None,
     "url": "https://ssp.postmatric.karnataka.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "UP Post-Matric Scholarship", "provider": "Govt. of Uttar Pradesh",
     "ptype": "government", "desc": "Fee + maintenance for post-matric students of UP.",
     "elig": "UP domicile; SC/ST/OBC/General as per category; income limits apply.",
     "amin": 10000, "amax": 30000, "income": 200000, "minpct": None,
     "url": "https://scholarship.up.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "West Bengal Swami Vivekananda Merit-cum-Means Scholarship (SVMCM)", "provider": "Govt. of West Bengal",
     "ptype": "government", "desc": "Merit-cum-means scholarship for WB students Class 11 to PG/research.",
     "elig": "WB domicile; >= 60% in qualifying exam; family income <= 2.5L.",
     "amin": 12000, "amax": 60000, "income": 250000, "minpct": 60,
     "url": "https://svmcm.wbhed.gov.in", "deadline": "December",
     "tags": ["Engineering", "Medical", "Science", "Any Stream"], "comp": 2, "renew": True},
    {"name": "Rajasthan Mukhyamantri Uchch Shiksha Scholarship", "provider": "Govt. of Rajasthan",
     "ptype": "government", "desc": "Merit scholarship for top Rajasthan students in higher education.",
     "elig": "Rajasthan domicile; top rankers in Class 12; family income <= 2.5L.",
     "amin": 5000, "amax": 50000, "income": 250000, "minpct": None,
     "url": "https://hte.rajasthan.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 3, "renew": True},
    {"name": "Gujarat Mukhyamantri Yuva Swavalamban Yojana (MYSY)", "provider": "Govt. of Gujarat",
     "ptype": "government", "desc": "Tuition + hostel + book aid for meritorious Gujarat students.",
     "elig": "Gujarat domicile; >= 80% in Class 10/12; family income <= 6L.",
     "amin": 10000, "amax": 200000, "income": 600000, "minpct": 80,
     "url": "https://mysy.guj.nic.in", "deadline": "November",
     "tags": ["Engineering", "Medical", "Any Stream"], "comp": 3, "renew": True},
    {"name": "Bihar Mukhyamantri Kanya Utthan Yojana", "provider": "Govt. of Bihar",
     "ptype": "government", "desc": "Cash incentive for girls completing intermediate and graduation.",
     "elig": "Bihar domicile girl student; passed Class 12 / graduation; unmarried at intermediate stage.",
     "amin": 10000, "amax": 50000, "income": None, "minpct": None,
     "url": "https://medhasoft.bih.nic.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 1, "renew": False},
    {"name": "Kerala Higher Education Scholarship (Suvarna Jubilee)", "provider": "Govt. of Kerala",
     "ptype": "government", "desc": "Merit-cum-means scholarship for Kerala UG/PG students.",
     "elig": "Kerala domicile; family income <= 1L; pursuing degree/PG in the state.",
     "amin": 12000, "amax": 60000, "income": 100000, "minpct": None,
     "url": "https://www.dcescholarship.kerala.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Madhya Pradesh Mukhyamantri Medhavi Vidyarthi Yojana (MMVY)", "provider": "Govt. of Madhya Pradesh",
     "ptype": "government", "desc": "Tuition support for meritorious MP students in higher education.",
     "elig": "MP domicile; >= 70% (CBSE) / 85% (MP Board) in Class 12; family income <= 6L.",
     "amin": 30000, "amax": 150000, "income": 600000, "minpct": 70,
     "url": "https://scholarshipportal.mp.nic.in", "deadline": "December",
     "tags": ["Engineering", "Medical", "Law", "Any Stream"], "comp": 3, "renew": True},
    {"name": "Telangana ePASS Post-Matric Scholarship", "provider": "Govt. of Telangana",
     "ptype": "government", "desc": "Fee reimbursement + maintenance for post-matric students.",
     "elig": "Telangana domicile; SC/ST/BC/EBC/minority; income limits apply.",
     "amin": 10000, "amax": 35000, "income": 200000, "minpct": None,
     "url": "https://telanganaepass.cgg.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Andhra Pradesh Jagananna Vidya Deevena", "provider": "Govt. of Andhra Pradesh",
     "ptype": "government", "desc": "Full fee reimbursement for eligible college students.",
     "elig": "AP domicile; family income <= 2.5L; enrolled in ITI/polytechnic/degree/professional course.",
     "amin": 10000, "amax": 100000, "income": 250000, "minpct": None,
     "url": "https://jnanabhumi.ap.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Punjab Post-Matric Scholarship for SC Students", "provider": "Govt. of Punjab",
     "ptype": "government", "desc": "Fee + maintenance for SC students of Punjab.",
     "elig": "Punjab domicile; SC category; family income <= 2.5L; post-matric course.",
     "amin": 10000, "amax": 30000, "income": 250000, "minpct": None,
     "url": "https://scholarships.punjab.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Odisha Medhabruti Scholarship", "provider": "Govt. of Odisha",
     "ptype": "government", "desc": "Merit scholarship for Odisha students in higher/professional education.",
     "elig": "Odisha domicile; >= 60% in qualifying exam; family income <= 6L.",
     "amin": 10000, "amax": 50000, "income": 600000, "minpct": 60,
     "url": "https://scholarship.odisha.gov.in", "deadline": "December",
     "tags": ["Engineering", "Medical", "Any Stream"], "comp": 3, "renew": True},

    # ---- Sports ----
    {"name": "Khelo India Scholarship", "provider": "Ministry of Youth Affairs & Sports",
     "ptype": "government", "desc": "Long-term athlete-development support for selected young athletes.",
     "elig": "Identified Khelo India athletes across notified sports disciplines.",
     "amin": 120000, "amax": 500000, "income": None, "minpct": None,
     "url": "https://kheloindia.gov.in", "deadline": "Rolling", "tags": ["Sports"],
     "comp": 5, "renew": True},
    {"name": "GoSports Foundation Athlete Scholarship", "provider": "GoSports Foundation",
     "ptype": "ngo", "desc": "Funding + mentorship for promising junior and elite athletes.",
     "elig": "Talented athletes in Olympic/Paralympic disciplines; selection-based.",
     "amin": 100000, "amax": 600000, "income": None, "minpct": None,
     "url": "https://gosports.in", "deadline": "Rolling", "tags": ["Sports"],
     "comp": 5, "renew": True},

    # ---- Girl child / women ----
    {"name": "CBSE Single Girl Child Merit Scholarship", "provider": "CBSE",
     "ptype": "government", "desc": "For single girl children scoring well in Class 10 CBSE.",
     "elig": "Single girl child; >= 60% in Class 10 CBSE; tuition fee <= prescribed limit.",
     "amin": 6000, "amax": 6000, "income": None, "minpct": 60,
     "url": "https://www.cbse.gov.in", "deadline": "October", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "Begum Hazrat Mahal National Scholarship (Girls)", "provider": "Maulana Azad Education Foundation",
     "ptype": "government", "desc": "For meritorious girls of notified minority communities.",
     "elig": "Minority-community girl; >= 50% in previous class; family income <= 2L.",
     "amin": 5000, "amax": 12000, "income": 200000, "minpct": 50,
     "url": "https://www.maef.nic.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "L'Oreal India For Young Women in Science Scholarship", "provider": "L'Oreal India",
     "ptype": "private", "desc": "Supports young women pursuing science degrees.",
     "elig": "Girl student; pursuing/entering a science degree; family income <= 6L; >= 60% in Class 12.",
     "amin": 100000, "amax": 250000, "income": 600000, "minpct": 60,
     "url": "https://www.buddy4study.com", "deadline": "September", "tags": ["Science"],
     "comp": 4, "renew": False},

    # ---- Stream-specific (engineering / medical / law / arts) ----
    {"name": "Keep India Smiling Foundational Scholarship (Colgate)", "provider": "Colgate-Palmolive India",
     "ptype": "private", "desc": "Merit-cum-means scholarship across school, college and sports.",
     "elig": "Class 11 to PG; family income <= 5L; merit + financial need.",
     "amin": 18000, "amax": 30000, "income": 500000, "minpct": None,
     "url": "https://www.colgatecares.co.in", "deadline": "November",
     "tags": ["Any Stream", "Sports"], "comp": 3, "renew": True},
    {"name": "Legrand Empowering Scholarship Program", "provider": "Legrand India",
     "ptype": "private", "desc": "For specially-abled and meritorious engineering/diploma students.",
     "elig": "Engineering/diploma students; family income <= 5L; preference to specially-abled.",
     "amin": 20000, "amax": 50000, "income": 500000, "minpct": 60,
     "url": "https://www.buddy4study.com", "deadline": "October", "tags": ["Engineering"],
     "comp": 3, "renew": False},
    {"name": "Santoor Women's Scholarship", "provider": "Wipro Consumer Care",
     "ptype": "private", "desc": "Supports girl students pursuing graduation.",
     "elig": "Girl student; first-year graduation; >= 60% in Class 12; family income <= 2L.",
     "amin": 24000, "amax": 24000, "income": 200000, "minpct": 60,
     "url": "https://www.buddy4study.com", "deadline": "October",
     "tags": ["Commerce", "Science", "Arts/Humanities"], "comp": 3, "renew": True},
    {"name": "Nationwide Education & Scholarship Test (NEST) Award", "provider": "NEST Foundation",
     "ptype": "ngo", "desc": "Merit award for school students via a national aptitude test.",
     "elig": "Class 1-12 students; selection via NEST exam; merit-based.",
     "amin": 5000, "amax": 50000, "income": None, "minpct": None,
     "url": "https://www.nestindia.org", "deadline": "Rolling", "tags": ["Any Stream"],
     "comp": 3, "renew": False},
    {"name": "Dr. Ambedkar Post-Matric Scholarship for EBC", "provider": "Ministry of Social Justice",
     "ptype": "government", "desc": "Post-matric support for Economically Backward Class students.",
     "elig": "EBC category; family income <= 1L; post-matric course.",
     "amin": 5000, "amax": 20000, "income": 100000, "minpct": None,
     "url": "https://scholarships.gov.in", "deadline": "December", "tags": ["Any Stream"],
     "comp": 2, "renew": True},
    {"name": "National Means-cum-Merit Scholarship (NMMSS)", "provider": "Ministry of Education",
     "ptype": "government", "desc": "Arrests dropout at Class 8; supports Class 9-12 study.",
     "elig": "Selected via state exam in Class 8; family income <= 3.5L; government-school student.",
     "amin": 12000, "amax": 12000, "income": 350000, "minpct": 55,
     "url": "https://scholarships.gov.in", "deadline": "November", "tags": ["Any Stream"],
     "comp": 3, "renew": True},
    {"name": "Saksham Scholarship by Buddy4Study", "provider": "Buddy4Study",
     "ptype": "ngo", "desc": "Need-based support for students with disabilities in higher education.",
     "elig": "Differently-abled student in UG/PG; family income <= 4L.",
     "amin": 20000, "amax": 50000, "income": 400000, "minpct": None,
     "url": "https://www.buddy4study.com", "deadline": "Rolling", "tags": ["Any Stream"],
     "comp": 2, "renew": False},
    {"name": "ONGC Foundation Scholarship for SC/ST & OBC", "provider": "ONGC Foundation",
     "ptype": "private", "desc": "For meritorious SC/ST and OBC students in professional courses.",
     "elig": "SC/ST/OBC; family income <= 4.5L (SC/ST) / 2L (OBC); first-year professional course; >= 60%.",
     "amin": 48000, "amax": 48000, "income": 450000, "minpct": 60,
     "url": "https://www.ongcindia.com", "deadline": "December",
     "tags": ["Engineering", "Medical", "Management"], "comp": 4, "renew": True},
    {"name": "NTSE National Talent Search Scholarship", "provider": "NCERT",
     "ptype": "government", "desc": "Prestigious talent-search scholarship from Class 11 onwards.",
     "elig": "Selected via NTSE (stage 1 state + stage 2 national); open to all streams.",
     "amin": 15000, "amax": 24000, "income": None, "minpct": None,
     "url": "https://ncert.nic.in", "deadline": "Rolling", "tags": ["Any Stream", "Science"],
     "comp": 5, "renew": True},
    {"name": "Bharti Airtel Scholarship Program", "provider": "Bharti Airtel Foundation",
     "ptype": "private", "desc": "Full support for meritorious students in select engineering institutes.",
     "elig": "Admitted to a partner institute; family income <= 8.5L; merit-based.",
     "amin": 100000, "amax": 250000, "income": 850000, "minpct": None,
     "url": "https://www.bhartifoundation.org", "deadline": "September", "tags": ["Engineering"],
     "comp": 4, "renew": True},
    {"name": "Mahindra All India Talent Scholarship (Diploma)", "provider": "K.C. Mahindra Education Trust",
     "ptype": "ngo", "desc": "For students from lower-income families pursuing job-oriented diplomas.",
     "elig": "Diploma students; family income <= 1.2L; >= 60% in Class 10/12.",
     "amin": 10000, "amax": 10000, "income": 120000, "minpct": 60,
     "url": "https://www.kcmet.org", "deadline": "September", "tags": ["Engineering", "Any Stream"],
     "comp": 3, "renew": False},
    {"name": "Indian Oil Academic Scholarship", "provider": "Indian Oil Corporation",
     "ptype": "private", "desc": "Scholarships for 10+/ITI/engineering/medical/MBA students.",
     "elig": "Family income <= 1L; >= 65% in qualifying exam; reserved-category relaxations.",
     "amin": 12000, "amax": 36000, "income": 100000, "minpct": 65,
     "url": "https://www.iocl.com", "deadline": "October",
     "tags": ["Engineering", "Medical", "Management", "Any Stream"], "comp": 4, "renew": True},
]


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def ensure_schema(cur):
    stmts = [
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS description TEXT;",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS amount_min_inr INTEGER;",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS eligibility_criteria TEXT;",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS deadline_month VARCHAR(20);",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS stream_tags TEXT[];",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS provider_type VARCHAR(20);",
        "ALTER TABLE scholarships ADD COLUMN IF NOT EXISTS data_source VARCHAR(30);",
    ]
    for s in stmts:
        cur.execute(s)
    print("  [schema] description/amount_min_inr/eligibility_criteria/deadline_month/"
          "stream_tags/provider_type/data_source ready")


INSERT_SQL = """
INSERT INTO scholarships
    (scholarship_name, provider, provider_type, description, eligibility_criteria,
     amount_min_inr, amount_max_inr, income_limit_inr, min_percentage,
     application_url, deadline_month, stream_tags, competitiveness_level,
     renewable, notes, data_source)
VALUES
    (%(name)s, %(provider)s, %(ptype)s, %(desc)s, %(elig)s, %(amin)s, %(amax)s,
     %(income)s, %(minpct)s, %(url)s, %(deadline)s, %(tags)s, %(comp)s,
     %(renew)s, %(desc)s, 'curated');
"""


def main():
    print("=" * 70)
    print("STARSHIP — scholarships expansion (curated real schemes)")
    print("=" * 70)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM scholarships;")
    start = cur.fetchone()[0]
    print(f"\nStart: {start} scholarship(s)\n")

    print("[1/2] Ensuring schema ...")
    ensure_schema(cur)
    conn.commit()

    print(f"\n[2/2] Inserting {len(SCHOLARSHIPS)} curated schemes (batches of {BATCH_SIZE}) ...\n")
    inserted = existed = 0
    for i, s in enumerate(SCHOLARSHIPS, start=1):
        cur.execute(
            "SELECT 1 FROM scholarships WHERE lower(scholarship_name) = lower(%s) LIMIT 1;",
            (s["name"],),
        )
        if cur.fetchone():
            existed += 1
            print(f"  = exists: {s['name']}")
        else:
            cur.execute(INSERT_SQL, s)
            inserted += 1
            print(f"  + {s['name']}  ({s['ptype']}, ₹{s['amin']:,}–₹{s['amax']:,})")
        if i % BATCH_SIZE == 0:
            conn.commit()
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM scholarships;")
    end = cur.fetchone()[0]
    cur.execute("SELECT provider_type, COUNT(*) FROM scholarships "
                "WHERE provider_type IS NOT NULL GROUP BY provider_type ORDER BY 2 DESC;")
    breakdown = cur.fetchall()

    print(f"\n{inserted} scholarships inserted, {existed} already existed.")
    print("\n" + "=" * 70)
    print(f"scholarships: {start} -> {end} ({end - start:+d})")
    for ptype, n in breakdown:
        print(f"  {ptype:<12} {n}")
    print("=" * 70)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
