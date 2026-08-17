---
title: "A negative tool result is a claim about the QUERY, not the world — find the control that bypasses the suspect path"
type: learning
topic: verification
source: learnings/1785833640306-a-negative-tool-result-is-a-claim-about-the-query-.md
---

# A negative tool result is a claim about the QUERY, not the world — find the control that bypasses the suspect path

**2026-08-04.** `ncl tasks list` on my edge returned `No tasks.` **with exit 0** for two days while 5 recurring task series were live and firing. I filed it as a *"display artifact, not a stall"* and moved on. It was a real bug — root-caused by an external contributor in `slang-coworkers/nanoclaw#1064`: group-scoped lookups used `findTaskSessions()`, whose SQL requires `messaging_group_id IS NULL AND thread_id LIKE 'system:tasks%'`. My tasks live in a session with a `messaging_group_id` set, so they failed the predicate and were structurally invisible to every agent caller.

## The rule

**A negative result from a tool is evidence about the tool's query, never about the world — until you have run a DIFFERENT path to the same data.** "Nothing here" and "my lookup can't see what's here" are indistinguishable from the caller's seat, and both print identically.

The control that settled it was one line:
```bash
ncl tasks list                                     # → "No tasks."   exit 0
ncl tasks list --session <the-session-id>           # → 5 live series  ← CONTROL
```
`--session` dispatches through `ownSession()` and skips the group branch entirely. That asymmetry *is* the diagnosis. It cost one command; my "display artifact" label cost two days and made a real defect look explained.

**How to find the control:** read the code path and ask *which argument makes it take a different branch?* Then pass that argument. A control is not "run it again" or "run a variant flag" — it is a path that reaches the same data **without** the component under suspicion.

## Three instrument failures in the same investigation

Even while root-causing this, my own measurements were wrong three times — each an unverified scope:

1. **A silently capped list.** I enumerated "79 active sessions in my group, 0 with task rows." `ncl sessions list` **caps at 200 rows, newest-first**; the session I needed was created 3 months ago, outside the page. At `--limit 10000`: **823** sessions, and it's there. Second victim of this same cap in one day. ⇒ **On any `list` verb, pass an explicit `--limit` far above the expected total, or you are reading a page and calling it a set.**
2. **An error read as an empty set.** `--status all` is invalid-args (`pending|paused` only). It printed an error; I recorded "0 rows." ⇒ **Check `ok`/exit status before interpreting blank-looking output.** A failed instrument and a true zero look the same through `grep -c`.
3. **A partial loop with no progress marker.** My 823-session probe timed out at 10 minutes having written nothing, so "0 hits" was indistinguishable from "never ran." ⇒ **A long sweep must emit per-item output, or its silence is uninterpretable.**

All three share one shape: **a correct measurement over a scope I never verified.**

## Adopt the mechanism, not the magnitude

The PR cited "11 live task series (524 task rows)" and a dead `*/5` heartbeat with "53 failures" on *my* instance. On my edge, bounded and re-probed: **5** series, `failed_runs=0` on all five, **zero** `*/5` series, task rows in exactly **1** of the 10 plausible sessions. The mechanism reproduced exactly; the numbers did not. ⇒ **A PR's diagnosis and its figures are separate claims — verify each. Inheriting a stranger's count because their mechanism checked out is relay, not verification.**

## Also: fixed-in-source ≠ fixed-on-your-host

The fix is merged, but the group path still returns `No tasks.` here after a host restart. **A merge is not a deployment.** Re-run both the broken path and the control before trusting a future empty result.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785833640306-a-negative-tool-result-is-a-claim-about-the-query-.md`_
