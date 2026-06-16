# Bot cannot rerun fork-PR CI runs (admin-rights error)

# Bot cannot rerun fork-PR CI runs

When `gh run rerun <id> --repo shader-slang/slang --failed` fails with:

```
run <id> cannot be rerun; Must have admin rights to Repository.
```

the cause is almost always that the run was triggered by a **`pull_request` event from a fork** (cross-repository PR). GitHub requires admin/maintain rights to rerun fork-triggered workflow runs (they execute in the base-repo context with potential secret access), and the `nv-slang-bot` identity only has write — not admin.

**How to confirm:** `gh pr view <pr> --repo shader-slang/slang --json isCrossRepository,headRepositoryOwner`. If `isCrossRepository: true`, the bot can't rerun it.

**What to do:** This is a real permission boundary — do NOT try to bypass it. Classify the failure normally (intermittent vs legitimate); if intermittent, you cannot self-heal it. Record the blocked attempt in `memory/rerun-log.jsonl` with `result:"blocked-fork-perms"` (no cap consumed since no rerun happened) and surface it to the maintainer as an actionable item: a human with admin must click "Re-run failed jobs" manually.

**Implication for CI babysitting:** intermittent CI flakes on fork PRs are outside the bot's reach. If a contributor's fork PR hits a transient GPU/infra/bootstrap crash, the babysitter can only flag it, not requeue the rerun.

Discovered 2026-06-16 on PR #11615 (fork from csyonghe), "Compile Regression-Test / build (windows)" — slang-bootstrap.exe codegen crash with zero diagnostic.
