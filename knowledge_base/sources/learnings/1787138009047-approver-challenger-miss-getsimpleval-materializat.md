---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787060030215-1xvkzx
written_at: 2026-08-19T11:13:29.048Z
---

# [approver/challenger-miss] getSimpleVal materialization of l-value args can add spurious out-param uninit warnings; byte-identical/green CI is blind

**Class of change:** a consumer-side fix that replaces a flavor-blind `LoweredValInfo::val` read with `getSimpleVal(context, argVal)` (or similar "materialize the lowered value" helper) so a `Ptr`-flavored l-value gets an inserted `load`. Common pattern in `slang-lower-to-ir.cpp` (visitIntrinsicAsmStmt, visitMakeOptionalExpr, the Optional/Make* family). shader-slang/slang PR #12533 was exactly this on `visitIntrinsicAsmStmt`.

**The signal to probe (transferable):** `getSimpleVal` loads a `Ptr` **unconditionally**. If the l-value can be a **write-only `out` (or `inout`) parameter**, the inserted `load` is a genuine READ. The use-uninitialized-values pass (`slang-ir-use-uninitialized-values.cpp`) classifies any operand of an instruction with no dedicated case (e.g. `GenericAsm`) as a **Load** via its `default` branch → a read-before-write of the not-yet-written `out` param → a NEW `E41015 "use of uninitialized out parameter"` diagnostic that did not exist before the fix (before: at most `E41018 "returning without init"`). So a "pure hygiene, no behavior change" materialization can silently add a user-visible warning for the out-arg shape.

**Why the normal artifacts are blind to it:**
- The materialized operand is often **unread by every emitter** (GenericAsm operands 1..N only feed `getAsm()`=operand 0), so codegen is byte-identical and the fix's *only* live effect is the new warning — a pure-negative change dressed as cleanup.
- The regression test that ships with such a fix tends to use `inout` (as #12533's did), and `inout` params are classified `AsInOut` and **never checked for read-before-write** (`checkUninitializedValues` only acts on `AsOut`), so the test — and all of CI — is GREEN while the flagged `out` shape is uncovered.
- The `load` is NOT DCE'd when it feeds a terminator (`GenericAsm` is an `IRTerminatorInst`), and the uninit check runs even on uncalled functions.

**How to catch it (challenger probe for this shape):** whenever a diff inserts `getSimpleVal`/materialize on an argument/operand that can be a parameter l-value, ask: *can this l-value be a write-only `out`/`inout` param, and does the new `load` become a read-before-write the uninit pass will flag?* Then VERIFY by building `slangc` and compiling `void helper(out S s){ <the-construct>, s.x; }` (and a read-then-write discriminator) before vs after — do not settle the use-uninitialized pass interaction statically; it is subtle (special-case stores, reachability self-cancellation, terminator operands). A prebuilt Debug `slangc` + a one-line revert-and-rebuild is enough.

**Outcome on #12533:** ABSTAIN_POLICY:OPEN_GAP — real, reachable, uncovered; whether to materialize indiscriminately vs. only when the arg is read is a design call for a maintainer. The fix may well be accepted (it's a warning, latent, no in-tree trigger), but that's a human's call, not an auto-approve.
