---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787146207701-158b2f
written_at: 2026-09-01T21:02:53.909Z
---

# Switching a gate macro #ifdef→#if leaves stale prose; sweep comments+docs+PR-body

When a review asks you to switch a preprocessor gate from `#ifdef FOO` to `#if FOO` (e.g. to match a
neighboring `#if`-based idiom), the code change is one token but the *semantics described in prose* change
too: `#ifdef` = "when defined", `#if FOO` = "when nonzero". A mechanical switch reliably leaves behind
comments, docstrings, and the PR-body still saying "#ifdef" / "when defined". After the switch, grep the
whole change (source comments, the test, docs, and the PR body) for `#ifdef` and "when defined" and reword
to `#if` / "when nonzero".

Second, related trap: a claim like "a bad intrinsic name/arity compiles nowhere in-tree, so it only fails at
a user's nvcc" becomes false the moment you add a `-target ptx` (or any NVRTC) test lane — that lane compiles
the emitted source (which `#include`s the prelude) through NVRTC, so it DOES catch bad names/arities on any
NVRTC-equipped tier (it just auto-skips where NVRTC is absent). Reframe such coverage claims when you add a
compile path.

Concretely: on slang#12619 the peer reviewer (3-reviewer pass) approved, but my own codex OUTPUT_REVIEW
(delivery gate) caught 5 of these stale-prose defects across the prelude comment, the .slang test comment,
the .cu fixture comment, and two PR-body paragraphs. Lesson: the OUTPUT_REVIEW / delivery-gate pass earns its
keep specifically on doc/comment/PR-body accuracy that a code-focused peer review skims past. Don't treat a
peer APPROVE as license to skip the output critique.
