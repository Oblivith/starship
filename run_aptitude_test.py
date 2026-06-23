import psycopg2


conn = psycopg2.connect(
    host="localhost",
    database="career_counseling_system",
    user="postgres",
    password="7616"
)

cur = conn.cursor()

print("\n===== CAREER APTITUDE TEST =====\n")


student_id = input("Enter student ID for this test: ")

cur.execute("""
SELECT question_id, question_text
FROM assessment_questions_v2
ORDER BY question_id
""")

questions = cur.fetchall()


for qid, qtext in questions:

    print("\n--------------------------------")
    print(qtext)

    cur.execute("""
    SELECT option_id, option_text
    FROM assessment_options_v2
    WHERE question_id = %s
    ORDER BY option_id
    """, (qid,))

    options = cur.fetchall()

    for oid, otext in options:
        print(f"{oid}. {otext}")

    answer = input("Select option ID: ")

    cur.execute("""
    INSERT INTO student_question_responses_v2
    (student_id, question_id, selected_option_id)
    VALUES (%s,%s,%s)
    """, (student_id, qid, answer))


conn.commit()

print("\nTest completed.")

cur.close()
conn.close()