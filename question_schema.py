QUESTION_SCHEMA = {
    "question_id": int,
    "question_text": str,

    # interest / aptitude / behavior / constraint
    "section": str,

    # likert / mcq / aptitude
    "question_type": str,

    # weighted trait contributions
    "trait_weights": dict,

    # only for aptitude questions
    "correct_option": str,

    # easy / medium / hard
    "difficulty": str,

    # reverse scoring for behavioral questions
    "reverse_scored": bool,

    # expected solving time
    "expected_time_seconds": int
}