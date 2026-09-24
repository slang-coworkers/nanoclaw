---
title: "Two-maintainer design divergence on a PR: provide evidence, ask them to align, gate any redesign"
type: learning
topic: agent-ops
source: learnings/1790220265420-two-maintainer-design-divergence-on-a-pr-provide-e.md
---

# Two-maintainer design divergence on a PR: provide evidence, ask them to align, gate any redesign

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1789415127209-dugkk4
written_at: 2026-09-24T03:24:25.420Z
---

# Two-maintainer design divergence on a PR: provide evidence, ask them to align, gate any redesign

**Rule.** When two maintainers diverge on a *design mechanism* for a coworker's PR (one steered the current design, another files REQUEST_CHANGES against it), the coworker must **not** pick a side, redesign unilaterally, or apply the objector's literal diff. It provides the technical evidence and asks *both* maintainers to align on the mechanism before touching code. The orchestrator gates any coworker-initiated redesign on **two preconditions: (1) both maintainers explicitly agree on the new mechanism, AND (2) a viable alternative is confirmed to satisfy the original hard constraint** (verified at source / empirically, not assumed).

**Why.** Redesigning to satisfy one maintainer risks diverging from the other who steered the current design → a wasteful double round-trip and a coworker appearing to take sides in a maintainer dispute. Asking them to align first, armed with the facts, lets the design owner and the objector converge (often the design owner proposes exactly the objector's ask) — then the redesign is unambiguous and low-risk.

**Mechanics that worked (slang#13070 / PR #13086, merged 2026-09-24 as 6eb89786ca).**
- jkwak-work filed REQUEST_CHANGES on the `isBindlessTextureNVEncodable` *interface member* (backward-compat + "overkill"); pdeayton-nv had steered that member design and approved the surrounding restructure.
- The fixer verified at source before replying: `IOpaqueDescriptor` is `[sealed][builtin]` ⇒ no external conformer can break; the member sits beside existing `kind`/`descriptorAccess` requirements (established pattern); and **proactively** built a `.slang-module` round-trip to test the one residual axis (serialization) — refuting the compat objection with an honest caveat about the untested prior-compiler path.
- It posted a **collaborative COMMENT-state reply** (never a competing APPROVE/REQUEST_CHANGES review — bot policy) tagging *both* maintainers, framing the objection's fix as "same intent, here are the constraints any alternative must satisfy," and asked them to settle the mechanism. It did **not** redesign.
- pdeayton-nv then proposed a type-query intrinsic (`__isBindlessTextureNVEncodable<T>()` in the `__isHalf<T>()` mold) — exactly jkwak's ask. Both preconditions now met: (1) both aligned; (2) fold confirmed at source (`static_assert(!__isHalf<T>())` used in the same file; distinct from the earlier target-dependent `__target_switch` query that didn't fold) + verified **empirically in the real position** (the `__init` static_assert fired E41400, DCE dropped the native cast). Only then was the redesign authorized. Both maintainers approved; merged.

**Orchestrator posture.** On a non-`@bot`-mention multi-maintainer thread, hold the coworker's GitHub post for calibration, then authorize a collaborative COMMENT-state reply that tags both maintainers and *asks* rather than asserts. Require the coworker to report a redesign plan before implementing; lift a pre-push ack gate once the maintainer explicitly asks to push and the automated gates (build + suite + empirical check + external critique) are green. Never let the coworker counter a maintainer's review verdict with its own. Related: [[feedback_deadpromise_check_assignee_before_rewake]] (assignee-asks-bot ⇒ we own it).

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1790220265420-two-maintainer-design-divergence-on-a-pr-provide-e.md`_
