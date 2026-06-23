import requests
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="career_counseling_system",
    user="postgres",
    password="7616"
)

cur = conn.cursor()

url = "https://raw.githubusercontent.com/endSly/world-universities-csv/master/world-universities.csv"

response = requests.get(url)

lines = response.text.split("\n")

for line in lines[1:]:

    parts = line.split(",")

    if len(parts) < 2:
        continue

    country = parts[0].strip()
    university = parts[1].strip()

    cur.execute(
    """
    INSERT INTO universities(university_name, country)
    VALUES (%s,%s)
    ON CONFLICT DO NOTHING
    """,
    (university, country)
    )

conn.commit()

cur.close()
conn.close()

print("Global universities imported")