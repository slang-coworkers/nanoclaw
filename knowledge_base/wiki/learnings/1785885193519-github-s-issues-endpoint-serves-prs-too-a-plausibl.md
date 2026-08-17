---
title: "GitHub's issues endpoint serves PRs too — a plausible zero from the wrong surface; when a path can name two objects, query both"
type: learning
topic: misc
source: learnings/1785885193519-github-s-issues-endpoint-serves-prs-too-a-plausibl.md
---

# GitHub's issues endpoint serves PRs too — a plausible zero from the wrong surface; when a path can name two objects, query both

**Evidence base: ONE instance (2026-08-04, slang#12343/#12348), but the API behaviour is documented and permanent, and the failure was actionable. Structural, not situational.**

## The trap

`GET /repos/{owner}/{repo}/issues/{N}/comments` **serves pull requests as well as issues** — a PR is an issue with a `pull_request` field. So querying `issues/12348/comments` returns the **PR's** comment surface, not the linked issue's. It answers, exit 0, with a plausible number.

A reviewer queried `issues/12348/comments` → **0** and reported *"no issue comments exist, so nothing is owed publicly."* Actual state:

| surface | count |
|---|---|
| PR #12348 comments | **0** |
| PR #12348 reviews | 0 |
| **issue #12343 comments** | **2** — the triage verdict and the fixer's 5-bullet, both current |

They had measured the PR and labelled it the issue.

## Why it was actionable, not pedantic

Under the draft-held rule, a draft PR's `Fixes #N` gives the linked issue **no visible footprint**, so a 5-bullet comment on the **issue** is a required artifact. The sentence implied that obligation was unmet when it was met — **so acting on it would have posted a duplicate onto an issue that already had its trail.** The conclusion ("nothing owed") happened to survive; the reason was wrong in exactly the half someone would act on.

I then repeated the error one tier up: I reported the issue's state to the operator having taken the reviewer's framing, which is the second time on that chain a wrong reason travelled with a correct conclusion because the conclusion checked out.

## The rule

**When an API path can name two different objects, query both and compare — do not reason about which one you got.** A single plausible number is not evidence you addressed the intended surface.

Concretely, for GitHub:
- PR review state → `pulls/{N}/reviews`
- PR conversation comments → `issues/{N}/comments` *with N = the PR* (yes, the issues path)
- PR inline/diff comments → `pulls/{N}/comments` (a **third** surface)
- **the linked issue's** comments → `issues/{M}/comments` with **M = the issue number**, which is *not* the PR number

Cheap discriminator: fetch the object and check for a `pull_request` field. Its presence means you are holding a PR regardless of which path you used.

## The family this belongs to

Seventh instance of one mechanism on that chain, and the shape never varied: **two objects answering to one name, with a plausible value returned for the wrong one.** `.base.sha` vs merge-base · `$?` vs test outcome · `getCount` on a neighbouring type (`IROperandList`, not `IRInstList`) · `grep -qi error` vs failure (matched `CXXFLAG_Werror_return_local_addr`) · a symbol name vs a stringified assert · a usage contract (*"do not rely on side effects"*) vs evaluation semantics · a 215 KB thin driver vs the 33 MB `libslang-compiler.so`. Each proxy agreed with its target under normal conditions — which is precisely why it looked adequate when chosen.

Three rules, all **construction** rather than vigilance:
1. Build a check that can only pass when the target is true.
2. Pair it with a control that would fail if the check were blind.
3. When a path can name two objects, query both rather than reasoning about which you got.

Related: `1785866171715` (instrument domain / proxy-correlation — this is its seventh instance), `1783078003012` (verify a PR↔issue relationship before assuming duplication — adjacent, about the linkage rather than the endpoint).

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785885193519-github-s-issues-endpoint-serves-prs-too-a-plausibl.md`_
