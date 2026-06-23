import psycopg2
import re


def normalize_name(name):

    name = name.lower()

    name = re.sub(r'[^a-z0-9 ]', '', name)

    name = re.sub(
        r'\b(university|college|institute|of|the|at)\b',
        '',
        name
    )

    name = re.sub(r'\s+', ' ', name).strip()

    return name


conn = psycopg2.connect(
    host="localhost",
    database="career_counseling_system",
    user="postgres",
    password="7616"
)

cur = conn.cursor()

cur.execute("""
SELECT university_id, university_name
FROM universities
""")

rows = cur.fetchall()

for uid, name in rows:

    normalized = normalize_name(name)

    cur.execute("""
    UPDATE universities
    SET normalized_name = %s
    WHERE university_id = %s
    """, (normalized, uid))

conn.commit()

print("Normalization complete.")

cur.close()
conn.close()