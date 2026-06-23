"""
scrapers/university_cutoffs.py  —  University admission-cutoff expansion

The university_cutoffs table shipped with only 3 hand-seeded rows, so the scoring
engine's "ADMISSION COMPETITIVENESS" / "ADMISSION PROBABILITY" blocks silently
fall back to a default competitiveness of 60 for almost every university. This
script expands that coverage with AI-estimated cutoffs for the top costed
universities, so admissions guidance has real data to lean on.

How the engine consumes this table (score_assessment.py, verified before writing):

    SELECT min_board_percentage
    FROM university_cutoffs uc
    JOIN universities u ON uc.university_id = u.university_id
    JOIN exams        e ON uc.exam_id       = e.exam_id
    WHERE u.university_name = %s          -- the matched university
      AND e.exam_name       = %s          -- career_profiles.required_exam
      AND uc.field_id       = %s;         -- programs.field_id for that career

    SELECT competitiveness_level FROM university_cutoffs uc
    JOIN universities u ON uc.university_id = u.university_id
    WHERE u.university_name = %s;

So a cutoff row is only EVER read if:
  - its exam_id resolves (via the exams table) to an exam_name that EXACTLY
    equals a career_profiles.required_exam string, AND
  - its field_id equals a programs.field_id used by some career.

The exams table only ships 4 rows, and most career_profiles.required_exam values
are compound strings ("JEE Main / JEE Advanced", "JEE / GATE (optional)", ...)
that aren't in it — so cutoffs keyed to a missing exam would be dead data. To make
this expansion genuinely consumable, the script ALSO idempotently seeds the exams
table with every exam_name the engine queries (ANCHORS below were derived directly
from the live (programs.field_id, career_profiles.required_exam) pairs).

Pipeline:
  1. ensure_schema  — add university_cutoffs.data_source (VARCHAR(30)) if missing;
     tag the pre-existing hand-seeded rows 'manual'.
  2. ensure_exams   — for every distinct exam_name in ANCHORS, INSERT into exams
     if absent (entrance / India); build {exam_name: exam_id}.
  3. target_universities — top 50 costed universities ordered by name (the rows
     with real data, per the brief). Universities that already have cutoff rows
     are skipped so the run resumes cleanly after a rate-limit stop.
  4. For each target university, ask Cohere (command-r-plus-08-2024) which broad
     academic categories it offers and a realistic (board %, entrance score,
     competitiveness 1-5) per category. Each offered category is expanded into the
     concrete (field_id, field_name, exam_name) leaf rows the engine queries, and
     written with INSERT ... ON CONFLICT (university_id, exam_id, field_name)
     DO NOTHING, data_source='ai_estimated'.

Safety / idempotency:
  - INSERT ... ON CONFLICT DO NOTHING on the (university_id, exam_id, field_name)
    unique key — never overwrites existing cutoffs; safe to re-run.
  - exams seeding is INSERT-if-absent; the 3 pre-existing cutoffs are untouched.
  - Commits per university, so a later Cohere rate-limit can't lose earlier work,
    and re-running picks up where it left off.

Run:
  python3 scrapers/university_cutoffs.py
  python3 scrapers/university_cutoffs.py --limit 50
"""

import os
import re
import sys
import time
import argparse

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

COHERE_MODEL = "command-r-plus-08-2024"
COHERE_SLEEP_S = 2.5      # be gentle with the trial rate limit
COHERE_MAX_CALLS = 60     # hard cap so one run can never exhaust the quota
DEFAULT_TARGET_LIMIT = 50


# ---------------------------------------------------------------------------
# ANCHORS — broad category -> the concrete (field_id, field_name, exam_name)
# leaf rows the engine actually queries. Derived directly from the live
# (programs.field_id, career_profiles.required_exam) pairs, so every row written
# here is reachable by the engine's cutoff join. exam_name strings MUST match
# career_profiles.required_exam verbatim.
# ---------------------------------------------------------------------------

ANCHORS = {
    "engineering": [
        (7,  "Mechanical Engineering",                      "JEE Advanced"),
        (9,  "Electrical Engineering",                       "JEE Advanced"),
        (21, "Civil Engineering",                            "JEE Main / JEE Advanced"),
        (22, "Aerospace Engineering",                        "JEE Advanced"),
        (23, "Chemical Engineering",                         "JEE Advanced"),
    ],
    "computer_science": [
        (8,  "Computer Science",                             "JEE / GATE (optional)"),
        (8,  "Computer Science",                             "JEE / SAT (optional)"),
        (24, "Information Technology",                       "JEE / GATE (optional)"),
        (25, "Electronics and Communication Engineering",   "JEE / GATE (optional)"),
        (29, "Mathematics",                                 "JEE / SAT (optional)"),
    ],
    "medical": [
        (10, "MBBS",                                         "NEET UG"),
    ],
    "dental": [
        (31, "Dentistry",                                   "NEET UG"),
    ],
    "nursing": [
        (32, "Nursing",                                     "NEET / BSc Nursing Entrance"),
    ],
    "pharmacy": [
        (15, "Pharmacy",                                    "NEET / D.Pharm Entrance"),
    ],
    "management": [
        (13, "Management",                                  "CAT / SPJIMR Sports Mgmt Entrance"),
        (13, "Management",                                  "CUET / CAT / University Entrance"),
        (40, "Physical Education",                          "CAT / SPJIMR Sports Mgmt Entrance"),
    ],
    "commerce": [
        (12, "Chartered Accountancy",                       "CA Foundation"),
        (4,  "Commerce",                                    "CA Foundation"),
        (37, "Economics",                                   "CUET / CAT / University Entrance"),
    ],
    "law": [
        (3,  "Law",                                         "CLAT"),
        (11, "Corporate Law",                               "CLAT"),
    ],
    "science": [
        (26, "Physics",                                     "UGC NET / CTET"),
        (27, "Chemistry",                                   "UGC NET / CTET"),
        (28, "Biology",                                     "CUET / University Entrance / GATE"),
        (30, "Environmental Science",                       "CUET / University Entrance / GATE"),
    ],
    "arts_humanities": [
        (5,  "Arts & Humanities",                           "UPSC CSE"),
        (33, "Political Science",                           "UPSC CSE"),
        (34, "Psychology",                                  "University Entrance / NIMHANS Entrance"),
        (35, "English Literature",                          "UGC NET / CTET"),
        (36, "Social Work",                                 "MSW Entrance / University Admission"),
    ],
    "architecture": [
        (14, "Architecture",                                "NATA / JEE Paper 2"),
    ],
    "agriculture": [
        (16, "Agriculture",                                 "ICAR AIEEA / CUET"),
    ],
    "design": [
        (19, "Design",                                      "NID Entrance / Portfolio-based Admission"),
        (38, "Fashion Design",                              "NID Entrance / NIFT Entrance"),
        (39, "Fine Arts",                                   "NID Entrance / Portfolio-based Admission"),
    ],
    "mass_communication": [
        (18, "Mass Communication",                          "IIMC Entrance / Mass Media Entrance"),
    ],
    "hospitality": [
        (20, "Hospitality",                                 "NCHM JEE"),
    ],
    "education": [
        (17, "Education",                                   "UGC NET / CTET"),
        (29, "Mathematics",                                 "UGC NET / CTET"),
    ],
}

CATEGORY_ORDER = list(ANCHORS.keys())


# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_conn():
    return psycopg2.connect(**config.DB_CONFIG)


def ensure_schema(cur):
    """Add data_source if missing; label the pre-existing hand-seeded rows."""
    cur.execute(
        "ALTER TABLE university_cutoffs ADD COLUMN IF NOT EXISTS data_source VARCHAR(30);"
    )
    cur.execute(
        "UPDATE university_cutoffs SET data_source = 'manual' WHERE data_source IS NULL;"
    )
    print(f"  [schema] data_source column ready; "
          f"{cur.rowcount} pre-existing cutoff row(s) tagged 'manual'")


def ensure_exams(cur):
    """Make sure every exam_name used in ANCHORS exists in the exams table.

    Returns {exam_name: exam_id}. New exams are seeded as entrance/India so the
    engine's `JOIN exams e ON uc.exam_id = e.exam_id WHERE e.exam_name = ...`
    can resolve every cutoff this script writes.
    """
    wanted = sorted({exam for rows in ANCHORS.values() for (_fid, _fn, exam) in rows})
    cur.execute("SELECT exam_name, exam_id FROM exams;")
    existing = {name: eid for name, eid in cur.fetchall()}

    seeded = 0
    mapping = {}
    for name in wanted:
        if name in existing:
            mapping[name] = existing[name]
            continue
        cur.execute(
            """
            INSERT INTO exams (exam_name, exam_type, conducting_body, country)
            VALUES (%s, 'entrance', 'Various', 'India')
            RETURNING exam_id;
            """,
            (name,),
        )
        mapping[name] = cur.fetchone()[0]
        seeded += 1
    print(f"  [exams] {len(wanted)} exam name(s) required; "
          f"{seeded} newly seeded, {len(wanted) - seeded} already present")
    return mapping


def target_universities(cur, limit):
    """Top `limit` costed universities by name (the rows with real data)."""
    cur.execute(
        """
        SELECT university_id, university_name, state
        FROM universities
        WHERE total_annual_cost_inr IS NOT NULL
        ORDER BY university_name
        LIMIT %s;
        """,
        (limit,),
    )
    return cur.fetchall()


def has_cutoffs(cur, university_id):
    cur.execute(
        "SELECT 1 FROM university_cutoffs WHERE university_id = %s LIMIT 1;",
        (university_id,),
    )
    return cur.fetchone() is not None


# ---------------------------------------------------------------------------
# Cohere — per-university category cutoffs
# ---------------------------------------------------------------------------

def _cohere_client():
    if cohere is None:
        return None
    key = config.COHERE_API_KEY
    if not key:
        return None
    return cohere.ClientV2(api_key=key)


def _build_prompt(university_name, state):
    loc = f" in {state}" if state else ""
    cats = ", ".join(CATEGORY_ORDER)
    return "\n".join([
        f'You are an expert on Indian university admissions. For "{university_name}"'
        f"{loc}, decide which broad academic categories it actually offers and give "
        "a realistic admission cutoff for each.",
        "",
        "Output ONE line per category the university offers, in EXACTLY this format:",
        "  category|min_board_percentage|min_exam_score|competitiveness_level",
        "",
        "Where:",
        "  - category is one of: " + cats,
        "  - min_board_percentage: integer 0-100 (typical class-12 % a candidate needs)",
        "  - min_exam_score: integer (representative entrance cutoff — a percentile for "
        "JEE/CAT-type exams, or marks for NEET-type exams)",
        "  - competitiveness_level: integer 1-5, where 5 = extremely competitive "
        "(IIT/AIIMS/top-NLU tier) and 1 = easy admission",
        "",
        "Only output categories this university genuinely offers. No headers, no prose, "
        "no extra text — just the pipe-delimited lines.",
    ])


_LINE_RE = re.compile(
    r"([a-z_]+)\s*\|\s*(\d+)\s*\|\s*(\d+)\s*\|\s*(\d+)", re.IGNORECASE
)


def parse_categories(text):
    """Parse 'category|board|score|comp' lines into a dict keyed by category."""
    out = {}
    for m in _LINE_RE.finditer(text):
        cat = m.group(1).strip().lower()
        if cat not in ANCHORS:
            continue
        board = max(0, min(100, int(m.group(2))))
        score = int(m.group(3))
        comp = max(1, min(5, int(m.group(4))))
        if not (0 < score <= 100000):
            score = None
        out[cat] = (board, score, comp)
    return out


def insert_cutoffs(cur, university_id, categories, exam_ids):
    """Expand each offered category into its leaf field/exam cutoff rows."""
    inserted = 0
    for cat, (board, score, comp) in categories.items():
        for field_id, field_name, exam_name in ANCHORS[cat]:
            exam_id = exam_ids.get(exam_name)
            if exam_id is None:
                continue
            cur.execute(
                """
                INSERT INTO university_cutoffs
                    (university_id, exam_id, field_name, min_board_percentage,
                     min_exam_score, competitiveness_level, field_id, data_source)
                VALUES (%s, %s, %s, %s, %s, %s, %s, 'ai_estimated')
                ON CONFLICT (university_id, exam_id, field_name) DO NOTHING;
                """,
                (university_id, exam_id, field_name, board, score, comp, field_id),
            )
            inserted += cur.rowcount
    return inserted


def estimate_with_cohere(conn, cur, universities, exam_ids):
    client = _cohere_client()
    if client is None:
        print("  [cohere] no client / API key — cannot estimate cutoffs")
        return 0, 0

    total_inserted = 0
    processed = 0
    calls = 0
    for uid, uname, state in universities:
        if has_cutoffs(cur, uid):
            print(f"  [skip] {uname[:48]:<48} already has cutoffs")
            continue
        if calls >= COHERE_MAX_CALLS:
            print(f"  [cohere] hit COHERE_MAX_CALLS ({COHERE_MAX_CALLS}) — stopping")
            break

        prompt = _build_prompt(uname, state)
        calls += 1
        try:
            resp = client.chat(
                model=COHERE_MODEL,
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.message.content[0].text
        except Exception as exc:  # network / rate-limit / quota
            print(f"  [cohere] call {calls} failed for {uname[:40]} ({exc}) — stopping")
            break

        cats = parse_categories(text)
        if not cats:
            print(f"  [warn] {uname[:48]:<48} no parseable categories — skipped")
            time.sleep(COHERE_SLEEP_S)
            continue

        n = insert_cutoffs(cur, uid, cats, exam_ids)
        conn.commit()  # per-university, so a later failure can't lose this work
        total_inserted += n
        processed += 1
        print(f"  [ok]   {uname[:48]:<48} {len(cats):>2} categories -> {n:>2} rows")
        time.sleep(COHERE_SLEEP_S)

    return total_inserted, processed


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser(description="Expand university_cutoffs with AI estimates.")
    ap.add_argument("--limit", type=int, default=DEFAULT_TARGET_LIMIT,
                    help="number of top costed universities to target (default 50)")
    args = ap.parse_args()

    print("=" * 70)
    print("STARSHIP — university cutoffs expansion (AI-estimated)")
    print("=" * 70)

    conn = get_conn()
    cur = conn.cursor()

    cur.execute("SELECT COUNT(*) FROM university_cutoffs;")
    rows0 = cur.fetchone()[0]
    print(f"\nStart: {rows0} cutoff row(s)\n")

    print("[1/4] Ensuring schema ...")
    ensure_schema(cur)
    conn.commit()

    print("\n[2/4] Ensuring exams reference rows ...")
    exam_ids = ensure_exams(cur)
    conn.commit()

    print(f"\n[3/4] Selecting top {args.limit} costed universities ...")
    universities = target_universities(cur, args.limit)
    print(f"  {len(universities)} target university row(s)")

    print("\n[4/4] Cohere cutoff estimation ...")
    inserted, processed = estimate_with_cohere(conn, cur, universities, exam_ids)

    cur.execute("SELECT COUNT(*) FROM university_cutoffs;")
    rows1 = cur.fetchone()[0]
    cur.execute(
        "SELECT data_source, COUNT(*) FROM university_cutoffs "
        "GROUP BY data_source ORDER BY 2 DESC;"
    )
    breakdown = cur.fetchall()
    cur.execute(
        "SELECT COUNT(DISTINCT university_id) FROM university_cutoffs;"
    )
    distinct_unis = cur.fetchone()[0]

    print("\n" + "=" * 70)
    print(f"Done: {rows1} cutoff rows ({rows1 - rows0:+d}); "
          f"{inserted} inserted this run across {processed} universit(y/ies)")
    print(f"Cutoffs now span {distinct_unis} distinct universities.")
    print("data_source breakdown:")
    for src, n in breakdown:
        print(f"  {src or '(null)':<14} {n}")
    print("=" * 70)

    cur.close()
    conn.close()


if __name__ == "__main__":
    main()
