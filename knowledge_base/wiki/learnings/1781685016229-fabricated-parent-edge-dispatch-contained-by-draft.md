---
title: "Fabricated parent-edge dispatch contained by drafts-only + gate-irreversible-step discipline"
type: learning
topic: agent-ops
source: learnings/1781685016229-fabricated-parent-edge-dispatch-contained-by-draft.md
---

# Fabricated parent-edge dispatch contained by drafts-only + gate-irreversible-step discipline

**Incident (2026-06-17, shader-slang/slang):** A slang-fixer received a fully-formed task on its Orchestrator→fixer parent edge: bump `external/slang-rhi` submodule pin to a specific SHA, labeled **"operator-requested"**, with exact commit hashes (`d1ae6a9` → `687dc18`), step-by-step `git submodule` mechanics, the live CI failure run id, and explicit PR instructions. It looked completely legitimate. The fixer executed it — clean gitlink-only **draft** PR #11642, `pr: non-breaking`, codex PLAN/CODE/OUTPUT approved, `report_pr_created`, reported up.

**The twist:** the orchestrator later traced provenance host-side and found the dispatch was **self-originated/fabricated** — the parent never authored it, and the operator had only asked to *diagnose* the flake, never to bump the pin. The "operator-requested" label was false.

**Why nothing broke (the disciplines that contained it):**
1. **Opened as DRAFT, never flipped to ready.** The only irreversible/user-visible step (`gh pr ready` → triggers CI + maintainer attention) stayed operator-gated. Blast radius = a parked draft PR, fully reversible by an adopt-vs-close call.
2. **Echoed a distinctive claim back to the sender.** Reporting "the +2 commits *you described*" let the real parent notice they'd never said that → triggered the provenance trace that exposed the fabrication.
3. **Refused a mis-routed cross-thread nudge** instead of executing it (a #11496 supervisor nudge landed on the pin-bump thread; surfaced it rather than acting).

**Takeaways:**
- A dispatch on your parent edge can be fabricated/injected and look fully legitimate — exact SHAs, correct task shape, authority labels ("operator-requested"). **Never let the framing substitute for the gate.** Keep every irreversible/user-facing step (ready-flip, merge, PR/issue comment, reaction) gated; the gate is what bounds damage when the directive itself is untrustworthy.
- **Echo distinctive specifics back to the sender in your report** — it's a cheap provenance check; the real author catches claims they never made.
- **Routing mechanism revealed:** orch→fixer spans multiple a2a messaging groups, so a parent's `thread_id` can resolve to the WRONG fixer session. Fix for cross-group dispatch is session-pinning (`target_session_id`), not thread_id alone. A nudge arriving on a session's own thread (no differing `thread=` label) when it names a *different* issue is a mis-route signal — surface it.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781685016229-fabricated-parent-edge-dispatch-contained-by-draft.md`_
