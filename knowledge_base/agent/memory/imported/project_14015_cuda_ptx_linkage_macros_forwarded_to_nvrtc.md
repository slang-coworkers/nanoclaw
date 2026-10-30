---
type: project
name: project_14015_cuda_ptx_linkage_macros_forwarded_to_nvrtc
description: "slang#14015 (albertrodriguezclo, human, filed 10-29 12:40Z): -D / preprocessorMacros given to Slang are also forwarded to NVRTC for PTX (slang-code-gen.cpp 'Add any preprocessor definitions associated with the linkage' TODO(JS)), so -D_WIN32=1 breaks NVRTC's builtin header (CUDART_CB → __stdcall). Dispatched to slang-triager on the canonical thread 10-29."
---

# slang#14015: linkage `-D` macros leak into NVRTC on PTX

**Report (reporter's, not verified by us):** `slangc trivial.slang -target ptx ... -D_WIN32=1` fails in
`__nv_nvrtc_builtin_header.h(1054)` (`CUDART_CB *cudaHostFn_t`); same flags fine on SPIR-V/DXIL/Metal.
Cause named by the reporter: `slang-code-gen.cpp` forwards every linkage macro to the downstream compiler
(`TODO(JS): ... should defines passed to Slang really be passed to downstream compilers?`).
Suggested fixes: stop forwarding by default (keep `-Xnvrtc -D...`), skip platform macros, or list forwarded
macros in the diagnostic. Seen via slang-rhi CUDA device, Slang 2026.19 + main 01dcd3568, NVRTC 12.8, Win11.

**Routing (10-29 12:4xZ, Main webhook session `sess-1793277610770-k81q1p`):** live read open, 0 comments,
no labels, unassigned; no PR names #14015. **The R6 gate nanoclaw#1993 MERGED 2026-10-25 12:58Z with no
waiting period** — only newcomer labels (`GoodFirstBug`, `HelpWanted`, `no-bot`) withhold delivery; `bot-ok`
hands one back. So an unlabelled human issue goes straight to triage. Dispatched to `slang-triager`,
thread `gh-issue-shader-slang/slang-14015`.

**Design note for the chain:** the default-forwarding change is a behaviour change some users may rely on
(passing `-D` to reach CUDA prelude/NVRTC code); the triager should surface that choice to maintainers rather
than pick it silently.

**12:43Z triager interim (their finding):** reproduced on Linux, local slangc 01dcd3568 + NVRTC 12.6, same `__nv_nvrtc_builtin_header.h` failure. Still checking other downstream paths and git history.

**12:55Z [Triage], checked live 12:5xZ:** comment 6497225816 by nv-slang-bot (no @-mentions, no links), label
`reproduced`, Issue Type Bug, still open. Forwarding loop confirmed on master at `slang-code-gen.cpp:551-565`.
Triager's findings: #2263 (2022) widened forwarding on purpose so `-D` reaches prelude macros
(`SLANG_ENABLE_BOUND_ZERO_INDEX`; documented `docs/cpu-target.md:627`, tested `tests/compute/bound-check-zero-index.slang`).
Tested as forwarded: NVRTC, gcc (shader-sharedlib). Tested as not forwarded: DXC, glslang, direct SPIR-V. Forwarded by
code reading only: MSVC, FXC, Metal, slang-llvm. CPU `-D_WIN32=1` also breaks (`<intrin.h>`). Options A (stop, breaking) /
B (filter `SLANG_*` or reserved names) / C (diagnostic note, additive) / D (opt-out option) / E (emit as `#define` in
generated front matter; fixes NVRTC, not CPU). Memo: `/workspace/inbox/a2a-1793278517022-0u9ztc/triage-14015.md`.

**PARKED** on maintainer direction (which of A–E). No fixer handoff. Timer: triager one-shot `t-bf5d39` on 11-03
(lane `sess-1793278464975-wz7wiz`, triager group). Operator told on orchestrator-dashboard 10-29 12:5xZ.

**Resume on:** maintainer comment on #14015 (webhook), or the t-bf5d39 re-check.
