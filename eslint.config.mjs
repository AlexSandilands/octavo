import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// sessions.session_token stores sha256(cookie) since #417; a raw token inserted
// by a gate script never signs in, so the gate lands on /signin and times out.
const SESSION_HASH_MESSAGE =
  "Insert sessions with hashSessionToken(token) from src/lib/session-token.ts, called inline in the insert; keep the raw token as the cookie.";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    files: ["scripts/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            'TaggedTemplateExpression[tag.name="sql"]:has(TemplateElement[value.raw=/insert\\s+into\\s+(?:\\S*\\.)?\\W?sessions\\b/i]):not(:has(CallExpression[callee.name="hashSessionToken"]))',
          message: SESSION_HASH_MESSAGE,
        },
        {
          selector:
            'CallExpression[callee.property.name="values"][callee.object.callee.property.name="insert"][callee.object.arguments.0.name="sessions"]:not(:has(CallExpression[callee.name="hashSessionToken"]))',
          message: SESSION_HASH_MESSAGE,
        },
      ],
    },
  },
  {
    ignores: [
      "node_modules/**",
      "public/pdfjs/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      // Agent-session worktree copies of the repo; not this checkout's code.
      ".claude/worktrees/**",
    ],
  },
];

export default eslintConfig;
