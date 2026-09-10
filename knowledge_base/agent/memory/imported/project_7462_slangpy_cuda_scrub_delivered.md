---
type: project
name: project_7462_slangpy_cuda_scrub_delivered
description: "slang#7462 slangpy-CUDA scrub DELIVERED 08-05 — reassign-and-narrow, not close; 3 human checklist items pending. RESUME: a checklist answer → slang-triager on gh-issue-shader-slang/slang-7462."
metadata:
  node_type: memory
  type: project
  originSessionId: main-7462-scrub
---

# slang#7462 — "Check support for slangpy CUDA backend" — scrub DELIVERED, awaiting human

**RESUME TRIGGER:** a human answers any of the three checklist items on the issue (webhook lands on
`gh-issue-shader-slang/slang-7462`) ⇒ forward to `slang-triager` on that exact thread. Tested 08-05:
issue **open, 3 comments** ⇒ the trigger event remains occurrable, so this is **live, not stale**.

## What was asked
`@jkiviluoto-nv` (cmt `5195815854`, 18:40Z): scrub for relevance / reassign / close, because assignee
`mkeshavaNV` is stepping away. Issue filed 2025-06-17 by `mkeshavaNV` (self-assigned), label `cuda`,
milestone **Q4 2025 (Fall)** — closed, 7 months expired.

## Verdict delivered
**Still relevant, mostly done → reassign and narrow to a named residue; do NOT close.** Posted by
`slang-triager` as comment **`5196451411`** (5,859 chars, `nv-slang-bot[bot]`), issue left open, no
labels or Type changed. Three genuinely-human calls left as an unchecked markdown checklist so a reply
becomes the next chain inbound: **who inherits** · **was dropping `hard-rasterizer` deliberate**
(`@saipraveenb25` scoped the three) · **should the ticket move to slangpy-samples**.

## The four findings that changed the answer
The ports live in **shader-slang/slangpy-samples** (slangpy's `samples` submodule), which is why they
looked absent from `shader-slang/slang`.

| finding | evidence |
|---|---|
| both CUDA ports **pass** | re-derived on `main` (run `31010713264`, job `92321865219`) and a Slang-dispatched run — **not** the PR-branch evidence I briefed |
| `hard-rasterizer` **never started** | 0 commits on that path vs a control of 2 for `fwd-rasterizer`; upstream slang-torch source still exists ⇒ not-done, not obsoleted; no successor issue in 3 repos |
| **#9419 superseded** | it is a **PR not an issue**, 1,005 commits behind base, patching a `test-slangpy` job deliberately deleted by #10454/`25e6d713d`; the gate already ships via `ci-slangpy-trigger-test.yml` → `ci-latest-slang.yml` |
| residue **wider than briefed** | `soft-rasterizer-pytorch` (the only CUDA↔torch-interop example) *and* `diff-splatting` have **no test function at all**; 15 of 21 example dirs execute; 3 more are explicit `pytest.skip` |

⛔**Boundary on the gate claim** (mine, narrowing the triager's wording):
`ci-slangpy-trigger-test.yml:33` carries `draft != true`, so the gate covers **non-draft PRs, the merge
queue, and manual dispatch** — not literally every PR. Verdict unaffected; drafts weren't covered under
#9419's scheme either, and `merge_group` is what guards landing.

## Two things worth keeping from how this ran
⭐⭐⭐**The triager refused a subagent's "descendants of #7462" claim after measuring zero references in
all three candidate bodies.** A fabricated lineage is exactly what would have licensed closing the
ticket over a real gap — the single highest-value act in the chain.

⭐⭐⭐**My briefing labelled its two unverified leads AS leads** ("I have not opened these — treat as
questions, not facts"), and **both turned out wrong**. Written as findings they'd have been inherited
into a public verdict. The label cost one clause; see
[[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]] for the corollary about all-clears.

Two corrections landed against me and both held under my own re-measurement: `search/issues` returns
PRs as well as issues (check `.pull_request`), and my "no re-post needed" all-clear was a grep for
`every PR` when the live string was `every Slang PR`.
