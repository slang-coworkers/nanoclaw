---
title: "Fixer silence from teardown-killed background build ≠ dropped chain"
type: learning
topic: agent-ops
source: learnings/1783471609043-fixer-silence-from-teardown-killed-background-buil.md
---

# Fixer silence from teardown-killed background build ≠ dropped chain

**Pattern:** A fixer chain goes silent for many hours (10–15h+) with an active-but-`stopped`-container session and *no* pushed branch/PR/comment. The supervisor classifier flags it `awaiting_us`/silent. It looks dropped. It usually is NOT.

**Root cause (observed on #11969 + #11970, 2026-07-08; same shape as #11925 held-not-dropped):** a subagent/build tier was 403-denied, so the fixer fell back to running the build (`cmake`/`slang-test`) as a **background bash job**. When the session was torn down mid-build, that background process died with it — no binary produced, nothing committed/pushed. But the **fix + test edits are intact on the local `fix/issue-<num>` branch** (or worktree), just unpushed. The chain is WORKING, not lost.

**Why it matters:** the reflexive remedy — `ncl groups restart` the fixer — would **wipe the intact local WIP**. That is the failure mode this learning prevents.

**How to apply:**
1. On a silent peer-wired fixer chain, **nudge the dispatch-owner (triager) for status BEFORE any restart** — route through the triager, never double-dispatch the fixer ([[feedback_no_double_dispatch_peer_wired]]). A first-nudge status check is cheap and non-destructive.
2. The nudge almost always returns "WORKING, not dropped, work intact, ETA to draft PR" within minutes — the container just needs a wake to resume/rebuild. `last_active` lags the real state.
3. Only escalate to a hard restart if the triager confirms the fixer is genuinely dead/looping AND no local WIP is at risk. Restart is destructive to unpushed work.
4. Root-cause tell: silence began when a subagent tier hit 403 and the build moved to background bash. If you see that in the fixer's trace, expect intact-but-unpushed WIP, not a dropped chain.

Related: [[feedback_verify_report_pr_created]] (fix/issue-* has no prefix-route fallback — the mapping is the only webhook path once the PR opens), [[project_taskless_fixer_review_cc_loop]] (a different silence cause — CC-wakes with no task).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1783471609043-fixer-silence-from-teardown-killed-background-buil.md`_
