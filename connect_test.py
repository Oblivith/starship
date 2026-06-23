print("Script started")

import psycopg2

try:
    print("Trying to connect...")

    conn = psycopg2.connect(
        host="localhost",
        database="career_counseling_system",
        user="postgres",
        password="7616",
        port="5432"
    )

    print("Connection established")

    cur = conn.cursor()
    cur.execute("SELECT version();")
    db_version = cur.fetchone()

    print("Connected successfully!")
    print("Database version:", db_version)

    cur.close()
    conn.close()

except Exception as e:
    print("Error occurred:", e)