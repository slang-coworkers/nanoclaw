---
title: "Dump-based FileCheck tests need `-o -` and an explicit `result code = 0` — `-o /dev/null` passes on a failing compile"
type: learning
topic: ci-tooling
source: learnings/1785775051459-dump-based-filecheck-tests-need-o-and-an-explicit-.md
---

# Dump-based FileCheck tests need `-o -` and an explicit `result code = 0` — `-o /dev/null` passes on a failing compile

## Rule

In a slang-test FileCheck test that asserts on **dumped output** (IR dumps, `-dump-ir`, emitted asm), never write to `-o /dev/null`. Use **`-o -`** and add an explicit **`// <PREFIX>: result code = 0`** assertion. Otherwise the test can go **green while the compile fails**.

## The why (concrete, shader-slang/slang#11917 batch-3 / PR #12281, 2026-08-03)

A regression test used `-o /dev/null`. On **Windows that path is invalid** — slangc reports **E00004 and returns result code −1**. The test **still passed**, because the IR dump is printed *before* the output write is attempted, so FileCheck found everything it was looking for and never noticed the compile had failed. Caught by the maintainer (pdeayton-nv) in review, not by CI.

Two properties combined to hide it:
- **Ordering:** the dump you assert on is emitted before the failure occurs, so the pattern matches regardless.
- **No status assertion:** FileCheck only checks text it was told to look for; a nonzero result code is invisible unless asserted.

Net effect: a test that appears to guard a behavior but would keep passing if the compiler stopped working on that path entirely — on one platform silently, permanently.

## How to apply

- Use `-o -` (stdout) for dump-based tests; it's valid on every platform.
- **Always add `result code = 0`** to the CHECK set for dump/asm tests, and **verify that assertion is failable** (make the compile fail once and confirm the test goes red). An assertion you haven't seen fail is not yet evidence.
- Treat "test passes" on a platform-specific path as unproven until you've seen it fail for the right reason. Platform-invalid paths (`/dev/null`, `NUL`, `/tmp/...`) are a classic source of green-on-broken.
- **Known latent instance:** `tests/autodiff/func-extension/subscript-accessor.slang` has the same `-o /dev/null` pattern (surfaced to pdeayton-nv 2026-08-03, deliberately left out of scope on #12281). Cheap standalone fix for whoever next touches that area.

## Generalization

Same family as [A stale test binary can pass the very test you're validating] and [One positive control per hazard]: **a PASS that is structurally silent about the failure you care about carries no information.** The question to ask of any new test is *"what would have to break for this to stay green?"* — if the answer includes "the compile fails," the test needs a status assertion.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785775051459-dump-based-filecheck-tests-need-o-and-an-explicit-.md`_
