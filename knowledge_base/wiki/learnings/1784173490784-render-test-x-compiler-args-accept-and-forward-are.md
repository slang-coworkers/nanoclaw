---
title: "render-test -X<compiler> args: accept AND forward are two separate fixes (slang#12121)"
type: learning
topic: slang-compiler
source: learnings/1784173490784-render-test-x-compiler-args-accept-and-forward-are.md
---

# render-test -X<compiler> args: accept AND forward are two separate fixes (slang#12121)

**Context:** shader-slang/slang#12121 — `COMPARE_COMPUTE`/`COMPARE_COMPUTE_EX` tests (run via `render-test`) rejected direct `-Xdxc -Vd`, so tests tunneled `-Xslang... -Xdxc -Vd -X.`. `SIMPLE` tests (run `slangc` directly) accept `-Xdxc` fine. Fixed + merged in PR #12128 (merge `814ab6dda9`).

**The load-bearing gotcha — the fix is TWO independent parts, and part 1 alone is a false-pass trap:**

1. **Accept the name.** `render-test`'s `Options` (tools/render-test/options.h) default-constructs `DownstreamArgs` and registers ONLY `"slang"`, then strips with `flags=0`. Unknown `-Xdxc` → `_findOrAddName` without `AllowNewNames` → `downstreamNameNotKnown` → SLANG_FAIL (source/compiler-core/slang-command-line-args.cpp). `slangc` avoids this by constructing `DownstreamArgs(m_cmdLineContext)` (source/slang/slang-options.cpp:2705) whose ctor (slang-command-line-args.cpp:146-161) auto-registers every `SLANG_PASS_THROUGH_*` name (dxc/fxc/glslang/nvrtc/metal/...) + "downstream"/"linker". Fix: construct render-test's `DownstreamArgs` with the `CommandLineContext` it ALREADY builds in `Options::parse` (options.cpp:89), then re-add "slang" (NOT a pass-through enum value, so the loop misses it).

2. **Forward the accepted args.** Even once accepted, render-test READS only `getArgsByName("slang")` (two sites: tools/render-test/slang-support.cpp `_compileProgramImpl`, and render-test-main.cpp matrix-layout scan). A newly-accepted `"dxc"` bucket is read by NOTHING → silently dropped → test passes without the option ever applying = FALSE PASS. Fix: in `_compileProgramImpl`, re-emit every non-"slang" bucket as single-option `-X<name> <value>` pairs and append to the argv handed to `globalSession->parseCommandLineArguments`. slangc's own parser re-buckets them into `CompilerOptionName::DownstreamArgs`, routing to the right downstream tool. (The existing `-Xslang...` wrapper works today precisely because the "slang" bucket takes this forward path — the fix generalizes it.)

**Why single-option pairs, not block form:** codex review caught a block-form (`-X<name>... <args> -X.`) grammar bug in the first attempt; switching to opaque single-option `-X<name> <value>` pairs is simpler and robust.

**Verification method (no GPU):** DXC/D3D12 execution is Windows-only → CI-gated. To verify locally, use a downstream-reaching DISCRIMINATOR: forward a bogus `-Xnvrtc <bogus>` (or `-Xgcc`) through a `-cpu`/NVRTC-reachable test — if part 2 works the downstream FAILS/empties vs baseline; if the arg is silently dropped the test still passes. A plain green does NOT prove the arg was applied (matches learning "render-test COMPARE_COMPUTE is not slangc").

**Process note:** maintainer (jkwak-work, self-filed + self-assigned) initially got triage+verdict only (no auto-fixer per the self-filed rule); his explicit "@nv-slang-bot, please make a PR" comment OVERRODE the stand-down. He also pulled the bulk migration of 56 wrapper tests INTO the PR (reversing the "defer as follow-up" plan) — so the final PR was 59 files (2 tools + 57 tests).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1784173490784-render-test-x-compiler-args-accept-and-forward-are.md`_
