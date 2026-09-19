---
title: "slang-pr-review: stacked-PR review + final-review.md wrap-up extraction + FETCH_HEAD race"
type: learning
topic: slang-compiler
source: learnings/1789733573227-slang-pr-review-stacked-pr-review-final-review-md-.md
---

# slang-pr-review: stacked-PR review + final-review.md wrap-up extraction + FETCH_HEAD race

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789726735391-b079j4
written_at: 2026-09-18T12:12:53.227Z
---

# slang-pr-review: stacked-PR review + final-review.md wrap-up extraction + FETCH_HEAD race

Running /slang-pr-review on a **stacked draft PR** (base = another fix branch, not master) and across two rounds surfaced three practical gotchas:

1. **`gh pr diff <N>` already scopes to the delta.** For a PR whose base is a sibling fix branch (e.g. #13173 based on fix/issue-13166), `gh pr diff` diffs head-vs-base and returns ONLY the PR author's delta — no need to compute a three-dot diff manually. The runner's `pr` mode is correct as-is for stacked PRs.

2. **`compose-and-run.sh` sometimes captures the CLI's closing wrap-up turn in `final-review.md`, not the review body.** When the inner claude CLI ends with a meta turn ("All reviewers complete, the harness will write the markdown…"), `final-review.md` is ~8 lines of wrap-up and the real review (Verdict + inline comments + `reviewed:` footer) lives in an EARLIER assistant turn. Reconstruct it from `<run_dir>/stream.jsonl`: pull all `type==assistant` text blocks (+ top-level `type==result`), pick the longest containing `**Verdict**`/`reviewed:`/`Inline comment`, and slice from `**Verdict**`. The summarizer's severity counts can read 0/0/0 in this case because it parsed the wrap-up — trust the extracted body's findings, and cross-check the `result` field which carries the same summary.

3. **Background reviewers race on the shared /workspace/agent/slang checkout's FETCH_HEAD.** compose-and-run + run-clarity each `git fetch` the PR concurrently, so `git show FETCH_HEAD:...` in the parent can point at an unrelated commit mid-run. For your own delta verification, use a stable snapshot you captured yourself (`gh pr diff > /tmp/x.diff`) or read blobs by explicit immutable commit SHA — never rely on FETCH_HEAD while reviewers run.

Also: Devin (Reviewer B) reliably times out on stacked draft PRs (anonymous scrape doesn't converge) — treat as best-effort skip, note it, and let A+C carry the verdict. And the two-round pattern worked well: round-1 REQUEST_CHANGES (one confirmed reachable crash via `%a=OpNop %a` self-reference that the validator's `default:break` skipped) → fixer applied the exact suggested guard (`content >= i`) + closed test gaps → round-2 clean APPROVE_WITH_NITS.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789733573227-slang-pr-review-stacked-pr-review-final-review-md-.md`_
