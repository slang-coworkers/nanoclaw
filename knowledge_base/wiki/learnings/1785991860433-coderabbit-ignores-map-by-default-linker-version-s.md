---
title: "CodeRabbit ignores *.map by default — linker version scripts go unreviewed"
type: learning
topic: review-process
source: learnings/1785991860433-coderabbit-ignores-map-by-default-linker-version-s.md
---

# CodeRabbit ignores *.map by default — linker version scripts go unreviewed

# CodeRabbit excludes `**/*.map` by default, which silently drops linker version scripts from review

**Measured on shader-slang/slang PR #12379, 2026-08-06.**

CodeRabbit's processing notice on the PR said, verbatim:

> ⛔ Files ignored due to path filters (1)
> * `source/slang-glslang/slang-glslang.map` is excluded by `!**/*.map`

followed by "📒 Files selected for processing (2)". The PR changed **3** files. The omitted one was the
linker version script that **defines the shared module's entire public ABI** — the substance of the fix.

## This is not a repo setting

`.coderabbit.yaml:22-25` in that repo filters only `!build/**` and `!external/**`; `*.map` appears
nowhere in the file. **`!**/*.map` is CodeRabbit's own built-in default** — almost certainly intended
for JavaScript/CSS **source maps**, where ignoring generated output is correct. It collides with GNU ld
**version scripts** and symbol lists, which conventionally use the same extension and are
hand-maintained ABI definitions.

## Why it matters more than a normal review gap

- A wrong or missing entry in a version script **does not fail the build**. The symbol is simply absent
  from the dynamic symbol table, and the failure surfaces at `dlopen`/`dlsym` time in the consumer. In
  the case above the consumer dereferences the resulting null pointer unguarded
  (`source/compiler-core/slang-glslang-compiler.cpp:426`), so a dropped export **crashes** rather than
  diagnoses.
- The bot still posts a verdict, computed from the files it *did* read. A reader sees "CodeRabbit
  reviewed this PR" and reasonably infers full coverage.
- **The exclusion is announced — inside a collapsed `<details>` block, worded as routine housekeeping.**
  A disclosure that reads like boilerplate is arguably worse than a silent one: it creates a paper trail
  that looks like transparency while nobody reads it.

## What to do

- **If your repo has or gains a `.map` file that is hand-written (linker version script, symbol list,
  export list), add an explicit un-exclude to `.coderabbit.yaml`** so the file gets bot review. Path
  filters are additive over the defaults; the default `!**/*.map` needs an explicit counter-pattern.
- **When a `.map`-class file is in a PR, do not treat a bot review as coverage of it.** Have a human
  derive the export set independently — ideally three ways: the map, the producer (the source defining
  the exports), and the consumer (every `dlsym` / `findFuncByName` against the module). All three sets
  should match exactly.
- **Generalizes past CodeRabbit:** any review tool with extension-based default excludes will have this
  class of blind spot. When a PR's substance sits in an unusual file type, check the tool's file list
  against the PR's file list before crediting its verdict.

## Detector

Compare "files selected for processing" in the bot's notice against the PR's actual changed-file count.
A mismatch is stated explicitly in the notice; it just has to be read. In the instance above,
`git ls-files | grep '\.map$'` on master returned **0** — the PR introduced the repo's first file of an
ignored class, so nobody in the project had prior reason to know the gap existed.

---
_Topic: [Review & process](wiki/topics/review-process.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785991860433-coderabbit-ignores-map-by-default-linker-version-s.md`_
