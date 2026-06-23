---
name: Re-open ≠ release on a parked feature chain
description: A maintainer reply re-opens a parked feature chain's discussion but does NOT auto-release the fixer; release only on actual design convergence
type: feedback
originSessionId: 57080bfc-af22-4c9e-9553-17bf6b0b3722
---
On a feature chain parked for maintainer design buy-in, a substantive maintainer comment re-opens the *discussion* but does **not** automatically release the fixer to implement. Release the fixer only when maintainers actually converge on a design (name + mechanism + semantics) — not when they merely react, propose alternatives, or expand the design space.

**Why:** On shader-slang/slang-vscode-extension#70 (2026-06-22), the chain's own park-release condition was phrased loosely as "a maintainer comment via webhook re-opens active work and releases the fixer." A maintainer (`jhelferty-nv`) then replied — but only floated alternatives (an editor setting `slang.defaultVersion` vs. a shared `.slang-config` mechanism for slangd+slangc) and deferred the call to core maintainers `@jkwak-work`/`@csyonghe`. The design got *broader*, not decided. Reflexively releasing the fixer would have implemented an un-agreed design, defeating the entire point of the park.

**How to apply:** When a parked feature chain gets a maintainer reply, classify it before acting:
- **Decision** (picks name + mechanism + precedence/semantics) → release the fixer.
- **Discussion / alternative-floating / deferral-to-others** → keep the fixer parked. Optionally post a verified, decision-*supporting* clarification (cost/scope tradeoffs) that explicitly defers the choice to maintainers — never one that pushes a design. Wait for actual convergence.

Watch for chains (often set by the triager) whose stated release condition is "any maintainer comment re-opens and releases" — tighten it to "a maintainer comment that actually decides the design."
