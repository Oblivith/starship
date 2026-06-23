import psycopg2
import re

DB_PASSWORD = "7616"

def fetch_unprocessed_raw():
    conn = psycopg2.connect(
        host="localhost",
        database="career_counseling_system",
        user="postgres",
        password=DB_PASSWORD,
        port="5432"
    )
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


def extract_salary(text):
    salaries = re.findall(r'\d{1,2},?\d{0,2},?\d{0,3}', text)
    numbers = [int(s.replace(",", "")) for s in salaries if len(s) > 4]
    return max(numbers) if numbers else 500000


def extract_duration(text):
    match = re.search(r'(\d+)\s+years?', text.lower())
    return int(match.group(1)) if match else 3


def extract_education(text):
    degrees = ["B.Tech", "BSc", "MBA", "M.Tech", "Diploma"]
    for d in degrees:
        if d.lower() in text.lower():
            return d
    return "Bachelor's Degree"


def process_raw():
    row = fetch_unprocessed_raw()

    if not row:
        print("No unprocessed data found.")
        return

    raw_id, text = row

    salary = extract_salary(text)
    duration = extract_duration(text)
    education = extract_education(text)

    conn = psycopg2.connect(
        host="localhost",
        database="career_counseling_system",
        user="postgres",
        password=DB_PASSWORD,
        port="5432"
    )
    cur = conn.cursor()

    cur.execute("""
        INSERT INTO careers
        (career_name, category, min_education, duration_years,
         starting_salary_inr, salary_5yr_inr,
         automation_risk, future_demand_5yr, remote_possible)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
    """, (
        "Extracted Career",
        "General",
        education,
        duration,
        salary,
        int(salary * 1.5),
        3,
        "Stable",
        True
    ))

    cur.execute("""
        UPDATE raw_data
        SET processed = true
        WHERE raw_id = %s
    """, (raw_id,))

    conn.commit()
    cur.close()
    conn.close()

    print("Raw data processed and inserted into careers.")


if __name__ == "__main__":
    process_raw()