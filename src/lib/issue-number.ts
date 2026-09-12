import { z } from "zod";

// The issue number's bounds, in one place so the publish modal and the server
// action refuse exactly the same values (issue #270). The ceiling is the
// `issues.number` column's — a Postgres `integer`.
export const ISSUE_NUMBER_MAX = 2147483647;

export const issueNumberSchema = z.number().int().min(1).max(ISSUE_NUMBER_MAX);

/** What the publish modal says when the typed number isn't one. */
export const ISSUE_NUMBER_HINT = `Enter a whole number between 1 and ${ISSUE_NUMBER_MAX}.`;
