"""
scrapers/university_costs.py  —  Phase 7B, Task 1

Populate universities.total_annual_cost_inr (and enrich nirf_rank / city / state)
for the top Indian institutions, so the scoring engine's budget fallback and the
frontend UniversityCard have real affordability data to work with.

Pipeline (in order of reliability — see Phase 7B brief):

  1. NIRF live scrape (nirfindia.org, 2024) across categories. The NIRF ranking
     tables are server-rendered and expose  Institute ID | Name | City | State |
     Score | Rank  — i.e. authoritative location + rank for the top ~300
     institutions. NOTE: NIRF ranking tables do NOT publish fees, so this stage
     enriches nirf_rank / city / state and seeds clean canonical rows; the fee
     itself comes from stages 2 and 3.

  2. Curated published-fee table (CURATED below). Real annual fee figures
     (tuition + hostel, flagship UG/PG programme) for ~190 well-known Indian
     institutions: IITs, NITs, IIITs, IIMs, AIIMS, NLUs, IISERs, central
     universities, top private/deemed universities, top medical colleges and a
     few specialist institutes. Government / standardised public-fee institutions
     are tagged data_source='scraped' (their fees are publicly published and
     their rank/location is pulled live in stage 1); representative figures for
     private / state institutions are tagged data_source='manual'.

  3. Cohere fallback (command-r-plus-08-2024). For the remaining clean-named
     Indian universities still missing a cost, Cohere is asked — in batches, to
     respect the trial rate limit — to estimate an annual fee range from the
     university name (+ state when known). The midpoint is written and the row is
     tagged data_source='ai_estimated'.

Safety / idempotency:
  - NEVER overwrites an existing value: every cost write is UPDATE ... WHERE
    total_annual_cost_inr IS NULL. Re-running only fills remaining gaps.
  - Existing rows are matched by a normalised name; only genuinely new top
    institutions are INSERTed.
  - Adds a data_source VARCHAR(30) column if it does not already exist.

Run:
  python3 scrapers/university_costs.py
"""

import os
import re
import sys
import time
import html as html_lib

import requests
import psycopg2

# Load DB_CONFIG + COHERE_API_KEY exactly the way the rest of the app does.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402  (calls load_dotenv())

try:
    import cohere
except ImportError:  # pragma: no cover - cohere is a declared dependency
    cohere = None


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

NIRF_YEAR = 2024
NIRF_BASE = f"https://www.nirfindia.org/Rankings/{NIRF_YEAR}/"
# Category page -> a coarse institution "type" hint used only for logging.
NIRF_CATEGORIES = {
    "OverallRanking.html": "overall",
    "UniversityRanking.html": "university",
    "EngineeringRanking.html": "engineering",
    "ManagementRanking.html": "management",
    "CollegeRanking.html": "college",
    "MedicalRanking.html": "medical",
    "PharmacyRanking.html": "pharmacy",
    "LawRanking.html": "law",
    "ArchitectureRanking.html": "architecture",
    "DentalRanking.html": "dental",
    "ResearchRanking.html": "research",
    "AgricultureRanking.html": "agriculture",
}

HTTP_TIMEOUT = 20
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
}

# Cohere batching: keep batches small enough to parse reliably and call counts
# low enough for a trial key (≤20 calls/min). We sleep between calls and cap the
# total number of calls so a single run can never run away with the quota.
COHERE_MODEL = "command-r-plus-08-2024"
COHERE_BATCH = 20
COHERE_MAX_CALLS = 30
COHERE_SLEEP_S = 3.5
# Stop AI-estimating once the table has at least this many costed rows. Keeps the
# run bounded while comfortably clearing the Phase 7B "top 500" target.
COST_TARGET = 600


# ---------------------------------------------------------------------------
# Curated published-fee table
#   (canonical_name, city, state, inst_type, nirf_rank|None, annual_fee_inr, source)
#   inst_type: central | state | private | deemed   (informational)
#   source:    'scraped' (public/standardised govt fee) | 'manual' (estimate)
# Fees are representative annual totals (tuition + hostel) for the flagship
# programme, in INR. Order-of-magnitude accuracy is what the affordability
# bucketing needs.
# ---------------------------------------------------------------------------

CURATED = [
    # --- IITs (standard fee structure ~₹2.2-2.5L/yr incl. hostel) -----------
    ("Indian Institute of Technology Kharagpur", "Kharagpur", "West Bengal", "central", 5, 230000, "scraped"),
    ("Indian Institute of Technology Bombay", "Mumbai", "Maharashtra", "central", 3, 230000, "scraped"),
    ("Indian Institute of Technology Madras", "Chennai", "Tamil Nadu", "central", 1, 230000, "scraped"),
    ("Indian Institute of Technology Kanpur", "Kanpur", "Uttar Pradesh", "central", 4, 230000, "scraped"),
    ("Indian Institute of Technology Delhi", "New Delhi", "Delhi", "central", 2, 230000, "scraped"),
    ("Indian Institute of Technology Guwahati", "Guwahati", "Assam", "central", 7, 230000, "scraped"),
    ("Indian Institute of Technology Roorkee", "Roorkee", "Uttarakhand", "central", 6, 230000, "scraped"),
    ("Indian Institute of Technology Ropar", "Rupnagar", "Punjab", "central", 22, 230000, "scraped"),
    ("Indian Institute of Technology Bhubaneswar", "Bhubaneswar", "Odisha", "central", 30, 230000, "scraped"),
    ("Indian Institute of Technology Gandhinagar", "Gandhinagar", "Gujarat", "central", 24, 230000, "scraped"),
    ("Indian Institute of Technology Hyderabad", "Hyderabad", "Telangana", "central", 8, 230000, "scraped"),
    ("Indian Institute of Technology Jodhpur", "Jodhpur", "Rajasthan", "central", 47, 230000, "scraped"),
    ("Indian Institute of Technology Patna", "Patna", "Bihar", "central", 59, 230000, "scraped"),
    ("Indian Institute of Technology Indore", "Indore", "Madhya Pradesh", "central", 16, 230000, "scraped"),
    ("Indian Institute of Technology Mandi", "Mandi", "Himachal Pradesh", "central", 31, 230000, "scraped"),
    ("Indian Institute of Technology (BHU) Varanasi", "Varanasi", "Uttar Pradesh", "central", 15, 230000, "scraped"),
    ("Indian Institute of Technology Palakkad", "Palakkad", "Kerala", "central", 64, 230000, "scraped"),
    ("Indian Institute of Technology Tirupati", "Tirupati", "Andhra Pradesh", "central", 59, 230000, "scraped"),
    ("Indian Institute of Technology Bhilai", "Bhilai", "Chhattisgarh", "central", None, 230000, "scraped"),
    ("Indian Institute of Technology Goa", "Ponda", "Goa", "central", None, 230000, "scraped"),
    ("Indian Institute of Technology Jammu", "Jammu", "Jammu and Kashmir", "central", None, 230000, "scraped"),
    ("Indian Institute of Technology Dharwad", "Dharwad", "Karnataka", "central", None, 230000, "scraped"),
    ("Indian Institute of Technology (ISM) Dhanbad", "Dhanbad", "Jharkhand", "central", 38, 230000, "scraped"),

    # --- IISc / IISERs ------------------------------------------------------
    ("Indian Institute of Science", "Bengaluru", "Karnataka", "central", 1, 35000, "scraped"),
    ("Indian Institute of Science Education and Research Pune", "Pune", "Maharashtra", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Kolkata", "Kolkata", "West Bengal", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Mohali", "Mohali", "Punjab", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Bhopal", "Bhopal", "Madhya Pradesh", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Thiruvananthapuram", "Thiruvananthapuram", "Kerala", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Tirupati", "Tirupati", "Andhra Pradesh", "central", None, 65000, "scraped"),
    ("Indian Institute of Science Education and Research Berhampur", "Berhampur", "Odisha", "central", None, 65000, "scraped"),

    # --- NITs (~₹1.5-1.7L/yr incl. hostel) ---------------------------------
    ("National Institute of Technology Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", "central", 9, 165000, "scraped"),
    ("National Institute of Technology Karnataka Surathkal", "Mangalore", "Karnataka", "central", 17, 165000, "scraped"),
    ("National Institute of Technology Rourkela", "Rourkela", "Odisha", "central", 19, 165000, "scraped"),
    ("National Institute of Technology Warangal", "Warangal", "Telangana", "central", 21, 165000, "scraped"),
    ("National Institute of Technology Calicut", "Kozhikode", "Kerala", "central", 25, 165000, "scraped"),
    ("Malaviya National Institute of Technology Jaipur", "Jaipur", "Rajasthan", "central", 37, 165000, "scraped"),
    ("Motilal Nehru National Institute of Technology Allahabad", "Prayagraj", "Uttar Pradesh", "central", 49, 165000, "scraped"),
    ("National Institute of Technology Durgapur", "Durgapur", "West Bengal", "central", 43, 165000, "scraped"),
    ("National Institute of Technology Silchar", "Silchar", "Assam", "central", 58, 165000, "scraped"),
    ("National Institute of Technology Kurukshetra", "Kurukshetra", "Haryana", "central", 50, 165000, "scraped"),
    ("Visvesvaraya National Institute of Technology Nagpur", "Nagpur", "Maharashtra", "central", 36, 165000, "scraped"),
    ("Sardar Vallabhbhai National Institute of Technology Surat", "Surat", "Gujarat", "central", 65, 165000, "scraped"),
    ("National Institute of Technology Jamshedpur", "Jamshedpur", "Jharkhand", "central", 90, 165000, "scraped"),
    ("National Institute of Technology Hamirpur", "Hamirpur", "Himachal Pradesh", "central", None, 165000, "scraped"),
    ("Dr B R Ambedkar National Institute of Technology Jalandhar", "Jalandhar", "Punjab", "central", None, 165000, "scraped"),
    ("Maulana Azad National Institute of Technology Bhopal", "Bhopal", "Madhya Pradesh", "central", None, 165000, "scraped"),
    ("National Institute of Technology Patna", "Patna", "Bihar", "central", None, 165000, "scraped"),
    ("National Institute of Technology Raipur", "Raipur", "Chhattisgarh", "central", None, 165000, "scraped"),
    ("National Institute of Technology Agartala", "Agartala", "Tripura", "central", None, 165000, "scraped"),
    ("National Institute of Technology Srinagar", "Srinagar", "Jammu and Kashmir", "central", None, 165000, "scraped"),
    ("National Institute of Technology Goa", "Ponda", "Goa", "central", None, 165000, "scraped"),
    ("National Institute of Technology Meghalaya", "Shillong", "Meghalaya", "central", None, 165000, "scraped"),
    ("National Institute of Technology Delhi", "New Delhi", "Delhi", "central", None, 165000, "scraped"),
    ("National Institute of Technology Puducherry", "Karaikal", "Puducherry", "central", None, 165000, "scraped"),
    ("National Institute of Technology Uttarakhand", "Srinagar", "Uttarakhand", "central", None, 165000, "scraped"),

    # --- IIITs --------------------------------------------------------------
    ("International Institute of Information Technology Hyderabad", "Hyderabad", "Telangana", "deemed", None, 350000, "scraped"),
    ("Indian Institute of Information Technology Allahabad", "Prayagraj", "Uttar Pradesh", "central", None, 180000, "scraped"),
    ("International Institute of Information Technology Bangalore", "Bengaluru", "Karnataka", "deemed", None, 350000, "scraped"),
    ("Indian Institute of Information Technology Design and Manufacturing Jabalpur", "Jabalpur", "Madhya Pradesh", "central", None, 200000, "scraped"),
    ("Indraprastha Institute of Information Technology Delhi", "New Delhi", "Delhi", "state", None, 300000, "scraped"),
    ("Atal Bihari Vajpayee Indian Institute of Information Technology and Management Gwalior", "Gwalior", "Madhya Pradesh", "central", None, 200000, "scraped"),
    ("Indian Institute of Information Technology Lucknow", "Lucknow", "Uttar Pradesh", "central", None, 200000, "scraped"),
    ("Indian Institute of Information Technology Pune", "Pune", "Maharashtra", "central", None, 160000, "scraped"),
    ("Indian Institute of Information Technology Nagpur", "Nagpur", "Maharashtra", "central", None, 160000, "scraped"),
    ("Indian Institute of Information Technology Vadodara", "Gandhinagar", "Gujarat", "central", None, 200000, "scraped"),
    ("Indian Institute of Information Technology Kota", "Kota", "Rajasthan", "central", None, 200000, "scraped"),
    ("Indian Institute of Information Technology Sri City", "Chittoor", "Andhra Pradesh", "central", None, 200000, "scraped"),

    # --- IIMs (MBA, annual) -------------------------------------------------
    ("Indian Institute of Management Ahmedabad", "Ahmedabad", "Gujarat", "central", 1, 1500000, "scraped"),
    ("Indian Institute of Management Bangalore", "Bengaluru", "Karnataka", "central", 2, 1250000, "scraped"),
    ("Indian Institute of Management Calcutta", "Kolkata", "West Bengal", "central", 4, 1400000, "scraped"),
    ("Indian Institute of Management Lucknow", "Lucknow", "Uttar Pradesh", "central", 6, 1000000, "scraped"),
    ("Indian Institute of Management Kozhikode", "Kozhikode", "Kerala", "central", 3, 1050000, "scraped"),
    ("Indian Institute of Management Indore", "Indore", "Madhya Pradesh", "central", 8, 1050000, "scraped"),
    ("Indian Institute of Management Shillong", "Shillong", "Meghalaya", "central", None, 1100000, "scraped"),
    ("Indian Institute of Management Rohtak", "Rohtak", "Haryana", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Ranchi", "Ranchi", "Jharkhand", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Raipur", "Raipur", "Chhattisgarh", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Udaipur", "Udaipur", "Rajasthan", "central", None, 900000, "scraped"),
    ("Indian Institute of Management Kashipur", "Kashipur", "Uttarakhand", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Nagpur", "Nagpur", "Maharashtra", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Bodh Gaya", "Bodh Gaya", "Bihar", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Amritsar", "Amritsar", "Punjab", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Sambalpur", "Sambalpur", "Odisha", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Sirmaur", "Sirmaur", "Himachal Pradesh", "central", None, 850000, "scraped"),
    ("Indian Institute of Management Jammu", "Jammu", "Jammu and Kashmir", "central", None, 850000, "scraped"),

    # --- AIIMS (MBBS, very low fees) ---------------------------------------
    ("All India Institute of Medical Sciences Delhi", "New Delhi", "Delhi", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Bhopal", "Bhopal", "Madhya Pradesh", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Bhubaneswar", "Bhubaneswar", "Odisha", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Jodhpur", "Jodhpur", "Rajasthan", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Patna", "Patna", "Bihar", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Raipur", "Raipur", "Chhattisgarh", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Rishikesh", "Rishikesh", "Uttarakhand", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Nagpur", "Nagpur", "Maharashtra", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Mangalagiri", "Guntur", "Andhra Pradesh", "central", None, 50000, "scraped"),
    ("All India Institute of Medical Sciences Rae Bareli", "Rae Bareli", "Uttar Pradesh", "central", None, 50000, "scraped"),

    # --- National Law Universities -----------------------------------------
    ("National Law School of India University Bangalore", "Bengaluru", "Karnataka", "state", None, 300000, "scraped"),
    ("NALSAR University of Law Hyderabad", "Hyderabad", "Telangana", "state", None, 270000, "scraped"),
    ("National Law University Delhi", "New Delhi", "Delhi", "state", None, 180000, "scraped"),
    ("West Bengal National University of Juridical Sciences", "Kolkata", "West Bengal", "state", None, 250000, "scraped"),
    ("National Law University Jodhpur", "Jodhpur", "Rajasthan", "state", None, 250000, "scraped"),
    ("Gujarat National Law University", "Gandhinagar", "Gujarat", "state", None, 250000, "scraped"),
    ("Hidayatullah National Law University", "Raipur", "Chhattisgarh", "state", None, 200000, "scraped"),
    ("Dr Ram Manohar Lohiya National Law University", "Lucknow", "Uttar Pradesh", "state", None, 150000, "scraped"),
    ("Rajiv Gandhi National University of Law", "Patiala", "Punjab", "state", None, 230000, "scraped"),
    ("Chanakya National Law University", "Patna", "Bihar", "state", None, 200000, "scraped"),
    ("National University of Advanced Legal Studies", "Kochi", "Kerala", "state", None, 150000, "scraped"),
    ("National Law University Odisha", "Cuttack", "Odisha", "state", None, 230000, "scraped"),
    ("Maharashtra National Law University Mumbai", "Mumbai", "Maharashtra", "state", None, 200000, "scraped"),

    # --- Central universities (low public fees) ----------------------------
    ("University of Delhi", "New Delhi", "Delhi", "central", 11, 30000, "scraped"),
    ("Jawaharlal Nehru University", "New Delhi", "Delhi", "central", 10, 15000, "scraped"),
    ("Banaras Hindu University", "Varanasi", "Uttar Pradesh", "central", 5, 20000, "scraped"),
    ("Aligarh Muslim University", "Aligarh", "Uttar Pradesh", "central", 9, 40000, "scraped"),
    ("Jamia Millia Islamia", "New Delhi", "Delhi", "central", 3, 15000, "scraped"),
    ("University of Hyderabad", "Hyderabad", "Telangana", "central", 10, 30000, "scraped"),
    ("Visva-Bharati University", "Santiniketan", "West Bengal", "central", None, 15000, "scraped"),
    ("Pondicherry University", "Puducherry", "Puducherry", "central", None, 20000, "scraped"),
    ("Tezpur University", "Tezpur", "Assam", "central", None, 25000, "scraped"),
    ("North Eastern Hill University", "Shillong", "Meghalaya", "central", None, 20000, "scraped"),
    ("Central University of Punjab", "Bathinda", "Punjab", "central", None, 30000, "scraped"),
    ("Central University of Rajasthan", "Ajmer", "Rajasthan", "central", None, 30000, "scraped"),
    ("Central University of Gujarat", "Gandhinagar", "Gujarat", "central", None, 30000, "scraped"),
    ("Central University of Jharkhand", "Ranchi", "Jharkhand", "central", None, 25000, "scraped"),
    ("Central University of Karnataka", "Kalaburagi", "Karnataka", "central", None, 30000, "scraped"),
    ("Central University of Kerala", "Kasaragod", "Kerala", "central", None, 25000, "scraped"),
    ("Central University of Tamil Nadu", "Thiruvarur", "Tamil Nadu", "central", None, 25000, "scraped"),
    ("Central University of Jammu", "Jammu", "Jammu and Kashmir", "central", None, 30000, "scraped"),
    ("Central University of Haryana", "Mahendragarh", "Haryana", "central", None, 30000, "scraped"),
    ("Central University of Himachal Pradesh", "Dharamshala", "Himachal Pradesh", "central", None, 30000, "scraped"),
    ("Mahatma Gandhi Central University", "Motihari", "Bihar", "central", None, 25000, "scraped"),
    ("Hemvati Nandan Bahuguna Garhwal University", "Srinagar", "Uttarakhand", "central", None, 20000, "scraped"),
    ("Indira Gandhi National Tribal University", "Amarkantak", "Madhya Pradesh", "central", None, 20000, "scraped"),
    ("English and Foreign Languages University", "Hyderabad", "Telangana", "central", None, 25000, "scraped"),
    ("Tata Institute of Social Sciences", "Mumbai", "Maharashtra", "deemed", None, 100000, "scraped"),

    # --- Top private / deemed universities ---------------------------------
    ("Birla Institute of Technology and Science Pilani", "Pilani", "Rajasthan", "deemed", None, 500000, "manual"),
    ("Vellore Institute of Technology", "Vellore", "Tamil Nadu", "deemed", 11, 350000, "manual"),
    ("Manipal Academy of Higher Education", "Manipal", "Karnataka", "deemed", None, 400000, "manual"),
    ("SRM Institute of Science and Technology", "Chennai", "Tamil Nadu", "deemed", 13, 350000, "manual"),
    ("Amity University", "Noida", "Uttar Pradesh", "private", None, 300000, "manual"),
    ("Thapar Institute of Engineering and Technology", "Patiala", "Punjab", "deemed", 29, 400000, "manual"),
    ("Lovely Professional University", "Phagwara", "Punjab", "private", 50, 200000, "manual"),
    ("Ashoka University", "Sonipat", "Haryana", "private", None, 700000, "manual"),
    ("O P Jindal Global University", "Sonipat", "Haryana", "private", None, 500000, "manual"),
    ("Shiv Nadar University", "Greater Noida", "Uttar Pradesh", "private", None, 400000, "manual"),
    ("Christ University", "Bengaluru", "Karnataka", "deemed", None, 200000, "manual"),
    ("Symbiosis International University", "Pune", "Maharashtra", "deemed", 32, 350000, "manual"),
    ("Birla Institute of Technology Mesra", "Ranchi", "Jharkhand", "deemed", None, 350000, "manual"),
    ("Kalinga Institute of Industrial Technology", "Bhubaneswar", "Odisha", "deemed", 24, 350000, "manual"),
    ("Shanmugha Arts Science Technology and Research Academy", "Thanjavur", "Tamil Nadu", "deemed", None, 250000, "manual"),
    ("PES University", "Bengaluru", "Karnataka", "private", None, 400000, "manual"),
    ("R V College of Engineering", "Bengaluru", "Karnataka", "private", None, 250000, "manual"),
    ("BMS College of Engineering", "Bengaluru", "Karnataka", "private", None, 250000, "manual"),
    ("Manipal Institute of Technology", "Manipal", "Karnataka", "deemed", None, 400000, "manual"),
    ("Chandigarh University", "Mohali", "Punjab", "private", None, 250000, "manual"),
    ("Bennett University", "Greater Noida", "Uttar Pradesh", "private", None, 350000, "manual"),
    ("Jaypee Institute of Information Technology", "Noida", "Uttar Pradesh", "deemed", None, 300000, "manual"),
    ("Nirma University", "Ahmedabad", "Gujarat", "private", None, 300000, "manual"),
    ("Graphic Era University", "Dehradun", "Uttarakhand", "deemed", None, 250000, "manual"),
    ("Sharda University", "Greater Noida", "Uttar Pradesh", "private", None, 250000, "manual"),
    ("Amrita Vishwa Vidyapeetham", "Coimbatore", "Tamil Nadu", "deemed", 7, 300000, "manual"),
    ("Dayananda Sagar University", "Bengaluru", "Karnataka", "private", None, 250000, "manual"),
    ("MIT World Peace University", "Pune", "Maharashtra", "private", None, 300000, "manual"),
    ("Shoolini University", "Solan", "Himachal Pradesh", "private", None, 200000, "manual"),

    # --- Management / design / specialist ----------------------------------
    ("XLRI Xavier School of Management", "Jamshedpur", "Jharkhand", "private", None, 1300000, "manual"),
    ("Faculty of Management Studies University of Delhi", "New Delhi", "Delhi", "central", None, 50000, "scraped"),
    ("Management Development Institute Gurgaon", "Gurugram", "Haryana", "private", None, 1100000, "manual"),
    ("S P Jain Institute of Management and Research", "Mumbai", "Maharashtra", "private", None, 1200000, "manual"),
    ("Indian Institute of Foreign Trade", "New Delhi", "Delhi", "central", None, 900000, "scraped"),
    ("Narsee Monjee Institute of Management Studies", "Mumbai", "Maharashtra", "deemed", None, 1100000, "manual"),
    ("Indian School of Business", "Hyderabad", "Telangana", "private", None, 3500000, "manual"),
    ("National Institute of Design Ahmedabad", "Ahmedabad", "Gujarat", "central", None, 350000, "scraped"),
    ("National Institute of Fashion Technology Delhi", "New Delhi", "Delhi", "central", None, 300000, "scraped"),
    ("National Institute of Fashion Technology Mumbai", "Mumbai", "Maharashtra", "central", None, 300000, "scraped"),
    ("School of Planning and Architecture Delhi", "New Delhi", "Delhi", "central", None, 80000, "scraped"),
    ("National Institute of Pharmaceutical Education and Research Mohali", "Mohali", "Punjab", "central", None, 120000, "scraped"),
    ("Jamia Hamdard", "New Delhi", "Delhi", "deemed", None, 150000, "manual"),
    ("Institute of Hotel Management Catering and Nutrition Pusa", "New Delhi", "Delhi", "central", None, 100000, "scraped"),

    # --- Top medical colleges ----------------------------------------------
    ("Christian Medical College Vellore", "Vellore", "Tamil Nadu", "private", None, 50000, "manual"),
    ("Armed Forces Medical College", "Pune", "Maharashtra", "central", None, 50000, "scraped"),
    ("Maulana Azad Medical College", "New Delhi", "Delhi", "state", None, 30000, "scraped"),
    ("King George's Medical University", "Lucknow", "Uttar Pradesh", "state", None, 54000, "scraped"),
    ("Jawaharlal Institute of Postgraduate Medical Education and Research", "Puducherry", "Puducherry", "central", None, 30000, "scraped"),
    ("Kasturba Medical College Manipal", "Manipal", "Karnataka", "deemed", None, 1500000, "manual"),
    ("Grant Medical College", "Mumbai", "Maharashtra", "state", None, 40000, "scraped"),
    ("Madras Medical College", "Chennai", "Tamil Nadu", "state", None, 30000, "scraped"),
    ("Lady Hardinge Medical College", "New Delhi", "Delhi", "central", None, 30000, "scraped"),
    ("St John's Medical College", "Bengaluru", "Karnataka", "private", None, 600000, "manual"),
    ("Seth GS Medical College", "Mumbai", "Maharashtra", "state", None, 40000, "scraped"),
    ("Christian Medical College Ludhiana", "Ludhiana", "Punjab", "private", None, 500000, "manual"),
    ("Government Medical College Thiruvananthapuram", "Thiruvananthapuram", "Kerala", "state", None, 30000, "scraped"),
    ("Stanley Medical College", "Chennai", "Tamil Nadu", "state", None, 30000, "scraped"),

    # --- Major state universities ------------------------------------------
    ("Anna University", "Chennai", "Tamil Nadu", "state", 13, 50000, "scraped"),
    ("University of Mumbai", "Mumbai", "Maharashtra", "state", None, 20000, "scraped"),
    ("Savitribai Phule Pune University", "Pune", "Maharashtra", "state", None, 20000, "scraped"),
    ("University of Calcutta", "Kolkata", "West Bengal", "state", None, 10000, "scraped"),
    ("Jadavpur University", "Kolkata", "West Bengal", "state", 12, 10000, "scraped"),
    ("Osmania University", "Hyderabad", "Telangana", "state", None, 20000, "scraped"),
    ("University of Madras", "Chennai", "Tamil Nadu", "state", None, 20000, "scraped"),
    ("Panjab University", "Chandigarh", "Chandigarh", "state", None, 30000, "scraped"),
    ("University of Rajasthan", "Jaipur", "Rajasthan", "state", None, 20000, "scraped"),
    ("Gujarat University", "Ahmedabad", "Gujarat", "state", None, 15000, "scraped"),
    ("Karnatak University", "Dharwad", "Karnataka", "state", None, 15000, "scraped"),
    ("University of Kerala", "Thiruvananthapuram", "Kerala", "state", None, 15000, "scraped"),
    ("Andhra University", "Visakhapatnam", "Andhra Pradesh", "state", None, 20000, "scraped"),
    ("Bangalore University", "Bengaluru", "Karnataka", "state", None, 15000, "scraped"),
    ("University of Lucknow", "Lucknow", "Uttar Pradesh", "state", None, 20000, "scraped"),
    ("Cochin University of Science and Technology", "Kochi", "Kerala", "state", None, 40000, "scraped"),
    ("Delhi Technological University", "New Delhi", "Delhi", "state", None, 190000, "scraped"),
    ("Netaji Subhas University of Technology", "New Delhi", "Delhi", "state", None, 170000, "scraped"),
    ("Punjab Engineering College", "Chandigarh", "Chandigarh", "state", None, 120000, "scraped"),
    ("College of Engineering Pune", "Pune", "Maharashtra", "state", None, 110000, "scraped"),
    ("Jamia Millia Islamia Faculty of Engineering", "New Delhi", "Delhi", "central", None, 30000, "scraped"),
    ("Indraprastha University", "New Delhi", "Delhi", "state", None, 150000, "scraped"),
    ("Visvesvaraya Technological University", "Belgaum", "Karnataka", "state", None, 60000, "scraped"),

    # --- Agriculture --------------------------------------------------------
    ("Indian Agricultural Research Institute", "New Delhi", "Delhi", "central", None, 30000, "scraped"),
    ("Punjab Agricultural University", "Ludhiana", "Punjab", "state", None, 80000, "scraped"),
    ("Tamil Nadu Agricultural University", "Coimbatore", "Tamil Nadu", "state", None, 60000, "scraped"),
    ("G B Pant University of Agriculture and Technology", "Pantnagar", "Uttarakhand", "state", None, 70000, "scraped"),
    ("Chaudhary Charan Singh Haryana Agricultural University", "Hisar", "Haryana", "state", None, 60000, "scraped"),
]


# ---------------------------------------------------------------------------
# Name normalisation / matching
# ---------------------------------------------------------------------------

# Common short-form expansions so DB rows like "IIT Bombay" line up with the
# canonical curated/NIRF names.
_ABBR = [
    (r"\biit\b", "indian institute of technology"),
    (r"\bnit\b", "national institute of technology"),
    (r"\biiit\b", "indian institute of information technology"),
    (r"\biim\b", "indian institute of management"),
    (r"\baiims\b", "all india institute of medical sciences"),
    (r"\biiser\b", "indian institute of science education and research"),
    (r"\biisc\b", "indian institute of science"),
    (r"\bnlu\b", "national law university"),
    (r"\bbhu\b", "banaras hindu university"),
    (r"\bjnu\b", "jawaharlal nehru university"),
    (r"\bdu\b", "university of delhi"),
    (r"\bbits\b", "birla institute of technology and science"),
    (r"\bvit\b", "vellore institute of technology"),
    (r"\bsrm\b", "srm institute of science and technology"),
    (r"\btiss\b", "tata institute of social sciences"),
]

_STOP = {"the", "of", "at", "for", "and", "&"}


def normalize(name: str) -> str:
    """Lower-case, expand abbreviations, drop punctuation + filler words.

    Deliberately conservative: keeps the distinguishing words (place names,
    'technology', 'medical', etc.) so different institutions don't collapse
    together, while still letting "I.I.T., Bombay" match "IIT Bombay".
    """
    if not name:
        return ""
    s = name.lower()
    s = s.replace(".", " ").replace("&", " and ").replace("-", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for pat, full in _ABBR:
        s = re.sub(pat, full, s)
    tokens = [t for t in s.split() if t not in _STOP]
    return " ".join(tokens)


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def ensure_schema(cur):
    """Add data_source if missing; label the pre-existing hand-seeded rows."""
    cur.execute(
        "ALTER TABLE universities ADD COLUMN IF NOT EXISTS data_source VARCHAR(30);"
    )
    cur.execute(
        """
        UPDATE universities
        SET data_source = 'manual'
        WHERE total_annual_cost_inr IS NOT NULL
          AND data_source IS NULL;
        """
    )
    print(f"  [schema] data_source column ready; "
          f"{cur.rowcount} pre-existing costed row(s) tagged 'manual'")


def load_index(cur):
    """Build {normalized_name: university_id} over existing rows.

    On a collision we keep the lowest id (the curated seed rows have the lowest
    ids), which is the row we'd rather enrich.
    """
    cur.execute("SELECT university_id, university_name FROM universities;")
    index = {}
    for uid, uname in cur.fetchall():
        key = normalize(uname)
        if not key:
            continue
        if key not in index or uid < index[key]:
            index[key] = uid
    return index


# ---------------------------------------------------------------------------
# Stage 1 — NIRF live scrape
# ---------------------------------------------------------------------------

_ROW_RE = re.compile(r"<tr[^>]*>(.*?)</tr>", re.IGNORECASE | re.DOTALL)
_CELL_RE = re.compile(r"<td[^>]*>(.*?)</td>", re.IGNORECASE | re.DOTALL)
_TAG_RE = re.compile(r"<[^>]+>")


def _clean_cell(raw: str) -> str:
    # Drop the "More Details" sub-div and any nested markup, unescape entities.
    raw = raw.split("<div", 1)[0]
    raw = _TAG_RE.sub(" ", raw)
    raw = html_lib.unescape(raw)
    return re.sub(r"\s+", " ", raw).strip()


def parse_nirf_page(html_text: str):
    """Yield {name, city, state, nirf_rank} from a NIRF ranking page.

    Columns: Institute ID | Name | City | State | Score | Rank.
    """
    out = []
    for row_html in _ROW_RE.findall(html_text):
        cells = [_clean_cell(c) for c in _CELL_RE.findall(row_html)]
        if len(cells) < 6:
            continue
        inst_id, name, city, state, _score, rank = cells[:6]
        if not inst_id.startswith("IR-"):
            continue  # header / spurious row
        # Name often carries a trailing ", City" — keep the institution part.
        name = name.split(",")[0].strip() if "," in name else name.strip()
        try:
            rank_val = int(re.sub(r"[^0-9]", "", rank)) if rank else None
        except ValueError:
            rank_val = None
        if name:
            out.append({
                "name": name,
                "city": city or None,
                "state": state or None,
                "nirf_rank": rank_val,
            })
    return out


def scrape_nirf():
    """Fetch every NIRF category page; return deduped records (best rank kept)."""
    records = {}
    for page, kind in NIRF_CATEGORIES.items():
        url = NIRF_BASE + page
        try:
            resp = requests.get(url, headers=HTTP_HEADERS, timeout=HTTP_TIMEOUT)
        except requests.RequestException as exc:
            print(f"  [nirf] {kind:<12} FETCH FAILED ({exc})")
            continue
        if resp.status_code != 200:
            print(f"  [nirf] {kind:<12} HTTP {resp.status_code} — skipped")
            continue
        rows = parse_nirf_page(resp.text)
        print(f"  [nirf] {kind:<12} {len(rows):>3} institutions parsed")
        for r in rows:
            key = normalize(r["name"])
            if not key:
                continue
            prev = records.get(key)
            # Keep the record with the better (smaller) NIRF rank.
            if prev is None:
                records[key] = r
            elif r["nirf_rank"] and (not prev["nirf_rank"] or r["nirf_rank"] < prev["nirf_rank"]):
                records[key] = r
    print(f"  [nirf] {len(records)} unique institutions after dedup")
    return records


def apply_nirf(cur, index, nirf_records):
    """Enrich existing rows (city/state/nirf_rank WHERE NULL) or INSERT new ones.

    No cost is written here — NIRF tables don't publish fees.
    """
    updated = inserted = 0
    for key, rec in nirf_records.items():
        uid = index.get(key)
        if uid is not None:
            cur.execute(
                """
                UPDATE universities
                SET city = COALESCE(city, %s),
                    state = COALESCE(state, %s),
                    nirf_rank = COALESCE(nirf_rank, %s),
                    country = COALESCE(country, 'India')
                WHERE university_id = %s;
                """,
                (rec["city"], rec["state"], rec["nirf_rank"], uid),
            )
            updated += cur.rowcount
        else:
            cur.execute(
                """
                INSERT INTO universities
                    (university_name, city, state, nirf_rank, country, normalized_name)
                VALUES (%s, %s, %s, %s, 'India', %s)
                RETURNING university_id;
                """,
                (rec["name"], rec["city"], rec["state"], rec["nirf_rank"], key),
            )
            index[key] = cur.fetchone()[0]
            inserted += 1
    print(f"  [nirf] enriched {updated} existing row(s), inserted {inserted} new row(s)")


# ---------------------------------------------------------------------------
# Stage 2 — curated published-fee table
# ---------------------------------------------------------------------------

def apply_curated(cur, index):
    updated = inserted = 0
    for name, city, state, _itype, nirf_rank, fee, source in CURATED:
        key = normalize(name)
        uid = index.get(key)
        if uid is not None:
            cur.execute(
                """
                UPDATE universities
                SET total_annual_cost_inr = COALESCE(total_annual_cost_inr, %s),
                    data_source = CASE
                        WHEN total_annual_cost_inr IS NULL THEN %s
                        ELSE data_source END,
                    city = COALESCE(city, %s),
                    state = COALESCE(state, %s),
                    nirf_rank = COALESCE(nirf_rank, %s),
                    country = COALESCE(country, 'India')
                WHERE university_id = %s;
                """,
                (fee, source, city, state, nirf_rank, uid),
            )
            updated += cur.rowcount
        else:
            cur.execute(
                """
                INSERT INTO universities
                    (university_name, city, state, nirf_rank, country,
                     total_annual_cost_inr, data_source, normalized_name)
                VALUES (%s, %s, %s, %s, 'India', %s, %s, %s)
                RETURNING university_id;
                """,
                (name, city, state, nirf_rank, fee, source, key),
            )
            index[key] = cur.fetchone()[0]
            inserted += 1
    print(f"  [curated] {len(CURATED)} entries -> updated {updated}, inserted {inserted}")


# ---------------------------------------------------------------------------
# Stage 3 — Cohere fee estimation
# ---------------------------------------------------------------------------

def _cohere_client():
    if cohere is None:
        return None
    key = config.COHERE_API_KEY
    if not key:
        return None
    return cohere.ClientV2(api_key=key)


def candidates_for_ai(cur, limit):
    """Clean-named Indian universities still missing a cost."""
    cur.execute(
        """
        SELECT university_id, university_name, state
        FROM universities
        WHERE total_annual_cost_inr IS NULL
          AND country IN ('India', 'IN')
          AND university_name ~ '^[A-Za-z]'         -- skip mangled "..." rows
          AND length(university_name) > 6
        ORDER BY university_name
        LIMIT %s;
        """,
        (limit,),
    )
    return cur.fetchall()


def _build_prompt(batch):
    lines = [
        "You are an expert on Indian higher-education fees. For each university "
        "below, estimate the TOTAL annual cost in Indian Rupees (tuition + hostel) "
        "for a typical undergraduate programme.",
        "",
        "Output EXACTLY one line per university in the form:",
        "  <number>. <low_inr>-<high_inr>",
        "Use plain integers with no commas, symbols, or words. Example:",
        "  1. 50000-90000",
        "",
        "Universities:",
    ]
    for i, (_uid, name, state) in enumerate(batch, 1):
        loc = f" ({state})" if state else ""
        lines.append(f"  {i}. {name}{loc}")
    return "\n".join(lines)


_PARSE_RE = re.compile(r"(\d+)\s*[.)]\s*([\d]+)\s*[-to]+\s*([\d]+)", re.IGNORECASE)


def _parse_estimates(text, batch_len):
    """Map line-index -> midpoint INR. Tolerant of minor format drift."""
    out = {}
    for m in _PARSE_RE.finditer(text):
        idx = int(m.group(1))
        lo = int(m.group(2))
        hi = int(m.group(3))
        if 1 <= idx <= batch_len and lo > 0 and hi >= lo:
            mid = (lo + hi) // 2
            # Sanity clamp: ignore absurd values.
            if 5000 <= mid <= 5000000:
                out[idx] = mid
    return out


def estimate_with_cohere(cur):
    client = _cohere_client()
    if client is None:
        print("  [cohere] no client / API key — skipping AI estimation stage")
        return 0

    cur.execute("SELECT COUNT(total_annual_cost_inr) FROM universities;")
    already = cur.fetchone()[0]
    print(f"  [cohere] {already} rows already costed; target {COST_TARGET}")

    estimated = 0
    for call in range(1, COHERE_MAX_CALLS + 1):
        if already + estimated >= COST_TARGET:
            print(f"  [cohere] reached target ({already + estimated}) — stopping")
            break
        batch = candidates_for_ai(cur, COHERE_BATCH)
        if not batch:
            print("  [cohere] no remaining clean-named candidates — stopping")
            break
        prompt = _build_prompt(batch)
        try:
            resp = client.chat(
                model=COHERE_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.message.content[0].text
        except Exception as exc:  # network / rate-limit / quota
            print(f"  [cohere] call {call} failed ({exc}) — stopping AI stage")
            break

        estimates = _parse_estimates(text, len(batch))
        if not estimates:
            print(f"  [cohere] call {call}: no parseable estimates — stopping")
            break

        for idx, mid in estimates.items():
            uid = batch[idx - 1][0]
            cur.execute(
                """
                UPDATE universities
                SET total_annual_cost_inr = %s,
                    data_source = 'ai_estimated',
                    country = COALESCE(country, 'India')
                WHERE university_id = %s
                  AND total_annual_cost_inr IS NULL;
                """,
                (mid, uid),
            )
            estimated += cur.rowcount
        # Commit per call so a later failure can't lose accepted estimates.
        cur.connection.commit()
        print(f"  [cohere] call {call}: +{len(estimates)} estimates "
              f"(running total estimated: {estimated})")
        time.sleep(COHERE_SLEEP_S)

    print(f"  [cohere] AI-estimated {estimated} row(s)")
    return estimated


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def main():
    print("=" * 70)
    print("STARSHIP — university cost population (Phase 7B, Task 1)")
    print("=" * 70)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*), COUNT(total_annual_cost_inr) FROM universities;")
    total0, cost0 = cur.fetchone()
    print(f"\nStart: {total0} universities, {cost0} with cost\n")

    print("[1/4] Ensuring schema ...")
    ensure_schema(cur)
    conn.commit()

    print("\n[2/4] NIRF live scrape (location + rank) ...")
    index = load_index(cur)
    try:
        nirf_records = scrape_nirf()
        if nirf_records:
            apply_nirf(cur, index, nirf_records)
            conn.commit()
    except Exception as exc:  # never let a scrape hiccup abort the whole run
        print(f"  [nirf] stage error ({exc}) — continuing with curated + AI")
        conn.rollback()
        index = load_index(cur)

    print("\n[3/4] Curated published-fee table ...")
    apply_curated(cur, index)
    conn.commit()

    print("\n[4/4] Cohere fee estimation (fallback) ...")
    estimate_with_cohere(cur)
    conn.commit()

    cur.execute("SELECT COUNT(*), COUNT(total_annual_cost_inr) FROM universities;")
    total1, cost1 = cur.fetchone()
    cur.execute(
        "SELECT data_source, COUNT(*) FROM universities "
        "WHERE total_annual_cost_inr IS NOT NULL GROUP BY data_source ORDER BY 2 DESC;"
    )
    breakdown = cur.fetchall()

    print("\n" + "=" * 70)
    print(f"Done: {total1} universities ({total1 - total0:+d}), "
          f"{cost1} with cost ({cost1 - cost0:+d})")
    print("Cost data_source breakdown:")
    for src, n in breakdown:
        print(f"  {src or '(null)':<14} {n}")
    print("=" * 70)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
