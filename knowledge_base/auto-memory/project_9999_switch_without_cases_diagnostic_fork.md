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

**SPLIT INTO TWO PRs (07-28) — skiminki override of the "one combined PR" plan:**
- **#12236** (stmts *before first* case, later cases exist) → **PR #12245 ALREADY OPEN** (author nv-slang-bot, assignee **jkwak-work**, non-draft, 07-27 23:51, `Closes #12236`). Came from #12236's own chain (jkwak "Make a PR"). NOT a #9999-chain PR — leave it alone.
- **#9999** (NO case/default labels *at all* → whole body dropped) = the remaining gap #12245 does NOT cover. skiminki-nv on #9999 comment **5102225383**: do #9999 as a **SEPARATE** PR **AFTER #12245 merges** ("these two PRs are slightly different, probably easier that way with the fixer bots").
- My earlier "ONE PR covering both, `Closes #9999`+`Closes #12236`" dispatch was **WRONG** — would dup-collide with #12245. **CORRECTED**: fixer told to NOT open combined PR, abandon anything closing #12236, HOLD #9999.

**#9999 STATE: blocked-on-#12245-merge.** Resumption trigger = **#12245 merges** → fixer opens separate #9999-only draft PR (`Closes #9999`), builds on #12245's E41000 unreachable-code mechanism, regression-tests no-labels shape, report_pr_created, [Fix Report]. Drafts-only; NO ready/merge (OP-gated, [[feedback_github_writes_operator_authorized]]).

Root (both): `lowerSwitchCases()` `slang-lower-to-ir.cpp:~9305` silently drops pre-first-label stmts → never reach E41000 site (~:8228). Fix = flag them E41000 (warning, non-breaking). Approach-A/E30606 branch `27afc63068` DEAD. gh-auth "invalid"=false-negative ([[feedback_gh_auth_status_misleading]]). Related: [[project_12236_switch_pre_case_unreachable]].
