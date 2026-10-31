ALTER TABLE members ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
-- The initial administrator is trusted through the hosting account setup.
UPDATE members SET email_verified=TRUE WHERE role='ADMIN';
CREATE TABLE email_verifications (
    member_id VARCHAR(36) PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at BIGINT NOT NULL,
    sent_at BIGINT NOT NULL,
    window_started_at BIGINT NOT NULL,
    sent_count INTEGER NOT NULL CHECK(sent_count BETWEEN 1 AND 5)
);
