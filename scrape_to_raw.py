import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
import psycopg2
import requests
from bs4 import BeautifulSoup

DB_PASSWORD = "7616"

def scrape_and_store(url, source_type):
    try:
        # Fetch webpage
        response = requests.get(url, verify=False)
        soup = BeautifulSoup(response.text, "html.parser")

        # Extract visible text
        text_content = soup.get_text(separator="\n")

        # Connect to DB
        conn = psycopg2.connect(
            host="localhost",
            database="career_counseling_system",
            user="postgres",
            password=DB_PASSWORD,
            port="5432"
        )

        cur = conn.cursor()

        # Insert into raw_data
        cur.execute("""
            INSERT INTO raw_data (source_type, source_url, raw_content)
            VALUES (%s, %s, %s)
        """, (source_type, url, text_content))

        conn.commit()

        print("Raw data stored successfully!")

        cur.close()
        conn.close()

    except Exception as e:
        print("Error:", e)


if __name__ == "__main__":
    test_url = "https://example.com"
    scrape_and_store(test_url, "test")