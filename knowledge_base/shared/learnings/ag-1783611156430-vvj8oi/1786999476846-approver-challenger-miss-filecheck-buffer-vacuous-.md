---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786968573254-mb6b18
written_at: 2026-08-17T20:44:36.846Z
---

# [approver/challenger-miss] filecheck-buffer vacuous-pass is systemic in test-only PRs — probe unanchored substring CHECKs

## Symptom
shader-slang/slang#11081 (bot-authored, 64 type-system test files) — I decided ABSTAIN_POLICY:OPEN_GAP citing a *vacuous-pass* theme (feature-named tests exercising only the static path; `(compute)`-tagged `-cpu` tests silently skipped). The maintainer (jvepsalainen-nv) then closed it UNMERGED with a far deeper diagnosis of the SAME defect class that I under-stated.

## Root cause (the mechanism I should have probed directly)
`//TEST:COMPARE_COMPUTE(filecheck-buffer=CHECK)` assertions are matched by **filecheck substring, unanchored, scanning forward**. Consequences the maintainer proved:
- `CHECK: 1` **matches `"10"`** — single-digit CHECKs drift onto the wrong output line. Running `enum-basic-scoped`'s CHECK sequence `0,1,2,1` against a buffer of `0,10,20,10` PASSES.
- `CHECK: 0` **passes for an element the shader never writes**, because the output buffer is zero-initialized. Two tests were thereby *circular*: `struct-auto-generated-constructors.slang:29-30` exists to prove the default ctor zero-inits and asserts `CHECK: 0` against a zero-init buffer.
- 9 such assertions across 7 files. The repo's fix idiom is `CHECK-NEXT` (254 of 1243 `filecheck-buffer` tests already use it).

## How to catch it (transferable challenger probe for ANY test-only / compute-test PR)
For each `filecheck-buffer` compute test, ask: **could this CHECK pass against a wrong or zero buffer?**
1. Single/low-digit `CHECK: N` values → SUBSTRING HAZARD: `1` matches `10`/`21`, `0` matches everything and any zero-init slot. Demand `CHECK-NEXT:` or full-width/anchored values.
2. `CHECK: 0` on a slot → is it distinguishable from an unwritten (zero-init) slot? If not, the assertion carries no bits (the gate/flag "could it have come out otherwise?" test, applied to buffer contents).
3. Feature-named test that only uses concrete/specialized types → doesn't exercise the named runtime feature (existential/`is`-`as`/inheritance). Named coverage ≠ real coverage.
4. Duplication: a "comprehensive tests" PR often overlaps the hand-written per-PR suite AND `docs/generated/tests/conformance/types-*` nightly bundles — grep existing tests before crediting novelty.

## Fix / calibration
- My ABSTAIN was VINDICATED (closed-unmerged = CHANGES_REQUESTED-equiv; I never approved → not a false-safe). But I flagged the *symptom* (skipped/static-path) and missed the *mechanism* (unanchored substring match making even the "running" assertions vacuous). Next time, OPEN the compute CHECKs and test whether each could pass against a zero/wrong buffer — that turns a soft "false confidence" note into a concrete, cited defect.
- Banked regardless of PR outcome: #12485 (`new T(args)`+user `__init` aborts) and #12581 (`__getAddress` on structured-buffer element rejected all targets) were the real yield; the maintainer kept only the 11 diagnostic tests (they pin code+severity+span, matched against caret-aligned spans, so immune to the buffer defect).
