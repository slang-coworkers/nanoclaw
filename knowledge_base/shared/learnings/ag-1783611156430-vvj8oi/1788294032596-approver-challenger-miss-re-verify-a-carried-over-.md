---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1784180176857-773lfi
written_at: 2026-09-01T20:20:32.596Z
---

# [approver/challenger-miss] Re-verify a carried-over gap's MECHANISM at each new head after a rebase — "the sites read byte-identical" is not "the gap still holds"; and a documented release-assert on an unproven-reachable path is not a 🔴

## Context

shader-slang/slang#12136 R5: the branch was rebased onto current master (120 ahead / 0 behind,
mostly `.github/` + `docs/generated/` churn) and the autodiff packaging replayed on top. An
upstream tier pre-checked my two prior gap sites and reported them byte-identical at the new head.

## Two things worth carrying forward

### 1. A rebase can move the leg that actually carries a gap — re-verify the mechanism, not just the two cited lines.

The recorded `OPEN_GAP` (LSP builtin-source regression) rests on **three** coupled facts, not two:
`slang-language-server.cpp:3235` (source retrieval allowlist) and `:1212` (goto-def allowlist) —
*plus* the naming leg `getBuiltinModuleNameStr` → `getBuiltinModuleInfo.name` → `pathInfo`, which
is what makes goto-def's `pathInfo.getName()` fail to match. A pointer that says "3235/1212 are
unchanged" covers the two allowlists but not the naming leg; a rebase that touched
`getBuiltinModuleNameStr` could close or move the gap while the allowlists stayed put. I re-fetched
all three at the pinned head and confirmed the supplement still registers as `"autodiff"` and the
`Core` source blob no longer contains the derivative registrations. Only then did I re-assert the
gap. **Accept an upstream "sites unchanged" pointer as a lead, re-verify the full mechanism at the
new SHA before re-recording — the cheap line-diff check and the load-bearing check are different
checks.**

### 2. A `SLANG_RELEASE_ASSERT` on an unproven-reachable path is a residual concern, not a verified 🔴.

Devin escalated to a "Bug": `translateFwdDerivativeAttributeToAD2` does
`auto m = visitor->getShared()->getModule(); SLANG_RELEASE_ASSERT(m);` — "compiler can abort
outside a module compile." The reachability candidate was real (`slang-session.cpp:84` builds a
reflection context with a **null** module). But:

- The author had converted a **prior-round silent null-deref** (a CodeRabbit 🔴) into this **loud
  assert + documented invariant** — the codebase-preferred "fail loudly on out-of-contract input"
  form. That is an *improvement*, not a new defect.
- Attribute translation runs during a decl's semantic checking (real module bound); reflection
  operates on already-checked/deserialized decls and does not re-run it.
- CI was green across the exact surfaces that would trip it: supplement compilation (its own
  `[ForwardDerivativeOf]` decls run this translation), all `test-slang` lanes, and the reflection
  unit test that deterministically SIGSEGV'd at an earlier revision (R2) and is now green.

**Discipline: never BLOCK on an unproven crash.** Investigation can only add caution, never upgrade
toward approval — but it also does not manufacture a BLOCK from a hardening change whose failure
path I cannot reach. I recorded it as a residual concern reinforcing an independent abstain and
flagged it for the maintainer, with the explicit trip-wire: a repro reaching the assert via a
null-module context flips it to BLOCK. When a reviewer labels a *new defensive assert* a "bug,"
separate "is the assert new/correct?" (yes — it replaced a silent deref) from "is its invariant
violable on a supported path?" (unproven here) before scoring.

## Fix

At each new head of a multi-revision PR: re-run the full mechanism trace for every carried gap
(all legs, not just the cited lines), and re-classify each reviewer finding from source at that
SHA — a rebase invalidates line numbers and can silently open or close the very gap you are
carrying. Treat a documented release-assert as a hardening unless you can *prove* its invariant is
reachable-false on a supported input.
