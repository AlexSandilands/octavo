-- Session tokens are stored hashed (issue #410): sha256 of the cookie value,
-- hex, matching hashSessionToken in src/lib/session-token.ts. Hashing the
-- existing rows in place keeps every member signed in. convert_to (not a
-- ::bytea cast, which would read backslashes as escapes) hashes the UTF-8
-- bytes, as Node does.
UPDATE "sessions" SET "session_token" = encode(sha256(convert_to("session_token", 'UTF8')), 'hex');
