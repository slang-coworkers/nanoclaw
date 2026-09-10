---
name: project_10918_debug_global_variable_rework
description: "slang#10918 (Fixes #10772) DebugGlobalVariable rework — IR-decoration replaces name-string match; draft PR pushed 0835101c02, NO real CI signal (draft), 2 maintainer questions open"
metadata:
  node_type: memory
  type: project
  originSessionId: unknown-prior-session
---

# slang#10918 — DebugGlobalVariable rework (`Fixes #10772`)

**✅ SHIPPED 08-03 17:34Z — head `0835101c02`, still DRAFT, `pr: non-breaking` (Main-verified: 6 files, +65/−1, requested reviewer `bmillsNV`).**

**The fix:** new **`IRScalarizedInterfaceFieldDecoration`** (stable name **900**) attached in `createSimpleGLSLGlobalVarying` when the recursion's outer param is an `IRStructField` — *the same event that appends `.field` to the name hint* — plus a 4-line early-out in `maybeEmitDebugGlobalVariable`. **The `.`-in-name string match is GONE** (that's the point: an IR decoration replaces a fragile name-string heuristic). Rebased from a **643-behind** base onto fresh master. PR title+body rewritten to describe the IR-level approach. Replies: issuecomment-5169617383 + a correction issuecomment-5169685046.

**Tests:** `tests/spirv/` 542/542, `tests/glsl*` 337/337. Two tests — the hull regression + `debug-global-promoted-param.slang` using pdeayton's anyhit shader.

**Review:** codex PLAN/CODE/OUTPUT all approve — after **13 rounds that caught SEVEN real errors** of the fixer's: a wrong RT-specific framing, a false "compute behaves the same" claim, an inflated count (grep matched the test's own comments), a dead `!loc` term, a self-matching CHECK, **an inert CHECK-NOT that passed even when flipped to a present pattern**, and an overstated test-evidence claim. Fixer's own assessment: *"Most of this fix's quality came from that adversarial pass, not my first draft."* (The inert CHECK-NOT is the same family as the session's `-o /dev/null` and vacuous-assertion findings — **"present" ≠ "exercising."**)

## ⚠️ TWO MAINTAINER QUESTIONS OPEN (weigh before merge)
1. **The RT case is NOT an RT bug.** A plain `float4 color : COLOR` fragment varying emits the same line-0 debug global, and **existing tests deliberately PIN that** for promoted parameters. So the fixer asserted the **retained** behaviour rather than its absence, and put *"should this representation change at all?"* to **pdeayton-nv**. That's a design question, not a defect — needs a human answer.
2. **#10771 does NOT fold in** — it's a debug-***type*** defect in `emitDebugTypeImpl`. Fixer stated plainly this rests on **reading code, not a repro** (correct hedging).

## 🔴 NO REAL CI SIGNAL ON THIS PR (Main's call to route)
CI run 30836752387 is the **benign draft priority-yield** — only `wait-for-human-priority` + aggregate `check-ci` fail, **all builds skipped**. **Drafts skip the `pull_request` path entirely ⇒ there is no build/test signal on this PR at all.** A **ready-flip would produce one and is operator-gated**, so the fixer correctly left it to Main/the maintainer rather than self-flipping. Local suites are green (542/542, 337/337) but that is not CI.
- **✅ MAIN'S DECISION 08-03: LEAVE IT DRAFT — do NOT flip for CI.** The fixer had framed it as "a ready-flip buys CI but is operator-gated." **The better reason to hold: flipping also signals *review me*, and this PR has TWO OPEN DESIGN QUESTIONS** (the RT-representation question to pdeayton; the #10771 boundary) ⇒ **inviting a review of a shape that may still change wastes a reviewer's pass.** The honest position for now is the local suites, explicitly disclosed as local-not-CI (which the fixer did). **If pdeayton answers the representation question and the shape holds, THEN a ready-flip earns its CI** — Main routes it at that point. Fixer folded this in so it no longer treats "no CI signal" as itself a reason to flip.
- **PR body updated with a "Where to aim your review" paragraph** (Main's suggestion): names the three claims that took several passes (wrong RT framing, false compute-stage claim, the miscount) and points scrutiny at the RT-contract reading + the #10771 boundary, **flagging that the latter has no repro behind it.** ⚠️ Codex initially FAILED that body: the fixer had written the mechanical part "held up unchanged," which was false — review *did* change the emission gate. Reworded before publishing. **Fixer's note worth keeping: it had flagged that exact risk in its own review request and STILL shipped the wrong sentence — "the self-flag didn't save me, the external read did."** (Direct evidence for why the adversarial pass isn't redundant with self-review.)
- Fixer adopted the standing test rule verbatim: **name the defect, then name the assertion that fails when only that defect is reintroduced** — and generalized it past tests ("would this build have failed if my patch were absent?", "would this grep have returned 0 if the bug were fixed?"). Both of its controls this session only worked **because it ran them in both directions; the negative-only control was the one that lied.**

## 🔴 PROCESS FAILURE DIAGNOSED — the 5-day stall (fixer's own, owned)
The stall was **two turns ended trusting an in-session `Monitor`/background shell to survive teardown. They don't** — both builds died silently, unfired. Fixed this turn by **running the build inside the turn and blocking on it**. Cf. [[feedback_in_session_monitors_dont_survive_teardown]] — this is that lesson costing 5 days on a real chain.
- **✅ CAPABILITY GAP WAS NOT REAL — resolved 08-03 17:45Z.** Fixer had reported `schedule_task` missing ⇒ "no durable cron fallback." **Main verified its config (`mcp_servers: {}` but `cli_scope: "group"`) and relayed that `ncl tasks` exists; fixer then ran `ncl tasks help` and confirmed the capability is fully there:** `create|list|get|update|cancel|pause|resume|run|delete`, one-shot `--process-after`, cron `--recurrence`, **and the exact feature it wanted — `--script` runs BEFORE the agent wakes, so a `wakeAgent:false` fire costs ZERO tokens** ⇒ a free idempotent "has the build finished / has the head moved?" poll. **No MCP wiring needed; no operator ask.**
  - **⭐ Fixer's own generalization (now a fleet learning): "the MCP tool is missing" ≠ "the capability is missing"** — it probed for `mcp__nanoclaw__schedule_task`, got "No such tool available," and declared a gap **without ever running `ncl tasks help`.** Two surfaces, two gates: MCP tools gated by `allowedMcpTools`/`mcp_servers`; `ncl` gated by `cli_scope`. A probe of one surface cannot license a claim about the system. Will use `ncl tasks` on the next long build; blocking in-turn stays simpler when the build fits in a turn.
- **Reviewers `pdeayton-nv`/`bmillsNV` were requested 2026-04-22** — months before this session; **pre-existing, not added by the bot.** (Live state now shows only `bmillsNV` in `requested_reviewers`.)

**Next:** human review. Merge + ready-flip **operator/maintainer-gated**; bot flips nothing.
