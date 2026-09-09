---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788881188894-4aiqcl
written_at: 2026-09-08T15:42:26.534Z
---

# Slang "benchview" is a downstream-consumer-by-URL, not in-tree infra; verify audit branches exist before auditing

Triaging shader-slang/slang#12944 ("audit dev/ccummings/benchview branch state", sub-task of perf epic #12941, author expipiplus1/MEMBER).

**Verify the audit target exists FIRST.** An audit task named after a dev branch can have a non-existent target. `dev/ccummings/benchview` does NOT exist on origin. Cheap ways to confirm a branch is genuinely absent (do all four; a single 404 isn't conclusive): `gh api repos/OWNER/REPO/branches/<b>` (404), `git ls-remote origin | grep <b>`, `gh pr list --search "head:<b>"` (=[]), `git log --all --grep=<keyword> -i`. Also `git log --all --author=<person> -- <path>` to see if the person the branch is named after ever touched that area — here ccummings has 154 commits, ALL record/replay (`tools/slang-replay/`), ZERO in `tools/compile-perf/`; he's the *requester* of BenchView ingestion (PR #12437), not the author of any benchview branch. Most-supported read for a missing dev branch: never pushed to origin (local/private/fork), not "deleted" — you usually can't prove deletion (no origin reflog access).

**What "benchview" actually is in Slang.** NOT an in-tree DB/uploader/schema. "benchview" appears only in COMMENTS in `tools/compile-perf/bench.py` (:113/:133/:926). PR #12437 ("keep raw samples") retained raw per-run samples in `results.json` specifically so a *downstream* "BenchView submission format" can compute its own summaries — the deliberate direction was to hand BenchView the public results-repo URL (`shader-slang/slang-compile-perf`, gh-pages at shader-slang.org/slang-compile-perf) rather than build infrastructure. No endpoint/creds anywhere.

**compile-perf scope trap.** The whole `tools/compile-perf/` suite is COMPILE-TIME ONLY (DESIGN.md:3 "compiler time, not GPU/runtime"). Runtime metrics + SlangPy-in-CI are explicitly DEFERRED Phase 3 (DESIGN.md:386-390, needs Python env + slangpy build on the perf runner). So any perf task mentioning "runtime metric requirements" or "SlangPy data ingestion" is greenfield gated on a stakeholder go/no-go, not a fix. Slack regression alerts are broken by the self-hosted runner's egress proxy blocking hooks.slack.com (403) — an ops ACL, not a Slang code fix. (rss_kb is captured but dead on the Windows runner, #12112.)

**Routing for perf-epic #12941 sub-tasks (expipiplus1/MEMBER):** don't auto-dispatch slang-fixer — these are maintainer-owned/sprint/data-gated. Triage, post ONE concise comment (the parent OK'd posting here despite the core-team-skip rule *because the finding corrects the task premise* — a missing audit target is a correction the author needs, not clutter), hold the detailed remediation checklist until the author confirms the real target, and report up. Same terminal shape parent endorsed for siblings #12958/#12949.
