---
title: "Concurrent slang PR reviews contaminate shared tmp/ and transcripts/ — pin run dirs, don't trust exit-1"
type: learning
topic: slang-compiler
source: learnings/1789443118244-concurrent-slang-pr-reviews-contaminate-shared-tmp.md
---

# Concurrent slang PR reviews contaminate shared tmp/ and transcripts/ — pin run dirs, don't trust exit-1

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789440799835-bm2rjm
written_at: 2026-09-15T03:31:58.244Z
---

# Concurrent slang PR reviews contaminate shared tmp/ and transcripts/ — pin run dirs, don't trust exit-1

When multiple `/slang-pr-review` runs execute concurrently in the same reviewer container, they SHARE two mutable paths and clobber each other. Seen live during review of shader-slang/slang#13083 while sibling sessions reviewed #13081, #869, #868, gh-12785, etc.

**1. `/workspace/agent/slang/tmp/pr-diff.patch` clobber → false-positive INTEGRITY-FAIL (exit 1).**
`compose-and-run.sh`'s post-run guard re-reads `tmp/pr-diff.patch` and compares its file list to `gh pr view <PR> --json files`. A concurrent review overwrites that shared file mid-run, so the guard sees a DIFFERENT PR's files and exits 1 with `INTEGRITY-FAIL.txt`. **The review itself can still be valid**: the inner claude model detects the contamination (sha256 mismatch vs context.json), re-stages the correct diff to an isolated path, aborts its first subagent dispatch, and re-runs — then stamps the correct head+hash in `final-review.md` (e.g. `reviewed: <sha> · diff sha256 <hash>`) and its process note explains it. **Do NOT discard Reviewer A on exit-1 alone.** Verify: (a) `final-review.md`'s stamped head/hash == `gh pr view <PR> --json headRefOid`; (b) `summarize.py` shows run-state success + drift==0; (c) the review body cites the target PR's real symbols. If all hold, it's a false positive — report `reviewers_complete:true` with a coordinator note.

**2. Shared `transcripts/` dir → run-dir drift.** Both `slang-pr-review-runner` and `slang-clarity-review-runner` write `transcripts/<key>-<TS>/`. `ls -1dt transcripts/*/ | head -1` picks whichever run finished most recently — often a CONCURRENT review's dir, not yours. I nearly shipped a combined report whose Reviewer-C section was a different PR's (gh-12785) clarity review because of this. **Always pin run_dir from the exact path printed at launch** — capture the runner's stdout (`>>> output → <dir>` for clarity; the timestamped `pr-<TS>` dir for A) into a per-review log and read it back. Clarity dirs conveniently embed the head+hash in the name (`pr-pr<N>-<headsha>-<diffhash>-…`), so match on that. Before merging, grep each reviewer section for the target PR's unique symbols and assert 0 hits for the other PR's symbols.

**Fixes worth proposing upstream:** stage each run's diff in an isolated per-run tmp (not shared `slang/tmp/`); have the runners print a machine-readable `RUN_DIR=` line the workflow captures instead of newest-dir discovery.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789443118244-concurrent-slang-pr-reviews-contaminate-shared-tmp.md`_
