"""
scrapers/universities_expand.py  —  universities expansion

Inserts the significant Indian institutions (all IITs / NITs / IIITs / IIMs /
IISERs / NLUs / AIIMS, central + major state universities, top private/deemed
universities, design/fashion institutes, agricultural + open universities) plus
the universities Indian students most commonly target abroad (USA, UK, Canada,
Australia, Singapore, Germany, UAE, Hong Kong).

WHY CURATED, NOT AI-GENERATED:
  These are real institutions with real names, cities and (for India) NIRF ranks.
  An LLM asked to "list every university" hallucinates plausible-but-fake names
  and wrong ranks — useless for students choosing where to apply. So this is a
  curated authoritative list, exactly like the curated published-fee table that
  is the backbone of university_costs.py. Costs are best-estimate annual figures
  (abroad tuition converted to INR at representative 2025 rates).

IDEMPOTENCY (important — there is NO unique constraint on university_name, and
the table already holds 326 duplicate names):
  `ON CONFLICT (university_name)` is therefore impossible. Each insert is guarded
  by a case-insensitive existence check; commit per batch of 50. Re-running
  inserts only the institutions still missing and never overwrites an existing
  row (so the 514 hand/AI-costed rows from Phase 7B are untouched). New rows get
  normalized_name + data_source = 'curated' for consistency with the existing data.

Run:
  python3 scrapers/universities_expand.py
"""

import os
import re
import sys

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402

BATCH_SIZE = 50

# Representative annual costs (INR). Abroad = typical annual tuition converted at
# 2025 rates; figures are estimates for guidance, not quotes.
C_IIT, C_NIT, C_IIIT, C_IIM = 250000, 160000, 200000, 1100000
C_IISER, C_NLU, C_AIIMS = 50000, 250000, 12000
C_CENTRAL, C_STATE, C_OPEN = 30000, 25000, 15000
C_PRIVATE, C_DEEMED, C_BITS, C_DESIGN, C_AGRI = 350000, 300000, 500000, 350000, 80000
C_US_TOP, C_US_PUB, C_UK, C_CANADA = 4500000, 3000000, 3000000, 2500000
C_AUS, C_SG, C_DE, C_AE, C_HK = 2800000, 2500000, 150000, 2000000, 2500000


# ---------------------------------------------------------------------------
# INDIA — (name, city, state, nirf_rank or None, cost)
# ---------------------------------------------------------------------------

IITS = [
    ("Indian Institute of Technology Madras", "Chennai", "Tamil Nadu", 1),
    ("Indian Institute of Technology Delhi", "New Delhi", "Delhi", 2),
    ("Indian Institute of Technology Bombay", "Mumbai", "Maharashtra", 3),
    ("Indian Institute of Technology Kanpur", "Kanpur", "Uttar Pradesh", 4),
    ("Indian Institute of Technology Kharagpur", "Kharagpur", "West Bengal", 5),
    ("Indian Institute of Technology Roorkee", "Roorkee", "Uttarakhand", 6),
    ("Indian Institute of Technology Guwahati", "Guwahati", "Assam", 7),
    ("Indian Institute of Technology Hyderabad", "Hyderabad", "Telangana", 8),
    ("Indian Institute of Technology (BHU) Varanasi", "Varanasi", "Uttar Pradesh", 15),
    ("Indian Institute of Technology Indore", "Indore", "Madhya Pradesh", 16),
    ("Indian Institute of Technology Gandhinagar", "Gandhinagar", "Gujarat", 36),
    ("Indian Institute of Technology Ropar", "Rupnagar", "Punjab", 22),
    ("Indian Institute of Technology Patna", "Patna", "Bihar", 41),
    ("Indian Institute of Technology Mandi", "Mandi", "Himachal Pradesh", 31),
    ("Indian Institute of Technology Jodhpur", "Jodhpur", "Rajasthan", 43),
    ("Indian Institute of Technology Bhubaneswar", "Bhubaneswar", "Odisha", 28),
    ("Indian Institute of Technology Tirupati", "Tirupati", "Andhra Pradesh", 59),
    ("Indian Institute of Technology Palakkad", "Palakkad", "Kerala", None),
    ("Indian Institute of Technology Bhilai", "Bhilai", "Chhattisgarh", None),
    ("Indian Institute of Technology Goa", "Ponda", "Goa", None),
    ("Indian Institute of Technology Jammu", "Jammu", "Jammu and Kashmir", None),
    ("Indian Institute of Technology Dharwad", "Dharwad", "Karnataka", None),
    ("Indian Institute of Technology (ISM) Dhanbad", "Dhanbad", "Jharkhand", 38),
]

NITS = [
    ("National Institute of Technology Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", 9),
    ("National Institute of Technology Karnataka, Surathkal", "Mangalore", "Karnataka", 17),
    ("National Institute of Technology Rourkela", "Rourkela", "Odisha", 19),
    ("National Institute of Technology Warangal", "Warangal", "Telangana", 21),
    ("National Institute of Technology Calicut", "Kozhikode", "Kerala", 25),
    ("Motilal Nehru National Institute of Technology Allahabad", "Prayagraj", "Uttar Pradesh", 49),
    ("National Institute of Technology Durgapur", "Durgapur", "West Bengal", 43),
    ("National Institute of Technology Silchar", "Silchar", "Assam", 41),
    ("Malaviya National Institute of Technology Jaipur", "Jaipur", "Rajasthan", 37),
    ("Visvesvaraya National Institute of Technology Nagpur", "Nagpur", "Maharashtra", 39),
    ("Sardar Vallabhbhai National Institute of Technology Surat", "Surat", "Gujarat", 65),
    ("National Institute of Technology Kurukshetra", "Kurukshetra", "Haryana", 56),
    ("Maulana Azad National Institute of Technology Bhopal", "Bhopal", "Madhya Pradesh", 60),
    ("Dr B R Ambedkar National Institute of Technology Jalandhar", "Jalandhar", "Punjab", 71),
    ("National Institute of Technology Patna", "Patna", "Bihar", 78),
    ("National Institute of Technology Raipur", "Raipur", "Chhattisgarh", 79),
    ("National Institute of Technology Agartala", "Agartala", "Tripura", None),
    ("National Institute of Technology Srinagar", "Srinagar", "Jammu and Kashmir", None),
    ("National Institute of Technology Hamirpur", "Hamirpur", "Himachal Pradesh", 90),
    ("National Institute of Technology Jamshedpur", "Jamshedpur", "Jharkhand", 86),
    ("National Institute of Technology Meghalaya", "Shillong", "Meghalaya", None),
    ("National Institute of Technology Manipur", "Imphal", "Manipur", None),
    ("National Institute of Technology Mizoram", "Aizawl", "Mizoram", None),
    ("National Institute of Technology Nagaland", "Dimapur", "Nagaland", None),
    ("National Institute of Technology Arunachal Pradesh", "Jote", "Arunachal Pradesh", None),
    ("National Institute of Technology Sikkim", "Ravangla", "Sikkim", None),
    ("National Institute of Technology Goa", "Cuncolim", "Goa", None),
    ("National Institute of Technology Puducherry", "Karaikal", "Puducherry", None),
    ("National Institute of Technology Uttarakhand", "Srinagar (Garhwal)", "Uttarakhand", None),
    ("National Institute of Technology Delhi", "New Delhi", "Delhi", None),
    ("National Institute of Technology Andhra Pradesh", "Tadepalligudem", "Andhra Pradesh", None),
]

IIITS = [
    ("Indian Institute of Information Technology Allahabad", "Prayagraj", "Uttar Pradesh", 90),
    ("Atal Bihari Vajpayee IIIT and Management Gwalior", "Gwalior", "Madhya Pradesh", None),
    ("Indian Institute of Information Technology Hyderabad", "Hyderabad", "Telangana", None),
    ("Indian Institute of Information Technology Bangalore", "Bengaluru", "Karnataka", None),
    ("IIIT Design and Manufacturing Jabalpur", "Jabalpur", "Madhya Pradesh", None),
    ("IIIT Design and Manufacturing Kancheepuram", "Chennai", "Tamil Nadu", None),
    ("Indian Institute of Information Technology Guwahati", "Guwahati", "Assam", None),
    ("Indian Institute of Information Technology Kota", "Kota", "Rajasthan", None),
    ("Indian Institute of Information Technology Sri City", "Sri City", "Andhra Pradesh", None),
    ("Indian Institute of Information Technology Vadodara", "Gandhinagar", "Gujarat", None),
    ("Indian Institute of Information Technology Nagpur", "Nagpur", "Maharashtra", None),
    ("Indian Institute of Information Technology Pune", "Pune", "Maharashtra", None),
    ("Indian Institute of Information Technology Kalyani", "Kalyani", "West Bengal", None),
    ("Indian Institute of Information Technology Lucknow", "Lucknow", "Uttar Pradesh", None),
    ("Indian Institute of Information Technology Dharwad", "Dharwad", "Karnataka", None),
    ("Indian Institute of Information Technology Kottayam", "Kottayam", "Kerala", None),
    ("Indian Institute of Information Technology Manipur", "Imphal", "Manipur", None),
    ("Indian Institute of Information Technology Ranchi", "Ranchi", "Jharkhand", None),
    ("Indian Institute of Information Technology Bhopal", "Bhopal", "Madhya Pradesh", None),
    ("Indian Institute of Information Technology Surat", "Surat", "Gujarat", None),
    ("Indian Institute of Information Technology Bhagalpur", "Bhagalpur", "Bihar", None),
    ("Indian Institute of Information Technology Agartala", "Agartala", "Tripura", None),
    ("Indian Institute of Information Technology Raichur", "Raichur", "Karnataka", None),
    ("Indian Institute of Information Technology Una", "Una", "Himachal Pradesh", None),
    ("Indian Institute of Information Technology Sonepat", "Sonepat", "Haryana", None),
]

IIMS = [
    ("Indian Institute of Management Ahmedabad", "Ahmedabad", "Gujarat", 1),
    ("Indian Institute of Management Bangalore", "Bengaluru", "Karnataka", 2),
    ("Indian Institute of Management Kozhikode", "Kozhikode", "Kerala", 3),
    ("Indian Institute of Management Calcutta", "Kolkata", "West Bengal", 4),
    ("Indian Institute of Management Lucknow", "Lucknow", "Uttar Pradesh", 6),
    ("Indian Institute of Management Indore", "Indore", "Madhya Pradesh", 8),
    ("Indian Institute of Management Mumbai", "Mumbai", "Maharashtra", None),
    ("Indian Institute of Management Raipur", "Raipur", "Chhattisgarh", 14),
    ("Indian Institute of Management Ranchi", "Ranchi", "Jharkhand", 18),
    ("Indian Institute of Management Rohtak", "Rohtak", "Haryana", 13),
    ("Indian Institute of Management Udaipur", "Udaipur", "Rajasthan", 22),
    ("Indian Institute of Management Tiruchirappalli", "Tiruchirappalli", "Tamil Nadu", 23),
    ("Indian Institute of Management Kashipur", "Kashipur", "Uttarakhand", 24),
    ("Indian Institute of Management Nagpur", "Nagpur", "Maharashtra", None),
    ("Indian Institute of Management Visakhapatnam", "Visakhapatnam", "Andhra Pradesh", None),
    ("Indian Institute of Management Bodh Gaya", "Bodh Gaya", "Bihar", None),
    ("Indian Institute of Management Amritsar", "Amritsar", "Punjab", None),
    ("Indian Institute of Management Sambalpur", "Sambalpur", "Odisha", None),
    ("Indian Institute of Management Sirmaur", "Sirmaur", "Himachal Pradesh", None),
    ("Indian Institute of Management Jammu", "Jammu", "Jammu and Kashmir", None),
]

IISERS = [
    ("Indian Institute of Science Education and Research Pune", "Pune", "Maharashtra", None),
    ("Indian Institute of Science Education and Research Kolkata", "Mohanpur", "West Bengal", None),
    ("Indian Institute of Science Education and Research Mohali", "Mohali", "Punjab", None),
    ("Indian Institute of Science Education and Research Bhopal", "Bhopal", "Madhya Pradesh", None),
    ("Indian Institute of Science Education and Research Thiruvananthapuram", "Thiruvananthapuram", "Kerala", None),
    ("Indian Institute of Science Education and Research Tirupati", "Tirupati", "Andhra Pradesh", None),
    ("Indian Institute of Science Education and Research Berhampur", "Berhampur", "Odisha", None),
    ("Indian Institute of Science Bangalore", "Bengaluru", "Karnataka", None),
]

NLUS = [
    ("National Law School of India University", "Bengaluru", "Karnataka", 1),
    ("National Academy of Legal Studies and Research (NALSAR)", "Hyderabad", "Telangana", 3),
    ("The West Bengal National University of Juridical Sciences", "Kolkata", "West Bengal", 4),
    ("National Law University Delhi", "New Delhi", "Delhi", 2),
    ("National Law University Jodhpur", "Jodhpur", "Rajasthan", 8),
    ("Gujarat National Law University", "Gandhinagar", "Gujarat", 11),
    ("Hidayatullah National Law University", "Raipur", "Chhattisgarh", None),
    ("Rajiv Gandhi National University of Law", "Patiala", "Punjab", None),
    ("Chanakya National Law University", "Patna", "Bihar", None),
    ("National University of Advanced Legal Studies", "Kochi", "Kerala", None),
    ("National Law University Odisha", "Cuttack", "Odisha", None),
    ("National University of Study and Research in Law", "Ranchi", "Jharkhand", None),
    ("National Law University and Judicial Academy Assam", "Guwahati", "Assam", None),
    ("Damodaram Sanjivayya National Law University", "Visakhapatnam", "Andhra Pradesh", None),
    ("Tamil Nadu National Law University", "Tiruchirappalli", "Tamil Nadu", None),
    ("Maharashtra National Law University Mumbai", "Mumbai", "Maharashtra", None),
    ("Maharashtra National Law University Nagpur", "Nagpur", "Maharashtra", None),
    ("Maharashtra National Law University Aurangabad", "Aurangabad", "Maharashtra", None),
    ("Dharmashastra National Law University", "Jabalpur", "Madhya Pradesh", None),
    ("Himachal Pradesh National Law University", "Shimla", "Himachal Pradesh", None),
    ("Dr B R Ambedkar National Law University", "Sonepat", "Haryana", None),
    ("National Law University Tripura", "Agartala", "Tripura", None),
]

AIIMS_MED = [
    ("All India Institute of Medical Sciences Delhi", "New Delhi", "Delhi", 1, C_AIIMS),
    ("Post Graduate Institute of Medical Education and Research", "Chandigarh", "Chandigarh", 2, C_AIIMS),
    ("Christian Medical College", "Vellore", "Tamil Nadu", 3, 80000),
    ("National Institute of Mental Health and Neurosciences", "Bengaluru", "Karnataka", 4, 30000),
    ("Jawaharlal Institute of Postgraduate Medical Education", "Puducherry", "Puducherry", 5, C_AIIMS),
    ("Sanjay Gandhi Postgraduate Institute of Medical Sciences", "Lucknow", "Uttar Pradesh", 6, 30000),
    ("Banaras Hindu University Institute of Medical Sciences", "Varanasi", "Uttar Pradesh", 7, 20000),
    ("AIIMS Jodhpur", "Jodhpur", "Rajasthan", 13, C_AIIMS),
    ("AIIMS Bhubaneswar", "Bhubaneswar", "Odisha", 15, C_AIIMS),
    ("AIIMS Bhopal", "Bhopal", "Madhya Pradesh", None, C_AIIMS),
    ("AIIMS Patna", "Patna", "Bihar", None, C_AIIMS),
    ("AIIMS Raipur", "Raipur", "Chhattisgarh", None, C_AIIMS),
    ("AIIMS Rishikesh", "Rishikesh", "Uttarakhand", None, C_AIIMS),
    ("AIIMS Nagpur", "Nagpur", "Maharashtra", None, C_AIIMS),
    ("AIIMS Mangalagiri", "Mangalagiri", "Andhra Pradesh", None, C_AIIMS),
    ("Maulana Azad Medical College", "New Delhi", "Delhi", None, 20000),
    ("King George's Medical University", "Lucknow", "Uttar Pradesh", None, 55000),
    ("Kasturba Medical College Manipal", "Manipal", "Karnataka", None, 1500000),
    ("Armed Forces Medical College", "Pune", "Maharashtra", None, 60000),
    ("Madras Medical College", "Chennai", "Tamil Nadu", None, 25000),
    ("Grant Medical College", "Mumbai", "Maharashtra", None, 90000),
    ("Lady Hardinge Medical College", "New Delhi", "Delhi", None, 20000),
]

CENTRAL_UNIS = [
    ("University of Delhi", "New Delhi", "Delhi", 30000),
    ("Jawaharlal Nehru University", "New Delhi", "Delhi", 25000),
    ("Banaras Hindu University", "Varanasi", "Uttar Pradesh", 20000),
    ("Aligarh Muslim University", "Aligarh", "Uttar Pradesh", 25000),
    ("Jamia Millia Islamia", "New Delhi", "Delhi", 20000),
    ("University of Hyderabad", "Hyderabad", "Telangana", 28000),
    ("Visva-Bharati University", "Santiniketan", "West Bengal", 18000),
    ("Pondicherry University", "Puducherry", "Puducherry", 25000),
    ("North Eastern Hill University", "Shillong", "Meghalaya", 20000),
    ("Tezpur University", "Tezpur", "Assam", 22000),
    ("Assam University", "Silchar", "Assam", 20000),
    ("University of Allahabad", "Prayagraj", "Uttar Pradesh", 18000),
    ("Babasaheb Bhimrao Ambedkar University", "Lucknow", "Uttar Pradesh", 20000),
    ("Central University of Rajasthan", "Ajmer", "Rajasthan", 20000),
    ("Central University of Punjab", "Bathinda", "Punjab", 22000),
    ("Central University of Gujarat", "Gandhinagar", "Gujarat", 20000),
    ("Central University of Jharkhand", "Ranchi", "Jharkhand", 20000),
    ("Central University of Karnataka", "Kalaburagi", "Karnataka", 20000),
    ("Central University of Kerala", "Kasaragod", "Kerala", 20000),
    ("Central University of Tamil Nadu", "Thiruvarur", "Tamil Nadu", 20000),
    ("Central University of Himachal Pradesh", "Dharamshala", "Himachal Pradesh", 20000),
    ("Central University of Jammu", "Jammu", "Jammu and Kashmir", 20000),
    ("Central University of Kashmir", "Srinagar", "Jammu and Kashmir", 20000),
    ("Central University of Haryana", "Mahendragarh", "Haryana", 20000),
    ("Central University of Odisha", "Koraput", "Odisha", 20000),
    ("Central University of South Bihar", "Gaya", "Bihar", 20000),
    ("Mahatma Gandhi Central University", "Motihari", "Bihar", 20000),
    ("Guru Ghasidas Vishwavidyalaya", "Bilaspur", "Chhattisgarh", 20000),
    ("Hari Singh Gour University", "Sagar", "Madhya Pradesh", 18000),
    ("Indira Gandhi National Tribal University", "Amarkantak", "Madhya Pradesh", 18000),
    ("Maulana Azad National Urdu University", "Hyderabad", "Telangana", 18000),
    ("English and Foreign Languages University", "Hyderabad", "Telangana", 22000),
    ("Rajiv Gandhi University", "Itanagar", "Arunachal Pradesh", 18000),
    ("Mizoram University", "Aizawl", "Mizoram", 18000),
    ("Nagaland University", "Lumami", "Nagaland", 18000),
    ("Manipur University", "Imphal", "Manipur", 18000),
    ("Tripura University", "Agartala", "Tripura", 18000),
    ("Sikkim University", "Gangtok", "Sikkim", 18000),
    ("Hemvati Nandan Bahuguna Garhwal University", "Srinagar (Garhwal)", "Uttarakhand", 18000),
    ("Dr Harisingh Gour Vishwavidyalaya", "Sagar", "Madhya Pradesh", 18000),
    ("Sri Sri University", "Cuttack", "Odisha", 120000),
    ("Mahatma Gandhi Antarrashtriya Hindi Vishwavidyalaya", "Wardha", "Maharashtra", 18000),
    ("Dr B R Ambedkar University Delhi", "New Delhi", "Delhi", 25000),
    ("Nalanda University", "Rajgir", "Bihar", 60000),
    ("South Asian University", "New Delhi", "Delhi", 50000),
]

STATE_UNIS = [
    ("Anna University", "Chennai", "Tamil Nadu", 40000),
    ("Jadavpur University", "Kolkata", "West Bengal", 25000),
    ("University of Calcutta", "Kolkata", "West Bengal", 18000),
    ("University of Mumbai", "Mumbai", "Maharashtra", 25000),
    ("Savitribai Phule Pune University", "Pune", "Maharashtra", 25000),
    ("University of Madras", "Chennai", "Tamil Nadu", 20000),
    ("Osmania University", "Hyderabad", "Telangana", 20000),
    ("Andhra University", "Visakhapatnam", "Andhra Pradesh", 22000),
    ("Bangalore University", "Bengaluru", "Karnataka", 22000),
    ("University of Mysore", "Mysuru", "Karnataka", 20000),
    ("University of Kerala", "Thiruvananthapuram", "Kerala", 18000),
    ("Cochin University of Science and Technology", "Kochi", "Kerala", 35000),
    ("University of Calicut", "Malappuram", "Kerala", 18000),
    ("Mahatma Gandhi University", "Kottayam", "Kerala", 18000),
    ("University of Rajasthan", "Jaipur", "Rajasthan", 20000),
    ("University of Lucknow", "Lucknow", "Uttar Pradesh", 20000),
    ("Chhatrapati Shahu Ji Maharaj University", "Kanpur", "Uttar Pradesh", 18000),
    ("Panjab University", "Chandigarh", "Chandigarh", 30000),
    ("Guru Nanak Dev University", "Amritsar", "Punjab", 25000),
    ("Punjabi University", "Patiala", "Punjab", 22000),
    ("Maharaja Sayajirao University of Baroda", "Vadodara", "Gujarat", 25000),
    ("Gujarat University", "Ahmedabad", "Gujarat", 20000),
    ("Devi Ahilya Vishwavidyalaya", "Indore", "Madhya Pradesh", 20000),
    ("Rani Durgavati Vishwavidyalaya", "Jabalpur", "Madhya Pradesh", 18000),
    ("Utkal University", "Bhubaneswar", "Odisha", 18000),
    ("Sambalpur University", "Sambalpur", "Odisha", 18000),
    ("Patna University", "Patna", "Bihar", 18000),
    ("Ranchi University", "Ranchi", "Jharkhand", 18000),
    ("Gauhati University", "Guwahati", "Assam", 18000),
    ("Dibrugarh University", "Dibrugarh", "Assam", 18000),
    ("Kurukshetra University", "Kurukshetra", "Haryana", 22000),
    ("Maharshi Dayanand University", "Rohtak", "Haryana", 22000),
    ("Himachal Pradesh University", "Shimla", "Himachal Pradesh", 20000),
    ("University of Jammu", "Jammu", "Jammu and Kashmir", 20000),
    ("University of Kashmir", "Srinagar", "Jammu and Kashmir", 20000),
    ("Goa University", "Taleigao", "Goa", 25000),
    ("Veer Narmad South Gujarat University", "Surat", "Gujarat", 18000),
    ("Shivaji University", "Kolhapur", "Maharashtra", 18000),
    ("Sant Gadge Baba Amravati University", "Amravati", "Maharashtra", 18000),
    ("Bharathiar University", "Coimbatore", "Tamil Nadu", 18000),
    ("Bharathidasan University", "Tiruchirappalli", "Tamil Nadu", 18000),
    ("Sri Venkateswara University", "Tirupati", "Andhra Pradesh", 18000),
    ("Acharya Nagarjuna University", "Guntur", "Andhra Pradesh", 18000),
    ("Kakatiya University", "Warangal", "Telangana", 18000),
    ("Karnatak University", "Dharwad", "Karnataka", 18000),
    ("Mangalore University", "Mangalore", "Karnataka", 18000),
    ("Berhampur University", "Berhampur", "Odisha", 16000),
    ("Vidyasagar University", "Midnapore", "West Bengal", 16000),
    ("University of Burdwan", "Bardhaman", "West Bengal", 16000),
    ("Kalyani University", "Kalyani", "West Bengal", 16000),
]

PRIVATE_DEEMED = [
    ("Birla Institute of Technology and Science Pilani", "Pilani", "Rajasthan", C_BITS),
    ("BITS Pilani Goa Campus", "Zuarinagar", "Goa", C_BITS),
    ("BITS Pilani Hyderabad Campus", "Hyderabad", "Telangana", C_BITS),
    ("Vellore Institute of Technology", "Vellore", "Tamil Nadu", 198000),
    ("VIT Chennai", "Chennai", "Tamil Nadu", 198000),
    ("VIT-AP University", "Amaravati", "Andhra Pradesh", 198000),
    ("SRM Institute of Science and Technology", "Chennai", "Tamil Nadu", 260000),
    ("Manipal Academy of Higher Education", "Manipal", "Karnataka", 400000),
    ("Manipal Institute of Technology", "Manipal", "Karnataka", 400000),
    ("Amity University Noida", "Noida", "Uttar Pradesh", 320000),
    ("Amity University Mumbai", "Mumbai", "Maharashtra", 320000),
    ("Symbiosis International University", "Pune", "Maharashtra", 350000),
    ("Christ University", "Bengaluru", "Karnataka", 200000),
    ("Ashoka University", "Sonepat", "Haryana", 700000),
    ("OP Jindal Global University", "Sonepat", "Haryana", 500000),
    ("Shiv Nadar University", "Greater Noida", "Uttar Pradesh", 400000),
    ("Plaksha University", "Mohali", "Punjab", 450000),
    ("Krea University", "Sri City", "Andhra Pradesh", 600000),
    ("FLAME University", "Pune", "Maharashtra", 550000),
    ("Bennett University", "Greater Noida", "Uttar Pradesh", 350000),
    ("Lovely Professional University", "Phagwara", "Punjab", 200000),
    ("Chandigarh University", "Mohali", "Punjab", 200000),
    ("Thapar Institute of Engineering and Technology", "Patiala", "Punjab", 400000),
    ("Kalinga Institute of Industrial Technology", "Bhubaneswar", "Odisha", 350000),
    ("PES University", "Bengaluru", "Karnataka", 400000),
    ("RV College of Engineering", "Bengaluru", "Karnataka", 250000),
    ("BMS College of Engineering", "Bengaluru", "Karnataka", 250000),
    ("PSG College of Technology", "Coimbatore", "Tamil Nadu", 150000),
    ("Sastra Deemed University", "Thanjavur", "Tamil Nadu", 200000),
    ("Amrita Vishwa Vidyapeetham", "Coimbatore", "Tamil Nadu", 300000),
    ("Jamia Hamdard", "New Delhi", "Delhi", 200000),
    ("Banasthali Vidyapith", "Banasthali", "Rajasthan", 180000),
    ("Graphic Era University", "Dehradun", "Uttarakhand", 200000),
    ("UPES Dehradun", "Dehradun", "Uttarakhand", 350000),
    ("Nirma University", "Ahmedabad", "Gujarat", 280000),
    ("Pandit Deendayal Energy University", "Gandhinagar", "Gujarat", 280000),
    ("Dayananda Sagar University", "Bengaluru", "Karnataka", 250000),
    ("Sharda University", "Greater Noida", "Uttar Pradesh", 250000),
    ("Galgotias University", "Greater Noida", "Uttar Pradesh", 200000),
    ("Jaypee Institute of Information Technology", "Noida", "Uttar Pradesh", 300000),
]

SPECIALIST = [
    ("National Institute of Design Ahmedabad", "Ahmedabad", "Gujarat", C_DESIGN),
    ("National Institute of Design Bengaluru", "Bengaluru", "Karnataka", C_DESIGN),
    ("National Institute of Design Gandhinagar", "Gandhinagar", "Gujarat", C_DESIGN),
    ("National Institute of Fashion Technology Delhi", "New Delhi", "Delhi", 300000),
    ("National Institute of Fashion Technology Mumbai", "Mumbai", "Maharashtra", 300000),
    ("National Institute of Fashion Technology Bengaluru", "Bengaluru", "Karnataka", 300000),
    ("National Institute of Fashion Technology Chennai", "Chennai", "Tamil Nadu", 300000),
    ("National Institute of Fashion Technology Kolkata", "Kolkata", "West Bengal", 300000),
    ("National Institute of Fashion Technology Hyderabad", "Hyderabad", "Telangana", 300000),
    ("Indian Institute of Crafts and Design", "Jaipur", "Rajasthan", 250000),
    ("School of Planning and Architecture Delhi", "New Delhi", "Delhi", 80000),
    ("School of Planning and Architecture Bhopal", "Bhopal", "Madhya Pradesh", 80000),
    ("Sir JJ School of Art", "Mumbai", "Maharashtra", 40000),
    ("Film and Television Institute of India", "Pune", "Maharashtra", 150000),
    ("Satyajit Ray Film and Television Institute", "Kolkata", "West Bengal", 150000),
    ("Indian Institute of Mass Communication", "New Delhi", "Delhi", 130000),
    ("Xavier Labour Relations Institute (XLRI)", "Jamshedpur", "Jharkhand", 1200000),
    ("SP Jain Institute of Management and Research", "Mumbai", "Maharashtra", 1900000),
    ("Management Development Institute", "Gurugram", "Haryana", 1200000),
    ("Indian Institute of Foreign Trade", "New Delhi", "Delhi", 1000000),
    ("Tata Institute of Social Sciences", "Mumbai", "Maharashtra", 200000),
    ("Delhi Technological University", "New Delhi", "Delhi", 190000),
    ("Netaji Subhas University of Technology", "New Delhi", "Delhi", 180000),
    ("Indira Gandhi Delhi Technical University for Women", "New Delhi", "Delhi", 160000),
    ("Indian Statistical Institute", "Kolkata", "West Bengal", 30000),
    ("Institute of Chemical Technology", "Mumbai", "Maharashtra", 90000),
    ("Indian Maritime University", "Chennai", "Tamil Nadu", 300000),
    ("Lakshmibai National Institute of Physical Education", "Gwalior", "Madhya Pradesh", 60000),
    ("National Sports University", "Imphal", "Manipur", 60000),
]

AGRI_OPEN = [
    ("Indian Agricultural Research Institute", "New Delhi", "Delhi", C_AGRI),
    ("Punjab Agricultural University", "Ludhiana", "Punjab", C_AGRI),
    ("Tamil Nadu Agricultural University", "Coimbatore", "Tamil Nadu", C_AGRI),
    ("GB Pant University of Agriculture and Technology", "Pantnagar", "Uttarakhand", C_AGRI),
    ("Anand Agricultural University", "Anand", "Gujarat", C_AGRI),
    ("Acharya NG Ranga Agricultural University", "Guntur", "Andhra Pradesh", C_AGRI),
    ("University of Agricultural Sciences Bangalore", "Bengaluru", "Karnataka", C_AGRI),
    ("Chaudhary Charan Singh Haryana Agricultural University", "Hisar", "Haryana", C_AGRI),
    ("Indira Gandhi National Open University", "New Delhi", "Delhi", C_OPEN),
    ("Yashwantrao Chavan Maharashtra Open University", "Nashik", "Maharashtra", C_OPEN),
    ("Dr B R Ambedkar Open University", "Hyderabad", "Telangana", C_OPEN),
    ("Netaji Subhas Open University", "Kolkata", "West Bengal", C_OPEN),
    ("Krishna Kanta Handiqui State Open University", "Guwahati", "Assam", C_OPEN),
    ("Uttar Pradesh Rajarshi Tandon Open University", "Prayagraj", "Uttar Pradesh", C_OPEN),
    ("Karnataka State Open University", "Mysuru", "Karnataka", C_OPEN),
]


# ---------------------------------------------------------------------------
# ABROAD — (name, city, country, cost)
# ---------------------------------------------------------------------------

USA = [
    ("Massachusetts Institute of Technology", "Cambridge", C_US_TOP),
    ("Stanford University", "Stanford", C_US_TOP),
    ("Harvard University", "Cambridge", C_US_TOP),
    ("California Institute of Technology", "Pasadena", C_US_TOP),
    ("Princeton University", "Princeton", C_US_TOP),
    ("Yale University", "New Haven", C_US_TOP),
    ("Columbia University", "New York", C_US_TOP),
    ("University of Chicago", "Chicago", C_US_TOP),
    ("University of Pennsylvania", "Philadelphia", C_US_TOP),
    ("Cornell University", "Ithaca", C_US_TOP),
    ("Carnegie Mellon University", "Pittsburgh", C_US_TOP),
    ("University of California, Berkeley", "Berkeley", C_US_PUB),
    ("University of California, Los Angeles", "Los Angeles", C_US_PUB),
    ("University of California, San Diego", "San Diego", C_US_PUB),
    ("University of Michigan, Ann Arbor", "Ann Arbor", C_US_PUB),
    ("Georgia Institute of Technology", "Atlanta", C_US_PUB),
    ("University of Illinois Urbana-Champaign", "Champaign", C_US_PUB),
    ("University of Texas at Austin", "Austin", C_US_PUB),
    ("Purdue University", "West Lafayette", C_US_PUB),
    ("University of Wisconsin-Madison", "Madison", C_US_PUB),
    ("University of Washington", "Seattle", C_US_PUB),
    ("New York University", "New York", C_US_TOP),
    ("Johns Hopkins University", "Baltimore", C_US_TOP),
    ("Duke University", "Durham", C_US_TOP),
    ("Northwestern University", "Evanston", C_US_TOP),
    ("University of Southern California", "Los Angeles", C_US_TOP),
    ("Texas A&M University", "College Station", C_US_PUB),
    ("Ohio State University", "Columbus", C_US_PUB),
    ("Pennsylvania State University", "University Park", C_US_PUB),
    ("Arizona State University", "Tempe", C_US_PUB),
    ("University of Maryland, College Park", "College Park", C_US_PUB),
    ("University of Massachusetts Amherst", "Amherst", C_US_PUB),
    ("North Carolina State University", "Raleigh", C_US_PUB),
    ("Rutgers University", "New Brunswick", C_US_PUB),
    ("University of Florida", "Gainesville", C_US_PUB),
    ("Boston University", "Boston", C_US_TOP),
    ("University of California, Davis", "Davis", C_US_PUB),
    ("University of California, Irvine", "Irvine", C_US_PUB),
    ("University of Minnesota", "Minneapolis", C_US_PUB),
    ("Virginia Tech", "Blacksburg", C_US_PUB),
    ("University of Colorado Boulder", "Boulder", C_US_PUB),
    ("Stony Brook University", "Stony Brook", C_US_PUB),
    ("University at Buffalo SUNY", "Buffalo", C_US_PUB),
    ("Northeastern University", "Boston", C_US_TOP),
    ("Rice University", "Houston", C_US_TOP),
    ("Vanderbilt University", "Nashville", C_US_TOP),
    ("University of Pittsburgh", "Pittsburgh", C_US_PUB),
    ("Indiana University Bloomington", "Bloomington", C_US_PUB),
    ("Michigan State University", "East Lansing", C_US_PUB),
    ("University of California, Santa Barbara", "Santa Barbara", C_US_PUB),
]

UK = [
    ("University of Oxford", "Oxford", C_UK),
    ("University of Cambridge", "Cambridge", C_UK),
    ("Imperial College London", "London", C_UK),
    ("University College London", "London", C_UK),
    ("University of Edinburgh", "Edinburgh", C_UK),
    ("University of Manchester", "Manchester", C_UK),
    ("King's College London", "London", C_UK),
    ("London School of Economics and Political Science", "London", C_UK),
    ("University of Warwick", "Coventry", C_UK),
    ("University of Bristol", "Bristol", C_UK),
    ("University of Glasgow", "Glasgow", C_UK),
    ("University of Birmingham", "Birmingham", C_UK),
    ("University of Sheffield", "Sheffield", C_UK),
    ("University of Leeds", "Leeds", C_UK),
    ("University of Nottingham", "Nottingham", C_UK),
    ("University of Southampton", "Southampton", C_UK),
    ("University of Liverpool", "Liverpool", C_UK),
    ("Newcastle University", "Newcastle", C_UK),
    ("Queen Mary University of London", "London", C_UK),
    ("Cardiff University", "Cardiff", C_UK),
    ("Durham University", "Durham", C_UK),
    ("University of York", "York", C_UK),
    ("Lancaster University", "Lancaster", C_UK),
    ("University of Exeter", "Exeter", C_UK),
    ("University of Bath", "Bath", C_UK),
    ("Coventry University", "Coventry", 2200000),
    ("University of Surrey", "Guildford", C_UK),
    ("Queen's University Belfast", "Belfast", C_UK),
]

CANADA = [
    ("University of Toronto", "Toronto", C_CANADA),
    ("University of British Columbia", "Vancouver", C_CANADA),
    ("McGill University", "Montreal", C_CANADA),
    ("University of Alberta", "Edmonton", C_CANADA),
    ("McMaster University", "Hamilton", C_CANADA),
    ("University of Waterloo", "Waterloo", C_CANADA),
    ("University of Montreal", "Montreal", C_CANADA),
    ("University of Calgary", "Calgary", C_CANADA),
    ("Western University", "London", C_CANADA),
    ("Queen's University", "Kingston", C_CANADA),
    ("University of Ottawa", "Ottawa", C_CANADA),
    ("Dalhousie University", "Halifax", C_CANADA),
    ("University of Manitoba", "Winnipeg", C_CANADA),
    ("University of Saskatchewan", "Saskatoon", C_CANADA),
    ("Simon Fraser University", "Burnaby", C_CANADA),
    ("York University", "Toronto", C_CANADA),
    ("Concordia University", "Montreal", C_CANADA),
    ("Carleton University", "Ottawa", C_CANADA),
]

AUSTRALIA = [
    ("University of Melbourne", "Melbourne", C_AUS),
    ("Australian National University", "Canberra", C_AUS),
    ("University of Sydney", "Sydney", C_AUS),
    ("University of New South Wales", "Sydney", C_AUS),
    ("University of Queensland", "Brisbane", C_AUS),
    ("Monash University", "Melbourne", C_AUS),
    ("University of Western Australia", "Perth", C_AUS),
    ("University of Adelaide", "Adelaide", C_AUS),
    ("University of Technology Sydney", "Sydney", C_AUS),
    ("RMIT University", "Melbourne", C_AUS),
    ("Macquarie University", "Sydney", C_AUS),
    ("Queensland University of Technology", "Brisbane", C_AUS),
    ("Deakin University", "Geelong", C_AUS),
    ("University of Wollongong", "Wollongong", C_AUS),
    ("Curtin University", "Perth", C_AUS),
]

SINGAPORE = [
    ("National University of Singapore", "Singapore", C_SG),
    ("Nanyang Technological University", "Singapore", C_SG),
    ("Singapore Management University", "Singapore", C_SG),
    ("Singapore University of Technology and Design", "Singapore", C_SG),
]

GERMANY = [
    ("Technical University of Munich", "Munich", C_DE),
    ("Ludwig Maximilian University of Munich", "Munich", C_DE),
    ("Heidelberg University", "Heidelberg", C_DE),
    ("RWTH Aachen University", "Aachen", C_DE),
    ("Technical University of Berlin", "Berlin", C_DE),
    ("Karlsruhe Institute of Technology", "Karlsruhe", C_DE),
    ("Technical University of Darmstadt", "Darmstadt", C_DE),
    ("University of Stuttgart", "Stuttgart", C_DE),
    ("Technical University of Dresden", "Dresden", C_DE),
    ("University of Freiburg", "Freiburg", C_DE),
    ("Humboldt University of Berlin", "Berlin", C_DE),
    ("University of Bonn", "Bonn", C_DE),
]

UAE = [
    ("Khalifa University", "Abu Dhabi", C_AE),
    ("United Arab Emirates University", "Al Ain", C_AE),
    ("American University of Sharjah", "Sharjah", 2600000),
    ("University of Dubai", "Dubai", C_AE),
    ("BITS Pilani Dubai Campus", "Dubai", 1200000),
    ("Amity University Dubai", "Dubai", 1500000),
    ("Manipal Academy of Higher Education Dubai", "Dubai", 1400000),
]

HONGKONG = [
    ("University of Hong Kong", "Hong Kong", C_HK),
    ("Hong Kong University of Science and Technology", "Hong Kong", C_HK),
    ("Chinese University of Hong Kong", "Hong Kong", C_HK),
    ("City University of Hong Kong", "Hong Kong", C_HK),
    ("Hong Kong Polytechnic University", "Hong Kong", C_HK),
]


# ---------------------------------------------------------------------------
# Assemble unified row dicts
# ---------------------------------------------------------------------------

def _norm(name):
    n = name.lower()
    n = re.sub(r"[^a-z0-9 ]", " ", n)
    n = re.sub(r"\s+", " ", n).strip()
    return n


def build_rows():
    rows = []

    def add_india(name, city, state, nirf, cost):
        rows.append({"name": name, "city": city, "state": state, "country": "India",
                     "nirf": nirf, "cost": cost})

    def add_abroad(name, city, country, cost):
        rows.append({"name": name, "city": city, "state": None, "country": country,
                     "nirf": None, "cost": cost})

    for name, city, state, nirf in IITS:
        add_india(name, city, state, nirf, C_IIT)
    for name, city, state, nirf in NITS:
        add_india(name, city, state, nirf, C_NIT)
    for name, city, state, nirf in IIITS:
        add_india(name, city, state, nirf, C_IIIT)
    for name, city, state, nirf in IIMS:
        add_india(name, city, state, nirf, C_IIM)
    for name, city, state, nirf in IISERS:
        add_india(name, city, state, nirf, C_IISER)
    for name, city, state, nirf in NLUS:
        add_india(name, city, state, nirf, C_NLU)
    for name, city, state, nirf, cost in AIIMS_MED:
        add_india(name, city, state, nirf, cost)
    for name, city, state, cost in CENTRAL_UNIS:
        add_india(name, city, state, None, cost)
    for name, city, state, cost in STATE_UNIS:
        add_india(name, city, state, None, cost)
    for name, city, state, cost in PRIVATE_DEEMED:
        add_india(name, city, state, None, cost)
    for name, city, state, cost in SPECIALIST:
        add_india(name, city, state, None, cost)
    for name, city, state, cost in AGRI_OPEN:
        add_india(name, city, state, None, cost)

    for name, city, cost in USA:
        add_abroad(name, city, "United States", cost)
    for name, city, cost in UK:
        add_abroad(name, city, "United Kingdom", cost)
    for name, city, cost in CANADA:
        add_abroad(name, city, "Canada", cost)
    for name, city, cost in AUSTRALIA:
        add_abroad(name, city, "Australia", cost)
    for name, city, cost in SINGAPORE:
        add_abroad(name, city, "Singapore", cost)
    for name, city, cost in GERMANY:
        add_abroad(name, city, "Germany", cost)
    for name, city, cost in UAE:
        add_abroad(name, city, "UAE", cost)
    for name, city, cost in HONGKONG:
        add_abroad(name, city, "Hong Kong", cost)

    return rows


# ---------------------------------------------------------------------------
# DB
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def ensure_schema(cur):
    # data_source already added in Phase 7B; keep idempotent in case run standalone.
    cur.execute("ALTER TABLE universities ADD COLUMN IF NOT EXISTS data_source VARCHAR(30);")
    print("  [schema] data_source column ready")


INSERT_SQL = """
INSERT INTO universities
    (university_name, city, state, country, nirf_rank, total_annual_cost_inr,
     normalized_name, data_source)
VALUES (%s, %s, %s, %s, %s, %s, %s, 'curated');
"""


def main():
    print("=" * 70)
    print("STARSHIP — universities expansion (curated)")
    print("=" * 70)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM universities;")
    start = cur.fetchone()[0]
    print(f"\nStart: {start} university row(s)\n")

    print("[1/2] Ensuring schema ...")
    ensure_schema(cur)
    conn.commit()

    rows = build_rows()
    print(f"\n[2/2] Inserting {len(rows)} curated institutions (batches of {BATCH_SIZE}) ...\n")

    inserted = existed = 0
    ins_india = ins_abroad = 0
    for i, r in enumerate(rows, start=1):
        cur.execute(
            "SELECT 1 FROM universities WHERE lower(university_name) = lower(%s) LIMIT 1;",
            (r["name"],),
        )
        if cur.fetchone():
            existed += 1
        else:
            cur.execute(INSERT_SQL, (
                r["name"], r["city"], r["state"], r["country"], r["nirf"],
                r["cost"], _norm(r["name"]),
            ))
            inserted += 1
            if r["country"] == "India":
                ins_india += 1
            else:
                ins_abroad += 1
            print(f"  + [{r['country'][:13]:<13}] {r['name'][:50]}")
        if i % BATCH_SIZE == 0:
            conn.commit()
            print(f"  ... committed {i}/{len(rows)}")
    conn.commit()

    cur.execute("SELECT COUNT(*) FROM universities;")
    end = cur.fetchone()[0]

    print(f"\n{inserted} universities inserted (India: {ins_india}, Abroad: {ins_abroad}), "
          f"{existed} already existed.")
    print("\n" + "=" * 70)
    print(f"universities: {start} -> {end} ({end - start:+d})")
    print("=" * 70)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
