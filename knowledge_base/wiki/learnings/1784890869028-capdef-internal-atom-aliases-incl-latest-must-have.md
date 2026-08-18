---
title: "capdef internal _atom aliases (incl _*_latest) MUST have a public pair or generator errors 20007"
type: learning
topic: agent-ops
source: learnings/1784890869028-capdef-internal-atom-aliases-incl-latest-must-have.md
---

# capdef internal _atom aliases (incl _*_latest) MUST have a public pair or generator errors 20007

**Context:** shader-slang/slang#12211 — a clean `slang-capability-generator` run failed with `error 20007: All internal '_atom' require a corresponding external 'atom'` on `_GLSL_latest` and `_sm_latest` (capdef:182, :227). On Windows Release this cascades to MSBuild MSB8066 and breaks the build. Regression from PR #12122 (commit 7e65d59665).

**Rule / non-obvious facts:**
1. `CapabilityDefParser::validateInternalAtomExternalAtomPair()` (tools/slang-capability-generator/capability-generator-main.cpp:410-446) requires EVERY non-`Abstract` atom whose name starts with `_` to have a matching public (`_`-stripped) atom. The check is UNIVERSAL — `alias` atoms are treated identically to `def` atoms; there is NO exemption for aliases or for `_*_latest`. So adding `alias _FOO = ...;` without a public `alias FOO = ...;` is a latent build break.
2. Why it slips past incremental CI: the invariant only fires on a CLEAN capability-generator regeneration. Incremental builds reuse cached generated headers, so a fresh Windows Release build is where it first surfaces. HYPOTHESIS (unconfirmed): on Linux the generator prints the 20007 diagnostics but still exits 0, so Linux CI may not fail while Windows MSB8066 treats it as fatal — verify before asserting.
3. Precedent for "latest" version aliases: `spirv_latest` (capdef:1666) and `metallib_latest` (capdef:208) are BOTH already PUBLIC `[Version]` capabilities. SPIR-V additionally keeps an internal `_spirv_latest` (:169) that its getter reads — so both spellings coexist for SPIR-V by design. GLSL/HLSL were the only version families missing the public "latest" pair.
4. The `/// [Version]` doc comment must go on the PUBLIC alias (not the internal `_atom`) for it to appear under the public name in the generated `docs/user-guide/a4-02-reference-capability-atoms.md`. Adding new atoms → you MUST regenerate that doc in the same PR (trips CI check-capability-atoms-ref, per learning 1784139517684).

**Takeaway:** When adding any internal `_atom` (def or alias) to slang-capabilities.capdef, add its public pair in the same edit, OR confirm a public counterpart already exists — otherwise a clean regen breaks. Fix for #12211 = add public `GLSL_latest`/`sm_latest` aliases (Approach A), mirroring spirv_latest/metallib_latest.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1784890869028-capdef-internal-atom-aliases-incl-latest-must-have.md`_
