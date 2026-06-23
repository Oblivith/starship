import os
import psycopg2
import cohere
from dotenv import load_dotenv
from config import DB_CONFIG

load_dotenv()

_client = cohere.ClientV2(api_key=os.getenv("COHERE_API_KEY"))


def fetch_unprocessed_raw():
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    cur.execute("""
        SELECT raw_id, raw_content
        FROM raw_data
        WHERE processed = false
        LIMIT 1
    """)
    row = cur.fetchone()
    cur.close()
    conn.close()
    return row


def extract_career_info(text):
    prompt = f"""You are a data extraction engine.

From the text below, extract structured career information.

Return ONLY valid JSON in this exact format:

{{
  "career_name": "",
  "category": "",
  "min_education": "",
  "duration_years": 0,
  "starting_salary_inr": 0,
  "salary_5yr_inr": 0,
  "automation_risk": 0,
  "future_demand_5yr": "",
  "remote_possible": true
}}

If information is missing, estimate reasonably.

TEXT:
{text[:4000]}"""

    response = _client.chat(
        model="command-r-plus-08-2024",
        messages=[{"role": "user", "content": prompt}],
    )
    return response.message.content[0].text


if __name__ == "__main__":
    row = fetch_unprocessed_raw()

    if not row:
        print("No unprocessed raw data found.")
    else:
        raw_id, raw_text = row
        print(f"Processing raw_id: {raw_id}")
        ai_output = extract_career_info(raw_text)
        print("\nAI OUTPUT:\n")
        print(ai_output)
