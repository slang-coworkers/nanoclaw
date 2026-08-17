---
title: "CodeRabbit findings live on pulls/N/comments, not reviews[].body — a successful exit-0 harvest can score 0 findings when 11 exist"
type: learning
topic: review-process
source: learnings/1785778143329-coderabbit-findings-live-on-pulls-n-comments-not-r.md
---

# CodeRabbit findings live on pulls/N/comments, not reviews[].body — a successful exit-0 harvest can score 0 findings when 11 exist

## The bug

Review-harvest tooling that counts severity markers in **`pulls/N/reviews[].body`** systematically under-reads CodeRabbit. CodeRabbit's review *body* is frequently **status boilerplate only** — e.g. `Actionable comments posted: 11` plus a collapsed config block, with **zero severity markers**. All the actual findings are **inline comments on `pulls/N/comments`**, an endpoint the harvest never queries.

**Why this is worse than a normal gap:** it fires on a *successful* harvest. Exit 0, body retrieved, markers tallied → **0 findings**, while 11 real findings (2 Major) sit one endpoint away. There is no error to investigate and no signal that anything was missed.

## Evidence (slang-rhi#803, 2026-08-03)

- R1 CodeRabbit review `4816225157` @ `2fc21a3`: body is 1186 chars of `Actionable comments posted: 11` + collapsed config, **no severity markers**. The 11 findings — **2 🟠 Major, 3 🟡, 6 🔵** (3 Functional Correctness) — were all inline on `pulls/N/comments`. Harvest scored it "clean 0/0/0".
- R2 only *appeared* non-clean because CodeRabbit happened to inline one Major **into the body** that round. **Formatting luck, not correctness** — the same code would have under-read it with a different body layout.
- Not a bot-filter bug: `collect-reviews.sh:87-90,139` and `harvest-reviews.py:51-54,137` use REST `pulls/N/reviews` with an **exact-match allowlist** (`login in ("github-actions[bot]","coderabbitai[bot]")`). No `endswith("[bot]")`, no GraphQL in the harvest path. R2 harvested `coderabbitai[bot]` verbatim — the matching works.

## The fix

1. **Also tally `pulls/N/comments`** (inline review comments), not just `reviews[].body`.
2. **Treat `Actionable comments posted: N` with N>0 and zero severity markers in the body as a hard "findings are elsewhere" flag** — never as clean. That single check converts the silent under-read into a loud one.
3. **Use `original_commit_id`, not `commit_id`, for provenance.** GitHub **rewrites inline comments' `commit_id` as the head advances** — 8 of the 11 R1 findings now report `commit_id == R3`, three revisions later. Only `original_commit_id` preserves which revision the finding was made against.
4. **`status green ≠ a harvestable review`:** at R3, CodeRabbit's check was green but it produced **no review object** — the run updated its walkthrough comment instead. Absence of a review is not absence of a bot pass.

## Scope

`slang-pr-approver` and `slangpy-pr-approver` harvest scripts are **byte-identical** (sha256 `cbbb72da…`), so both are affected. **slangpy is exposed worse**, because CodeRabbit is often its *only* review signal — a body-only tally there means an approver row can read "clean" with every finding unexamined. **Recommend auditing past slangpy rows whose CodeRabbit harvest reported 0 findings.**

## Related discipline

A separate, real trap in the same family — **a timeout is a statement about a past instant, not the present.** In this same incident the harvest's exit-22 was *correct when computed* (07:04:49) but the review landed 07:07:42, ~3 min later; the verdict was then synthesized and reported at 07:12:04 without a final re-probe of a signal already flagged as imminent. **Re-probe at the last moment before committing an artifact that depends on a "not yet available" result.**

Same family as ["present" and "passing" are not "exercising"] — a green/successful signal that is structurally silent about the thing you needed to know.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785778143329-coderabbit-findings-live-on-pulls-n-comments-not-r.md`_
