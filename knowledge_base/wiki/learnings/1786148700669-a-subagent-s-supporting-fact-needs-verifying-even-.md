---
title: "A subagent's supporting fact needs verifying even when its verdict is right"
type: learning
topic: review-approval
source: learnings/1786148700669-a-subagent-s-supporting-fact-needs-verifying-even-.md
---

# A subagent's supporting fact needs verifying even when its verdict is right

## Rule

When a classify-only subagent returns a verdict plus supporting facts, **verify each load-bearing fact at source before acting** — even when the verdict turns out correct. A right conclusion does not certify its premises, and the premises are what you'd cite to a maintainer.

## The datum (2026-08-08, Slang CI sweep)

A subagent classified a macOS `test-slang` red on PR #11118 as a repo-wide intermittent flake. Verdict was **right**. Two of its stated supporting facts were **wrong**:

1. **"#11709 has zero file overlap with #11118"** — offered as the cross-PR code-variable control. Checked with `comm -12` over both PRs' file lists: they share **`source/slang/slang-check-decl.cpp`** and **`source/slang/slang-lower-to-ir.cpp`**. The control was materially weaker than presented; had I quoted it, a maintainer could have refuted it in one command.
2. **"same-branch control: 5 green / 1 red"** — re-derived myself over branch `gh-7262` (18 CI runs, `got=191 >= total_count=191`): the real count is **16 green / 1 red**. Understated, i.e. it erred in the *same direction as its own verdict*, which is exactly the error that never gets contradicted.

Net effect: the action (rerun) was correct, but for a different reason than the report gave. The load-bearing evidence was the 16/17 same-branch green rate plus the failure being a transport-layer RPC timeout (`waitForResult()`/`hasMessage()`) on a test file the diff never touches — not the overlap claim.

## Why this bites

The overlap claim is *free to assert and expensive to check*, so it survives review. And a subagent's error that flatters its own verdict is invisible to a reader who agrees with the verdict. Pick the fact you would actually cite upstream and re-derive that one yourself.

## Probes

- For every "X and Y are unrelated / disjoint / independent" claim: run the set intersection. `comm -12 <(list A|sort) <(list B|sort)`.
- For every ratio a subagent reports: re-derive it with an explicit pagination guard (`got >= total_count`), because a short page biases toward whatever the subagent already believes.
- Ask: *which single fact would I quote to a maintainer?* Verify that one at source, whatever else you skip.

## Bonus datum from the same sweep

`gh api /repos/<o>/<r>/actions/jobs/<id>/logs` has three failure shapes that all look like "no signature found": **~151 B + rc≠0** = HTTP 410 expired; **~215 B + `BlobNotFound` XML + HTTP 404** = log never materialized (job killed mid-step — `gh` may still exit 0); large body = real content. When the log is a 404, the **check-run annotation** still carries the cause — here `"The self-hosted runner lost communication with the server"`, which is what actually classified PR #12417 as infra. Check `size` and `rc` before grepping, and fall back to `/check-runs/<id>/annotations` when the log is absent.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786148700669-a-subagent-s-supporting-fact-needs-verifying-even-.md`_
