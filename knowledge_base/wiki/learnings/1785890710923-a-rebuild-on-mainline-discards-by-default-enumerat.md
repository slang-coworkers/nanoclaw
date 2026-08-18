---
title: "A rebuild on mainline discards by default — enumerate from the old head, never infer from a diff"
type: learning
topic: ci-tooling
source: learnings/1785890710923-a-rebuild-on-mainline-discards-by-default-enumerat.md
---

# A rebuild on mainline discards by default — enumerate from the old head, never infer from a diff

## The loss

A PR branch was rebuilt on top of a rewritten `main`. During conflict resolution in `test_torch_bridge.py`, a test was silently dropped: `test_stale_bridge_version_is_rejected` — the guard proving a stale bridge is rejected when an API version changes.

It survived nobody's check, including a careful one. The implementer verified its presence by diffing the **new branch against `main`** and concluded it "never existed." Its positive controls were methodologically sound. But the test was **branch-only** — added by the original PR work, never present on `main`:

```bash
git show <old-head>:path/to/test_file.py | grep -c stale_bridge   # 1  ← existed
git show origin/main:path/to/test_file.py | grep -c stale_bridge  # 0  ← absent
```

Absent from **both sides** of the comparison being made, so a branch-vs-mainline diff cannot see it. **The control passed while the thing was gone.**

Worse: that test was the remediation for an earlier review BLOCK on exactly this versioning concern. Losing it would have silently reopened a finding that had already gated the PR — on a PR whose description claims the hardening.

## The rule

**A rebuild on mainline discards by default.** Anything that existed *only* on the old head has to be **enumerated from the old head** and re-checked item by item. It can never be inferred from a diff, because the diff's baseline is precisely the thing that lacks it.

**When verifying a resolution preserved something, diff against BOTH parents** — not just the mainline. Merge and rebase have two ancestors; a one-sided comparison answers a narrower question than the one you're asking.

```bash
# enumerate what only the old head had, before trusting any diff
git diff --stat <merge-base> <old-head>          # what the branch uniquely added
git show <old-head>:<file> | grep -E 'def test_' # then check each survives
```

## Why it evades good process

Three reviewers had explicitly agreed this test must be preserved. It was named in the instructions as a required deliverable. It still vanished, because:

- The **conflict set** looked like a completeness criterion. It bounds what git flags — not what the change breaks, and not what it *loses*.
- The verification question ("is it there?") got answered against a baseline that never had it.
- A rebuild is framed mentally as *carrying work forward*; its actual default is *starting from mainline and re-adding*.

## Related

[The conflict set bounds what git flags, not what the change breaks] — sibling failure in the same resolution. [A silent instrument answers a narrower question than you asked] — the family: shallow clone, conflict-set-as-completeness, and now parent-selection in a diff. Every instance was a *correct answer to a narrower question than the one at issue*.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785890710923-a-rebuild-on-mainline-discards-by-default-enumerat.md`_
