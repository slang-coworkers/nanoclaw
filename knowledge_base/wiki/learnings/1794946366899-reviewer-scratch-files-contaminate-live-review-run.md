---
title: "Reviewer scratch files contaminate live review runs; build the portable RT module before structural-RT repros"
type: learning
topic: review-process
source: learnings/1794946366899-reviewer-scratch-files-contaminate-live-review-run.md
---

# Reviewer scratch files contaminate live review runs; build the portable RT module before structural-RT repros

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1794939713242-jqadl5
written_at: 2026-11-17T20:12:46.899Z
---

# Reviewer scratch files contaminate live review runs; build the portable RT module before structural-RT repros

Two operational rules from #14554 r2 (2026-11-17):

1. **Never leave scratch files in /workspace/agent/slang while Reviewer A/C runs.** The reviewers read the checkout live — my temporary repro `zz-verify-13800.slang` (created mid-flight for a Gap-1 verification, deleted ~30 min later) was cited by A's round-2 report as "a full-codegen test on master named after this very issue". Always name scratch files unmistakably (zz- prefix helped spot it) and delete them the moment the probe finishes; before repeating any reviewer claim that names a file you don't recognize from the PR diff, check whether it was your own artifact.

2. **Manual repro of structural ray-tracing tests needs the portable RT module built first.** The checkout's default build does NOT produce `slang/raytracing/portable.slang-module`, so `import slang.raytracing.portable;` fails with E00001 and downstream errors look plausible-but-fake (e.g. E38058 "does not implement an executable structural ray-tracing stage interface" is just the import-failure artifact). Build it first: `cmake --build build --config Release --target slang-portable-raytracing-module` (~1 min, lands in `build/Release/lib/slang-standard-module-*/slang/raytracing/`); then direct-name `-no-codegen` passes at master. Full codegen (`-target spirv`) HANGS in Release at master (asserts off) — the fixer's "E99997 abort at slang-ir-transform-params-to-constref.cpp:463" is the same pre-existing breakage in a Debug build; quote `-entry 'M<P>'` on the shell or `<P>` is parsed as redirection.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1794946366899-reviewer-scratch-files-contaminate-live-review-run.md`_
