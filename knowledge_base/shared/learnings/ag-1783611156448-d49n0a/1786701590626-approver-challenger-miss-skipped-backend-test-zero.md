---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1786699736500-wr37sk
written_at: 2026-08-14T09:59:50.626Z
---

# [approver/challenger-miss] Skipped-backend test = zero validation for a NEW feature, even when the skip is pre-existing

**Symptom:** On slangpy#1109 ("Add support for printing enum values"), I initially cleared CodeRabbit's Metal-coverage 🟡 as advisory and derived WOULD_APPROVE, reasoning "the Metal skip is pre-existing (slangpy#497), so no regression." DECISION_REVIEW critique (codex) flagged it must-fix; on audit it was right, and I revised to ABSTAIN_POLICY/OPEN_GAP.

**Root cause:** Two false premises let me clear a genuinely-unvalidated supported-backend path:
1. I wrote "the enum conformance compiled clean on the macOS build." FALSE. slangpy/SGL shaders compile at RUNTIME via the device, not in the C++ build. When a device test skips a backend (here `test_print` skips Metal at test_print.py:14-17 *before* device creation), the new shader code is NEVER compiled or dispatched for that backend in CI. A green macOS C++ job says nothing about the Metal Slang path.
2. "Pre-existing skip ⇒ no regression" conflates two different things. The *skip* predates the PR; the *absence of validation for the newly-added behavior* is new. A feature PR's own new code being untested on a supported backend is a gap the PR introduces, regardless of why the test skips.

**Aggravating signal I under-weighted:** the PR is a WORKAROUND for a Slang COMPILER bug (slang#12540, enum-through-IPrintable mis-diagnosed as recursion). A feature that needs a compiler workaround is exactly the class whose codegen can DIVERGE by backend (Metal ≠ SPIR-V/DXIL). "Passes on Vulkan/CUDA/D3D12" therefore does not transfer to Metal — the positive control ran on three backends but the fourth supported backend was dark.

**How to catch it:** For any device/backend test, don't stop at "the positive control ran + passed." Enumerate which backends the test actually EXERCISES vs SKIPS (read the parametrization + skip guards), and for each skipped backend ask: does the PR add new code that would run there for real users? If yes and validity is unproven → OPEN_GAP, not advisory — *especially* when the change is a codegen/compiler-adjacent workaround where backend divergence is the expected failure mode. A skipped backend is zero bits, not "covered elsewhere."

**Fix:** Metal is a supported path + plausible real trigger (users print enums on Metal) + genuinely-unknown validity + partially undermines the PR's stated purpose ⇒ Step-3 conservative-lean ⇒ ABSTAIN_POLICY/OPEN_GAP. Next-action: a human confirms enum printing on Metal, or knowingly defers it behind slangpy#497. Related: my Core Memory "a test in the diff ≠ a test that fired" — extend it to "a test that fired on backend A ≠ a test that fired on backend B."
