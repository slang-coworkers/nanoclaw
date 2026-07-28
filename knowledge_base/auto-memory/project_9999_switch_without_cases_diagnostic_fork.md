---
name: project_9999_switch_without_cases_diagnostic_fork
metadata: 
  node_type: memory
  type: project
  originSessionId: 3bed1c39-d0f9-450c-9be9-c86e9aaac773
---

**#9999** — `switch`-body with executable statements but no `case`/`default` label compiles with zero diagnostics and silently discards the body (reporter H7perus; assignee jhelferty-nv). Missing-diagnostic / frontend, low sev. Milestone Q2 2026.

**History:** bot 06-29 promised "draft PR being prepared from internal WIP branch" — **stalled, never produced a PR**. jhelferty-nv asked 07-22 "was a PR ever created?" → honest answer NO (bot ack comment 5051291879). Re-dispatched to slang-fixer.

**DESIGN FORK (07-27) — RESOLVED:**
- **jhelferty-nv** (assignee, 06-29 comment 4833955393): originally "make this an **error**" → dedicated E30606 `switch-without-cases`. = Approach-A.
- **skiminki-nv** (07-27 comment 5094597424): undiagnosed **unreachable code** → extend existing unreachable-code detection as **warning E41000**, ref his own issue **#12236**. NOT a dedicated error.
- Bot did not pick; posted fork comment **5094719535** asking maintainers to reconcile.
- **RESOLUTION (07-27 comment 5097811854):** jhelferty-nv conceded — *"I'm fine with @skiminki-nv's suggestion."* → **skiminki approach WINS: warning E41000 via extending unreachable-code detection. Approach-A (E30606) SCRAPPED.**

**Approach-A (dead):** branch `fix/issue-9999` `27afc63068` — E30606 error, verified 2170/2170 — **abandoned** (wrong approach). Kept only as reference.

**AUTHORIZED FIX (dispatched to slang-fixer 07-27):** ONE PR covering **#9999 + #12236** (same root cause). Root: `lowerSwitchCases()` `slang-lower-to-ir.cpp:~9305` silently drops stmts before first case/default → never reach existing E41000 site (~:8228). Fix = make dropped stmts get flagged **E41000** (warning, non-breaking → `pr: non-breaking` label). Regression tests both shapes (no-case body #9999 + stmts-before-first-case-w/-later-cases #12236). Briefing memo `triage-12236.md` staged to fixer. Draft PR `Closes #9999` + `Closes #12236`, held for jhelferty + skiminki review. Drafts-only; NO ready/merge.

**Next:** fixer implements → draft PR + report_pr_created → [Fix Report]. gh-auth "invalid" = known false-negative (writes work, [[feedback_gh_auth_status_misleading]]). Merge/ready operator-gated ([[feedback_github_writes_operator_authorized]]); drafts-only guardrail. Related: [[project_12236_switch_pre_case_unreachable]].
