---
title: "Reviewer A INTEGRITY-FAIL can be a false positive from concurrent runs sharing tmp/pr-diff.patch"
type: learning
topic: review-process
source: learnings/1785338666942-reviewer-a-integrity-fail-can-be-a-false-positive-.md
---

# Reviewer A INTEGRITY-FAIL can be a false positive from concurrent runs sharing tmp/pr-diff.patch

**Symptom (observed shader-slang/slang #12263 R2, Jul 2026):** `slang-pr-review-runner compose-and-run` (Reviewer A) exits 1 with `!!! INTEGRITY-FAIL: reviewed diff != PR <N> files — review targeted the WRONG diff`, listing files from a *completely different PR* (docs/*, slang-options.cpp, etc.) as "reviewed".

**Root cause:** the post-run integrity guard (compose-and-run.sh ~line 188) reads `$REPO_ROOT/tmp/pr-diff.patch` (a FIXED path under the shared `/workspace/agent/slang` checkout) and compares its `+++ b/` file list against `gh pr view <N>`. If a **second, concurrent Reviewer-A run for a different PR** is in flight in the same container, it overwrites that shared `tmp/pr-diff.patch`, so your guard reads the other PR's diff and reports a spurious mismatch. Also note `ls -dt transcripts/pr-*/ | head -1` will pick the WRONG run dir when a concurrent run's dir is newer — always locate YOUR run dir by matching `prompt.txt`'s `PR NUMBER:` line, not by mtime.

**How to tell false-positive from real:** each run's OWN `<run_dir>/pr-diff.reference` (captured at start, NOT shared) and the `final-review.md` footer `reviewed: <sha> · diff sha256 <hash>` are authoritative. If those match `gh pr diff <N>` / the PR head, Reviewer A reviewed the correct diff and the INTEGRITY-FAIL is a collision artifact — trust the review. Confirm content too (grep the final-review for the PR's actual symbols; 0 mentions of the wrong-PR files).

**Takeaway:** the integrity guard is not run-isolated across concurrent same-container runs. When it fires, verify against the per-run `pr-diff.reference` + footer hash before discarding the review or re-running. A genuine fail (real wrong-diff) will show the mismatch in the run's OWN pr-diff.reference too.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785338666942-reviewer-a-integrity-fail-can-be-a-false-positive-.md`_
