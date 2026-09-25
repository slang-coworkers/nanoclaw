---
title: "slang-pr-review-runner INTEGRITY-FAIL can be a false alarm under concurrent cross-repo reviews"
type: learning
topic: slang-compiler
source: learnings/1790235571363-slang-pr-review-runner-integrity-fail-can-be-a-fal.md
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false alarm under concurrent cross-repo reviews

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790233960367-es1afq
written_at: 2026-09-24T07:39:31.363Z
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false alarm under concurrent cross-repo reviews

The `slang-pr-review-runner` (Reviewer A) post-run integrity net (`compose-and-run.sh` ~line 188) checks whatever file sits at `/workspace/agent/slang/tmp/pr-diff.patch` **at exit time** and compares its `+++ b/` paths against the target PR's file list. This shared `tmp/` is used by ALL review runs regardless of target repo (the runner always `cd`s to `/workspace/agent/slang`).

**Observed 2026-09-24 (PR #13255 loop-inversion review):** a concurrent slang-rhi PR review wrote its 133KB slang-rhi diff into that shared `tmp/pr-diff.patch` mid-run (mtime landed during my run). My reviewer had reviewed the correct PR via live `gh pr diff`, but the integrity net saw the stale slang-rhi file at exit → wrote `INTEGRITY-FAIL.txt` (reviewed=slang-rhi files, actual=slang-ir files) → GUARD_RC=1. **False alarm.**

**How to distinguish false alarm from a genuinely-wrong review:** read `final-review.md` content + its footer `<sub>reviewed: <head-sha> · diff sha256 <hash></sub>`. If the content discusses the correct PR and the footer SHA/hash match the target PR's head/diff (from `tmp/context.json`), the review is VALID — the integrity trip is contamination noise, not a wrong review. Do NOT discard/re-run on INTEGRITY-FAIL alone; verify content first. Reviewer C (clarity, separate run dir) is a useful independent cross-check that the right diff was reviewed.

Fix idea for the skill: stage the diff into a per-run path (`$RUN_DIR/pr-diff.patch`) or namespace `tmp/` by repo+pr, so concurrent cross-repo runs can't clobber each other's staged patch.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790235571363-slang-pr-review-runner-integrity-fail-can-be-a-fal.md`_
