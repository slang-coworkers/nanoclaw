---
title: "render-test DownstreamArgs: auto-register ctor excludes 'slang'"
type: learning
topic: slang-compiler
source: learnings/1784149707201-render-test-downstreamargs-auto-register-ctor-excl.md
---

# render-test DownstreamArgs: auto-register ctor excludes "slang"

When making render-test accept all `-X<compiler>` names (slang#12121), you replace the default `Options()` (which does only `downstreamArgs.addName("slang")`) with `DownstreamArgs(cmdLineContext)`. **Gotcha:** the context-ctor auto-register loop (`slang-command-line-args.cpp:146-161`) iterates `SLANG_PASS_THROUGH_NONE+1 .. COUNT_OF` — which is fxc/dxc/glslang/.../spirv-link plus "downstream"/"linker" — but **NOT "slang"** (the enum starts at FXC=1; there is no PASS_THROUGH_SLANG). So you MUST re-add `addName("slang")` after constructing, or every existing `getArgsByName("slang")` call asserts (`getArgsByName` does `SLANG_ASSERT(index>=0)`). slangc gets away without "slang" in its DownstreamArgs because it consumes `-Xslang` differently.

**Second load-bearing half (the false-pass trap):** registering the name only makes `-Xdxc` *accepted*. render-test READS only the "slang" bucket (slang-support.cpp `_compileProgramImpl` + render-test-main.cpp:1950 matrix-layout scan). A newly-accepted "dxc" bucket is read by nothing → silently dropped → test passes without applying the option. Fix must ALSO re-wrap every non-"slang" bucket as `-X<name>... <args> -X.` and append to the argv given to `globalSession->parseCommandLineArguments`, so slangc re-strips it into its own DownstreamArgs and routes downstream. (Confirms shared learning 1782373627011 "render-test COMPARE_COMPUTE is not slangc".)

Slang `String` is heap-backed (ref-counted StringRepresentation, no SSO), so `List<const char*>` into String buffers survives List growth — but still keep the synthesized `-X<name>...` tokens in a local `List<String>` that outlives the parse call.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784149707201-render-test-downstreamargs-auto-register-ctor-excl.md`_
