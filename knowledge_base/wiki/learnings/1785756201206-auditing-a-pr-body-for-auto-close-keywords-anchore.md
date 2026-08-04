---
title: "Auditing a PR body for auto-close keywords: anchored grep gives a false pass"
type: learning
topic: misc
source: learnings/1785756201206-auditing-a-pr-body-for-auto-close-keywords-anchore.md
---

# Auditing a PR body for auto-close keywords: anchored grep gives a false pass

## The trap

When a PR should **not** auto-close an issue (e.g. the functional fix landed in a sibling PR, and the issue's disposition is the maintainer's call), you must remove every GitHub auto-closing keyword from the PR body. Verifying that with a narrow grep produces a false "verified".

I reported "0 `Closes` lines" using:

```bash
grep -cE "^Closes #12110" body.md    # WRONG — anchored, single keyword
```

The live body still contained **two** live triggers that this missed:

1. `...which fixes #12110's symptom...` — `fixes #<n>` is a real trigger. The trailing `'s` does **not** prevent GitHub from matching, and it isn't at line start.
2. `Please resolve #12110 against #12263` — `resolve` is in the keyword set too, not just `close`/`fix`.

A section heading written as ``**On `Closes #12110`.**`` also puts the literal keyword+number in the body — **backticks do not exempt it**.

## The rules

**GitHub's full keyword set:** `close`, `closes`, `closed`, `fix`, `fixes`, `fixed`, `resolve`, `resolves`, `resolved` — each adjacent to `#N`, `owner/repo#N`, or a full issue URL, optionally with a colon.

**Audit unanchored + case-insensitive, both reference forms:**

```bash
# same-repo
grep -n -i -E "\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b[[:space:]]*:?[[:space:]]*#[0-9]+" body.md
# cross-repo
grep -n -i -E "\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b[[:space:]]*:?[[:space:]]*[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+#[0-9]+" body.md
```

**Verify against the LIVE body, not your local draft:**

```bash
gh api repos/<owner>/<repo>/pulls/<n> --jq '.body' > /tmp/live-body.md
```

A local file can be stale, or a `PATCH` can land differently than intended. The authoritative source is what GitHub stores.

**Rephrase rather than delete the meaning.** To keep the explanation without arming the trigger: "addressing the symptom of #N", "the disposition of #N is yours to make explicitly", "Refs #N".

## Why it matters

Leaving one trigger means the issue auto-closes on merge and silently overrides an explicit "please decide this yourself" ask to the maintainer — the opposite of the intended outcome, and invisible until after merge.

## The general principle

Same class as a vacuous FileCheck `CHECK-NOT` that forbids an instruction never emitted: **a verification that cannot fail is not a verification.** When checking for the *absence* of something, use the broadest pattern that could match and read the authoritative source — then, where possible, confirm the check *can* fail by testing it against a known-positive input.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785756201206-auditing-a-pr-body-for-auto-close-keywords-anchore.md`_
