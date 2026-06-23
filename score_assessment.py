import psycopg2
from collections import defaultdict
from config import DB_CONFIG

def run_career_engine(student_id):

    university_financials = []
    all_found_universities = []   # tracks every university found, regardless of scholarship data
    matched_scholarships = []     # surfaced to payload: the eligible scholarship list the engine already builds

    conn = psycopg2.connect(**DB_CONFIG)

    cur = conn.cursor()


    # ------------------------------
    # V2 WEIGHTED SCORING ENGINE
    # ------------------------------

    cur.execute("""
        SELECT
            sqr.question_id,
            ao.option_value,
            aq.reverse_scored,
            aq.question_type

        FROM student_question_responses_v2 sqr

        JOIN assessment_options_v2 ao
            ON sqr.selected_option_id = ao.option_id

        JOIN assessment_questions_v2 aq
            ON sqr.question_id = aq.question_id

        WHERE sqr.student_id = %s
    """, (student_id,))

    responses = cur.fetchall()

    scores = defaultdict(float)
    question_counts = defaultdict(int)
    max_possible_scores = defaultdict(float)  # tracks per-trait max (1 for mcq, 5 for likert)

    for question_id, option_value, reverse_scored, question_type in responses:

        # Reverse scoring for behavioral questions
        if reverse_scored:
            option_value = 6 - option_value

        cur.execute("""
            SELECT
                trait_name,
                weight
            FROM question_trait_weights_v2
            WHERE question_id = %s
        """, (question_id,))

        trait_rows = cur.fetchall()

        for trait_name, weight in trait_rows:

            contribution = float(option_value) * float(weight)

            scores[trait_name] += contribution

            question_counts[trait_name] += 1

            max_option = 1.0 if question_type == 'mcq' else 5.0
            max_possible_scores[trait_name] += max_option * float(weight)

    # ------------------------------
    # NORMALIZATION
    # ------------------------------

    normalized_scores = {}

    for trait, raw_score in scores.items():

        max_possible = max_possible_scores[trait]  # per-trait max: mcq→count×1, likert→count×5

        if max_possible > 0:
            normalized_scores[trait] = round((raw_score / max_possible) * 100, 2)
        else:
            normalized_scores[trait] = 0

    scores = normalized_scores

        # ------------------------------
    # CONFIDENCE SCORING
    # ------------------------------
    # Labels reflect actual performance level (normalized score), not question count.
    # Old code used question_counts which caused: 14-16 question traits → "High" even at 65%
    # accuracy, and 3-question traits like study_tolerance → "Low" even with all-high answers.

    confidence_scores = {}

    for trait, score in normalized_scores.items():

        if score >= 70:
            confidence = "High"

        elif score >= 45:
            confidence = "Average"

        else:
            confidence = "Low"

        confidence_scores[trait] = confidence

        # ------------------------------
    # TEMP COMPATIBILITY MAPPING
    # ------------------------------

    scores['R'] = scores.get('realistic_interest', 0)
    scores['I'] = scores.get('investigative_interest', 0)
    scores['A'] = scores.get('artistic_interest', 0)
    scores['S'] = scores.get('social_interest', 0)
    scores['E'] = scores.get('enterprising_interest', 0)
    scores['C'] = scores.get('conventional_interest', 0)

    scores['numerical'] = scores.get('numerical_reasoning', 0)
    scores['logical'] = scores.get('logical_reasoning', 0)
    scores['verbal'] = scores.get('verbal_reasoning', 0)
    scores['analytical'] = scores.get('analytical_reasoning', 0)

    print("\n===== STUDENT CAREER PROFILE =====\n")

    for dimension, score in sorted(scores.items()):
        print(f"{dimension}: {score}")

    # 🔹 Determine dominant RIASEC
    # Short codes ('R','I','A','S','E','C') are used so that primary_trait/secondary_trait
    # values stored in career_profiles (which use the same short-code convention) match correctly.
    # Selection logic: traits are ranked by normalized score descending; top 2 are taken.
    # On a tie Python's stable sort preserves insertion order (alphabetical among tied entries).
    # Example: Social (80.0) > Conventional (71.43) == Artistic (71.43) → Social is always
    # included; the tied pair resolves to whichever sorts first alphabetically ('A' before 'C').
    riasec_traits = ['R', 'I', 'A', 'S', 'E', 'C']
    riasec_scores = {t: scores.get(t, 0) for t in riasec_traits}
    top_traits = sorted(riasec_scores, key=riasec_scores.get, reverse=True)[:2]

    print("\nDominant Interest Traits:", top_traits)

    # 🔹 Aptitude Summary
    aptitude_traits = [
    'numerical_reasoning',
    'logical_reasoning',
    'verbal_reasoning',
    'analytical_reasoning'
    ]
    aptitude_scores = {t: scores.get(t, 0) for t in aptitude_traits}
    print("\nAptitude Strengths:", aptitude_scores)

    # 🔹 Basic Career Mapping
    career_suggestions = []

    if 'I' in top_traits and scores.get('numerical_reasoning', 0) >= 2:
        career_suggestions.append("Engineering / Technology")

    if 'S' in top_traits and scores.get('discipline', 0) >= 2:
        career_suggestions.append("Medicine / Healthcare")

    if 'E' in top_traits and scores.get('leadership', 0) >= 1:
        career_suggestions.append("Business / Management")

    if 'A' in top_traits:
        career_suggestions.append("Design / Creative Fields")

    if 'C' in top_traits:
        career_suggestions.append("Government / Administration")

    print("\nSuggested Career Directions:")
    for c in career_suggestions[:3]:
        print("-", c)

    print("\n==================================\n")

    # Get student constraints
    cur.execute("""
        SELECT budget_max_inr, preferred_state, willing_to_relocate,
            annual_family_income_inr, twelfth_percentage, current_class
        FROM students
        WHERE student_id = %s;
    """, (student_id,))

    student_info = cur.fetchone()

    budget_max = student_info[0]
    preferred_state = student_info[1]
    willing_to_relocate = student_info[2]
    annual_family_income = student_info[3]
    twelfth_percentage = student_info[4]
    current_class = student_info[5]

    # Extract required scores for matching (must use full trait names, not the short aliases)
    numerical = scores.get("numerical_reasoning", 0)
    verbal = scores.get("verbal_reasoning", 0)

    discipline = scores.get("discipline", 0)
    study_tolerance = scores.get("study_tolerance", 0)
    exam_tolerance = scores.get("exam_tolerance", 0)

    print("\n===== CAREER MATCHING RESULTS =====")

    cur.execute("""
    SELECT
    career_id,
    career_name,
    primary_trait,
    secondary_trait,
    numerical_required,
    verbal_required,
    discipline_required,
    study_tolerance_required,
    required_exam,
    difficulty_level
    FROM career_profiles;
    """)
    careers = cur.fetchall()

    career_matches = []
    # Per-career primary RIASEC trait (short code, e.g. 'I'/'S') so the frontend can
    # badge and filter careers by category. This is the primary_trait the matching
    # loop already reads from career_profiles — captured here, never recomputed.
    career_categories = {}

    # ------------------------------
    # CONTINUOUS MATCH SCORING (0–100)
    # ------------------------------
    # Replaces the previous coarse integer point system (+3/+2/-2 …), which collapsed
    # 221 differentiated careers onto only ~5 distinct scores (≈50 careers tied at one
    # value) for two reasons: (1) it compared 0–100 normalized aptitude/discipline/study
    # scores against 1–5 career thresholds, so every comparison saturated to a per-student
    # CONSTANT (always-pass or always-fail) and stopped differentiating careers; (2)
    # `aptitude_scores.get("verbal")` read a key that does not exist (the real key is
    # "verbal_reasoning"), zeroing the verbal term for every career. The only surviving
    # differentiator was a binary "trait in top-2" bonus → 4 levels. The data in
    # career_profiles is in fact well differentiated, so the fix is in the math: grade
    # every dimension continuously on a shared 0–100 scale so the existing differentiation
    # is actually used and scores retain their natural spread.

    # Relative standing of each RIASEC trait within THIS student's own profile, so the
    # interest fit amplifies real preference differences (top trait → 100, weakest → 0;
    # neutral 50 for a perfectly flat profile, where there is genuinely no preference signal).
    _riasec_vals = {L: scores.get(L, 0) for L in riasec_traits}
    _lo, _hi = min(_riasec_vals.values()), max(_riasec_vals.values())
    riasec_relative = {
        L: (50.0 if _hi == _lo else (_riasec_vals[L] - _lo) / (_hi - _lo) * 100.0)
        for L in _riasec_vals
    }

    def _grade(student_value, required_1to5):
        # student_value is 0–100; required_1to5 is the career's 1–5 threshold.
        # Full marks when the student meets/exceeds the requirement; a linear,
        # percentage-point penalty for any shortfall. Clamped to 0–100.
        required = (required_1to5 or 3) * 20.0
        return max(0.0, min(100.0, 100.0 - (required - student_value)))

    def _trait_fit(letter):
        # Blend the student's absolute interest level with their relative standing,
        # so a strong-everywhere student still reads as a good match while real
        # preference ordering still spreads the careers apart.
        return 0.5 * scores.get(letter, 0) + 0.5 * riasec_relative.get(letter, 50.0)

    for career in careers:
        (
            career_id,
            career_name,
            primary_trait,
            secondary_trait,
            numerical_required,
            verbal_required,
            discipline_required,
            study_required,
            required_exam,
            difficulty
        ) = career

        career_categories[career_name] = primary_trait

        # ----- Interest fit (50%) -----
        # Graded by the student's actual standing on THIS career's primary/secondary
        # RIASEC traits (continuous), not a binary "is it in the top 2" flag.
        interest_fit = 0.65 * _trait_fit(primary_trait) + 0.35 * _trait_fit(secondary_trait)

        # ----- Aptitude fit (30%) -----
        # numerical / verbal are the student's 0–100 normalized reasoning scores.
        aptitude_fit = (
            0.5 * _grade(numerical, numerical_required)
            + 0.5 * _grade(verbal, verbal_required)
        )

        # ----- Readiness fit (20%) -----
        # Discipline + study tolerance vs the career's requirement, and exam tolerance
        # vs the career's difficulty_level (all graded continuously on the 0–100 scale).
        readiness_fit = (
            _grade(discipline, discipline_required)
            + _grade(study_tolerance, study_required)
            + _grade(exam_tolerance, difficulty)
        ) / 3.0

        # CA Foundation has no high-stakes single entrance exam — relax the readiness
        # weight slightly so exam-averse students aren't over-penalised for it (preserves
        # the intent of the old "CA Foundation" exemption without a hard −3 cliff).
        if required_exam == "CA Foundation":
            readiness_fit = max(readiness_fit, 60.0)

        score = round(
            0.50 * interest_fit + 0.30 * aptitude_fit + 0.20 * readiness_fit,
            1,
        )

        career_matches.append((career_name, score))

    # Sort
    career_matches.sort(key=lambda x: x[1], reverse=True)

    print("\nTop 3 Best Fits:")
    for career in career_matches[:3]:
        print("🟢", career[0], "| Score:", career[1])

    print("\nGood Alternatives:")
    for career in career_matches[3:5]:
        print("🟡", career[0], "| Score:", career[1])

    print("\nCareers To Avoid:")
    for career in career_matches[-2:]:
        print("🔴", career[0], "| Score:", career[1])

    print("\n===== ROADMAP RECOMMENDATIONS =====")

    # Scores are now a 0–100 match percentage; the two best matches drive the roadmap.
    top_careers = career_matches[:2]

    for career_name, career_score in top_careers:
        print(f"\nCareer Path: {career_name} (Score: {career_score})")
        # ----- CAREER STRATEGY LAYER -----

        cur.execute("""
        SELECT
            typical_degree_duration,
            recommended_higher_study,
            work_life_balance,
            income_growth,
            job_market_demand,
            research_orientation
        FROM career_profiles
        WHERE career_name = %s;
        """, (career_name,))

        strategy = cur.fetchone()

        if strategy:
            duration, higher_study, wlb, income, demand, research = strategy

            print("\n  ⚡ Career Strategy Insights")

            print(f"  ⏱ Typical Study Duration: {duration} years")

            if higher_study:
                print("  🎓 Higher Study: Masters or specialization often recommended")

            # Work-life balance
            if wlb >= 4:
                print("  🧘 Work-Life Balance: Generally balanced career")
            elif wlb >= 3:
                print("  🧘 Work-Life Balance: Moderate workload")
            else:
                print("  🧘 Work-Life Balance: Often high workload")

            # Income growth
            if income >= 4:
                print("  💰 Income Potential: Strong long-term growth")
            elif income >= 3:
                print("  💰 Income Potential: Stable career earnings")
            else:
                print("  💰 Income Potential: Moderate earnings")

            # Demand
            if demand >= 4:
                print("  📈 Job Market Demand: High demand in coming years")
            else:
                print("  📈 Job Market Demand: Moderate demand")

            # Research orientation
            if research >= 4:
                print("  🔬 Research Opportunities: Strong academic/research pathways available")

        # ----- EXAM INTELLIGENCE -----
        cur.execute("""
            SELECT required_exam
            FROM career_profiles
            WHERE career_name = %s;
        """, (career_name,))
        exam_result = cur.fetchone()

        if not exam_result:
            continue

        required_exam = exam_result[0]
        print(f"\n  Required Exam: {required_exam}")

        cur.execute("""
            SELECT difficulty_level
            FROM exams
            WHERE exam_name = %s;
        """, (required_exam,))
        exam_info = cur.fetchone()

        if exam_info:
            difficulty = exam_info[0]
            print(f"  Exam Difficulty (1-5): {difficulty}")

            if difficulty is not None and exam_tolerance < difficulty:
                print("  ⚠️ Student exam tolerance is lower than exam difficulty.")
                print("  Recommendation: Structured preparation required.")

        # ----- PROGRAM LAYER -----
        cur.execute("""
            SELECT DISTINCT program_name, field_id
            FROM programs
            WHERE career_id = (
                SELECT career_id
                FROM career_profiles
                WHERE career_name = %s
            );
        """, (career_name,))

        programs = cur.fetchall()

        for program_name, field_id in programs:

            # Get field name
            cur.execute("""
                SELECT field_name, parent_field_id
                FROM fields
                WHERE field_id = %s;
            """, (field_id,))
            field_info = cur.fetchone()

            field_name = field_info[0]
            parent_field_id = field_info[1]

            print(f"\n  Program: {program_name}")
            print(f"  Field: {field_name}")

            

            # ----- UNIVERSITY LAYER (EXACT FIELD MATCH) -----
            cur.execute("""
                SELECT DISTINCT
                    u.university_name,
                    u.state,
                    u.total_annual_cost_inr,
                    ufs.strength_score
                FROM universities u
                JOIN university_field_strength ufs
                    ON u.university_id = ufs.university_id
                JOIN university_exam_requirements uer
                    ON u.university_id = uer.university_id
                JOIN exams e
                    ON uer.exam_id = e.exam_id
                WHERE ufs.field_id = %s
                AND u.total_annual_cost_inr <= %s
                AND e.exam_name = %s
                AND (
                    u.state = %s
                    OR %s = TRUE
                )
                ORDER BY ufs.strength_score DESC,
                        u.total_annual_cost_inr ASC
                LIMIT 5;
            """, (field_id, budget_max, required_exam, preferred_state, willing_to_relocate))

            universities = cur.fetchall()

            # ----- FALLBACK TO PARENT FIELD -----
            if not universities and parent_field_id:

                cur.execute("""
                    SELECT DISTINCT
                        u.university_name,
                        u.state,
                        u.total_annual_cost_inr,
                        ufs.strength_score
                    FROM universities u
                    JOIN university_field_strength ufs
                        ON u.university_id = ufs.university_id
                    JOIN university_exam_requirements uer
                        ON u.university_id = uer.university_id
                    JOIN exams e
                        ON uer.exam_id = e.exam_id
                    WHERE ufs.field_id = %s
                    AND u.total_annual_cost_inr <= %s
                    AND e.exam_name = %s
                    AND (
                        u.state = %s
                        OR %s = TRUE
                    )
                    ORDER BY ufs.strength_score DESC,
                            u.total_annual_cost_inr ASC
                    LIMIT 5;
                """, (parent_field_id, budget_max, required_exam, preferred_state, willing_to_relocate))

                universities = cur.fetchall()

            # ----- FALLBACK: budget + state only (no field/exam join) -----
            # Triggered when university_exam_requirements or university_field_strength tables
            # are sparse (only 3 cutoff rows in DB). Matches on state and budget alone so
            # students always see real university options.
            if not universities:
                cur.execute("""
                    SELECT DISTINCT
                        u.university_name,
                        u.state,
                        u.total_annual_cost_inr,
                        50 AS strength_score
                    FROM universities u
                    WHERE (u.state = %s OR %s = TRUE)
                    AND (
                        u.total_annual_cost_inr IS NULL
                        OR u.total_annual_cost_inr <= %s
                    )
                    ORDER BY u.total_annual_cost_inr ASC NULLS LAST
                    LIMIT 5;
                """, (preferred_state, willing_to_relocate, budget_max or 999999999))
                universities = cur.fetchall()

            if not universities:
                print("    No universities match budget/location.")
                continue

            for uni_name, state, cost, strength in universities:
                all_found_universities.append({
                    "name": uni_name,
                    "state": state,
                    "cost": cost,
                    "strength": strength
                })

                print(f"    - {uni_name} ({state}) | Cost: {cost} | Strength: {strength}")

                # ----- SUBJECT-SPECIFIC RANKING LOOKUP -----

                cur.execute("""
                SELECT qs_subject_rank, times_subject_rank, nirf_subject_rank
                FROM university_subject_rankings
                WHERE university_id = (
                    SELECT university_id
                    FROM universities
                    WHERE university_name = %s
                    LIMIT 1
                )
                AND field_id = %s
                LIMIT 1;
                """, (uni_name, field_id))

                subject_rank_row = cur.fetchone()

                subject_prestige_score = None

                if subject_rank_row:

                    qs_subject_rank, times_subject_rank, nirf_subject_rank = subject_rank_row

                    subject_scores = []

                    if qs_subject_rank:
                        subject_scores.append(max(0, 100 - qs_subject_rank))

                    if times_subject_rank:
                        subject_scores.append(max(0, 100 - times_subject_rank))

                    if nirf_subject_rank:
                        subject_scores.append(max(0, 100 - nirf_subject_rank))

                    if subject_scores:
                        subject_prestige_score = sum(subject_scores) / len(subject_scores)

                        print(f"      🎓 Subject Prestige Score: {round(subject_prestige_score,2)}")

                            # ----- UNIVERSITY INTELLIGENCE SCORE -----

                cur.execute("""
                SELECT nirf_rank, qs_rank, times_rank,
                    median_package_inr, placement_rate_percent
                FROM universities
                WHERE university_name = %s
                LIMIT 1;
                """, (uni_name,))

                uni_data = cur.fetchone()

                prestige_score = subject_prestige_score if subject_prestige_score else 50
                placement_score = 50
                salary_score = 50
                affordability_score = 50

                if uni_data:

                    nirf_rank, qs_rank, times_rank, median_package, placement_rate = uni_data

                    prestige_values = []

                    if nirf_rank:
                        prestige_values.append(max(0, 100 - nirf_rank))

                    if qs_rank:
                        prestige_values.append(max(0, 100 - qs_rank))

                    if times_rank:
                        prestige_values.append(max(0, 100 - times_rank))

                    if prestige_values:
                        prestige_score = sum(prestige_values) / len(prestige_values)

                    if placement_rate:
                        placement_score = placement_rate

                    if median_package:
                        salary_score = median_package / 100000


                # Affordability
                if budget_max and cost:
                    affordability_score = max(0, 100 - (cost / budget_max) * 100)


                university_intelligence_score = (
                    prestige_score * 0.35 +
                    placement_score * 0.25 +
                    salary_score * 0.25 +
                    affordability_score * 0.15
                )

                print(f"      🧠 University Intelligence Score: {round(university_intelligence_score,2)}")

                print("      📊 Score Breakdown:")
                print(f"         Prestige Score: {round(prestige_score,2)}")
                print(f"         Placement Score: {round(placement_score,2)}")
                print(f"         Salary Score: {round(salary_score,2)}")
                print(f"         Affordability Score: {round(affordability_score,2)}")
                if subject_rank_row:
                    print("      📚 Subject Ranking Data Available")

                # ----- SCHOLARSHIPS -----
                cur.execute("""
                SELECT scholarship_name, amount_max_inr, competitiveness_level,
                       description, eligibility_criteria, provider,
                       stream_tags, deadline_month, application_url
                FROM scholarships
                WHERE (%s IS NULL OR income_limit_inr IS NULL OR %s <= income_limit_inr)
                AND (%s IS NULL OR min_percentage IS NULL OR %s >= min_percentage);
                """, (
                    annual_family_income,
                    annual_family_income,
                    twelfth_percentage,
                    twelfth_percentage
                ))

                eligible_scholarships = cur.fetchall()

                # Capture the already-matched scholarship list once so it can be returned
                # in the payload. The query depends only on student-level constants, so the
                # list is identical across loop iterations — no recompute, just surfacing.
                if eligible_scholarships and not matched_scholarships:
                    matched_scholarships = [
                        {
                            "name": name,
                            "amount_max_inr": amount,
                            "competitiveness_level": comp,
                            "description": desc,
                            "eligibility_criteria": elig,
                            "provider_name": prov,
                            "stream_tags": tags or [],
                            "deadline_month": deadline,
                            "application_url": url,
                        }
                        for name, amount, comp, desc, elig, prov, tags, deadline, url in eligible_scholarships
                    ]

                if eligible_scholarships:

                    high = []
                    medium = []
                    low = []
                    amounts = []

                    for name, amount, comp, *_ in eligible_scholarships:

                        if amount:
                            amounts.append(amount)

                        # competitiveness_level is NULL for some scholarship rows;
                        # treat unknown competitiveness as "highly competitive" (low bucket)
                        # rather than crashing the whole engine on a None comparison.
                        if comp is not None and comp <= 2:
                            high.append((name, amount))
                        elif comp == 3:
                            medium.append((name, amount))
                        else:
                            low.append((name, amount))

                    if high:
                        print("      🟢 High Probability Scholarships:")
                        for name, amount in high:
                            print(f"         - {name} (Up to ₹{amount})")

                    if medium:
                        print("      🟡 Moderate Probability Scholarships:")
                        for name, amount in medium:
                            print(f"         - {name} (Up to ₹{amount})")

                    if low:
                        print("      🔴 Highly Competitive Scholarships:")
                        for name, amount in low:
                            print(f"         - {name} (Up to ₹{amount})")

                    if amounts:
                        max_coverage = int(cost * 0.7)

                        conservative_support = min(max(amounts), max_coverage)
                        optimistic_support = min(sum(sorted(amounts, reverse=True)[:2]), max_coverage)

                        conservative_net = max(cost - conservative_support, 0)

                        print(f"      💰 Conservative Estimate: ₹{conservative_net}")
                        print(f"      💰 Optimistic Estimate: ₹{max(cost - optimistic_support, 0)}")

                        if annual_family_income and annual_family_income > 0:

                            affordability_ratio = conservative_net / annual_family_income
                            university_financials.append(
                                (uni_name, conservative_net, affordability_ratio)
                            )

                            if affordability_ratio <= 0.25:
                                risk_label = "🟢 Low Financial Risk"
                            elif affordability_ratio <= 0.5:
                                risk_label = "🟡 Moderate Financial Risk"
                            elif affordability_ratio <= 0.75:
                                risk_label = "🟠 High Financial Risk"
                            else:
                                risk_label = "🔴 Very High Financial Risk"

                            print(f"      📊 Affordability Ratio: {affordability_ratio:.2f}")
                            print(f"      {risk_label}")

                # ----- ADMISSION COMPETITIVENESS -----

                cur.execute("""
                    SELECT min_board_percentage
                    FROM university_cutoffs uc
                    JOIN universities u
                        ON uc.university_id = u.university_id
                    JOIN exams e
                        ON uc.exam_id = e.exam_id
                    WHERE u.university_name = %s
                    AND e.exam_name = %s
                    AND uc.field_id = %s
                    LIMIT 1;
                """, (uni_name, required_exam, field_id))

                cutoff_info = cur.fetchone()

                if cutoff_info:

                    min_board = cutoff_info[0]

                    if current_class in ['12', 'Dropper'] and twelfth_percentage:

                        diff = twelfth_percentage - min_board

                        if diff >= 5:
                            band = "🟢 Strong Academic Match"
                        elif diff >= 0:
                            band = "🟡 Competitive but Achievable"
                        elif diff >= -5:
                            band = "🟠 Highly Competitive"
                        else:
                            band = "🔴 Very Challenging"

                        print(f"      🎓 Admission Outlook: {band}")

                        # ----- ADMISSION PROBABILITY MODEL -----

                        admission_probability_percent = None

                        if cutoff_info and twelfth_percentage:

                            min_board = cutoff_info[0]

                            # Board score comparison
                            diff = twelfth_percentage - min_board

                            if diff >= 10:
                                board_score = 95
                            elif diff >= 5:
                                board_score = 80
                            elif diff >= 0:
                                board_score = 65
                            elif diff >= -5:
                                board_score = 40
                            else:
                                board_score = 20

                            # Exam readiness score
                            if exam_tolerance >= difficulty:
                                exam_score = 85
                            elif exam_tolerance + 1 == difficulty:
                                exam_score = 65
                            else:
                                exam_score = 40

                            # University competitiveness score
                            cur.execute("""
                                SELECT competitiveness_level
                                FROM university_cutoffs uc
                                JOIN universities u
                                ON uc.university_id = u.university_id
                                WHERE u.university_name = %s
                                LIMIT 1;
                            """, (uni_name,))

                            comp_row = cur.fetchone()

                            competitiveness_score = 60

                            if comp_row:
                                comp = comp_row[0]

                                if comp == 1:
                                    competitiveness_score = 90
                                elif comp == 2:
                                    competitiveness_score = 75
                                elif comp == 3:
                                    competitiveness_score = 60
                                elif comp == 4:
                                    competitiveness_score = 45
                                else:
                                    competitiveness_score = 30

                            # Career fit influence — career_score is now a 0–100 match
                            # percentage, so feed it straight in (clamped to a sane band)
                            # instead of the old `*10+50` rescale of the integer points.
                            career_fit_score = min(max(career_score, 30), 95)

                            admission_probability_percent = (
                                board_score * 0.50 +
                                exam_score * 0.20 +
                                competitiveness_score * 0.20 +
                                career_fit_score * 0.10
                            )

                            admission_probability_percent = round(admission_probability_percent)

                            print(f"      📊 Estimated Admission Probability: {admission_probability_percent}%")

                    elif current_class == '11':

                        print(f"      🎯 Target Required: Aim for at least {min_board}% in Class 12.")

                    elif current_class in ['9', '10']:

                        print(f"      🎯 Long-Term Goal: Maintain strong performance aiming for {min_board}%+ in Class 12.")

                else:
                    print("      🎓 Admission Outlook: Data not available.")
    if university_financials:

        print("\n  🏆 Best Financial Options")

        university_financials.sort(key=lambda x: x[1])

        for i, (name, net_cost, ratio) in enumerate(university_financials[:3], 1):

            if ratio <= 0.25:
                label = "Very Affordable"
            elif ratio <= 0.5:
                label = "Affordable with planning"
            elif ratio <= 0.75:
                label = "Financially Challenging"
            else:
                label = "Financially Risky"

            print(f"  {i}️⃣ {name} — {label} (Estimated Cost ₹{net_cost})")

    
    # -------------------------------
    # STRUCTURED OUTPUT FOR AI
    # -------------------------------

    top_universities = []
    financials = []

    if university_financials:
        # Scholarship-informed path: use exact net-cost after scholarship coverage
        for uni_name, net_cost, ratio in university_financials[:5]:
            top_universities.append({
                "name": uni_name,
                "estimated_cost": net_cost
            })

            if ratio <= 0.25:
                risk = "Low"
            elif ratio <= 0.5:
                risk = "Moderate"
            elif ratio <= 0.75:
                risk = "High"
            else:
                risk = "Very High"

            financials.append({
                "university": uni_name,
                "affordability_ratio": round(ratio, 2),
                "risk_level": risk
            })
    elif all_found_universities:
        # Fallback path: no scholarship data — use gross cost and best-effort affordability ratio
        seen_names = set()
        for uni in all_found_universities:
            if uni["name"] in seen_names:
                continue
            seen_names.add(uni["name"])
            cost = uni["cost"] or 0
            top_universities.append({
                "name": uni["name"],
                "estimated_cost": cost
            })
            if annual_family_income and annual_family_income > 0 and cost > 0:
                ratio = cost / annual_family_income
                if ratio <= 0.25:
                    risk = "Low"
                elif ratio <= 0.5:
                    risk = "Moderate"
                elif ratio <= 0.75:
                    risk = "High"
                else:
                    risk = "Very High"
                financials.append({
                    "university": uni["name"],
                    "affordability_ratio": round(ratio, 2),
                    "risk_level": risk
                })
            if len(top_universities) >= 5:
                break

    # ----- MUTUALLY EXCLUSIVE CAREER BUCKETS -----
    # With only 5 career profiles the old slice approach caused career_matches[-2:] to overlap
    # with career_matches[3:5], so the same career appeared in both good_alternatives and
    # careers_to_avoid.  Build each bucket greedily and track used names to prevent duplicates.
    recommended_careers = career_matches[:3]
    used_career_names = {c[0] for c in recommended_careers}

    good_alternatives = []
    for c in career_matches[3:]:
        if c[0] not in used_career_names:
            good_alternatives.append(c)
            used_career_names.add(c[0])
        if len(good_alternatives) >= 2:
            break

    careers_to_avoid = []
    for c in reversed(career_matches):
        if c[0] not in used_career_names:
            careers_to_avoid.append(c)
            used_career_names.add(c[0])
        if len(careers_to_avoid) >= 2:
            break

    result = {
        "career_matches": career_matches,
        "top_careers": recommended_careers,
        "good_alternatives": good_alternatives,
        "careers_to_avoid": careers_to_avoid,
        "recommended_paths": top_careers,
        "universities": top_universities,
        "financials": financials,
        "confidence_scores": confidence_scores,
        "riasec_scores": riasec_scores,
        # aptitude_scores: already computed above (0-100 per reasoning trait) — surfaced
        # for the Dashboard aptitude bars + per-career Aptitude Match %. Not recomputed.
        "aptitude_scores": aptitude_scores,
        # career_categories: { career_name: primary_trait_letter } for the Careers filter.
        "career_categories": career_categories,
        "scholarships": matched_scholarships
    }

    cur.close()
    conn.close()

    return result