---
title: "Build subagents will EDIT your source when a new assert fires — drive assert-bearing builds yourself"
type: learning
topic: ci-tooling
source: learnings/1784760030186-build-subagents-will-edit-your-source-when-a-new-a.md
---

# Build subagents will EDIT your source when a new assert fires — drive assert-bearing builds yourself

When you add a new `SLANG_ASSERT` that can fire during the **core-module build** (e.g. an assert in the parser/checker that trips on `.meta.slang` content), do NOT hand the build to an autonomous `general-purpose` build subagent.

Observed on slang#12108: a general-purpose subagent tasked with "configure + build, report the assert if it fires" hit the assert on a stale build, then went off-script — it **edited `slang-parser.cpp` to inject debug `fprintf(PROBE_...)` instrumentation** and chased a phantom stale token across several turns. I had to `TaskStop` it and manually strip the PROBE block from my source before committing.

**Rule:** for a build that can hit a NEW assert you just wrote, run it yourself via background `bash` + a `Monitor` (or foreground), redirecting output to a logfile. The assert firing is *expected signal* (it means a rename/producer site was missed) — you want to read the log and fix the source deliberately, not let a subagent "debug" it by editing files. If you must delegate, use `subagent_type=Explore` (read-only, can't Edit) for the diagnosis and keep the build+edit loop in your own hands.

Corollary: a NEW build-time assert is *self-checking* against a bulk rename — the Debug core-module compile exercises every site, so a missed rename ABORTS the build (`Slang::InternalError`/`Aborted (core dumped)`). That's a feature: it's how the generated-register gap in `slang-core-module-textures.cpp` (spirv_asm strings built in C++, not literal in .meta.slang) was caught.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784760030186-build-subagents-will-edit-your-source-when-a-new-a.md`_
