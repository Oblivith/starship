"""
scrapers/careers_expand.py  —  career_profiles expansion (25 -> 200+)

Generates rich, AI-authored career profiles with Cohere
(command-r-plus-08-2024, cohere.ClientV2) across every major domain and inserts
them into career_profiles. Existing rows are never touched.

WHY THE ENGINE CARES (verified against score_assessment.py before writing):
  The matching loop reads, for EVERY career row:
      numerical_required, verbal_required, discipline_required,
      study_tolerance_required, primary_trait, secondary_trait, required_exam
  and compares the numeric ones with `>=` (e.g. `if numerical >= numerical_required`).
  A NULL in any of those would raise `TypeError: int >= NoneType` and crash
  scoring for the whole student. The roadmap block additionally reads
  typical_degree_duration / recommended_higher_study / work_life_balance /
  income_growth / job_market_demand / research_orientation for the top careers
  (`if wlb >= 4` etc.). So EVERY new career here populates all of those columns
  (1-5 scale, matching the existing 25). They are validated + clamped so a bad
  Cohere response can never write a NULL or out-of-range value.

COUNTRY SALARY:
  Built deterministically in Python from the India salary via per-country wage
  models (multiplier vs India + forex + currency meta + per-country growth),
  using the EXACT schema + 9 keys (IN US GB CA AU SG HK AE EU) the frontend
  salaryData.js consumes. This guarantees valid JSONB for all 9 regions for
  every career — asking the LLM for 200 x 9 hand-tuned figures is neither
  reliable (JSON truncation) nor cheap on the trial quota.

SCHEMA:
  career_profiles already has salary_*/education_path/top_recruiters/
  growth_outlook/country_salary (migrations 004/004b/006). This script adds, via
  ADD COLUMN IF NOT EXISTS, the three the brief asks for that are missing:
  description, required_stream, data_source — and widens required_exam to hold
  the multi-pathway " / " strings.

IDEMPOTENCY:
  There is NO unique constraint on career_name (only the PK + a non-unique
  index), so `ON CONFLICT (career_name)` is impossible. Instead every insert is
  guarded by a case-insensitive existence check, commit per batch. Re-running
  inserts only the careers that are still missing.

Run:
  python3 scrapers/careers_expand.py
  python3 scrapers/careers_expand.py --limit 60     # cap how many to generate
"""

import os
import re
import sys
import json
import time
import argparse

import psycopg2

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config  # noqa: E402  (calls load_dotenv())

try:
    import cohere
except ImportError:  # pragma: no cover - cohere is a declared dependency
    cohere = None


# ---------------------------------------------------------------------------
# Tunables
# ---------------------------------------------------------------------------

COHERE_MODEL = "command-r-plus-08-2024"
COHERE_SLEEP_S = 1.5
COHERE_MAX_CALLS = 60       # batches of 4 → ~50 batches for 200 careers
BATCH_SIZE = 4
MAX_BATCH_RETRIES = 2
DATA_SOURCE = "ai_generated"


# ---------------------------------------------------------------------------
# Target careers — the names we want covered, grouped by domain so coverage is
# guaranteed (we drive generation, not the model). Existing careers are skipped
# by the existence check, so overlap with the seeded 25 is harmless.
# ---------------------------------------------------------------------------

TARGET_CAREERS = [
    # Engineering (all branches)
    "Mechanical Engineer", "Civil Engineer", "Electrical Engineer",
    "Electronics & Communication Engineer", "Computer Science Engineer",
    "Information Technology Engineer", "Chemical Engineer", "Aerospace Engineer",
    "Aeronautical Engineer", "Automobile Engineer", "Production Engineer",
    "Industrial Engineer", "Mechatronics Engineer", "Robotics Engineer",
    "Biomedical Engineer", "Biotechnology Engineer", "Metallurgical Engineer",
    "Mining Engineer", "Petroleum Engineer", "Marine Engineer",
    "Instrumentation Engineer", "Environmental Engineer", "Structural Engineer",
    "Agricultural Engineer", "Textile Engineer", "Food Technology Engineer",
    # IT / Data / Computing
    "Software Engineer", "Data Scientist", "Data Analyst", "Machine Learning Engineer",
    "AI Research Engineer", "Cloud Architect", "DevOps Engineer",
    "Cybersecurity Analyst", "Ethical Hacker", "Full Stack Developer",
    "Mobile App Developer", "Database Administrator", "Network Engineer",
    "Blockchain Developer", "Site Reliability Engineer", "QA Automation Engineer",
    "Product Manager (Tech)", "UI/UX Designer", "Business Analyst (IT)",
    # Medicine & Allied Health
    "Doctor (MBBS)", "Surgeon", "Cardiologist", "Pediatrician", "Psychiatrist",
    "Dentist (BDS)", "Ayurvedic Doctor (BAMS)", "Homeopathic Doctor (BHMS)",
    "Physiotherapist", "Radiologist", "Pathologist", "Anaesthesiologist",
    "Veterinarian", "Optometrist", "Nutritionist & Dietitian",
    "Occupational Therapist", "Speech Therapist", "Medical Lab Technologist",
    "Pharmacist", "Clinical Research Associate",
    # Nursing & Public Health
    "Nurse (B.Sc Nursing)", "Public Health Specialist", "Epidemiologist",
    "Hospital Administrator",
    # Law
    "Corporate Lawyer", "Criminal Lawyer", "Civil Litigation Lawyer",
    "Legal Advisor", "Company Secretary", "Cyber Law Specialist",
    "Intellectual Property Lawyer", "Judge / Judicial Services Officer",
    # Commerce / Finance / Banking
    "Chartered Accountant", "Cost & Management Accountant", "Investment Banker",
    "Financial Analyst", "Actuary", "Bank Probationary Officer",
    "Stock Market Trader", "Wealth Manager", "Auditor", "Tax Consultant",
    "Economist", "Insurance Underwriter", "Credit Analyst",
    # Management / Business
    "Management Consultant", "Marketing Manager", "Human Resources Manager",
    "Operations Manager", "Supply Chain Manager", "Entrepreneur / Startup Founder",
    "Brand Manager", "Sales Manager", "Digital Marketing Specialist",
    "Public Relations Manager", "Project Manager",
    # Science / Research
    "Physicist", "Chemist", "Biologist", "Mathematician", "Statistician",
    "Biotechnologist", "Microbiologist", "Geologist", "Astronomer",
    "Marine Biologist", "Forensic Scientist", "Botanist", "Zoologist",
    "Research Scientist (R&D)", "Meteorologist", "Geneticist",
    # Architecture & Design
    "Architect", "Interior Designer", "Urban Planner", "Landscape Architect",
    "Industrial / Product Designer", "Graphic Designer", "Fashion Designer",
    "Textile Designer", "Jewellery Designer", "Animator", "Game Designer",
    "Motion Graphics Artist", "VFX Artist", "Set Designer",
    # Arts / Humanities / Social
    "Psychologist", "Clinical Psychologist", "Counsellor", "Social Worker",
    "Sociologist", "Historian", "Archaeologist", "Anthropologist",
    "Political Scientist", "Philosopher / Academic", "Linguist", "Translator",
    # Education
    "School Teacher", "Professor / Lecturer", "Special Educator",
    "Education Administrator", "Instructional Designer", "Career Counsellor",
    # Media / Journalism / Film
    "Journalist", "News Anchor", "Content Writer", "Copywriter", "Editor (Publishing)",
    "Film Director", "Cinematographer", "Film Editor", "Screenwriter",
    "Sound Engineer", "Radio Jockey", "Photographer", "Documentary Filmmaker",
    "Social Media Manager", "Video Producer",
    # Civil Services / Defence / Public
    "Civil Services Officer (IAS/IPS)", "Indian Foreign Service Officer",
    "Army Officer", "Navy Officer", "Air Force Officer (Pilot)",
    "Defence Scientist (DRDO)", "Police Officer", "Fire Officer",
    # Aviation / Maritime
    "Commercial Pilot", "Air Traffic Controller", "Aircraft Maintenance Engineer",
    "Cabin Crew / Flight Attendant", "Merchant Navy Officer", "Ship Captain",
    "Naval Architect",
    # Hospitality / Tourism
    "Hotel Manager", "Chef / Culinary Artist", "Event Manager",
    "Travel & Tourism Manager", "Sommelier", "Bakery & Confectionery Specialist",
    # Agriculture / Environment
    "Agricultural Scientist", "Horticulturist", "Dairy Technologist",
    "Fishery Scientist", "Forestry Officer", "Environmental Scientist",
    "Wildlife Conservationist", "Sustainability Consultant",
    "Renewable Energy Specialist",
    # Sports / Fitness
    "Professional Athlete", "Sports Coach", "Physical Education Teacher",
    "Sports Physiotherapist", "Fitness Trainer", "Sports Analyst", "Yoga Instructor",
    # Emerging / Misc
    "Game Developer", "Esports Professional", "Data Engineer",
    "Genetic Counsellor", "Drone Pilot", "Space Scientist (ISRO)",
    "Nanotechnology Researcher", "Logistics Manager", "Pharmacovigilance Officer",
    "Clinical Nutritionist", "Cartographer (GIS Specialist)",
]


# ---------------------------------------------------------------------------
# Country salary model — multiplier vs the India INR figure + forex + currency
# meta + a representative per-country growth outlook. Keys EXACTLY match the
# frontend's salaryData.js codes (Germany -> EU/Europe, the established slot).
# (min_mult, max_mult, inr_per_local_unit, currency_symbol, currency_code, growth)
# ---------------------------------------------------------------------------

COUNTRY_MODEL = {
    "US": (4.5, 5.5, 84.0,  "$",    "USD", "High"),
    "GB": (3.5, 4.2, 106.0, "£",    "GBP", "High"),
    "CA": (3.2, 4.0, 62.0,  "CAD$", "CAD", "High"),
    "AU": (3.4, 4.2, 55.0,  "AUD$", "AUD", "High"),
    "SG": (3.6, 4.5, 62.0,  "S$",   "SGD", "High"),
    "HK": (3.3, 4.2, 10.7,  "HK$",  "HKD", "Moderate"),
    "AE": (3.0, 3.8, 23.0,  "AED",  "AED", "High"),
    "EU": (3.3, 4.0, 91.0,  "€",    "EUR", "High"),
}


def round_sig(n):
    """Round to a clean-looking figure (nearest 1,000)."""
    return int(round(n / 1000.0)) * 1000


def build_country_salary(min_inr, max_inr, india_growth):
    """Deterministic 9-region country_salary JSONB matching migration 006's shape."""
    out = {
        "IN": {
            "min_inr": int(min_inr), "max_inr": int(max_inr),
            "min_local": int(min_inr), "max_local": int(max_inr),
            "currency_symbol": "₹", "currency_code": "INR",
            "growth_outlook": india_growth,
        }
    }
    for code, (mn, mx, forex, sym, cur, growth) in COUNTRY_MODEL.items():
        c_min_inr = round_sig(min_inr * mn)
        c_max_inr = round_sig(max_inr * mx)
        out[code] = {
            "min_inr": c_min_inr,
            "max_inr": c_max_inr,
            "min_local": round_sig(c_min_inr / forex),
            "max_local": round_sig(c_max_inr / forex),
            "currency_symbol": sym,
            "currency_code": cur,
            "growth_outlook": growth,
        }
    return out


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def ensure_schema(cur):
    cur.execute("ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS description TEXT;")
    cur.execute("ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS required_stream VARCHAR(60);")
    cur.execute("ALTER TABLE career_profiles ADD COLUMN IF NOT EXISTS data_source VARCHAR(30);")
    # Widen required_exam so the multi-pathway " / " strings fit (safe widening).
    cur.execute("ALTER TABLE career_profiles ALTER COLUMN required_exam TYPE VARCHAR(255);")
    cur.execute("UPDATE career_profiles SET data_source = 'manual' WHERE data_source IS NULL;")
    print(f"  [schema] description/required_stream/data_source ready; "
          f"required_exam widened; {cur.rowcount} existing row(s) tagged 'manual'")


def existing_career_names(cur):
    cur.execute("SELECT lower(career_name) FROM career_profiles WHERE career_name IS NOT NULL;")
    return {r[0] for r in cur.fetchall()}


# ---------------------------------------------------------------------------
# Cohere
# ---------------------------------------------------------------------------

def _cohere_client():
    if cohere is None:
        return None
    key = config.COHERE_API_KEY
    if not key:
        return None
    return cohere.ClientV2(api_key=key)


def _build_prompt(names):
    listing = "\n".join(f"  - {n}" for n in names)
    return "\n".join([
        "You are an expert Indian career counsellor and labour-market analyst.",
        "Produce factual, India-specific career profiles for EXACTLY these careers:",
        listing,
        "",
        "Return ONLY a JSON array (no prose, no markdown fences). One object per "
        "career above, in the same order, with EXACTLY these keys:",
        "  career_name            (string, echo the name above verbatim)",
        "  description            (string, 1-2 sentences, what the job actually involves)",
        "  required_stream        (string, e.g. 'Science (PCM)', 'Science (PCB)', "
        "'Commerce', 'Arts/Humanities', 'Any Stream')",
        "  required_exam          (string: list MULTIPLE valid entry routes separated "
        "by ' / ', e.g. 'JEE Main / JEE Advanced / State CET / CUET / Private University "
        "Entrance'. Never just one.)",
        "  primary_trait          (single RIASEC letter: R, I, A, S, E or C)",
        "  secondary_trait        (single RIASEC letter, different from primary)",
        "  numerical_required     (integer 1-5)",
        "  verbal_required        (integer 1-5)",
        "  discipline_required    (integer 1-5)",
        "  study_tolerance_required (integer 1-5: how much sustained study the path demands)",
        "  difficulty_level       (integer 1-5)",
        "  typical_degree_duration (integer years, e.g. 3, 4, 5)",
        "  recommended_higher_study (boolean)",
        "  work_life_balance      (integer 1-5, 5 = excellent balance)",
        "  income_growth          (integer 1-5)",
        "  job_market_demand      (integer 1-5)",
        "  research_orientation   (integer 1-5)",
        "  salary_min_inr         (integer: realistic ENTRY annual salary in India, INR)",
        "  salary_max_inr         (integer: realistic MID/SENIOR annual salary in India, INR)",
        "  education_path         (array of EXACTLY 4 short step strings, school -> career)",
        "  top_recruiters         (array of EXACTLY 5 real Indian employer/firm names)",
        "  growth_outlook         (one of: 'High', 'Moderate', 'Low')",
        "",
        "Salaries must be annual INR integers (e.g. 600000 not '6 LPA'). Be realistic "
        "for the Indian market. Output valid JSON only.",
    ])


def _extract_json_array(text):
    """Pull the first balanced JSON array out of a model response."""
    start = text.find("[")
    if start == -1:
        return None
    depth = 0
    for i in range(start, len(text)):
        ch = text[i]
        if ch == "[":
            depth += 1
        elif ch == "]":
            depth -= 1
            if depth == 0:
                blob = text[start:i + 1]
                try:
                    return json.loads(blob)
                except json.JSONDecodeError:
                    return None
    return None


def call_cohere_batch(client, names, retry=True):
    prompt = _build_prompt(names)
    try:
        resp = client.chat(
            model=COHERE_MODEL,
            messages=[{"role": "user", "content": prompt}],
        )
        text = resp.message.content[0].text
    except Exception as exc:
        print(f"  [cohere] batch call failed ({exc})")
        return None
    data = _extract_json_array(text)
    if data is None and retry:
        print("  [cohere] unparseable JSON — retrying once with a stricter nudge")
        time.sleep(COHERE_SLEEP_S)
        return call_cohere_batch(client, names, retry=False)
    return data


# ---------------------------------------------------------------------------
# Validation / coercion (so a bad LLM value can never write NULL or crash engine)
# ---------------------------------------------------------------------------

RIASEC = {"R", "I", "A", "S", "E", "C"}
OUTLOOKS = {"High", "Moderate", "Low"}


def clamp_int(val, lo, hi, default):
    try:
        v = int(round(float(val)))
    except (TypeError, ValueError):
        return default
    return max(lo, min(hi, v))


def coerce_career(obj):
    """Return a fully-populated, engine-safe row dict, or None if unusable."""
    name = (obj.get("career_name") or "").strip()
    if not name:
        return None

    primary = str(obj.get("primary_trait", "")).strip().upper()[:1]
    secondary = str(obj.get("secondary_trait", "")).strip().upper()[:1]
    if primary not in RIASEC:
        primary = "I"
    if secondary not in RIASEC or secondary == primary:
        secondary = next(t for t in ["R", "I", "A", "S", "E", "C"] if t != primary)

    salary_min = clamp_int(obj.get("salary_min_inr"), 60000, 100000000, 300000)
    salary_max = clamp_int(obj.get("salary_max_inr"), salary_min, 200000000,
                           max(salary_min * 3, 900000))
    if salary_max < salary_min:
        salary_max = salary_min * 3

    growth = str(obj.get("growth_outlook", "")).strip().title()
    if growth not in OUTLOOKS:
        growth = "Moderate"

    steps = obj.get("education_path")
    if not isinstance(steps, list) or not steps:
        steps = ["Complete Class 10 with strong fundamentals",
                 "Choose the relevant stream in Class 11-12",
                 "Earn the required degree / qualification",
                 "Gain experience through internships and entry roles"]
    steps = [str(s).strip() for s in steps if str(s).strip()][:5]

    recruiters = obj.get("top_recruiters")
    if not isinstance(recruiters, list) or not recruiters:
        recruiters = ["Leading Indian employers", "MNCs", "Startups",
                      "Government bodies", "Consulting firms"]
    recruiters = [str(r).strip() for r in recruiters if str(r).strip()][:6]

    req_exam = str(obj.get("required_exam", "")).strip() or "Varies by institution / CUET"
    req_exam = req_exam[:255]

    return {
        "career_name": name[:150],
        "description": (str(obj.get("description", "")).strip() or None),
        "required_stream": (str(obj.get("required_stream", "")).strip()[:60] or "Any Stream"),
        "required_exam": req_exam,
        "primary_trait": primary,
        "secondary_trait": secondary,
        "numerical_required": clamp_int(obj.get("numerical_required"), 1, 5, 3),
        "verbal_required": clamp_int(obj.get("verbal_required"), 1, 5, 3),
        "discipline_required": clamp_int(obj.get("discipline_required"), 1, 5, 3),
        "study_tolerance_required": clamp_int(obj.get("study_tolerance_required"), 1, 5, 3),
        "difficulty_level": clamp_int(obj.get("difficulty_level"), 1, 5, 3),
        "typical_degree_duration": clamp_int(obj.get("typical_degree_duration"), 1, 8, 4),
        "recommended_higher_study": bool(obj.get("recommended_higher_study", False)),
        "work_life_balance": clamp_int(obj.get("work_life_balance"), 1, 5, 3),
        "income_growth": clamp_int(obj.get("income_growth"), 1, 5, 3),
        "job_market_demand": clamp_int(obj.get("job_market_demand"), 1, 5, 3),
        "research_orientation": clamp_int(obj.get("research_orientation"), 1, 5, 2),
        "salary_min_inr": salary_min,
        "salary_max_inr": salary_max,
        "education_path": json.dumps({"steps": steps}),
        "top_recruiters": recruiters,
        "growth_outlook": growth,
        "country_salary": json.dumps(build_country_salary(salary_min, salary_max, growth)),
        "data_source": DATA_SOURCE,
    }


INSERT_SQL = """
INSERT INTO career_profiles
    (career_name, description, required_stream, required_exam, primary_trait,
     secondary_trait, numerical_required, verbal_required, discipline_required,
     study_tolerance_required, difficulty_level, typical_degree_duration,
     recommended_higher_study, work_life_balance, income_growth,
     job_market_demand, research_orientation, salary_min_inr, salary_max_inr,
     education_path, top_recruiters, growth_outlook, country_salary, data_source)
VALUES
    (%(career_name)s, %(description)s, %(required_stream)s, %(required_exam)s,
     %(primary_trait)s, %(secondary_trait)s, %(numerical_required)s,
     %(verbal_required)s, %(discipline_required)s, %(study_tolerance_required)s,
     %(difficulty_level)s, %(typical_degree_duration)s, %(recommended_higher_study)s,
     %(work_life_balance)s, %(income_growth)s, %(job_market_demand)s,
     %(research_orientation)s, %(salary_min_inr)s, %(salary_max_inr)s,
     %(education_path)s::jsonb, %(top_recruiters)s, %(growth_outlook)s,
     %(country_salary)s::jsonb, %(data_source)s);
"""


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Expand career_profiles with Cohere.")
    ap.add_argument("--limit", type=int, default=len(TARGET_CAREERS),
                    help="max number of NEW careers to generate this run")
    args = ap.parse_args()

    print("=" * 70)
    print("STARSHIP — career_profiles expansion (AI-generated)")
    print("=" * 70)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM career_profiles;")
    start_count = cur.fetchone()[0]
    print(f"\nStart: {start_count} career profile(s)\n")

    print("[1/3] Ensuring schema ...")
    ensure_schema(cur)
    conn.commit()

    have = existing_career_names(cur)
    # Preserve order, drop already-present, cap to --limit, dedupe target list.
    todo, seen = [], set()
    for name in TARGET_CAREERS:
        key = name.lower()
        if key in have or key in seen:
            continue
        seen.add(key)
        todo.append(name)
    todo = todo[:args.limit]
    print(f"\n[2/3] {len(todo)} new career(s) to generate "
          f"({len(have)} already present, skipped)")

    if not todo:
        print("  Nothing to do — career_profiles already covers the target list.")
        _summary(cur, start_count)
        cur.close(); conn.close()
        return

    client = _cohere_client()
    if client is None:
        print("  [cohere] no client / API key — cannot generate. Aborting.")
        cur.close(); conn.close()
        return

    print("\n[3/3] Generating in batches of "
          f"{BATCH_SIZE} (max {COHERE_MAX_CALLS} Cohere calls) ...\n")

    inserted = existed = 0
    calls = 0
    skipped_batches = []  # list of career names whose batch was ultimately unparseable
    for i in range(0, len(todo), BATCH_SIZE):
        if calls >= COHERE_MAX_CALLS:
            print(f"  [cohere] hit COHERE_MAX_CALLS ({COHERE_MAX_CALLS}) — stopping early")
            break
        batch = todo[i:i + BATCH_SIZE]
        batch_num = (i // BATCH_SIZE) + 1
        print(f"  --- batch {batch_num}: {batch} ---")

        data = None
        for attempt in range(1, MAX_BATCH_RETRIES + 2):  # 1 original + 2 retries
            calls += 1
            data = call_cohere_batch(client, batch)
            if data:
                break
            if attempt <= MAX_BATCH_RETRIES:
                print(f"  [warn] batch {batch_num} attempt {attempt} produced no usable data — retrying ({attempt}/{MAX_BATCH_RETRIES})")
                time.sleep(COHERE_SLEEP_S)
            else:
                print(f"  [warn] batch {batch_num} failed after {MAX_BATCH_RETRIES + 1} attempts — skipping careers: {batch}")
                skipped_batches.extend(batch)

        if not data:
            time.sleep(1.5)
            continue

        for obj in data:
            row = coerce_career(obj) if isinstance(obj, dict) else None
            if row is None:
                continue
            cur.execute(
                "SELECT 1 FROM career_profiles WHERE lower(career_name) = lower(%s) LIMIT 1;",
                (row["career_name"],),
            )
            if cur.fetchone():
                existed += 1
                continue
            cur.execute(INSERT_SQL, row)
            inserted += 1
            print(f"    + {row['career_name']}  "
                  f"(₹{row['salary_min_inr']:,}–₹{row['salary_max_inr']:,}, "
                  f"{row['primary_trait']}/{row['secondary_trait']}, {row['growth_outlook']})")

        conn.commit()  # per batch, so a later rate-limit can't lose earlier work
        time.sleep(1.5)

    cur.execute("SELECT COUNT(*) FROM career_profiles;")
    total_now = cur.fetchone()[0]
    print(f"\nCareers inserted this run: {inserted}")
    print(f"Total careers now: {total_now}")
    print(f"Skipped batches: {len(skipped_batches)} ({skipped_batches if skipped_batches else 'none'})")
    _summary(cur, start_count)
    cur.close()
    conn.close()


def _summary(cur, start_count):
    cur.execute("SELECT COUNT(*) FROM career_profiles;")
    end_count = cur.fetchone()[0]
    cur.execute("SELECT data_source, COUNT(*) FROM career_profiles "
                "GROUP BY data_source ORDER BY 2 DESC;")
    breakdown = cur.fetchall()
    print("\n" + "=" * 70)
    print(f"career_profiles: {start_count} -> {end_count} ({end_count - start_count:+d})")
    print("data_source breakdown:")
    for src, n in breakdown:
        print(f"  {src or '(null)':<14} {n}")
    print("=" * 70)


if __name__ == "__main__":
    main()
