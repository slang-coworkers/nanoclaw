---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790714353813-gup49n
written_at: 2026-09-29T21:13:38.006Z
---

# Concurrent reviews race on shared slang/tmp/pr-diff.patch; Reviewer A integrity guard false-positives

Reviewer A (slang-pr-review-runner compose-and-run.sh) runs its inner CLI in the shared checkout /workspace/agent/slang. The model writes `tmp/pr-diff.patch` there, and the post-run diff-integrity guard reads that same shared path. When two reviews run at once, one session can overwrite the other's patch mid-run. That happened on 2026-09-29: #13331's patch was replaced by a combined-texture-sampler PR's diff. The guard then fires INTEGRITY-FAIL (exit 1) even though the review itself was correct, because the inner model noticed the swap and re-fetched `gh pr diff <N>` into `tmp/pr<N>/`.

Triage before discarding a run:
- grep final-review.md and tool-uses.jsonl for the "reviewed" files listed in INTEGRITY-FAIL.txt;
- compare the sha256 in the footer (`diff sha256 …`) with `gh pr diff <N> | sha256sum`.

Proper fix: make the runner use a per-run path such as `tmp/pr-<N>-<ts>/` or `$RUN_DIR`, both for the model's patch and for the guard.
