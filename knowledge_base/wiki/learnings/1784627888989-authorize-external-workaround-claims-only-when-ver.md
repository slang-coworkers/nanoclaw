---
title: "Authorize external workaround claims only when verified in the USER's environment, not a convenient proxy"
type: learning
topic: verification
source: learnings/1784627888989-authorize-external-workaround-claims-only-when-ver.md
---

# Authorize external workaround claims only when verified in the USER's environment, not a convenient proxy

# Verify externally-posted workarounds in the user's actual environment before authorizing

**Incident (2026-07-20/21, slang #11877 / discussion #11840):** Main authorized a bot reply telling an external user (brussig-tud) that `import glsl;` is a flag-free workaround to get GLSL matrix-operator semantics **from the JavaScript/wasm frontend**. The claim was **FALSE**. The user tested it, hit `error E38201: 'glsl' module not available` (Playground repro), and reported back. The bot self-corrected transparently within 6 minutes and flagged the real gap to the maintainer — good recovery — but a wrong workaround was posted under the bot identity first.

**Root cause — environment-mismatched verification.** The fixer's "gate (b)" empirically confirmed `import glsl;` honors the operator **on the native built compiler** (where the `glsl` module was available). That proves "import glsl; works when the module is registered" — NOT "the module is reachable from JS/wasm," which was the actual question. The `glsl` module is gated by `SlangGlobalSessionDesc::enableGLSL` (defaults false; `include/slang.h`), and the wasm `createGlobalSession()` binding doesn't expose it — so neither `-allow-glsl` (per-session `AllowGLSL` option) nor `import glsl;` (needs global `enableGLSL`) is settable from JS today. The verification environment (native, GLSL-available) didn't match the claim's environment (JS/wasm, GLSL-unavailable).

**Main's miss:** I gave a "verify empirically first" instruction and treated the fixer's native-build test as satisfying it. It didn't — the test wasn't run in the target environment. This is [[feedback_verify_branch_in_env_where_it_fires]] applied to an authorization gate, and I failed to apply my own rule.

**How to apply — before authorizing any user-facing workaround/answer:**
1. **Match the verification environment to the claim's environment.** If the answer is "do X from frontend/target/config Y," the empirical check must run *in Y*, not a proxy where the relevant gate is already satisfied. Ask the coworker explicitly: "was this verified in the user's exact environment (their frontend/flags/build), or a convenient one?"
2. A workaround claim that *adds* capability ("X enables Y") is higher-risk than one that *removes* it ("Y isn't possible") — the former strands the user if wrong. Hold adds-capability claims to environment-matched proof.
3. When the corrected answer is itself a bot technical claim, its credibility should rest on independent evidence (here: brussig-tud's own E38201 repro + the diagnostic text naming `enableGLSL`), not the bot's say-so — the same bot was just wrong.

Relates to [[feedback_verify_branch_in_env_where_it_fires]], [[feedback_authorize_comment_matches_memo_hedging]], [[feedback_never_relay_a_verdict_not_in_hand]].

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784627888989-authorize-external-workaround-claims-only-when-ver.md`_
