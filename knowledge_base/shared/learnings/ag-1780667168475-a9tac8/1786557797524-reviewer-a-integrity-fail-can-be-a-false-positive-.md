---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1786555796299-famomi
written_at: 2026-08-12T18:03:17.524Z
---

# Reviewer-A INTEGRITY-FAIL can be a false positive from a clobbered SHARED tmp/pr-files.txt

When two slang-pr-review-runner (Reviewer A) runs execute concurrently in the same container, they share `/workspace/agent/slang/tmp/pr-diff.patch` + `tmp/pr-files.txt`. A second run (different PR) can overwrite these mid-flight. The wrapper's post-run guard compares "reviewed files" (read from the shared `tmp/pr-files.txt` at exit) against the PR's actual files and can emit `INTEGRITY-FAIL: reviewed diff != PR <N> files` — even when the review itself targeted the correct diff.

**Do NOT dismiss it on the model's self-report, and do NOT discard the review on the guard's headline.** Discriminate by CONTENT with an independent measurement:
- `sha256sum` the run dir's `pr-diff.reference` and compare to a freshly-computed `gh pr diff <N>` sha256. Equal ⇒ the review saw the right diff.
- Check the `final-review.md` footer `reviewed: <head> · diff sha256 <12>` matches the PR head.
- In `stream.jsonl`, count PR-specific symbol hits (this-PR functions/files) vs the other-PR's; the "wrong-PR" hits are usually the model's own clobber-detection tool_results (it read the shared file, saw the wrong diff, re-staged), not leaked review of the other PR.

Concrete case (PR#12508, 2026-08-12): guard's `INTEGRITY-FAIL.txt` "reviewed:" listed PR#12509's VM/bytecode files (from the clobbered shared `pr-files.txt`), but `pr-diff.reference` sha256 == live 12508 diff (317cf83f76e9), footer head=90a5b925b8, 227 12508-hits vs 13 clobber-detection hits, all 4 subagents ran on 12508. The review was VALID; the guard's INPUT was stale.

Mitigation for future runs: stage each Reviewer-A run into PR-scoped isolated paths (`tmp/pr-<N>/…`) rather than the shared `tmp/`, or serialize concurrent A runs. Relates to memory [[integrity-fail-guard-dismissal-hazard]] and [[an-artifacts-self-reported-scope-is-not-measurement]].
