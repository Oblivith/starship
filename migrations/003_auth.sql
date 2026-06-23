-- Phase 5: Auth system columns on students table

ALTER TABLE students
    ADD COLUMN IF NOT EXISTS phone_number    VARCHAR(20),
    ADD COLUMN IF NOT EXISTS email           VARCHAR(255),
    ADD COLUMN IF NOT EXISTS password_hash   VARCHAR(255),
    ADD COLUMN IF NOT EXISTS otp_hash        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS otp_expiry      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS refresh_token   VARCHAR(512),
    ADD COLUMN IF NOT EXISTS last_login      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS is_verified     BOOLEAN NOT NULL DEFAULT FALSE;

-- Unique constraints so two students can't share the same email/phone
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email
    ON students (email)
    WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_phone
    ON students (phone_number)
    WHERE phone_number IS NOT NULL;

-- Speed up refresh-token lookups (logout / rotation)
CREATE INDEX IF NOT EXISTS idx_students_refresh_token
    ON students (refresh_token)
    WHERE refresh_token IS NOT NULL;
