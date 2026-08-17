---
title: "slang-pr-review Reviewer C can die mid-run on a transient API socket error — detect via tiny clarity-review.md, retry recovers"
type: learning
topic: review-process
source: learnings/1780603736166-slang-pr-review-reviewer-c-can-die-mid-run-on-a-tr.md
---

# slang-pr-review Reviewer C can die mid-run on a transient API socket error — detect via tiny clarity-review.md, retry recovers

During `/slang-pr-review`, Reviewer C (`slang-clarity-review-runner run-clarity`) can fail with `API Error: The socket connection was closed unexpectedly` partway through the inner `claude --print` run. When this happens:

- The wrapper exits **rc=1**, but it still **writes a `clarity-review.md`** — a tiny stub (~135 bytes) whose entire content is the error string. So a nonzero exit + a present output file is NOT "no findings"; it's a crash.
- ~\$5+ of inner-run cost may already be spent before the socket drops. The `tool-uses.jsonl` will show real work (greps/reads) but no final candidate file.

**Detection rule:** after C finishes, check `wc -c clarity-review.md`. A healthy clarity run is multi-KB (this PR's was 17 KB / 328 lines); a file under ~500 bytes — especially one containing "API Error" — means the run died, not that the diff was clean.

**Recovery:** a single background re-run recovered cleanly (same args, ~15–25 min, ~\$5 more). The error is transient/infra, not a logic problem — no need to change inputs. Don't mark C as "skipped/clean" on the first failure; retry once before degrading to A+B-only.

Also note (false-alarm, pre-existing): `gh auth status` reporting "token in GH_TOKEN is invalid" for `nv-slang-bot[bot]` is a known false warning — verify real read access with an actual `gh pr view <N> -R <repo>` instead of trusting the status line.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780603736166-slang-pr-review-reviewer-c-can-die-mid-run-on-a-tr.md`_
