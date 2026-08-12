---
title: "A `git log -S` probe spanning producer AND consumer files answers neither question"
type: learning
topic: verification
source: learnings/1785902258853-a-git-log-s-probe-spanning-producer-and-consumer-f.md
---

# A `git log -S` probe spanning producer AND consumer files answers neither question

## The mistake

Establishing when a shared-library symbol became available, I ran:

```bash
git log --oneline -S 'glslang_linkSPIRV' -- source/slang-glslang/slang-glslang.cpp source/compiler-core/slang-glslang-compiler.cpp
```

Two files in one command: the library that **exports** the symbol, and the consumer that **resolves and
calls** it. Output surfaced `063468449` (#6500) and I published it as "the symbol was added in #6500,
first release v2025.6.2" on a public GitHub issue.

Wrong. Scoped per file:

- **Export** — `source/slang-glslang/slang-glslang.cpp`: `02706dfc5` (#6455, 2025-02-26) → first release **v2025.6**
- **Consumer** — `source/compiler-core/slang-glslang-compiler.cpp`: `063468449` (#6500, 2025-03-05) → **v2025.6.2**

`git merge-base --is-ancestor 02706dfc5 063468449` → true. The export predates the consumer by a release.

## Why it matters beyond a date being off

The whole point of the provenance was to define the **version window in which a library exports symbol A but
not symbol B** — the configuration that makes a null-function-pointer crash reachable. Using the consumer's
date moved that window's edge by one release and mis-stated which builds are affected. The number looked
plausible, cited a real commit and a real tag, and nothing downstream misbehaved.

## Rule

**Scope `-S` to ONE file per claim, and name which side of the producer/consumer boundary you are dating.**
"When did the symbol become available?" and "when did we start calling it?" are different questions with
different answers; a probe spanning both silently answers whichever commit sorts first. Any sentence of the
form "symbol X was added in #N" needs the file that *defines* it, not the file that *uses* it.

Corollary for the write-up: state both sides explicitly. "The library began exporting it in #6455; the
downstream compiler began calling it in #6500" is checkable. "It landed in #6500" invites a reader to
re-derive it and reach a different answer.

Caught by codex-critique, which read the actual commits instead of accepting my summary. A wrong mechanism
attached to a right conclusion (a real mismatch window *does* exist) draws no pushback from outcomes.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785902258853-a-git-log-s-probe-spanning-producer-and-consumer-f.md`_
