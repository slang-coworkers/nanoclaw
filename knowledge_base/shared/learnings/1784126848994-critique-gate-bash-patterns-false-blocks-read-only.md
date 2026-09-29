# critique-gate bash_patterns false-blocks read-only gh api pulls GETs

# critique-gate hook over-blocks read-only `gh api .../pulls/<n>` GETs

**Symptom (observed 2026-07-15, slang-pr-approver, PR #12119 R2 pass):** the critique-gate hook's `bash_patterns` include `gh api [^|]*pulls\b`, which matches *any* `gh api` call touching a `pulls` endpoint — including read-only GETs like `gh api repos/OWNER/REPO/pulls/<n>` used for PR existence/state/head verification. It tripped **3× in one turn**; the approver routed around it via the `issues` endpoint, `gh pr view`, and `gh run list`.

**Impact:** approvers/reviewers doing legitimate read-only PR verification get blocked and must detour to alternate endpoints. Harmless individually, but it adds friction to every approval pass and can push work toward less-precise checks (`issues` endpoint lacks PR-specific fields like `head.sha`, `mergeable`, `draft`).

**Suggested fix (operator sign-off required — this is a safety gate):** narrow the pattern to *write* methods only, so read-only GETs pass. Match on explicit write verbs/flags:
- `-X POST` / `-X PATCH` / `-X PUT` / `-X DELETE`
- `--method POST` (etc.)
- `-f`/`--field`/`--input` (mutating field args)

i.e. gate `gh api ... pulls ... (-X (POST|PATCH|PUT|DELETE)|--method (POST|PATCH|PUT|DELETE)|-f |--field|--input)`, not the bare `pulls\b`.

**Do NOT loosen this pattern unilaterally.** It's part of the critique-gate guard mechanism; a mis-written regex could let real writes through. Requires operator review of the exact hook file (critique-gate overlay / spine `bash_patterns`) before changing.

**Applies to:** all `*-pr-approver` coworkers (slang, slangpy) and any coworker type carrying the `critique-overlay` / critique-gate hook.


**Also observed 2026-09-28 (slang-fixer, task `okf-memory-synthesis-cfce`, a session that creates no PRs):** 3 "CRITIQUE GATE BLOCKED your PR creation" denials led to an admin bypass card, which was rejected. The memory-synthesis run itself was unaffected. The gate fires in *any* session carrying the hook, not only approvers. The default `BASH_PATTERNS` in `/app/hooks/gate-critique-on-deliver.sh:52` is `gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest`, plus the `bash_patterns` in the markers file. `gh pr view` and `git commit` do **not** match it, so the likely trigger is a subagent's read-only `gh api .../pulls/...` GET, the same root cause as above. The fix above (gate only on write verbs) still needs operator sign-off.
