---
type: chain
title: "slang#14727 — Compound shift assignment (<<=, >>=) rejects enum-typed shift counts"
description: Bot-filed 11-25 by the #14722/PR #14725 chain as a residual-gap follow-up; FILED-ONLY, self-echo on issue_opened — no triage dispatch; fixer start gates on operator/maintainer
tags: [slang, enum, compound-assignment, shift-operators, filed-only]
---

# slang#14727 — compound `<<=`/`>>=` rejects enum-typed shift counts

**Filing (11-25 20:45Z).** nv-slang-bot, labels `reproduced`. Terminal filing by the
**#14722 → PR #14725 chain** (that chain's sessions were still active on
`gh-issue-shader-slang/slang-14722` at filing time): the body carries the full verification
signature (master `f666576d`, repro on master AND on PR #14725 head `49e042e`, root cause,
fix direction), so per the #14548 rule its `issue_opened` is a **self-echo — no triage
dispatch was made** (verified: the only 14727 session at webhook time was my own bubble,
sess-1795639533843-rksjpo, seq-2 inbound = the webhook itself).

**The bug.** `x <<= SomeEnum` / `x >>= SomeEnum` fail E39999/E40022 while `x << SomeEnum`
compiles after #14725: `operator<<=`/`operator>>=` exist only as generic
`__generic<L, R : __BuiltinIntegerType>` overloads in `core.meta.slang` (`kShiftOps`,
~:3353), and compound assignment resolves the `operator<<=(inout L, R)` function directly
(never desugared to `x = x << y`, see #14038) — so the enum fails interface conformance
before coercion could apply the enum-to-tag conversion.

**Fix direction (from the filing).** Mirror #14725 for the compound forms: concrete per-type
`operator<<=`/`operator>>=` overloads with the shift amount fixed to `int`. Watch the
`OverloadRank` precedent from the flag-enum compound fix (#11627) so enum-accepting forms
don't make `int <<= int` ambiguous. When fixed, update the pin test
`tests/diagnostics/enum-shift-compound-assign-14722.slang` (added on PR #14725 at
`49e042e`) to expect success.

**Disposition: FILED-ONLY.** No triage chain, no fixer, no public bot posts. Fixer start is
operator/maintainer-gated per [the filing
policy](../orchestrator/filing-verified-issues-policy.md). Coordination note for whoever
GOes it: PR #14725 was still unmerged at filing time — check its merge state first; the
maintainer may prefer extending its scope over a second PR in the same `core.meta.slang`
section. Related: #14401 (generic ILogical shifts), #13075 (unscoped enum conversions).

Reported to the operator (dashboard) 11-25 with the filed-only disposition.
