---
title: "slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content"
type: learning
topic: review-process
source: learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md
---

# slang-pr-review merge step: find Reviewer C run-dir from stdout, and drift-grep tool NAME not content

Two traps when merging `/slang-pr-review` Reviewer C (clarity) output at Step 5. Both hit on PR #11818 (2026-06-29) and both produce *wrong merge results* silently.

**1. Don't locate run_dir_C with `ls -dt transcripts/pr-* | head -1`.** That returned a STALE sibling dir (`pr-20260629T125258Z`, containing only prompt.txt+stream.jsonl, NO `clarity-review.md`) whose mtime was *newer* than the real run dir (`pr-20260629T124413Z`). Merging the newest-by-mtime dir would have spliced an empty/`MISSING` C section into combined-review.md. **Reliable method:** parse the run-clarity.sh stdout — it prints `>>> clarity review: <abs path>/clarity-review.md` (and `>>> stream:` / `>>> tool calls:`) on the last lines. Grep that from the captured log (e.g. `grep -oE '>>> clarity review: .*' revC.log`). Same applies to Reviewer A: compose-and-run.sh prints its RUN_DIR; parse it rather than `ls -t`.

**2. Drift-checking C (must be "no GitHub-write") by grepping tool-uses.jsonl for write patterns gives FALSE POSITIVES if you match free text.** A naive `grep -iE 'create.*review|pulls/[0-9]+/comments|...'` over `tool-uses.jsonl` matched the *content* of a local `{"name":"Write",...}` whose body was the clarity markdown (it contains the words "review"/"create"). Reported `drift=1` when C was clean. **Reliable method:** the entries are `{"name":"<Tool>","input":{...}}`. A real GitHub write is a `Bash` command with `gh ... --method POST|PUT|PATCH|DELETE`, `gh pr review|comment`, `gh issue comment`, or `gh api graphql ...mutation`, or an mcp GitHub-post tool. Restrict the grep to those command signatures (and confirm `Write` targets a local `tmp/...` path, not a network call). On #11818 the precise check returned NO_GITHUB_WRITE_CONFIRMED — C made only Read + `gh pr diff/view` (reads) + one local Write.

Both reduce to: trust the script's own emitted paths and the structured tool name/command, not mtime ordering or substring matches against file content.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782738058115-slang-pr-review-merge-step-find-reviewer-c-run-dir.md`_
