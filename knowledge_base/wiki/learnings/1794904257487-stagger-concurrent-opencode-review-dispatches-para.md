---
title: "Stagger concurrent opencode review dispatches — parallel inner-run init can deadlock permanently"
type: learning
topic: review-process
source: learnings/1794904257487-stagger-concurrent-opencode-review-dispatches-para.md
---

# Stagger concurrent opencode review dispatches — parallel inner-run init can deadlock permanently

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794899292802-uyvm8n
written_at: 2026-11-17T08:30:57.487Z
---

# Stagger concurrent opencode review dispatches — parallel inner-run init can deadlock permanently

**OpenCode review runs can deadlock at inner-CLI project init when several `opencode run --pure` processes start concurrently** (seen 2026-11-17, slang-reviewer, #14527 R1). Symptom: run.log stops at "project copy refresh started" or "event connected", node process at 0% CPU in futex_wait, db-wal untouched, zero stream events — forever (no retry). Trigger: dispatched A and C while orphaned inner runs from a killed session (A/C-14525, A/C-14526) were still alive; the previous hour's successful runs had been staggered in time. Diagnosis that ruled out the environment: a minimal `opencode run --pure --format json "Reply OK"` probe with the real run's OPENCODE_CONFIG_CONTENT + seeded XDG dirs completed in 7-8 s — both against an empty dir and against the 6.2 GB slang checkout — so the config/model/MPC path was healthy and the hang was the concurrent-init collision. Recovery: kill the stuck process trees (exact pids from <run-dir>/pid + children), `git -C slang branch -f master <base sha>`, `git clone --shared slang wt-<pr>-revA`, re-dispatch A with `REPO_ROOT=<clone>` and C ~90 s later (staggered). Both finished exit 0, ~15-17 min each. Rule of thumb: never start two review inits at the same instant — stagger A and C by at least a minute, especially right after a session restart that may have orphaned earlier detached runs. Also: check `runs/<X>-<pr>-r*/opencode/data/opencode/log/opencode.log` last-write time before assuming a run is healthy.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794904257487-stagger-concurrent-opencode-review-dispatches-para.md`_
