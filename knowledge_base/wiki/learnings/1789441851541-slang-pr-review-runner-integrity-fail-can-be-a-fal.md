---
title: "slang-pr-review-runner INTEGRITY-FAIL can be a false positive under concurrent runs (shared tmp/pr-diff.patch)"
type: learning
topic: slang-compiler
source: learnings/1789441851541-slang-pr-review-runner-integrity-fail-can-be-a-fal.md
superseded_by: 1789506920553-slang-pr-review-runner-integrity-fail-can-be-a-fal
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false positive under concurrent runs (shared tmp/pr-diff.patch)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789440049823-a7tvb7
written_at: 2026-09-15T03:10:51.541Z
---

# slang-pr-review-runner INTEGRITY-FAIL can be a false positive under concurrent runs (shared tmp/pr-diff.patch)

**Symptom:** `slang-pr-review-runner`'s `compose-and-run.sh` exits nonzero with `!!! INTEGRITY-FAIL: reviewed diff != PR <N> files — review targeted the WRONG diff`, and writes `INTEGRITY-FAIL.txt` listing files from a *completely different* PR — even though `final-review.md` is a correct, on-target review of the requested PR.

**Root cause:** The post-run guard reads `$REPO_ROOT/tmp/pr-diff.patch` (REPO_ROOT defaults to the SHARED `/workspace/agent/slang`) and compares its `+++ b/` paths to the live PR file list. That tmp path is **shared across all concurrent runs** of the runner. When a second slang review run starts on the same checkout while the first is still going, the second writes ITS diff to the same `tmp/pr-diff.patch`, clobbering it. The first run's post-run guard then diffs the foreign file → false INTEGRITY-FAIL. (The script clears the file at *start* to avoid the reverse stale-read, but nothing prevents a concurrent run from re-writing it mid-flight.)

**How to confirm it's a false positive (don't discard the review):**
1. `<run_dir>/pr-diff.reference` is the runner's OWN authoritative capture at dispatch — check its files/sha256. If it matches the real PR, the run reviewed the right thing.
2. The `final-review.md` footer `reviewed: <sha> · diff sha256 <hash>` should equal that pr-diff.reference hash.
3. `grep -c` the run's `tool-uses.jsonl` for PR-specific identifiers vs the foreign PR's — expect an overwhelming ratio toward the correct PR (saw 34:1).
4. Cross-check mtimes: a concurrent `transcripts/pr-<TS>` dir created during your run + `tmp/pr-diff.patch` mtime inside your run window = the race.

Also note: the model's sandbox DENIES `> tmp/pr-diff.patch` redirects, so the reviewer subagents typically fall back to a live bare `gh pr diff <N>` for the actual review content — which is why the review stays correct even when the shared tmp file is wrong.

**Fix worth proposing upstream:** give each run a private tmp dir (e.g. `$RUN_DIR/pr-diff.patch`) instead of the shared `$REPO_ROOT/tmp/`, so the post-run guard can't be clobbered by a concurrent run. Until then, when INTEGRITY-FAIL fires, verify via pr-diff.reference + footer hash + tool-uses grounding before treating the run as failed; set `reviewers_complete: true` if the review is provably on-target and drift==0. Observed on shader-slang/slang-rhi#869 (2026-09-15).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789441851541-slang-pr-review-runner-integrity-fail-can-be-a-fal.md`_
