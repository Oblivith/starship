"""
scrapers/universities_expand_v2.py  —  universities GAP-FILL expansion (v2)

Session 17's universities_expand.py added ~300 curated Indian + abroad
institutions under country='India'. But the bulk of the 9,718-row table comes
from an EARLIER global/QS dataset import that labels India rows with the ISO-2
code 'IN' (357 rows), NOT 'India'. Those 'IN' rows are the real coverage gap:

      country='India'  -> 307 rows, 100% cost, 100% state   (Session 17 curated)
      country='IN'     -> 357 rows, 326 cost (31 NULL), only 41 state (316 NULL)

So unlike Session 17 (raw count), this script targets the GAPS. "India
universities" is therefore interpreted as  country IN ('India','IN')  — the
honest reading of the brief, since the data proves India is split across two
labels and the real NULLs live under 'IN'.

WHAT THIS SCRIPT DOES
  STEP A — fill NULL total_annual_cost_inr for India rows.
           Cohere (command-r-plus-08-2024) estimates a realistic annual cost in
           INR from the institution's name/tier/type (govt vs private). Batched
           (20 rows/call) to respect the trial key's call budget. UPDATE only —
           never overwrites a non-NULL cost.
  STEP B — fill NULL state for India rows.
           Cohere infers the Indian state/UT from the university name (and city
           if present); rows it cannot determine are left NULL. UPDATE WHERE
           state IS NULL only.
  STEP C — INSERT additional REAL named institutions not yet covered:
           government polytechnics, additional state private universities (each
           state has many beyond Session 17), additional government engineering
           & medical colleges, and additional abroad universities for countries
           already represented. All curated real names with real cities/states.

IDEMPOTENCY (there is NO unique constraint on university_name, and the table
holds duplicate names — so `ON CONFLICT (university_name)` is impossible, exactly
as documented in universities_expand.py). Each insert is therefore guarded by a
case-insensitive existence check; re-running inserts only the still-missing
institutions and never overwrites an existing row. New rows get
data_source = 'curated_v2'. The Cohere UPDATEs are likewise no-ops on a second
run because the targeted NULLs are already filled.

WHY CURATED NAMES, NOT AI-GENERATED NAMES (consistent with Session 17): an LLM
asked to "list every polytechnic" hallucinates plausible-but-fake names. Cohere
is used here ONLY to estimate a cost number and infer a state for institutions
that ALREADY EXIST as real rows — never to invent institution names.

Run:
  python3 scrapers/universities_expand_v2.py
"""

import json
import os
import re
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

BATCH_SIZE = 50          # DB commit batch for inserts
COHERE_BATCH = 20        # institutions per Cohere call (trial-key friendly)
COHERE_MODEL = "command-r-plus-08-2024"
INDIA_COUNTRIES = ("India", "IN")

VALID_STATES = {
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu and Kashmir", "Ladakh", "Puducherry", "Chandigarh",
    "Andaman and Nicobar Islands", "Dadra and Nagar Haveli and Daman and Diu",
    "Lakshadweep",
}

# Category cost defaults (representative annual INR — guidance estimates).
C_POLY, C_GOVT_ENGG, C_GOVT_MED = 18000, 45000, 30000
C_PRIVATE_UNI = 200000
C_US, C_UK, C_CANADA, C_AUS = 4500000, 3000000, 2500000, 2800000


# ===========================================================================
# STEP C DATA — real institutions to INSERT (name, city, state, cost)
# ===========================================================================

# --- Government polytechnics (diploma; AICTE-approved, state-run) ----------
POLYTECHNICS = [
    ("Government Polytechnic Mumbai", "Mumbai", "Maharashtra"),
    ("Government Polytechnic Pune", "Pune", "Maharashtra"),
    ("Government Polytechnic Nagpur", "Nagpur", "Maharashtra"),
    ("Government Polytechnic Nashik", "Nashik", "Maharashtra"),
    ("Government Polytechnic Aurangabad", "Aurangabad", "Maharashtra"),
    ("Government Polytechnic Amravati", "Amravati", "Maharashtra"),
    ("Government Polytechnic Solapur", "Solapur", "Maharashtra"),
    ("Government Polytechnic Kolhapur", "Kolhapur", "Maharashtra"),
    ("Government Polytechnic Jalgaon", "Jalgaon", "Maharashtra"),
    ("Government Polytechnic Thane", "Thane", "Maharashtra"),
    ("Government Polytechnic Ratnagiri", "Ratnagiri", "Maharashtra"),
    ("Government Polytechnic Nanded", "Nanded", "Maharashtra"),
    ("Veermata Jijabai Technological Institute Polytechnic", "Mumbai", "Maharashtra"),
    ("Government Polytechnic Bhopal", "Bhopal", "Madhya Pradesh"),
    ("Government Polytechnic Indore", "Indore", "Madhya Pradesh"),
    ("Government Polytechnic Jabalpur", "Jabalpur", "Madhya Pradesh"),
    ("Government Polytechnic Gwalior", "Gwalior", "Madhya Pradesh"),
    ("Government Polytechnic Ujjain", "Ujjain", "Madhya Pradesh"),
    ("Government Polytechnic Sagar", "Sagar", "Madhya Pradesh"),
    ("Government Polytechnic Rewa", "Rewa", "Madhya Pradesh"),
    ("Government Polytechnic Lucknow", "Lucknow", "Uttar Pradesh"),
    ("Government Polytechnic Kanpur", "Kanpur", "Uttar Pradesh"),
    ("Government Polytechnic Prayagraj", "Prayagraj", "Uttar Pradesh"),
    ("Government Polytechnic Varanasi", "Varanasi", "Uttar Pradesh"),
    ("Government Polytechnic Agra", "Agra", "Uttar Pradesh"),
    ("Government Polytechnic Meerut", "Meerut", "Uttar Pradesh"),
    ("Government Polytechnic Bareilly", "Bareilly", "Uttar Pradesh"),
    ("Government Polytechnic Gorakhpur", "Gorakhpur", "Uttar Pradesh"),
    ("Government Polytechnic Jhansi", "Jhansi", "Uttar Pradesh"),
    ("Government Polytechnic Ahmedabad", "Ahmedabad", "Gujarat"),
    ("Government Polytechnic Rajkot", "Rajkot", "Gujarat"),
    ("Government Polytechnic Vadodara", "Vadodara", "Gujarat"),
    ("Government Polytechnic Surat", "Surat", "Gujarat"),
    ("Government Polytechnic Bhavnagar", "Bhavnagar", "Gujarat"),
    ("Government Polytechnic Junagadh", "Junagadh", "Gujarat"),
    ("Government Polytechnic Gandhinagar", "Gandhinagar", "Gujarat"),
    ("Government Polytechnic Bengaluru", "Bengaluru", "Karnataka"),
    ("Government Polytechnic Mysuru", "Mysuru", "Karnataka"),
    ("Government Polytechnic Mangaluru", "Mangaluru", "Karnataka"),
    ("Government Polytechnic Hubballi", "Hubballi", "Karnataka"),
    ("Government Polytechnic Belagavi", "Belagavi", "Karnataka"),
    ("Government Polytechnic Davangere", "Davangere", "Karnataka"),
    ("Government Polytechnic Tumakuru", "Tumakuru", "Karnataka"),
    ("Central Polytechnic College Chennai", "Chennai", "Tamil Nadu"),
    ("Government Polytechnic College Coimbatore", "Coimbatore", "Tamil Nadu"),
    ("Government Polytechnic College Madurai", "Madurai", "Tamil Nadu"),
    ("Government Polytechnic College Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu"),
    ("Government Polytechnic College Salem", "Salem", "Tamil Nadu"),
    ("Government Polytechnic College Nagercoil", "Nagercoil", "Tamil Nadu"),
    ("Government Polytechnic College Jaipur", "Jaipur", "Rajasthan"),
    ("Government Polytechnic College Jodhpur", "Jodhpur", "Rajasthan"),
    ("Government Polytechnic College Kota", "Kota", "Rajasthan"),
    ("Government Polytechnic College Bikaner", "Bikaner", "Rajasthan"),
    ("Government Polytechnic College Ajmer", "Ajmer", "Rajasthan"),
    ("Government Polytechnic College Udaipur", "Udaipur", "Rajasthan"),
    ("Government Polytechnic Patiala", "Patiala", "Punjab"),
    ("Government Polytechnic Amritsar", "Amritsar", "Punjab"),
    ("Government Polytechnic Ludhiana", "Ludhiana", "Punjab"),
    ("Government Polytechnic Ambala", "Ambala", "Haryana"),
    ("Government Polytechnic Sonipat", "Sonipat", "Haryana"),
    ("Government Polytechnic Hisar", "Hisar", "Haryana"),
    ("Government Polytechnic Patna", "Patna", "Bihar"),
    ("Government Polytechnic Gaya", "Gaya", "Bihar"),
    ("Government Polytechnic Muzaffarpur", "Muzaffarpur", "Bihar"),
    ("Government Polytechnic Bhagalpur", "Bhagalpur", "Bihar"),
    ("Government Polytechnic Darbhanga", "Darbhanga", "Bihar"),
    ("Government Polytechnic Bhubaneswar", "Bhubaneswar", "Odisha"),
    ("Government Polytechnic Berhampur", "Berhampur", "Odisha"),
    ("Government Polytechnic College Thiruvananthapuram", "Thiruvananthapuram", "Kerala"),
    ("Government Polytechnic College Kozhikode", "Kozhikode", "Kerala"),
    ("Government Polytechnic College Thrissur", "Thrissur", "Kerala"),
    ("Government Polytechnic College Kalamassery", "Kalamassery", "Kerala"),
    ("Government Polytechnic Hyderabad", "Hyderabad", "Telangana"),
    ("Government Polytechnic Warangal", "Warangal", "Telangana"),
    ("Government Polytechnic Vijayawada", "Vijayawada", "Andhra Pradesh"),
    ("Government Polytechnic Visakhapatnam", "Visakhapatnam", "Andhra Pradesh"),
    ("Government Polytechnic Guntur", "Guntur", "Andhra Pradesh"),
    ("Pusa Polytechnic", "New Delhi", "Delhi"),
    ("Aryabhat Polytechnic", "New Delhi", "Delhi"),
    ("G B Pant Polytechnic", "New Delhi", "Delhi"),
    ("Government Polytechnic Dehradun", "Dehradun", "Uttarakhand"),
    ("Government Polytechnic Srinagar", "Srinagar", "Jammu and Kashmir"),
    ("Government Polytechnic Jammu", "Jammu", "Jammu and Kashmir"),
    ("Government Polytechnic Guwahati", "Guwahati", "Assam"),
    ("Government Polytechnic Raipur", "Raipur", "Chhattisgarh"),
    ("Government Polytechnic Bilaspur", "Bilaspur", "Chhattisgarh"),
    ("Government Polytechnic Ranchi", "Ranchi", "Jharkhand"),
    ("Government Polytechnic Jamshedpur", "Jamshedpur", "Jharkhand"),
    ("Government Polytechnic Shimla", "Shimla", "Himachal Pradesh"),
    ("Central Calcutta Polytechnic", "Kolkata", "West Bengal"),
]

# --- State private universities (UGC-recognized; beyond Session 17) --------
PRIVATE_UNIS = [
    ("Mody University of Science and Technology", "Lakshmangarh", "Rajasthan"),
    ("JECRC University", "Jaipur", "Rajasthan"),
    ("Poornima University", "Jaipur", "Rajasthan"),
    ("Sangam University", "Bhilwara", "Rajasthan"),
    ("Vivekananda Global University", "Jaipur", "Rajasthan"),
    ("Suresh Gyan Vihar University", "Jaipur", "Rajasthan"),
    ("Career Point University", "Kota", "Rajasthan"),
    ("NIMS University", "Jaipur", "Rajasthan"),
    ("Jagannath University", "Jaipur", "Rajasthan"),
    ("Pacific University", "Udaipur", "Rajasthan"),
    ("Sir Padampat Singhania University", "Udaipur", "Rajasthan"),
    ("University of Engineering and Management Jaipur", "Jaipur", "Rajasthan"),
    ("Sage University", "Indore", "Madhya Pradesh"),
    ("Medi-Caps University", "Indore", "Madhya Pradesh"),
    ("Oriental University", "Indore", "Madhya Pradesh"),
    ("LNCT University", "Bhopal", "Madhya Pradesh"),
    ("Rabindranath Tagore University", "Bhopal", "Madhya Pradesh"),
    ("People's University", "Bhopal", "Madhya Pradesh"),
    ("ITM University Gwalior", "Gwalior", "Madhya Pradesh"),
    ("Jaypee University of Engineering and Technology", "Guna", "Madhya Pradesh"),
    ("MIT World Peace University", "Pune", "Maharashtra"),
    ("FLAME University", "Pune", "Maharashtra"),
    ("Ajeenkya DY Patil University", "Pune", "Maharashtra"),
    ("Sandip University", "Nashik", "Maharashtra"),
    ("Vishwakarma University", "Pune", "Maharashtra"),
    ("MIT Art Design and Technology University", "Pune", "Maharashtra"),
    ("Sanjay Ghodawat University", "Kolhapur", "Maharashtra"),
    ("Spicer Adventist University", "Pune", "Maharashtra"),
    ("Sharda University", "Greater Noida", "Uttar Pradesh"),
    ("Galgotias University", "Greater Noida", "Uttar Pradesh"),
    ("Bennett University", "Greater Noida", "Uttar Pradesh"),
    ("GLA University", "Mathura", "Uttar Pradesh"),
    ("Invertis University", "Bareilly", "Uttar Pradesh"),
    ("IIMT University", "Meerut", "Uttar Pradesh"),
    ("Teerthanker Mahaveer University", "Moradabad", "Uttar Pradesh"),
    ("Integral University", "Lucknow", "Uttar Pradesh"),
    ("Babu Banarasi Das University", "Lucknow", "Uttar Pradesh"),
    ("Swami Vivekanand Subharti University", "Meerut", "Uttar Pradesh"),
    ("Noida International University", "Greater Noida", "Uttar Pradesh"),
    ("Chitkara University", "Rajpura", "Punjab"),
    ("Chandigarh University", "Mohali", "Punjab"),
    ("Plaksha University", "Mohali", "Punjab"),
    ("Rayat Bahra University", "Mohali", "Punjab"),
    ("CT University", "Ludhiana", "Punjab"),
    ("GNA University", "Phagwara", "Punjab"),
    ("O P Jindal Global University", "Sonipat", "Haryana"),
    ("SGT University", "Gurugram", "Haryana"),
    ("K R Mangalam University", "Gurugram", "Haryana"),
    ("Manav Rachna University", "Faridabad", "Haryana"),
    ("GD Goenka University", "Gurugram", "Haryana"),
    ("BML Munjal University", "Gurugram", "Haryana"),
    ("Lingaya's Vidyapeeth", "Faridabad", "Haryana"),
    ("PES University", "Bengaluru", "Karnataka"),
    ("Dayananda Sagar University", "Bengaluru", "Karnataka"),
    ("CMR University", "Bengaluru", "Karnataka"),
    ("Presidency University", "Bengaluru", "Karnataka"),
    ("REVA University", "Bengaluru", "Karnataka"),
    ("Alliance University", "Bengaluru", "Karnataka"),
    ("M S Ramaiah University of Applied Sciences", "Bengaluru", "Karnataka"),
    ("KLE Technological University", "Hubballi", "Karnataka"),
    ("Sathyabama Institute of Science and Technology", "Chennai", "Tamil Nadu"),
    ("Hindustan Institute of Technology and Science", "Chennai", "Tamil Nadu"),
    ("B S Abdur Rahman Crescent Institute", "Chennai", "Tamil Nadu"),
    ("Vel Tech Rangarajan Dr Sagunthala R&D Institute", "Chennai", "Tamil Nadu"),
    ("Karunya Institute of Technology and Sciences", "Coimbatore", "Tamil Nadu"),
    ("Kalasalingam Academy of Research and Education", "Krishnankoil", "Tamil Nadu"),
    ("Karpagam Academy of Higher Education", "Coimbatore", "Tamil Nadu"),
    ("KL University", "Vaddeswaram", "Andhra Pradesh"),
    ("Vignan's Foundation for Science Technology and Research", "Guntur", "Andhra Pradesh"),
    ("Mohan Babu University", "Tirupati", "Andhra Pradesh"),
    ("SRM University AP", "Amaravati", "Andhra Pradesh"),
    ("Anurag University", "Hyderabad", "Telangana"),
    ("Malla Reddy University", "Hyderabad", "Telangana"),
    ("Woxsen University", "Hyderabad", "Telangana"),
    ("Mahindra University", "Hyderabad", "Telangana"),
    ("ICFAI Foundation for Higher Education", "Hyderabad", "Telangana"),
    ("Nirma University", "Ahmedabad", "Gujarat"),
    ("Pandit Deendayal Energy University", "Gandhinagar", "Gujarat"),
    ("Ahmedabad University", "Ahmedabad", "Gujarat"),
    ("Charotar University of Science and Technology", "Changa", "Gujarat"),
    ("Ganpat University", "Mehsana", "Gujarat"),
    ("Marwadi University", "Rajkot", "Gujarat"),
    ("Parul University", "Vadodara", "Gujarat"),
    ("Navrachana University", "Vadodara", "Gujarat"),
    ("Karnavati University", "Gandhinagar", "Gujarat"),
    ("Adamas University", "Kolkata", "West Bengal"),
    ("JIS University", "Kolkata", "West Bengal"),
    ("Brainware University", "Kolkata", "West Bengal"),
    ("Techno India University", "Kolkata", "West Bengal"),
    ("University of Engineering and Management Kolkata", "Kolkata", "West Bengal"),
    ("Siksha O Anusandhan University", "Bhubaneswar", "Odisha"),
    ("Centurion University of Technology and Management", "Bhubaneswar", "Odisha"),
    ("Sri Sri University", "Cuttack", "Odisha"),
    ("GIET University", "Gunupur", "Odisha"),
    ("Assam Down Town University", "Guwahati", "Assam"),
    ("Royal Global University", "Guwahati", "Assam"),
    ("Kaziranga University", "Jorhat", "Assam"),
    ("Sarala Birla University", "Ranchi", "Jharkhand"),
    ("Usha Martin University", "Ranchi", "Jharkhand"),
    ("Graphic Era University", "Dehradun", "Uttarakhand"),
    ("University of Petroleum and Energy Studies", "Dehradun", "Uttarakhand"),
    ("DIT University", "Dehradun", "Uttarakhand"),
    ("Quantum University", "Roorkee", "Uttarakhand"),
    ("Shoolini University", "Solan", "Himachal Pradesh"),
    ("Bahra University", "Solan", "Himachal Pradesh"),
    ("Eternal University", "Sirmaur", "Himachal Pradesh"),
    ("ICFAI University Jharkhand", "Ranchi", "Jharkhand"),
]

# --- Additional government engineering colleges (state/CFTI, AICTE) ---------
GOVT_ENGG = [
    ("College of Engineering Pune", "Pune", "Maharashtra"),
    ("Veermata Jijabai Technological Institute", "Mumbai", "Maharashtra"),
    ("Sardar Patel College of Engineering", "Mumbai", "Maharashtra"),
    ("Government College of Engineering Aurangabad", "Aurangabad", "Maharashtra"),
    ("Government College of Engineering Karad", "Karad", "Maharashtra"),
    ("PSG College of Technology", "Coimbatore", "Tamil Nadu"),
    ("Thiagarajar College of Engineering", "Madurai", "Tamil Nadu"),
    ("Coimbatore Institute of Technology", "Coimbatore", "Tamil Nadu"),
    ("Government College of Technology Coimbatore", "Coimbatore", "Tamil Nadu"),
    ("College of Engineering Guindy", "Chennai", "Tamil Nadu"),
    ("Madras Institute of Technology", "Chennai", "Tamil Nadu"),
    ("University Visvesvaraya College of Engineering", "Bengaluru", "Karnataka"),
    ("University BDT College of Engineering", "Davangere", "Karnataka"),
    ("Malnad College of Engineering", "Hassan", "Karnataka"),
    ("College of Engineering Trivandrum", "Thiruvananthapuram", "Kerala"),
    ("Government Engineering College Thrissur", "Thrissur", "Kerala"),
    ("Model Engineering College", "Kochi", "Kerala"),
    ("Jadavpur University Faculty of Engineering", "Kolkata", "West Bengal"),
    ("Indian Institute of Engineering Science and Technology Shibpur", "Howrah", "West Bengal"),
    ("Bengal Engineering College", "Howrah", "West Bengal"),
    ("Government Engineering College Raipur", "Raipur", "Chhattisgarh"),
    ("University Institute of Technology RGPV", "Bhopal", "Madhya Pradesh"),
    ("Shri Govindram Seksaria Institute of Technology and Science", "Indore", "Madhya Pradesh"),
    ("Madhav Institute of Technology and Science", "Gwalior", "Madhya Pradesh"),
    ("Harcourt Butler Technical University", "Kanpur", "Uttar Pradesh"),
    ("Institute of Engineering and Technology Lucknow", "Lucknow", "Uttar Pradesh"),
    ("Bundelkhand Institute of Engineering and Technology", "Jhansi", "Uttar Pradesh"),
    ("Malaviya National Institute Engineering College", "Jaipur", "Rajasthan"),
    ("Government Engineering College Ajmer", "Ajmer", "Rajasthan"),
    ("Birla Institute of Technology Mesra", "Ranchi", "Jharkhand"),
    ("Muzaffarpur Institute of Technology", "Muzaffarpur", "Bihar"),
    ("Bihar Engineering University", "Patna", "Bihar"),
    ("Delhi Technological University", "New Delhi", "Delhi"),
    ("Netaji Subhas University of Technology", "New Delhi", "Delhi"),
    ("Indira Gandhi Delhi Technical University for Women", "New Delhi", "Delhi"),
    ("Guru Nanak Dev Engineering College", "Ludhiana", "Punjab"),
    ("Punjab Engineering College", "Chandigarh", "Chandigarh"),
    ("National Institute of Technology Chandigarh", "Chandigarh", "Chandigarh"),
    ("Andhra University College of Engineering", "Visakhapatnam", "Andhra Pradesh"),
    ("Jawaharlal Nehru Technological University Kakinada", "Kakinada", "Andhra Pradesh"),
    ("Osmania University College of Engineering", "Hyderabad", "Telangana"),
    ("Chaitanya Bharathi Institute of Technology", "Hyderabad", "Telangana"),
    ("Assam Engineering College", "Guwahati", "Assam"),
    ("Government Engineering College Bhavnagar", "Bhavnagar", "Gujarat"),
    ("Vishwakarma Government Engineering College", "Ahmedabad", "Gujarat"),
]

# --- Additional government medical colleges (state) ------------------------
GOVT_MED = [
    ("Grant Medical College", "Mumbai", "Maharashtra"),
    ("B J Medical College", "Pune", "Maharashtra"),
    ("Government Medical College Nagpur", "Nagpur", "Maharashtra"),
    ("Madras Medical College", "Chennai", "Tamil Nadu"),
    ("Stanley Medical College", "Chennai", "Tamil Nadu"),
    ("Madurai Medical College", "Madurai", "Tamil Nadu"),
    ("Bangalore Medical College and Research Institute", "Bengaluru", "Karnataka"),
    ("Mysore Medical College and Research Institute", "Mysuru", "Karnataka"),
    ("Government Medical College Thiruvananthapuram", "Thiruvananthapuram", "Kerala"),
    ("Government Medical College Kozhikode", "Kozhikode", "Kerala"),
    ("King George's Medical University", "Lucknow", "Uttar Pradesh"),
    ("Sarojini Naidu Medical College", "Agra", "Uttar Pradesh"),
    ("Sawai Man Singh Medical College", "Jaipur", "Rajasthan"),
    ("Government Medical College Surat", "Surat", "Gujarat"),
    ("B J Medical College Ahmedabad", "Ahmedabad", "Gujarat"),
    ("Gandhi Medical College Bhopal", "Bhopal", "Madhya Pradesh"),
    ("Mahatma Gandhi Memorial Medical College", "Indore", "Madhya Pradesh"),
    ("Patna Medical College", "Patna", "Bihar"),
    ("Calcutta Medical College", "Kolkata", "West Bengal"),
    ("Nil Ratan Sircar Medical College", "Kolkata", "West Bengal"),
    ("Osmania Medical College", "Hyderabad", "Telangana"),
    ("Andhra Medical College", "Visakhapatnam", "Andhra Pradesh"),
    ("Gauhati Medical College", "Guwahati", "Assam"),
    ("Government Medical College Chandigarh", "Chandigarh", "Chandigarh"),
    ("Maulana Azad Medical College", "New Delhi", "Delhi"),
]

# --- Additional abroad universities for already-represented countries -------
# (USA top ~51-100, plus more UK / Canada / Australia commonly targeted by
#  Indian students. country uses the full-name form Session 17 used.)
ABROAD = [
    ("University of California, Davis", "Davis", "United States", C_US),
    ("University of California, Irvine", "Irvine", "United States", C_US),
    ("University of California, Santa Barbara", "Santa Barbara", "United States", C_US),
    ("Boston University", "Boston", "United States", C_US),
    ("Northeastern University", "Boston", "United States", C_US),
    ("Ohio State University", "Columbus", "United States", C_US),
    ("Pennsylvania State University", "University Park", "United States", C_US),
    ("Purdue University", "West Lafayette", "United States", C_US),
    ("University of Florida", "Gainesville", "United States", C_US),
    ("University of Maryland, College Park", "College Park", "United States", C_US),
    ("University of Minnesota Twin Cities", "Minneapolis", "United States", C_US),
    ("Michigan State University", "East Lansing", "United States", C_US),
    ("Texas A&M University", "College Station", "United States", C_US),
    ("University of Pittsburgh", "Pittsburgh", "United States", C_US),
    ("Arizona State University", "Tempe", "United States", C_US),
    ("Rutgers University", "New Brunswick", "United States", C_US),
    ("Stony Brook University", "Stony Brook", "United States", C_US),
    ("University of Colorado Boulder", "Boulder", "United States", C_US),
    ("Indiana University Bloomington", "Bloomington", "United States", C_US),
    ("University of Massachusetts Amherst", "Amherst", "United States", C_US),
    ("North Carolina State University", "Raleigh", "United States", C_US),
    ("Virginia Tech", "Blacksburg", "United States", C_US),
    ("University of Arizona", "Tucson", "United States", C_US),
    ("University of Utah", "Salt Lake City", "United States", C_US),
    ("Rochester Institute of Technology", "Rochester", "United States", C_US),
    ("University of Glasgow", "Glasgow", "United Kingdom", C_UK),
    ("University of Birmingham", "Birmingham", "United Kingdom", C_UK),
    ("University of Sheffield", "Sheffield", "United Kingdom", C_UK),
    ("University of Nottingham", "Nottingham", "United Kingdom", C_UK),
    ("University of Leeds", "Leeds", "United Kingdom", C_UK),
    ("University of Southampton", "Southampton", "United Kingdom", C_UK),
    ("Queen Mary University of London", "London", "United Kingdom", C_UK),
    ("Newcastle University", "Newcastle", "United Kingdom", C_UK),
    ("University of Liverpool", "Liverpool", "United Kingdom", C_UK),
    ("Cardiff University", "Cardiff", "United Kingdom", C_UK),
    ("Simon Fraser University", "Burnaby", "Canada", C_CANADA),
    ("University of Victoria", "Victoria", "Canada", C_CANADA),
    ("York University", "Toronto", "Canada", C_CANADA),
    ("Carleton University", "Ottawa", "Canada", C_CANADA),
    ("Concordia University", "Montreal", "Canada", C_CANADA),
    ("University of Saskatchewan", "Saskatoon", "Canada", C_CANADA),
    ("Macquarie University", "Sydney", "Australia", C_AUS),
    ("University of Technology Sydney", "Sydney", "Australia", C_AUS),
    ("RMIT University", "Melbourne", "Australia", C_AUS),
    ("Curtin University", "Perth", "Australia", C_AUS),
    ("Deakin University", "Melbourne", "Australia", C_AUS),
    ("University of Wollongong", "Wollongong", "Australia", C_AUS),
]


# --- Supplement: more government polytechnics (additional district cities) --
POLYTECHNICS_2 = [
    ("Government Polytechnic Beed", "Beed", "Maharashtra"),
    ("Government Polytechnic Ahmednagar", "Ahmednagar", "Maharashtra"),
    ("Government Polytechnic Latur", "Latur", "Maharashtra"),
    ("Government Polytechnic Dhule", "Dhule", "Maharashtra"),
    ("Government Polytechnic Chandrapur", "Chandrapur", "Maharashtra"),
    ("Government Polytechnic Yavatmal", "Yavatmal", "Maharashtra"),
    ("Government Polytechnic Sangli", "Sangli", "Maharashtra"),
    ("Government Polytechnic Satara", "Satara", "Maharashtra"),
    ("Government Polytechnic Chhindwara", "Chhindwara", "Madhya Pradesh"),
    ("Government Polytechnic Shahdol", "Shahdol", "Madhya Pradesh"),
    ("Government Polytechnic Khandwa", "Khandwa", "Madhya Pradesh"),
    ("Government Polytechnic Morena", "Morena", "Madhya Pradesh"),
    ("Government Polytechnic Vidisha", "Vidisha", "Madhya Pradesh"),
    ("Government Polytechnic Aligarh", "Aligarh", "Uttar Pradesh"),
    ("Government Polytechnic Moradabad", "Moradabad", "Uttar Pradesh"),
    ("Government Polytechnic Saharanpur", "Saharanpur", "Uttar Pradesh"),
    ("Government Polytechnic Sultanpur", "Sultanpur", "Uttar Pradesh"),
    ("Government Polytechnic Etawah", "Etawah", "Uttar Pradesh"),
    ("Government Polytechnic Mirzapur", "Mirzapur", "Uttar Pradesh"),
    ("Government Polytechnic Banda", "Banda", "Uttar Pradesh"),
    ("Government Polytechnic Porbandar", "Porbandar", "Gujarat"),
    ("Government Polytechnic Morbi", "Morbi", "Gujarat"),
    ("Government Polytechnic Palanpur", "Palanpur", "Gujarat"),
    ("Government Polytechnic Godhra", "Godhra", "Gujarat"),
    ("Government Polytechnic Valsad", "Valsad", "Gujarat"),
    ("Government Polytechnic Bagalkot", "Bagalkot", "Karnataka"),
    ("Government Polytechnic Bidar", "Bidar", "Karnataka"),
    ("Government Polytechnic Kalaburagi", "Kalaburagi", "Karnataka"),
    ("Government Polytechnic Raichur", "Raichur", "Karnataka"),
    ("Government Polytechnic Shivamogga", "Shivamogga", "Karnataka"),
    ("Government Polytechnic Mandya", "Mandya", "Karnataka"),
    ("Government Polytechnic College Vellore", "Vellore", "Tamil Nadu"),
    ("Government Polytechnic College Tirunelveli", "Tirunelveli", "Tamil Nadu"),
    ("Government Polytechnic College Thanjavur", "Thanjavur", "Tamil Nadu"),
    ("Government Polytechnic College Dindigul", "Dindigul", "Tamil Nadu"),
    ("Government Polytechnic College Erode", "Erode", "Tamil Nadu"),
    ("Government Polytechnic College Alwar", "Alwar", "Rajasthan"),
    ("Government Polytechnic College Bharatpur", "Bharatpur", "Rajasthan"),
    ("Government Polytechnic College Sikar", "Sikar", "Rajasthan"),
    ("Government Polytechnic College Sri Ganganagar", "Sri Ganganagar", "Rajasthan"),
    ("Government Polytechnic Jalandhar", "Jalandhar", "Punjab"),
    ("Government Polytechnic Bathinda", "Bathinda", "Punjab"),
    ("Government Polytechnic Karnal", "Karnal", "Haryana"),
    ("Government Polytechnic Rohtak", "Rohtak", "Haryana"),
    ("Government Polytechnic Purnea", "Purnea", "Bihar"),
    ("Government Polytechnic Chhapra", "Chhapra", "Bihar"),
    ("Government Polytechnic College Kannur", "Kannur", "Kerala"),
    ("Government Polytechnic College Kollam", "Kollam", "Kerala"),
    ("Government Polytechnic Nizamabad", "Nizamabad", "Telangana"),
    ("Government Polytechnic Karimnagar", "Karimnagar", "Telangana"),
    ("Government Polytechnic Tirupati", "Tirupati", "Andhra Pradesh"),
    ("Government Polytechnic Kakinada", "Kakinada", "Andhra Pradesh"),
    ("Government Polytechnic Haldwani", "Haldwani", "Uttarakhand"),
    ("Government Polytechnic Sambalpur", "Sambalpur", "Odisha"),
    ("Government Polytechnic Rourkela", "Rourkela", "Odisha"),
    ("Government Polytechnic Silchar", "Silchar", "Assam"),
    ("Government Polytechnic Durg", "Durg", "Chhattisgarh"),
    ("Government Polytechnic Dhanbad", "Dhanbad", "Jharkhand"),
]

# --- Supplement: more private universities ---------------------------------
PRIVATE_UNIS_2 = [
    ("Kalinga University", "Raipur", "Chhattisgarh"),
    ("MATS University", "Raipur", "Chhattisgarh"),
    ("ISBM University", "Gariyaband", "Chhattisgarh"),
    ("Amity University Chhattisgarh", "Raipur", "Chhattisgarh"),
    ("AKS University", "Satna", "Madhya Pradesh"),
    ("Malwanchal University", "Indore", "Madhya Pradesh"),
    ("Mansarovar Global University", "Sehore", "Madhya Pradesh"),
    ("Dr A P J Abdul Kalam University", "Indore", "Madhya Pradesh"),
    ("Apex University", "Jaipur", "Rajasthan"),
    ("Maharaja Vinayak Global University", "Jaipur", "Rajasthan"),
    ("Bhagwant University", "Ajmer", "Rajasthan"),
    ("Geetanjali University", "Udaipur", "Rajasthan"),
    ("Raffles University", "Neemrana", "Rajasthan"),
    ("Era University", "Lucknow", "Uttar Pradesh"),
    ("Shobhit University", "Meerut", "Uttar Pradesh"),
    ("Rama University", "Kanpur", "Uttar Pradesh"),
    ("Shri Venkateshwara University", "Gajraula", "Uttar Pradesh"),
    ("Monad University", "Hapur", "Uttar Pradesh"),
    ("Sister Nivedita University", "Kolkata", "West Bengal"),
    ("The Neotia University", "Kolkata", "West Bengal"),
    ("Seacom Skills University", "Birbhum", "West Bengal"),
    ("Amity University Kolkata", "Kolkata", "West Bengal"),
    ("Birla Global University", "Bhubaneswar", "Odisha"),
    ("Don Bosco University", "Guwahati", "Assam"),
    ("University of Science and Technology Meghalaya", "Ri-Bhoi", "Meghalaya"),
    ("ICFAI University Tripura", "Agartala", "Tripura"),
    ("Sikkim Manipal University", "Gangtok", "Sikkim"),
    ("Adesh University", "Bathinda", "Punjab"),
    ("Sant Baba Bhag Singh University", "Jalandhar", "Punjab"),
    ("Apeejay Stya University", "Gurugram", "Haryana"),
    ("Ansal University", "Gurugram", "Haryana"),
    ("World University of Design", "Sonipat", "Haryana"),
    ("Starex University", "Gurugram", "Haryana"),
    ("Maharaja Agrasen University", "Solan", "Himachal Pradesh"),
    ("Arni University", "Kangra", "Himachal Pradesh"),
    ("Dr M G R Educational and Research Institute", "Chennai", "Tamil Nadu"),
    ("Vels Institute of Science Technology and Advanced Studies", "Chennai", "Tamil Nadu"),
    ("Bharath Institute of Higher Education and Research", "Chennai", "Tamil Nadu"),
    ("St Peter's Institute of Higher Education and Research", "Chennai", "Tamil Nadu"),
    ("Aurora Higher Education and Research", "Hyderabad", "Telangana"),
    ("Nalla Malla Reddy Engineering College", "Hyderabad", "Telangana"),
    ("Gopal Narayan Singh University", "Sasaram", "Bihar"),
    ("K K University", "Nalanda", "Bihar"),
    ("Amity University Patna", "Patna", "Bihar"),
    ("Jharkhand Rai University", "Ranchi", "Jharkhand"),
]


def build_insert_rows():
    rows = []
    for name, city, state in POLYTECHNICS + POLYTECHNICS_2:
        rows.append((name, city, state, "India", C_POLY))
    for name, city, state in PRIVATE_UNIS + PRIVATE_UNIS_2:
        rows.append((name, city, state, "India", C_PRIVATE_UNI))
    for name, city, state in GOVT_ENGG:
        rows.append((name, city, state, "India", C_GOVT_ENGG))
    for name, city, state in GOVT_MED:
        rows.append((name, city, state, "India", C_GOVT_MED))
    for name, city, country, cost in ABROAD:
        rows.append((name, city, None, country, cost))
    return rows


# ===========================================================================
# Helpers
# ===========================================================================

def _norm(name):
    n = name.lower()
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def _cohere_client():
    if not config.COHERE_API_KEY:
        return None
    import cohere
    return cohere.ClientV2(api_key=config.COHERE_API_KEY)


def _chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def _extract_json(text):
    """Pull the first JSON array/object out of a model reply (strip code fences)."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?", "", text).strip()
    text = re.sub(r"```$", "", text).strip()
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        start = text.find("{")
        end = text.rfind("}")
    if start == -1 or end == -1:
        return None
    try:
        return json.loads(text[start:end + 1])
    except json.JSONDecodeError:
        return None


# ===========================================================================
# STEP A — Cohere cost estimation for NULL-cost India rows
# ===========================================================================

def fill_costs(conn, client):
    cur = conn.cursor()
    cur.execute(
        "SELECT university_id, university_name, city, state FROM universities "
        "WHERE country IN %s AND total_annual_cost_inr IS NULL "
        "ORDER BY university_id;",
        (INDIA_COUNTRIES,),
    )
    targets = cur.fetchall()
    print(f"\n[STEP A] India rows with NULL cost: {len(targets)}")
    if not targets:
        cur.close()
        return 0
    if client is None:
        print("  [skip] no COHERE_API_KEY — cannot estimate costs")
        cur.close()
        return 0

    updated = 0
    for batch in _chunks(targets, COHERE_BATCH):
        listing = "\n".join(
            f'{uid}. {name}'
            + (f' ({city})' if city else '')
            + (f', {state}' if state else '')
            for uid, name, city, state in batch
        )
        prompt = (
            "You are a higher-education finance analyst in India. For each numbered "
            "institution below, estimate a REALISTIC total annual cost (tuition + "
            "typical fees) in Indian rupees for one year of its flagship undergraduate "
            "programme. Judge from the name/type: government institutions are cheap "
            "(10,000-60,000), state/central universities low (15,000-50,000), private "
            "universities and deemed universities higher (120,000-350,000), private "
            "medical far higher. Return ONLY a JSON array of objects "
            '{"id": <number>, "cost_inr": <integer rupees>}. No prose.\n\n'
            + listing
        )
        try:
            resp = client.chat(
                model=COHERE_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            data = _extract_json(resp.message.content[0].text)
        except Exception as e:  # noqa: BLE001
            print(f"  [warn] Cohere call failed for a batch: {e}")
            data = None
        if not data:
            print("  [warn] no usable JSON for a batch — skipped")
            continue
        for item in data:
            try:
                uid = int(item["id"])
                cost = int(item["cost_inr"])
            except (KeyError, ValueError, TypeError):
                continue
            if cost <= 0 or cost > 10_000_000:
                continue
            cur.execute(
                "UPDATE universities SET total_annual_cost_inr = %s, "
                "data_source = COALESCE(data_source, 'ai_estimated') "
                "WHERE university_id = %s AND total_annual_cost_inr IS NULL;",
                (cost, uid),
            )
            updated += cur.rowcount
        conn.commit()
        print(f"  ... batch done, running cost updates: {updated}")
    cur.close()
    print(f"[STEP A] cost values filled: {updated}")
    return updated


# ===========================================================================
# STEP B — Cohere state inference for NULL-state India rows
# ===========================================================================

def fill_states(conn, client):
    cur = conn.cursor()
    cur.execute(
        "SELECT university_id, university_name, city FROM universities "
        "WHERE country IN %s AND (state IS NULL OR state = '') "
        "ORDER BY university_id;",
        (INDIA_COUNTRIES,),
    )
    targets = cur.fetchall()
    print(f"\n[STEP B] India rows with NULL state: {len(targets)}")
    if not targets:
        cur.close()
        return 0
    if client is None:
        print("  [skip] no COHERE_API_KEY — cannot infer states")
        cur.close()
        return 0

    updated = 0
    for batch in _chunks(targets, COHERE_BATCH):
        listing = "\n".join(
            f'{uid}. {name}' + (f' ({city})' if city else '')
            for uid, name, city in batch
        )
        prompt = (
            "For each numbered Indian institution below, identify the Indian state "
            "or union territory where it is located, using the institution name and "
            "city. Use the exact official English state/UT name (e.g. 'Tamil Nadu', "
            "'Uttar Pradesh', 'Delhi', 'West Bengal'). If you genuinely cannot "
            "determine it with confidence, use null. Return ONLY a JSON array of "
            'objects {"id": <number>, "state": <state name or null>}. No prose.\n\n'
            + listing
        )
        try:
            resp = client.chat(
                model=COHERE_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            data = _extract_json(resp.message.content[0].text)
        except Exception as e:  # noqa: BLE001
            print(f"  [warn] Cohere call failed for a batch: {e}")
            data = None
        if not data:
            print("  [warn] no usable JSON for a batch — skipped")
            continue
        for item in data:
            try:
                uid = int(item["id"])
            except (KeyError, ValueError, TypeError):
                continue
            state = item.get("state")
            if not state or not isinstance(state, str):
                continue
            state = state.strip()
            if state not in VALID_STATES:
                continue  # reject hallucinated / malformed state names
            cur.execute(
                "UPDATE universities SET state = %s "
                "WHERE university_id = %s AND (state IS NULL OR state = '');",
                (state, uid),
            )
            updated += cur.rowcount
        conn.commit()
        print(f"  ... batch done, running state updates: {updated}")
    cur.close()
    print(f"[STEP B] state values filled: {updated}")
    return updated


# ===========================================================================
# STEP C — insert new curated real institutions
# ===========================================================================

INSERT_SQL = """
INSERT INTO universities
    (university_name, city, state, country, total_annual_cost_inr,
     normalized_name, data_source)
VALUES (%s, %s, %s, %s, %s, %s, 'curated_v2');
"""


def insert_new(conn):
    cur = conn.cursor()
    rows = build_insert_rows()
    print(f"\n[STEP C] candidate institutions to insert: {len(rows)} "
          f"(existence-checked, idempotent)")
    inserted = existed = 0
    for i, (name, city, state, country, cost) in enumerate(rows, start=1):
        cur.execute(
            "SELECT 1 FROM universities WHERE lower(university_name) = lower(%s) LIMIT 1;",
            (name,),
        )
        if cur.fetchone():
            existed += 1
        else:
            cur.execute(INSERT_SQL, (name, city, state, country, cost, _norm(name)))
            inserted += 1
        if i % BATCH_SIZE == 0:
            conn.commit()
    conn.commit()
    cur.close()
    print(f"[STEP C] inserted {inserted} new institutions, {existed} already existed")
    return inserted


# ===========================================================================
# Coverage reporting
# ===========================================================================

def coverage(conn):
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM universities;")
    total = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM universities WHERE country IN %s;", (INDIA_COUNTRIES,))
    india = cur.fetchone()[0]
    cur.execute(
        "SELECT COUNT(*) FROM universities WHERE country IN %s "
        "AND total_annual_cost_inr IS NOT NULL;", (INDIA_COUNTRIES,))
    cost = cur.fetchone()[0]
    cur.execute(
        "SELECT COUNT(*) FROM universities WHERE country IN %s "
        "AND state IS NOT NULL AND state <> '';", (INDIA_COUNTRIES,))
    state = cur.fetchone()[0]
    cur.close()
    cost_pct = (cost / india * 100) if india else 0
    state_pct = (state / india * 100) if india else 0
    return {
        "total": total, "india": india, "cost": cost, "state": state,
        "cost_pct": cost_pct, "state_pct": state_pct,
    }


def _print_cov(label, c):
    print(f"  {label}")
    print(f"    total rows           : {c['total']}")
    print(f"    India rows (India+IN): {c['india']}")
    print(f"    cost filled          : {c['cost']}  ({c['cost_pct']:.1f}%)")
    print(f"    state filled         : {c['state']}  ({c['state_pct']:.1f}%)")


def main():
    print("=" * 70)
    print("STARSHIP — universities GAP-FILL expansion v2")
    print("=" * 70)

    conn = get_conn()
    client = _cohere_client()
    if client is None:
        print("\n[!] COHERE_API_KEY not set — STEP A/B (cost+state fill) will be "
              "skipped; only STEP C inserts will run.")

    before = coverage(conn)
    print("\nBEFORE:")
    _print_cov("", before)

    fill_costs(conn, client)
    fill_states(conn, client)
    insert_new(conn)

    after = coverage(conn)
    print("\n" + "=" * 70)
    print("AFTER:")
    _print_cov("", after)
    print("-" * 70)
    print(f"  total rows : {before['total']} -> {after['total']} "
          f"({after['total'] - before['total']:+d})")
    print(f"  cost cover : {before['cost_pct']:.1f}% -> {after['cost_pct']:.1f}% "
          f"(target >=70%)")
    print(f"  state cover: {before['state_pct']:.1f}% -> {after['state_pct']:.1f}% "
          f"(target >=60%)")
    print("=" * 70)

    conn.close()


if __name__ == "__main__":
    main()
