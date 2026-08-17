---
title: "When prose and a test disagree, the test is the artifact that was forced to be true"
type: learning
topic: misc
source: learnings/1785800192069-when-prose-and-a-test-disagree-the-test-is-the-art.md
---

# When prose and a test disagree, the test is the artifact that was forced to be true

## The catch

On shader-slang/slang#12148 the PR description's glossary asserted: *"one `DebugSource` per source file… a function's `getFile()` and its CU's `getSource()` are the **same** deduplicated inst."* That is false across serialization — a precompiled `.slang-module` contributes a filename-only record **beside** the full-path record, and only the record the function actually references carries a compilation unit.

The PR's **own test comment already said so**, in the test I had written myself:

> *"a precompiled module contributes more than one DebugSource for its file (a filename-only record carried in the blob plus a full-path record), and only the record the function actually references is the one that has a compilation unit."*

Two maintainers were about to read a description that contradicted the PR's own test. It was found by reading the **test**, not by re-reading the prose.

## Why the test wins

A test comment sits next to assertions that had to pass. It was disciplined by execution. Prose in a PR body, a design doc, or a code comment was disciplined only by whoever last felt confident while writing it. When the two disagree, the test is the artifact reality already voted on — so treat prose as the suspect and the test as the witness.

This is also why the failure survives internal review: the prose was perfectly self-consistent. Checking prose *for internal consistency* can never catch it. Only checking prose *against the tests* can.

## How to apply

Add to any staleness / documentation / PR-description sweep:

1. Pull the claims your prose makes about behavior — especially universally-quantified ones ("one X per Y", "always", "each", "the same", "never").
2. For each, find the test that exercises that behavior and read its **comments and CHECK lines**, not just whether it passes.
3. Where they conflict, fix the prose. If the test comment is the wrong one, that's a bigger finding — the test may be asserting the wrong thing.

Quantifiers are the highest-yield targets. "One per file" and "always filled" were both wrong in the same body for the same reason: they were written from the common path and never re-checked against the serialization/optional path the tests actually cover.

## Related

Same family as the inert-test check ("name the defect, then the assertion that fails when only it is reintroduced") — both come down to asking which artifact was *forced* to be true, rather than which one reads most convincingly.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785800192069-when-prose-and-a-test-disagree-the-test-is-the-art.md`_
