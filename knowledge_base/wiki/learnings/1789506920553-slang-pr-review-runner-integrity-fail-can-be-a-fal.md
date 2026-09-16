---
title: "slang-pr-review-runner INTEGRITY-FAIL can be a false positive from concurrent-run shared-tmp contention — pipeline self-heals via tmp/iso-<pr>/"
type: learning
topic: slang-compiler
source: learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false positive from concurrent-run shared-tmp contention — pipeline self-heals via tmp/iso-<pr>/

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1787784675810-nces5k
written_at: 2026-09-15T21:15:20.553Z
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false positive from concurrent-run shared-tmp contention — pipeline self-heals via tmp/iso-<pr>/

On a R3 review of slang#12782, `compose-and-run.sh` exited 1 with `!!! INTEGRITY-FAIL: reviewed diff != PR 12782 files — review targeted the WRONG diff`. Investigation showed it was a FALSE POSITIVE caused by CONTENTION, and the review was actually correct:

**What happened:** A *concurrent* PR-review run (of an unrelated hlsl-legalize/vkray PR) overwrote the SHARED `/workspace/agent/slang/tmp/pr-diff.patch` ~1.5 min into this run. Four of Reviewer A's specialist subagents read the clobbered patch and correctly bailed ("pre-staged diff does not match the requested PR"). The orchestrating CLI then **isolated the correct diff** into `tmp/iso-<pr>-review/pr-diff.patch` and re-ran the affected subagents against that — so the final review WAS grounded in the correct diff. But the post-run integrity net (compose-and-run.sh ~line 188) re-inspects the *shared* `tmp/pr-diff.patch`, which was still clobbered → false INTEGRITY-FAIL + exit 1.

**How to tell false-positive from a real wrong-diff review:**
1. Compare Reviewer A's diff hash (from its `pr-diff.reference`) to Reviewer C's independently-computed hash (its run-dir-name suffix). Match = both saw the same, correct diff.
2. Read `final-review.md` — does it discuss the CORRECT PR's files, or the wrong ones? (Here it was all correct R3 content.)
3. Grep `stream.jsonl` for the wrong files: if subagents SAY "does not match / cannot complete / pre-staged diff does not correspond" they *bailed* (good); if they produced findings ON the wrong files, it's a real wrong-diff review (bad). Look for `tmp/iso-<pr>-review/` references = the self-heal fired.
4. Best: verify the verdict-driving finding directly against the actual PR-head source yourself.

**Takeaway:** don't reflexively trust OR dismiss an INTEGRITY-FAIL. It correctly fires on real wrong-diff runs, but shared-tmp contention between concurrent reviews produces false positives that the pipeline has already recovered from. Root fix would be per-run isolated tmp dirs for the shared checkout. Related: prior #12592 note "shared-tmp/ INTEGRITY-FAIL false positive."

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal.md`_
