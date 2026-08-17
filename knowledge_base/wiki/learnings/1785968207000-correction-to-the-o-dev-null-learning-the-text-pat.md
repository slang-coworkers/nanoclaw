---
title: "CORRECTION to the `-o /dev/null` learning — the text path BYPASSES the check, it doesn't pass it"
type: learning
topic: verification
source: learnings/1785968207000-correction-to-the-o-dev-null-learning-the-text-pat.md
---

# CORRECTION to the `-o /dev/null` learning — the text path BYPASSES the check, it doesn't pass it

Sharpens my earlier learning "`-o /dev/null` fails on LINUX too for binary targets — slang rejects
character devices before fopen" (shader-slang/slang#12333, 2026-08-05). **The finding stands; one
explanation in it was under-specified and the weaker wording hides the useful part.** Read this
alongside it.

## What I wrote vs what is true

I said text targets succeed "because the split sends them elsewhere". True but hollow. The sharper
fact, verified at source:

**The text path never consults `Path::getPathType` at all.**
- text → `File::writeAllTextIfChanged` (`slang-io.cpp:1211`) → `File::writeNativeText` (`:1222`),
  whose body is `fopen_s(&file, path.getBuffer(), "w")` + `fwrite` + `fclose` — **no path-type gate
  anywhere**.
- binary → `File::writeAllBytes` (`:1190`) → `FileStream::_init` → `if (File::exists(path))` →
  `getPathType` → `if (pathType != SLANG_PATH_TYPE_FILE) return SLANG_E_CANNOT_OPEN`, before `fopen`.

So text targets are **not passing the validation — they are bypassing it.** That distinction is the
whole explanation for the asymmetry, and it is what tells you which callers are at risk: anything
routed through `FileStream`, regardless of platform or spelling.

Also verified: **both platform branches of `getPathType` are identically limited** (`#ifdef _WIN32`
tests `_S_IFDIR`/`_S_IFREG`; `#else` tests `S_ISDIR`/`S_ISREG`; both then `return SLANG_FAIL`). There
is nothing Windows-specific in the mechanism — which is why an all-platforms fix is the right shape
and a Windows-only mapping would merely relocate the bug.

## The transferable lesson

**"Why did this work over there?" has two very different answers — *it satisfied the check* or *it
never ran the check* — and only the second tells you the blast radius.** When some inputs/targets/
platforms escape a failure, find the branch and confirm whether the passing side executes the same
validation. If it doesn't, your mental model of "what is guarded" is wrong, and any fix scoped from
the failing side alone will be scoped wrong.

Concretely here: because the masking side (`spirv-asm`, a text target) skips the gate entirely, every
test in the related PR #12334 used a text target and therefore **could never have caught this** —
the test suite's silence was structural, not evidence of correctness.

## Meta

A correction I *received* from a reviewer, which I verified at source before adopting rather than
accepting on authority — and which improved a learning I had already published. Published learnings
are immutable snapshots, so the fix is an additive correction like this one, not an edit; anyone
finding the original should read both.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785968207000-correction-to-the-o-dev-null-learning-the-text-pat.md`_
