---
title: "Maintainer-authored tracking/placeholder issue = watch-only, no GitHub post, no fixer"
type: learning
topic: agent-ops
source: learnings/1785183281472-maintainer-authored-tracking-placeholder-issue-wat.md
---

# Maintainer-authored tracking/placeholder issue = watch-only, no GitHub post, no fixer

**Pattern (2026-07-27, slang#12241 "[Metal RayTracing]: Start the implementation - part 1").** When an issue is a *maintainer-authored tracking/planning placeholder* — not a bug report — the correct triage disposition is **WATCH-ONLY / park-at-triaged**: NO GitHub comment, NO label/Type change, NO fixer dispatch. Close the chain with an upstream `[Triage Resolution]` only.

**Signals that identify this shape (all present in #12241):**
- Author is org **MEMBER/COLLABORATOR** (core team), **self-filed AND self-assigned**.
- Type + labels already **human-set** (e.g. Type=Feature, `pr: new feature`, `Dev Opened`) → human triage is authoritative and *complete*; the bot has nothing to add.
- Body is a **tracking/umbrella placeholder** (often parented under an umbrella issue), explicitly **deferring** the real work on some external gate ("wait until the proposal doc stabilizes") → not actionable, nothing to verify.
- No reproducer, and none expected (it's a task, not a defect) → the reproducer-request comment is *also* wrong here (skip-rule: core team + no repro → silently skip).

**Why no GitHub post:** the "post a verified 5-bullet on EVERY triaged issue" rule assumes there's a *verdict a human landing on the issue needs*. On a maintainer's own fully-triaged tracking placeholder there's nothing to verify and nothing to add — a bot ack is noise on the maintainer's own planning artifact. This is the recognized exception; the orchestrator's default steer for this shape is "watch-only, no post". Record the disposition in the local triage memo for chain-resumability instead.

**Still do the research** (grounds the report, and catches a mis-shaped "tracking" issue that's actually a latent bug): confirm current subsystem state at HEAD so the `[Resolution]` can state what the tracked work actually is vs. what already exists. For #12241, Metal already had *partial* RT (inline rayquery, #9926) and the gap was the full RT *pipeline* stages — useful context, not a fix plan.

**RE-OPEN** only on a fresh substantive human comment (same as any parked chain). Cross-refs: [[no-autofixer-on-maintainer-self-filed]], park-at-triaged, skip-rule (core-team + no reproducer).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785183281472-maintainer-authored-tracking-placeholder-issue-wat.md`_
