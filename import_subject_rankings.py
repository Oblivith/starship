import csv
import psycopg2
import re


DB_CONFIG = {
    "host": "localhost",
    "database": "career_counseling_system",
    "user": "postgres",
    "password": "7616"
}


def normalize_name(name):
    name = name.lower()
    name = re.sub(r'[^a-z0-9 ]', '', name)
    name = re.sub(r'\b(university|college|institute|of|the)\b', '', name)
    name = re.sub(r'\s+', ' ', name).strip()
    return name


def get_connection():
    return psycopg2.connect(**DB_CONFIG)


def load_university_map(cur):
    cur.execute("""
        SELECT university_id, normalized_name
        FROM universities
        WHERE normalized_name IS NOT NULL
    """)

    rows = cur.fetchall()

    return {name: uid for uid, name in rows}

    for uid, name in universities:

        if normalize_name(name) == normalized_name:
            return uid

    return None


def import_rankings(csv_file, field_id):

    university_map = load_university_map(cur)
    conn = get_connection()
    cur = conn.cursor()

    inserted = 0
    skipped = 0

    with open(csv_file, newline='', encoding="utf-8") as file:

        reader = csv.DictReader(file)

        for row in reader:

            university_name = row["university"]
            qs_rank = row.get("qs_rank")
            times_rank = row.get("times_rank")
            nirf_rank = row.get("nirf_rank")

            normalized = normalize_name(university_name)

            university_id = university_map.get(normalized)

            if not university_id:
                skipped += 1
                continue

            cur.execute("""
                INSERT INTO university_subject_rankings
                (university_id, field_id, qs_subject_rank, times_subject_rank, nirf_subject_rank)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (university_id, field_id)
                DO UPDATE SET
                qs_subject_rank = EXCLUDED.qs_subject_rank,
                times_subject_rank = EXCLUDED.times_subject_rank,
                nirf_subject_rank = EXCLUDED.nirf_subject_rank
            """, (
                university_id,
                field_id,
                qs_rank if qs_rank else None,
                times_rank if times_rank else None,
                nirf_rank if nirf_rank else None
            ))

            inserted += 1

    conn.commit()

    print("\nIMPORT COMPLETE")
    print("Inserted/Updated:", inserted)
    print("Skipped (not matched):", skipped)

    cur.close()
    conn.close()


if __name__ == "__main__":

    csv_file = "mechanical_rankings.csv"

    # example: Mechanical Engineering field_id
    field_id = 7

    import_rankings(csv_file, field_id)