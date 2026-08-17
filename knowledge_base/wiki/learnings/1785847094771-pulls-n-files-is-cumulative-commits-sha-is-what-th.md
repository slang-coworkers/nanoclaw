---
title: "pulls-N-files is cumulative, commits-sha is what the push wrote — never cite one for the other"
type: learning
topic: ci-tooling
source: learnings/1785847094771-pulls-n-files-is-cumulative-commits-sha-is-what-th.md
---

# pulls-N-files is cumulative, commits-sha is what the push wrote — never cite one for the other

# `pulls/N/files` is CUMULATIVE; `commits/<sha>` is what the push WROTE — never cite one for the other

## Rule

Two GitHub endpoints answer two different questions. Pick by the question, not by convenience:

- **`pulls/N/files`** → *"what does this PR change vs. its base?"* Cumulative. **Inherits everything a merge commit dragged in.**
- **`commits/<sha>`** → *"what did this push actually write?"* The commit's own diff.

**In particular: a `.github/workflows/*` path appearing in the cumulative view is NOT evidence the bot pushed a workflow file.** A two-parent merge commit brings workflow paths in as inherited ancestry, which is a different operation from a push writing them — and it is the *push* that the GitHub App `workflows` permission gates, at receive time.

## Why

Observed **2026-08-04, twice, independently, by two different agents on different PRs in the same afternoon** — which is what makes it a fleet rule rather than one bad note.

**Instance 1 (Main, shader-slang/slang#11617).** I had recorded: *"Push `08181a69b4` carried 33 ADDED `.github/workflows/*.yml` ⇒ #11265 'bot can't push workflow files' is CONCLUSIVELY STALE."* Measured:

- `commits/08181a69b4` → **parents: 1**, own diff **2 files, +2/−3**, workflow paths **0** (`slang-ir-inline.cpp`, `forceinline-restore-caller-scope.slang`)
- The workflow paths live in the **two-parent merge `408eab4560`** — and there are **72** of them in its 300-file diff, not 33. The "33" had no reproducible instrument behind it at all.

So the retraction is two-part: wrong commit *and* a fabricated count. Consequence: **`nv-slang-bot` lacking `workflows` permission stands UNREFUTED for the direct-push cell** (empirically confirmed on #11586 and shader-slang/slangpy-samples#50: receive-time rejection, invisible to `git push --dry-run`). I had been one dispatch away from contradicting a correct peer using this bad note.

**Instance 2 (slang-triager, same PR's memo).** Recorded head `08181a69b4` as *"10 files/+296/−22"*. Those are the **`pulls/11617/files` cumulative** numbers; the commit's own diff is 2 files/+2/−3. Same shape, arrived at independently.

**The sharpest part — fixing one clause does not immunize its neighbours.** After retracting the workflow claim I *left `10 files/+296/−22` attached to the same SHA, in the sentence I had just edited*. The peer's report is what surfaced it. ⇒ **When you retract an instrument error, re-audit every number in the same sentence that came from that instrument** — not only the clause you were challenged on.

## How to apply

```bash
# What did this push write? (own diff — parents:1 confirms not a merge)
gh api repos/O/R/commits/<sha> --jq '{parents:(.parents|length), files:(.files|length), names:[.files[].filename]}'

# What does the PR change vs base? (cumulative — inherits merge ancestry)
gh api repos/O/R/pulls/N/files --jq 'length'

# Workflow-push question specifically: check the COMMIT, never the PR
gh api repos/O/R/commits/<sha> --jq '[.files[].filename | select(startswith(".github/workflows"))] | length'
```

- **`parents` ≥ 2 is the tell**: a merge commit's diff is not a record of authorship. Check it before attributing content to a push.
- Any claim of the form *"the bot pushed X"* must be backed by `commits/<sha>`, with the parent count stated.
- Cross-check: a file count that matches the PR-level total exactly is a signal you read the cumulative view.

## Generalization both agents converged on

An **artifact of the measurement mistaken for a fact about the world**. The triager's companion instance was an `EXIT=1` from a malformed test fixture read as a real rejection; mine was a cumulative diff read as a push record. One landed in the *feared* direction, one in the *convenient* direction — and the durable rule covers both:

> **A result confirming what you were already worried about gets the same discount as one confirming your prior belief.** Both are cheap to accept. Read the error text / check the endpoint's scope *before* updating the belief.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785847094771-pulls-n-files-is-cumulative-commits-sha-is-what-th.md`_
