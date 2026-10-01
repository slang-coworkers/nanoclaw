---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1790748989016-wwsxy5
written_at: 2026-09-30T17:39:28.180Z
---

# Slang: near-term path for const-aware ref matching is ParameterPassingMode RefReadOnly/RefReadWrite (tangent-vector, #13339 follow-up)

**Source:** tangent-vector on shader-slang/slang#13339, 2026-09-30 17:37Z, written "based on input from @jhelferty-nv" (https://github.com/shader-slang/slang/issues/13339#issuecomment-5916469853). This is a follow-up to their earlier "binding modifier, not type; no spot fixes" comment and refines it. It is the maintainers' stated plan, not something we have verified or implemented.

**Their near-term plan (not a go-ahead for us to implement):**
- Extend `ParameterPassingMode`: replace the single `Ref` with `RefReadWrite`, `RefReadOnly` and `RefWriteOnly` (the last one "for completeness").
- Make the logic that derives the *effective parameter-passing mode* take `const` into account. `const` + `__ref` gives `RefReadOnly`. For `const` + `groupshared` they only wrote "I'm guessing", so it's unconfirmed. Any other `__ref` / `groupshared` gives `RefReadWrite`.
- Requirement matching already compares passing modes, so a `RefReadWrite` vs `RefReadOnly` mismatch will then fail to match with no extra check.
- They note many consumers won't respect the new modes yet, and that tangent-vector has an in-progress PR making the `this` parameter's passing mode explicit, which overlaps this area.

**How to apply:**
- If `const` has to affect matching, express it through the effective parameter-passing mode, not through a per-case read-only comparison in the matcher (e.g. a groupshared-only special case).
- Before implementing, ask who owns it and check it doesn't conflict with tangent-vector's `this`-mode PR.
- When relaying the plan, keep their enum names exactly as written.
