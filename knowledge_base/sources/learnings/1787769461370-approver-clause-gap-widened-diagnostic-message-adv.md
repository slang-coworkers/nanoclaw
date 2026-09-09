---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787768177718-r13xe3
written_at: 2026-08-26T18:37:41.370Z
---

# [approver/clause-gap] Widened diagnostic message advertising an operand-kind the PR leaves broken is an OPEN_GAP, not a nit

**Symptom.** PR #12583 ("Support countof for enum types", @5151d38dd037) adds `countof(EnumType)` correctly, and *also* widens the E30083 diagnostic text from "...can only be a type pack or tuple" to "...type pack, tuple, **array**, or enum type". The array accept-gate (`as<ArrayExpressionType>`) already existed, but `countof(arrayType)` **materialized as a value** lowers to the operand's `size.alignment`, not its element count (slang-lower-to-ir.cpp:6019 fall-through) — a pre-existing, silently-wrong path the author discloses as out-of-scope. Devin flagged it 🔴.

**Root cause / why it matters.** The PR's *own* enum edits are all verified correct (checker gate rejects `countof(enumValue)` via `isTypeExpr=false`; the lowering `SLANG_ASSERT(folded)` is sound because `getIntVal` is statically `ConstantIntVal*`; fold uses the byte-identical `getMembersOfType<EnumCaseDecl>().getCount()` as `spReflectionType_GetFieldCount`). So it is NOT a clean BLOCK — nothing the diff introduces is defective. But widening a user-facing message to *advertise* an operand kind whose value-path is broken turns a latent bug into a reachable false-advertising trap: a user reads "array is valid," writes `countof(myArray)` as a stored value, and gets the alignment. The change cannot be auto-approved (verified 🔴 in the touched surface, real reachable trigger, real blast radius) yet asserts nothing defective about the code ⇒ ABSTAIN_POLICY / OPEN_GAP — a genuine maintainer scope call.

**How to catch it (transferable probe).** When a PR *widens a diagnostic/acceptance message (or docs) to advertise a new operand/case/mode*, check that EVERY newly-advertised kind is correct on ALL evaluation paths — not just the one the PR set out to fix. A pre-existing bug you'd otherwise leave alone becomes in-scope the moment the same PR starts advertising that path as supported. Especially when the author edited the exact function that contains the buggy line (here the enum interception was added immediately above slang-lower-to-ir.cpp:6019) — "I was right next to it and chose not to fix it" is a maintainer scope decision, not something the approver clears silently.

**Fix.** Route to ABSTAIN_POLICY:OPEN_GAP. Do not round a "PR's own code is fine but it advertises a broken sibling path" up to WOULD_APPROVE, and do not force it to BLOCK (which falsely claims the diff is defective).
