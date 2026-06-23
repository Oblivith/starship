import json
import psycopg2
from psycopg2.extras import execute_values
from collections import defaultdict

# ----------------------------
# DATABASE CONFIG
# ----------------------------

DB_CONFIG = {
    "host": "localhost",
    "database": "career_counseling_system",
    "user": "postgres",
    "password": "7616",
    "port": "5432"
}

# ----------------------------
# LOAD JSON
# ----------------------------

with open("question_bank_v2.json", "r", encoding="utf-8") as f:
    questions = json.load(f)

# ----------------------------
# CONNECT DB
# ----------------------------

conn = psycopg2.connect(**DB_CONFIG)
cur = conn.cursor()

# ----------------------------
# VALIDATION
# ----------------------------

VALID_SECTIONS = {
    "interest",
    "behavioral",
    "constraints",
    "numerical",
    "logical",
    "analytical",
    "verbal"
}

VALID_TYPES = {
    "likert",
    "mcq"
}

# ----------------------------
# RESET TABLES (OPTIONAL)
# ----------------------------

RESET_DATABASE = True

if RESET_DATABASE:

    cur.execute("""
        TRUNCATE TABLE
            student_question_responses_v2,
            question_trait_weights_v2,
            assessment_options_v2,
            assessment_questions_v2
        RESTART IDENTITY CASCADE;
    """)

    conn.commit()

    print("✅ Existing assessment V2 data cleared")

# ----------------------------
# INSERT QUERIES
# ----------------------------

question_insert_query = """
INSERT INTO assessment_questions_v2 (
    question_text,
    section,
    question_type,
    difficulty,
    reverse_scored,
    expected_time_seconds
)
VALUES (%s, %s, %s, %s, %s, %s)
RETURNING question_id;
"""

option_insert_query = """
INSERT INTO assessment_options_v2 (
    question_id,
    option_text,
    option_value,
    is_correct
)
VALUES %s;
"""

trait_insert_query = """
INSERT INTO question_trait_weights_v2 (
    question_id,
    trait_name,
    weight
)
VALUES %s;
"""

# ----------------------------
# ANALYTICS
# ----------------------------

section_counts = defaultdict(int)
trait_usage = defaultdict(int)

# ----------------------------
# IMPORT LOOP
# ----------------------------

for idx, question in enumerate(questions, start=1):

    required_fields = [
        "question_text",
        "section",
        "question_type",
        "trait_weights",
        "options"
    ]

    for field in required_fields:
        if field not in question:
            raise Exception(f"Missing field '{field}' in question #{idx}")

    if question["section"] not in VALID_SECTIONS:
        raise Exception(
            f"Invalid section '{question['section']}' in question #{idx}"
        )

    if question["question_type"] not in VALID_TYPES:
        raise Exception(
            f"Invalid question_type '{question['question_type']}' in question #{idx}"
        )

    options = question["options"]

    if len(options) < 2:
        raise Exception(f"Question #{idx} has too few options")

    # MCQ validation
    if question["question_type"] == "mcq":

        correct_count = sum(
            1 for o in options if o.get("is_correct") is True
        )

        if correct_count != 1:
            raise Exception(
                f"MCQ question #{idx} must have exactly 1 correct option"
            )

    # ----------------------------
    # INSERT QUESTION
    # ----------------------------

    cur.execute(
        question_insert_query,
        (
            question["question_text"],
            question["section"],
            question["question_type"],
            question.get("difficulty"),
            question.get("reverse_scored", False),
            question.get("expected_time_seconds")
        )
    )

    question_id = cur.fetchone()[0]

    # ----------------------------
    # INSERT OPTIONS
    # ----------------------------

    option_rows = []

    for option in options:

        option_rows.append((
            question_id,
            option["text"],
            option["value"],
            option.get("is_correct", False)
        ))

    execute_values(
        cur,
        option_insert_query,
        option_rows
    )

    # ----------------------------
    # INSERT TRAITS
    # ----------------------------

    trait_rows = []

    for trait_name, weight in question["trait_weights"].items():

        trait_rows.append((
            question_id,
            trait_name,
            weight
        ))

        trait_usage[trait_name] += 1

    execute_values(
        cur,
        trait_insert_query,
        trait_rows
    )

    # ----------------------------
    # ANALYTICS
    # ----------------------------

    section_counts[question["section"]] += 1

# ----------------------------
# COMMIT
# ----------------------------

conn.commit()

# ----------------------------
# SUMMARY
# ----------------------------

print("\n✅ IMPORT COMPLETE")
print("=" * 40)

print("\nSECTION COUNTS")
for section, count in sorted(section_counts.items()):
    print(f"{section}: {count}")

print("\nTRAIT COVERAGE")
for trait, count in sorted(trait_usage.items()):
    print(f"{trait}: {count}")

print(f"\nTOTAL QUESTIONS: {sum(section_counts.values())}")

# ----------------------------
# CLOSE
# ----------------------------

cur.close()
conn.close()

print("\n✅ Database connection closed")