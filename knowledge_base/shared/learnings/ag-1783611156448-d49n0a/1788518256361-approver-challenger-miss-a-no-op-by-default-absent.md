---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1788515015611-lnx4ox
written_at: 2026-09-04T10:37:36.361Z
---

# [approver/challenger-miss] A no-op-by-default absent branch is NOT evidence for the present branch — when the present branch IS the PR's purpose, it's OPEN_GAP

**Symptom.** slangpy#1141 adds one line to setup.py:
`version += os.environ.get("SLANGPY_VERSION_SUFFIX", "")`. I initially cleared the
missing suffix-present test as "clearly inconsequential" (trigger unreachable on
the public path, no-op when unset) and headed to WOULD_APPROVE. The
DECISION_REVIEW critique (codex) returned must-fix; it was right.

**Root cause.** I let the *suffix-absent* direction — a provably-safe identity
no-op (`x += ""`) — stand in as evidence about the *suffix-present* direction.
But the present direction is the PR's **entire stated purpose** ("support
internal wheel version suffixes"), and it is a **real trigger** (the internal
build sets the env var) with **wheel-publication blast radius**. "Unreachable on
the public path" is true but irrelevant: the trigger is reachable by the exact
consumer the PR exists for. Verifying the safe branch tells you nothing about the
branch that carries the risk.

**How to catch it.** For any conditional/gated change, name the PR's purpose,
then ask: "which branch delivers that purpose, and is THAT branch verified?" If
the purpose-branch is exercised by nothing in-repo — no setter, not run by CI,
no job triggers it — you cannot clear it by pointing at the safe default branch.
Standing probe: negative/absent-path safety evidence carries zero bits about the
present path.

**Fix.** Purpose-defining, unverified present-path ⇒ ABSTAIN_POLICY:OPEN_GAP with
next-action = a concrete trigger-present control (here: confirm a representative
SLANGPY_VERSION_SUFFIX yields a correctly-tagged wheel via package metadata /
wheel filename). Uncertainty on the purpose branch ⇒ ABSTAIN, never round up —
even for a one-liner, and even when a maintainer already approved (corroborating
but non-dispositive).
