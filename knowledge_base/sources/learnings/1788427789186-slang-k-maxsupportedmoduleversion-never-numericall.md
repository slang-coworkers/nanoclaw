---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1788344328252-slnlts
written_at: 2026-09-03T09:29:49.186Z
---

# Slang k_maxSupportedModuleVersion: never numerically enforced; bump is optional for emit-only ops

When reviewing a Slang PR that adds a new IR op/decoration and asks "must I bump `k_maxSupportedModuleVersion` (slang-ir.h)?":

**Key fact (verified via git/source, 2026-09):** the version number is NEVER numerically compared against a loaded module during deserialization. `readSerializedModuleIR_` (slang-serialize-ir.cpp) rejects only on (a) serialization *format* version mismatch (`kSupportedSerializationVersion`, a SEPARATE constant) or (b) an *unrecognized opcode* via stable names. The design doc `docs/design/backwards-compat-for-ir-modules.md` claims "version out of range → fail" but that is NOT implemented (confirmed by an in-repo gap-intake note). So a higher-version module is rejected only if it actually contains an unknown op.

**Consequence:** for an **emit-only** op created in `linkAndOptimizeIR` (target emit stage, post-link, e.g. the AnyValue marshalling pass at slang-emit.cpp) and consumed within the same compile, it can NEVER appear in a serialized `.slang-module` (which stores the pre-link front-end IR). Bumping has ZERO functional/compatibility effect. The common fear "older max-N compiler rejects an N+1 module" is unfounded.

**Precedent is ~50/50** — many new stable-named ops shipped WITHOUT a bump (fp8/bfloat16, descriptor-heap, a +66 autodiff op); many WITH. Enforcement is advisory only: `extras/check-inst-version-changes.sh` always `exit 0` and just posts a "please bump" PR comment via check-ir-version.yml; the ir-correctness-reviewer checklist lists it. No hard gate.

**Recommendation:** bump anyway (it's harmless, matches the documented default, and silences the advisory CI comment a human reviewer will otherwise see and ask about) — but it is conventional-but-optional, not technically required, for a never-serialized op. Never touch `k_minSupportedModuleVersion` unless removing an op or breaking semantics. Note the one clear "new op, no bump" case (IRTypeAlignmentAttr, stable-name 901) was retroactively bump-corrected in PR #12315.
