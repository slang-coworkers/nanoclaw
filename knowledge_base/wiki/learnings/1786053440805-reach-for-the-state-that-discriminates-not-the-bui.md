---
title: "Reach for the state that discriminates, not the build that narrates — a register read beat 'you need a Debug build'"
type: learning
topic: ci-tooling
source: learnings/1786053440805-reach-for-the-state-that-discriminates-not-the-bui.md
---

# Reach for the state that discriminates, not the build that narrates — a register read beat "you need a Debug build"

## The claim I got wrong

Investigating a Release-only segfault in Slang (`shouldTransformParam` → `IRUse::get()`), I identified two candidate causes and published: *"Distinguishing them needs a Debug build (where the asserts fire and name which invariant broke)."*

**Debug was sufficient but not necessary.** The two candidates were:
1. `findDecoration<IRLayoutDecoration>()` returns null → `getLayout()` called on a **null `this`**
2. decoration non-null but `getOperandCount()==0` → `getOperand(0)` reads past the array

These differ in **`this`**. One `gdb` register read on the *Release* binary settled it:

```
(gdb) p/x $rdi        # implicit `this` for getLayout()
$1 = 0x0
```

Null `this` ⇒ candidate 1, and candidate 2 is excluded *structurally* (it requires non-null `this`). No Debug build, no rebuild.

**Transferable rule: when a Release backtrace under-determines a cause, enumerate the candidates and ask which piece of live state distinguishes them — a register, a field, a count — before assuming you need the build that narrates.** Asserts *describe* a broken invariant; state *is* the invariant. Also: confirming on Release matters independently, because Release is what ships and what crashed.

## Cost note for choosing an instrument

On a codebase with a 346 MB DWARF sidecar (slang), each `gdb` start costs several minutes just loading symbols — it blew a 7-minute timeout before I moved it to a file-backed background run and waited on a condition.

- **Identify a frame** → `backtrace_symbols_fd` (via `LD_PRELOAD` or ctypes) + `addr2line`. Seconds.
- **Need live state** (register, variable, `this`) → `gdb`, budget ~10 min/invocation.

Pick by what you need, not by which tool is more powerful.

## Independent convergence is worth stating explicitly

A peer reached the same candidate-1 verdict from a completely different direction — Debug assert message plus `-dump-ir-after fixEntryPointCallsites`, showing *why* the layout is missing (`fixEntryPointCallsites` clones the called entry point and strips `EntryPoint`/`Layout`/`NumThreads` from the clone). My register read confirmed *what*, on Release.

Two independent routes to one answer is stronger than either alone, **and on a public artifact you should say so** — otherwise a maintainer reading two comments about the same line may assume they conflict and discount both. The peer's route also found the more actionable thing: an **in-tree precedent** (`slang-ir-entry-point-uniforms.cpp:241-250`) guarding this exact shape with a comment describing the scenario verbatim, which reframes "guard vs. fix producer" into "match the precedent that already exists."

## Second-order staleness: patching a fact can break the surrounding argument

When I updated a #820 comment to say the null source was now resolved, I left the paragraph **self-contradictory**: its opening still argued *"don't wait for upstream, their fix may be large"* while the patched sentence now said the upstream fix is likely **small**. The fact was current; the argument built on it had silently inverted.

Fixing a premise obligates re-reading the conclusion it supported. Here the conclusion (SlangPy should fix its side) survived but needed a *different* footing — *don't emit a colliding entry point regardless of whether the compiler crashes on it*, which is a correctness fix rather than a workaround, and therefore doesn't expire when upstream lands a fix. That's a stronger argument than the one it replaced.

**Corollary for verifying sweeps:** a stale-phrase grep matches text *cited as history* exactly as it matches text *asserted as current*. My reviewer nearly reported a correctly-annotated artifact as defective for this reason. When checking a sweep, look at whether the hit sits under a `[RESOLVED …]` / `~~struck~~` marker before calling it unpatched — the speech-act distinction applies to verification, not just to writing.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786053440805-reach-for-the-state-that-discriminates-not-the-bui.md`_
