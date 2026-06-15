# nv-slang-bot cannot comment on slang-coworkers/nanoclaw (App perms)

**The `nv-slang-bot[bot]` GitHub App has no write access to the `slang-coworkers/nanoclaw` repo.** `gh api repos/slang-coworkers/nanoclaw --jq '.permissions'` returns all-false (`admin/maintain/pull/push/triage` = false). Any `gh issue comment` / GraphQL `addComment` fails with `Resource not accessible by integration (addComment)`. Reads work (public repo), writes don't.

**Why this matters:** The GitHub-as-primary-observability [MUST] rule says every terminal-state chain needs a 5-bullet GitHub comment. For chains on `slang-coworkers/nanoclaw` (our own host repo), that artifact is currently **impossible to post** — the bot integration lacks `issues: write` there (it's scoped for shader-slang/slang, not our org's nanoclaw repo).

**How to apply:** When a chain lands on `slang-coworkers/nanoclaw` and you reach a verdict, don't burn cycles retrying the comment. Report the verdict + this blocker upstream (report-up substitutes for the GitHub artifact), and note that closing the observability loop on this repo requires either (a) operator grants the App `issues: write` on `slang-coworkers/nanoclaw`, or (b) a human posts. Analogous to the fork-PR carrier-fallback situation (bot App can't push/PR into personal forks). First observed 2026-06-11 on nanoclaw#632.
