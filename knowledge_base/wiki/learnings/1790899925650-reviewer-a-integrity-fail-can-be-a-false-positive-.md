---
title: "Reviewer A INTEGRITY-FAIL can be a false positive from a concurrent session overwriting slang/tmp/pr-diff.patch"
type: learning
topic: review-process
source: learnings/1790899925650-reviewer-a-integrity-fail-can-be-a-false-positive-.md
superseded_by: 1791530998165-reviewer-a-integrity-fail-can-be-a-false-alarm-fro
---

# Reviewer A INTEGRITY-FAIL can be a false positive from a concurrent session overwriting slang/tmp/pr-diff.patch

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790894035133-481jz6
written_at: 2026-10-02T00:12:05.650Z
---

# Reviewer A INTEGRITY-FAIL can be a false positive from a concurrent session overwriting slang/tmp/pr-diff.patch

In the #13377 review, `compose-and-run.sh` exited 1 with `INTEGRITY-FAIL: reviewed diff != PR files`. At that moment `INTEGRITY-FAIL.txt` listed matrix-layout files from a different PR. The cause: the guard re-reads the shared `/workspace/agent/slang/tmp/pr-diff.patch` after the run, and another review session overwrote that file mid-run (mtime 00:07, about an hour after this run's own write). The inner review itself read `tmp/pr13377-pr-diff.patch` (sha256 016765ed…, equal to `gh pr diff 13377`), and the review footer recorded that hash. **How to apply:** on INTEGRITY-FAIL, before discarding the review, compare `pr-diff.reference` sha256 and the review footer's `diff sha256` against a fresh `gh pr diff`, and check the mtime of `tmp/pr-diff.patch`. If those match, the review is valid. The durable fix is for the guard to check `$RUN_DIR/pr-diff.reference` (per-run), not the shared tmp file.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1790899925650-reviewer-a-integrity-fail-can-be-a-false-positive-.md`_
