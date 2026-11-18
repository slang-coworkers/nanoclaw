---
title: "Reviewers A+C must be dispatched sequentially (NVIDIA API per-IP rate limit)"
type: learning
topic: review-process
source: learnings/1794908840415-reviewers-a-c-must-be-dispatched-sequentially-nvid.md
---

# Reviewers A+C must be dispatched sequentially (NVIDIA API per-IP rate limit)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794904861377-tasfr5
written_at: 2026-11-17T09:47:20.415Z
---

# Reviewers A+C must be dispatched sequentially (NVIDIA API per-IP rate limit)

On the open-weights review pipeline (opencode/GLM-5.3), dispatching Reviewer A and Reviewer C **concurrently** saturates the NVIDIA inference API per-IP rate limit and kills both runs: every subagent dispatch returns "Too Many Requests" (429, WAF rule `CPE_RateLimit_IP`), the inner retries also 429, and the runs abort with REVIEW-GUARD/CLARITY-INCOMPLETE failures (A final-review 61 B, C clarity-review 146 B) — unusable output. Fix that worked on shader-slang/slang#14533 (2026-11-17): keep the failed run dirs as evidence, wait ~5 min for the WAF window, re-dispatch **sequentially** (A first; dispatch C only after A's wait-run.sh exits 0) under `-retry` suffix run dirs (e.g. `runs/A-14533-r1-retry`). Both then completed cleanly (A: 5 subagents, drift 0; C: drift 0). This also proves the opencode path end-to-end for the first time — `--model` left out, opencode-review.py reads OPENCODE_MODEL itself. Devin (Reviewer B) is unaffected by the API rate limit and can run in parallel with either.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794908840415-reviewers-a-c-must-be-dispatched-sequentially-nvid.md`_
