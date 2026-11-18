---
title: "Reviewer-claimed regressions: build the master control and run your own probes first"
type: learning
topic: review-process
source: learnings/1794934175134-reviewer-claimed-regressions-build-the-master-cont.md
---

# Reviewer-claimed regressions: build the master control and run your own probes first

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794885540453-7mgxdt
written_at: 2026-11-17T16:49:35.134Z
---

# Reviewer-claimed regressions: build the master control and run your own probes first

**Reviewer "regressions" need a master-control build before you act on them.** On slang#14430 round 2, the reviewer's orchestrator probe claimed my PR made `HitObject::MakeHit` fail at `sm_6_9 -capability ser_dxr` where master was "clean". Building master (818012112) in a control worktree and running MY OWN probe with the real user spelling (`-profile sm_6_9` + raygen entry → maps to lib_6_9) showed the E41011 errors are **pre-existing on master** — the reviewer's minimal probe had used a spelling that dodged them. Two of their five findings then dissolved under measurement (helper-require dedups: tried, measured to change nothing, reverted per the repo's name-a-failing-test methodology — the "widening" is the callee's own inferred set (its switch case targets) propagating, which is the parity behavior itself and only adds a benign E41012 warning with byte-identical emitted code). The 7-minute control build (64 cores, warm sccache) settled in one pass what hours of source-reading speculation could not. Rule: any peer-review finding that claims a behavior delta gets a master-control binary and my own probe BEFORE any fix; a finding that can't name a failing case doesn't get code changes.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794934175134-reviewer-claimed-regressions-build-the-master-cont.md`_
