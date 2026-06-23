import requests
from bs4 import BeautifulSoup
import psycopg2

conn = psycopg2.connect(
    host="localhost",
    database="career_counseling_system",
    user="postgres",
    password="7616"
)

cur = conn.cursor()

url = "https://www.topuniversities.com/university-rankings/world-university-rankings/2024"

headers = {
    "User-Agent": "Mozilla/5.0"
}

response = requests.get(url, headers=headers)

soup = BeautifulSoup(response.text, "lxml")

rows = soup.select("tbody tr")

for row in rows:

    rank_tag = row.select_one(".rank")
    name_tag = row.select_one(".uni-link")

    if not rank_tag or not name_tag:
        continue

    rank = rank_tag.text.strip().replace("=", "")
    university = name_tag.text.strip()

    normalized = university.lower()

    cur.execute("""
    UPDATE universities
    SET qs_rank = %s
    WHERE normalized_name LIKE %s
    """, (rank, f"%{normalized}%"))

conn.commit()

cur.close()
conn.close()

print("QS rankings imported")