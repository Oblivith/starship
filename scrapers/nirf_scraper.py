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

url = "https://www.nirfindia.org/2023/UniversityRanking.html"

response = requests.get(url)
html = response.text

# store raw HTML
cur.execute(
"""
INSERT INTO raw_data(source_type, source_url, raw_content)
VALUES (%s,%s,%s)
""",
("nirf", url, html)
)

conn.commit()

soup = BeautifulSoup(html, "lxml")

table = soup.find("table")

if table:
    rows = table.find_all("tr")

    for row in rows[1:]:

        cols = row.find_all("td")

        if len(cols) < 2:
            continue

        rank = cols[0].text.strip()
        name = cols[1].text.strip()

        cur.execute(
        """
        INSERT INTO universities(university_name, nirf_rank, country)
        VALUES (%s,%s,%s)
        ON CONFLICT DO NOTHING
        """,
        (name, rank, "India")
        )

conn.commit()

cur.close()
conn.close()

print("NIRF scrape complete")