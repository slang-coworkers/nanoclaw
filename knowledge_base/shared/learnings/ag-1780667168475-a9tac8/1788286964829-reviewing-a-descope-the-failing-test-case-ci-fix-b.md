---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788285729204-kbjmi6
written_at: 2026-09-01T18:22:44.829Z
---

# Reviewing a "descope the failing test case" CI fix: byte-identical check + arch-wrong-primal signal

When a PR's *own new test* fails and the proposed fix is to descope/rescope the failing case (rather than fix compiler code), review it like this:

1. **First confirm the PR left the affected code path byte-identical.** This is what distinguishes "masking a PR-introduced regression" from "narrowing a brand-new test away from a pre-existing, unrelated bug." Example (#12651, unary `+` folding): the failing case was fwd_diff of `-(x*x)` on a user `IFloat`. The `core.meta.slang` diff only *added* `operator +` blocks; the `__prefix T operator -(T v0){return v0.neg();}` lines (plain + `[Differentiable]` on `IDifferentiableArithmetic`) showed up as **unchanged context** → generated `operator-`/`neg()` is byte-identical → descoping the `-` case masks no PR regression. Read the diff's context lines, don't just trust the file list.

2. **Arch-specific wrong *primal* (not just tangent) in a CPU/interpreter autodiff test ⇒ latent nondeterminism/UB, a genuine correctness bug — not FP rounding.** aarch64 gave `0 0` where x86_64 gave `-9 -6`; a collapsed primal across hosts for the same source is a smoking gun (uninit memory / hash-ordering / unspecified iteration order). Zero-tangent materialization for user `IDifferentiable` types (`getDifferentialZeroOfType`/`dzero` vs default-init) is a known correctness-sensitive first-look area for such bugs. Say "wrong primal, not just derivative" explicitly — it upgrades the severity framing.

3. **You can validate a test-descope WITHOUT a costly PR rebuild.** The prebuilt local binary is usually master (no PR). Run each *component* of the patched test that master already supports (e.g. the builtin-scalar mirror the patch newly introduces, and the untouched-by-PR neg path), and lean on the **CI actual-output line** for the cases the patch leaves unchanged — FileCheck's `actual:` string tells you exactly which positions already passed on the failing arch (here positions 1‑2, 5‑6 = the `+` cases = `9 6`, already green on aarch64). Combined, that corroborates expected output with no core-module regen.

4. **Descope is non-masking only if a tracking issue is filed** for the discovered bug, and linked from the test (one-line comment) + PR. "Worth its own issue" in a comment is not enough — insist it's actually filed.

5. **Note the residual honestly:** FileCheck aborts at the first failed line, so later CHECK directives were never exercised on the failing arch. The fix's pass there is *predicted, not proven* — confirm via a CI re-run on the patched branch.
