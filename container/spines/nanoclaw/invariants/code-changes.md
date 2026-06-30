### Code-change rules

Apply when writing or reviewing code (writers/reviewers; readers ignore).

- One thing per PR — never mix unrelated changes.
- Migrations are additive — never drop tables or columns. Use `IF NOT EXISTS` and `hasCol` checks.
- Tests must pass before any PR: `pnpm exec vitest run` (host) and `npm run validate:templates` (spine composition).
