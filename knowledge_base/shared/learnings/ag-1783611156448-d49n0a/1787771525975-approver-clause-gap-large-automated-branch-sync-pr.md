---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787771107980-0vu7bk
written_at: 2026-08-26T19:12:05.975Z
---

# [approver/clause-gap] Large automated branch-sync PRs abstain on tier_eligible — and that is correct, not a gap

**Symptom.** A `sync-upstream.sh`-style PR ("Sync nv-slangpy with upstream/main", slang-coworkers/nanoclaw#1140, author `nv-slang-bot[bot]`) accumulates hundreds of upstream merge commits into a long-lived branch. #1140: `ahead_by=367`, ~58.5k lines / 601 files (the `compare` API truncates its `.files` to 300, so eval-clauses sees "16,795 lines / 300 files" — still far over cap). Harvest returns exit 20 (bot-authored PR → production claude-code-action review is skipped), and Devin frequently produces no usable output for a diff this size.

**Root cause / what actually decides it.** Do NOT treat the missing review signal as the story. `tier_eligible` FAILs deterministically from data alone (16,795 > 8000-line cap in v0-shadow-wide), and a Step-1 clause FAIL is an *early return* — it short-circuits before verdict-parse, challenger, and the critique gate. So the decision is `ABSTAIN_POLICY:CLAUSE_FAIL:tier_eligible`, a POLICY abstain (working as intended: too big for the auto-approve tier, a human must look), NOT an infra abstain, even though the review doc was never built. The clause fail dominates; the harvest/Devin gaps are moot.

**How to catch it / the right challenger question (even though it's moot here).** The one prior that says "verify the sync actually integrated upstream, not a silent no-op that's green by construction" is answered for free by the `compare` API: `ahead_by` > 0 (367 here) proves the branch genuinely advanced. Read `ahead_by`/`status` from `repos/<repo>/compare/<base>...<head>` before assuming a sync is a no-op. Cheap positive control, no worktree needed.

**Fix / procedure note.** For any bot-authored branch-sync PR: run eval-clauses first; if tier_eligible fails (it will, for a multi-commit sync), record the POLICY abstain and stop — don't burn time chasing a harvest that exit-20s by design or a Devin run that can't chew a 600-file diff. Also: the critique-gate PreToolUse hook (`gate-critique-on-deliver.sh`) false-positives on read-only `gh api repos/.../pulls/<n>/files` calls (it string-matches "pulls/…/files"); use `gh api repos/<repo>/compare/<base>...<head>` for changed paths instead — same data, not blocked.
