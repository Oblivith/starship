# STARSHIP — Project Context for Claude Code

## What this project is
Starship is a free AI-powered career guidance platform for underprivileged students in India.
It helps them find careers, universities, scholarships, and funding paths.

## Stack
- Backend: Python, FastAPI, PostgreSQL, psycopg2
- Frontend: React + Vite + Tailwind CSS + Framer Motion (not started yet)
- AI: Cohere (command-r-plus-08-2024) via cohere SDK v5
- DB: PostgreSQL, database name: career_counseling_system

## AI / Cohere notes (IMPORTANT)
- Package: cohere (v5+); client is cohere.ClientV2
- Model: command-r-plus-08-2024 (command-r-plus without version suffix was retired Sep 2025)
- System prompt passed as {"role": "system", "content": ...} — first message in history list
- API key stored in .env as COHERE_API_KEY and exported via config.py
- Trial key limits: 1000 calls/month, 20 calls/trial-endpoint — upgrade for production

## Project structure
- api.py — FastAPI routes (main entry point)
- score_assessment.py — Career matching engine (the brain)
- ai_chat.py — Cohere counselor; per-session conversation memory (last 10 exchanges)
- ai_extract.py — Standalone script: extracts career info from raw_data table via Cohere
- config.py — Loads DB_CONFIG and COHERE_API_KEY from .env
- database.py — DB connection helpers
- migrations/ — SQL migration files (run with /opt/homebrew/bin/psql)
- scrapers/ — Data scrapers for universities/scholarships
- docs/ — Architecture docs and project state

## Running the server
```
python3 -m uvicorn api:app --host 127.0.0.1 --port 8000
```
psql binary is at: /opt/homebrew/bin/psql

## Database state
- 82 programs / 40 fields
- 25 career profiles (complete)
- 45 scholarships
- 514 universities with cost data
- 155 assessment questions v2
- GET /results ✅ (cached engine output; 404 if none)

## Endpoint status (Phase 2/3 complete — all passing)
- GET  /                  ✅
- GET  /questions          ✅ (155 questions)
- POST /start-assessment   ✅
- POST /submit-answer      ✅
- POST /submit-assessment  ✅
- POST /career-roadmap     ✅
- POST /chat               ✅ (Cohere live, tested)

## current_class
VARCHAR(50). Valid values: '9', '10', '11', '12', 'Dropper'.
String comparisons in score_assessment.py are correct as-is.

## Design direction (IMPORTANT — preserve this)
Brand: PROJECT STARSHIP
Theme: "Navigate your future"
Visual: Deep space / celestial — dark navy (#06071A), violet (#534AB7), teal (#1D9E75)
Space is the BACKDROP, students are the SUBJECT
The platform must be immediately clear as a career guidance tool — not a space website

## Current phase
See docs/CURRENT_PHASE.md

## Rules
- Work incrementally — no big rewrites unless necessary
- Preserve all existing console output and logging
- Maintain database schema — add columns, don't drop tables
- Always provide full updated file contents when changing a file
- After each session, update docs/PROJECT_STATE.md
- Do NOT touch frontend or scrapers unless explicitly asked
