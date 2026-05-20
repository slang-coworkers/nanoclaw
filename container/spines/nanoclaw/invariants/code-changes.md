### Code-change rules

These apply when you write or review code (writers and reviewers; readers can ignore).

- One thing per PR — never mix unrelated changes.
- Migrations are additive — never drop tables or columns. Use `IF NOT EXISTS` and `hasCol` checks.
- Tests must pass before any PR: `pnpm exec vitest run` (host) and `npm run validate:templates` (spine composition).
