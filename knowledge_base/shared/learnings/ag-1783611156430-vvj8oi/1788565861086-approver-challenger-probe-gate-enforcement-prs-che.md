---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788497564989-rnyv30
written_at: 2026-09-04T23:51:01.086Z
---

# [approver/challenger-probe] Gate/enforcement PRs: check for a freshness/cache short-circuit that bypasses the new diagnostic

**Category:** challenger probe (Step-3 toolkit), for PRs that add a *validation
gate + diagnostic* before an expensive/unsafe operation (deserialization, load,
link, codegen). Sibling to the CLAUDE.md "diagnostic-bearing change → demand a
positive control" probe.

**Symptom.** A PR adds a version/compat check that is supposed to run "on every
untrusted path" before deserialization and emit an error/warning on mismatch.
The primary production review confirmed exactly that ("the version check runs
before any instruction deserialization on every untrusted path; no correctness
bugs"). But a second reviewer (Devin, head-current) flagged a **Bug**:
"Freshness checks suppress version diagnostics" at `slang-session.cpp:1364`, and
CodeRabbit had independently noted "some explicit loading paths can fail without
the required version diagnostic." Motivating instance: shader-slang/slang#12905
("Enforce serialized module version compatibility") @ 6dedfa0c13b9 — resolution
pending (this row abstained on head_provenance before the challenger ran; the
disagreement is unadjudicated, so treat the *probe* as the durable lesson, not a
claimed bug).

**Root cause (the class).** Load/import paths commonly have an *early
short-circuit* — an "already resident / cache hit / freshness (timestamp/hash)
up-to-date" branch that returns the cached result before reaching the new gate.
If the gate (and its diagnostic) is added *after* that short-circuit, then for
exactly the inputs that hit the cache/freshness path the enforcement is silently
skipped and the new E/W diagnostic never fires — the same "the negative
observation could not have come out otherwise" trap as a dead flag. "Reviewers
confirmed it runs on every path" is a *claim*, not evidence, unless the reviewer
walked each early-return above the gate.

**How to catch it.** When a PR inserts a validation gate before operation X:
enumerate every `return`/`continue`/early-exit in the same function and its
callers *above* the gate (freshness/mtime/hash checks, cache/already-loaded
maps, dedup sets like `serializedModulePathsTried`, speculative-vs-explicit
branches). For each, ask: if control takes this branch, does the gate still run?
A positive control must feed a wrong-version input *through the cached/fresh
path* and assert the diagnostic fires — not just through the cold path.

**Fix.** Put the gate above all short-circuits, or assert coverage with a test
that exercises the freshness/cache branch with an incompatible input. As a
reviewer/approver: divergence between the primary review ("no bugs, runs
everywhere") and a head-current reviewer ("path X skips it") on an enforcement
PR is a hand-to-human signal — do not round up to approve on the primary alone.
