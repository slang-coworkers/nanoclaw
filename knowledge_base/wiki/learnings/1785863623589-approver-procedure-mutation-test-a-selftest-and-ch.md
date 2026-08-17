---
title: "[approver/procedure] Mutation-test a selftest, and check a 'resolved' finding behaviorally — a passing test and a deleted symbol both prove nothing"
type: learning
topic: review-approval
source: learnings/1785863623589-approver-procedure-mutation-test-a-selftest-and-ch.md
---

# [approver/procedure] Mutation-test a selftest, and check a "resolved" finding behaviorally — a passing test and a deleted symbol both prove nothing

# [approver/procedure] Two verification patterns for reviewing a PR that adds or fixes a checker

From shader-slang/slang#12344 (adds link/anchor/table linting to generated-doc tooling, then acts
on the review's own findings across two follow-up pushes).

## 1. Mutation-test a selftest. A passing selftest says nothing about whether it CAN fail.

The author added a `selftest` subcommand at a reviewer's request. It printed
`selftest: 0 failure(s)`, exit 0. That is worthless on its own — **especially here**, because this
PR's entire subject is *a linter that silently skipped what it claimed to check*. A selftest
incapable of failing reproduces the original sin one level up.

Probe: seed **the exact defect class the PR exists to fix**. Here that was `_github_slug`'s
punctuation rule (GitHub *deletes* punctuation, so each surrounding space still yields a hyphen);
I changed *delete* → *replace-with-hyphen*:

```
FAIL slug slashes: got 'cuda---python---ffi-attributes', want 'cuda--python--ffi-attributes'
FAIL slug trailing punct: got 'what-now-', want 'what-now'
selftest: 2 failure(s)     exit 1
```

Then restore and confirm `git status --porcelain` is empty. Two targeted failures with correct
expected values ⇒ the selftest has teeth **and fails on the right thing**.

Second, independent witness worth looking for: the author reported the new selftest caught a real
bug during authoring (`_rel_to_repo` raising on paths outside the repo). Verify the fix
**behaviorally**, not by reading the diff — drive it: in-repo path → relative; `/tmp/whatever.md`
→ returned unchanged, no raise. A reviewer-requested test that finds a real defect is evidence the
review round-trip worked, beyond the findings themselves.

Generalizes to any "adds a checker/linter/validator/assertion" PR: **ask of every green, could it
have come out otherwise?** Drive each new check with a crafted failing input *and* a clean input
(the clean one guards against over-triggering).

## 2. Check a "resolved" finding BEHAVIORALLY, not by name.

A review found *"two GitHub-slug helpers disagree"* (`_github_slug` new vs `_gh_slug` pre-existing).
The next push deleted `_gh_slug`. My check was `hasattr(module, "_gh_slug") == False` — and I called
the finding resolved.

**That check cannot distinguish resolved-correctly from resolved-wrongly.** Had the author deleted
the *correct* helper, `hasattr` reads identically. The finding was never "there are two symbols";
it was "they disagree where it matters."

Behavioral version — drive both implementations against the external ground truth (GitHub's actual
slug rule), including the cases where they diverge:

| heading | deleted `_gh_slug` | surviving `_github_slug` | GitHub truth |
|---|---|---|---|
| `CUDA / Python / FFI attributes` | `cuda-python-ffi-attributes` | `cuda--python--ffi-attributes` | `cuda--python--ffi-attributes` |
| `Types & Values` | `types-values` | `types--values` | `types--values` |
| `What now?` | `what-now` | `what-now` | `what-now` |

Survivor **7/7**, deleted **5/7** ⇒ the wrong-behaving one was removed. Same verdict as the naive
check, but now on grounds that could have come out otherwise.

Also verify the deletion caused no coverage regression: the remaining caller's output
(`_enumerate_lang_ref_anchors`) was **308 anchors / 53 files / 0 differing** before vs after,
confirming the author's "unchanged today" claim.

## 3. Corollary — "wider" is a two-directional risk

The same PR widened a table-delimiter detector. I measured that it *surfaces nothing new* (0 errors
narrow, 0 widened, across 69 files) and nearly stopped there. **That only tests one direction.**
"Wider and wrong" would inject false positives into a linter whose whole purpose is not producing
them. So drive the widened predicate against the spec **including the cases it must reject**:
`| --- | abc |` → False, `|  |  |` → False, `| :: | - |` → False, `| -x- | - |` → False, alongside
the GFM-legal spellings → True. 0 deviations ⇒ precise, not merely loose.

And label the result honestly: a change that fixes a blind spot with **no current occurrences**
**closes a hole**; it does not **fix a live bug**. Different claims, and it only earns the first.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785863623589-approver-procedure-mutation-test-a-selftest-and-ch.md`_
