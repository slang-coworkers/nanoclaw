---
title: "slangpy#1181 correction — the Vulkan worker crash is a catchable SIGABRT in SPIRV-Tools, tied to slang#13226 (not env, not uncatchable)"
type: learning
topic: slang-compiler
source: learnings/1790127518160-slangpy-1181-correction-the-vulkan-worker-crash-is.md
---

# slangpy#1181 correction — the Vulkan worker crash is a catchable SIGABRT in SPIRV-Tools, tied to slang#13226 (not env, not uncatchable)

---
author_agent_group: ag-1780667169498-sqxdef
author_session: sess-1790066143620-aji9sm
written_at: 2026-09-23T01:38:38.160Z
---

# slangpy#1181 correction — the Vulkan worker crash is a catchable SIGABRT in SPIRV-Tools, tied to slang#13226 (not env, not uncatchable)

Correction/superseding of an earlier learning that inferred slangpy#1181's Vulkan worker crash was an "uncatchable SIGKILL (GPU-watchdog/OOM), no code change captures it." **That inference was wrong.** slangpy-fixer built fresh Slang `master` Debug + fresh SlangPy Debug at the failing sha and reproduced it by running the single test with `-p no:xdist`:

- It's an **intermittent (~25%) catchable SIGABRT**, captured under gdb: a SPIRV-Tools `MergeReturnPass`/`DefUseManager` assertion `instruction.h:251: unique_id() Assertion 'unique_id_ != 0'` — a def-use `std::set` ordering hazard (a cleared/zeroed inst still referenced). It's a **compile-time** crash in SPIR-V optimization, not GPU/driver/xdist. Vulkan-only because only the SPIR-V target runs SPIRV-Tools' optimizer; CUDA emits C++/PTX.
- It ties to already-open **shader-slang/slang#13226** (autodiff regression bisected to #9808 "Refactor auto-diff implementation"; a `slangc`-CLI hang in `specializeModule` on the same `bwd_diff`-through-`IDiffTensor` kernel). #13226 notes SlangPy's API path (`getEntryPointCode`) does NOT hang; the fixer's repro goes via that API path and aborts DOWNSTREAM in SPIRV-Tools — the "missing link" the slang maintainer flagged.

**Process lessons that cost rework here:**
1. **The "GPU wall" was false** — the agent container HAD an NVIDIA L40S + working NVIDIA Vulkan ICD (api 1.4.329, `libGLX_nvidia.so.0` + `libnvidia-glvkspirv.so` resolve). Always run `nvidia-smi` / `ls /etc/vulkan/icd.d/` / `ldconfig -p | grep vulkan` before asserting no GPU. A "Vulkan needs a GPU we lack" close was wrong.
2. **Before posting a root-cause comment, READ the latest comments even when the newest is our own `nv-slang-bot` — a *parallel* bot session may have already investigated.** Here a parallel session had already linked slangpy#1181 → slang#13226; I nearly posted a competing "file a new slang issue" recommendation. Search shader-slang/slang for an existing issue before recommending a fresh filing.
3. **Don't over-claim across a coverage/config gap.** The failing CI job is the `-DSGL_ENABLE_COVERAGE=ON` build (larger stack frames) and deterministic; a non-coverage repro at ~25% may be a related-but-not-identical manifestation (stack-overflow vs SPIRV-Tools SIGABRT). Hedge.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790127518160-slangpy-1181-correction-the-vulkan-worker-crash-is.md`_
