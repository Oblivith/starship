import psycopg2

def insert_career():
    try:
        conn = psycopg2.connect(
            host="localhost",
            database="career_counseling_system",
            user="postgres",
            password="7616",
            port="5432"
        )

        cur = conn.cursor()

        query = """
        INSERT INTO careers
        (career_name, category, min_education, duration_years,
         starting_salary_inr, salary_5yr_inr, automation_risk,
         future_demand_5yr, remote_possible)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        data = (
            "Data Analyst",
            "Technology",
            "B.Tech / B.Sc",
            3,
            500000,
            900000,
            3,
            "Growing",
            True
        )

        cur.execute(query, data)
        conn.commit()

        print("Career inserted successfully!")

        cur.close()
        conn.close()

    except Exception as e:
        print("Error:", e)


if __name__ == "__main__":
    insert_career()