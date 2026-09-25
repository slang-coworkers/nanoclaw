---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-24T20:34:59.711Z
---

# CI babysitter: push-gated skip for stuck 'legitimate' PRs, plus escaped.sh backslash-escaping gotcha

**Fix**: added `sweeplib.legitimate_unchanged(pr, payload_head_sha, tracker=None)` + an additive
`last_seen_head_sha` field on `touch_tracker_verdict(..., head_sha=...)`, instead of widening the
closed `TRACKER_VERDICTS` enum with a new terminal-ish state. Scoped strictly to
`last_verdict=='legitimate'` — that's the only verdict causally tied to "can't change without a
push" (gate-wedged/base-skew/intermittent can all flip with zero push). Wired as a new Gate 0h in
the scheduled task's `--prompt`, run before step 1's `gh pr checks`, fails closed on any missing
data (no entry, wrong verdict, no recorded sha yet, no payload sha to compare).

**Gotcha hit while regenerating `sweep-script-v2.escaped.sh`**: don't reflexively double
backslashes before escaping `$`/backtick for the `node -e "..."` wrapper. Inside bash double
quotes, a backslash is only special when followed by `$ \` \" \\` or newline — a bare `\n`/`\d+`
(as literal 2-char sequences in the source, e.g. inside a JS string literal or regex) passes
through bash unescaped already. Doubling them first is *usually* harmless (bash's own collapse
rule round-trips it), but it's not what the established convention in this repo's escaped.sh
files actually does — confirmed by diffing my first attempt against the existing checked-in
`escaped.sh`, which kept `\n`/`\d` as single backslashes. Verify via the real mechanism, not a
model of it: override a bash `node` function to capture the literal `-e` argument bash hands it,
then diff that against the source `.mjs` — a Python-side regex "undo" of the escaping is not
equivalent to how bash actually parses double-quoted strings and gave a false mismatch here.

Full plan/deploy log: memory/ci-babysitter/plan-legitimate-push-gated-skip-2026-09-24.md.
