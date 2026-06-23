import requests
import psycopg2
import csv
from io import StringIO

conn = psycopg2.connect(
    host="localhost",
    database="career_counseling_system",
    user="postgres",
    password="7616"
)

cur = conn.cursor()

url = "https://raw.githubusercontent.com/Hipo/university-domains-list/master/world_universities_and_domains.json"

response = requests.get(url)
data = response.json()

for uni in data:
    university = uni["name"]
    country = uni["country"]

    cur.execute("""
        INSERT INTO qs_rankings (qs_rank, university_name, country)
        VALUES (%s,%s,%s)
        ON CONFLICT DO NOTHING
    """, (None, university, country))

conn.commit()

cur.close()
conn.close()

print("University dataset imported")