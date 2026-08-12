---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-12T02:48:20.915Z
---

# [approver/challenger] Concurrency BLOCK pattern — a partial acquire/release conversion: named accessors get the barrier, the CONTAINER iterator + end() don't, so the range-for reader stays racy

# Verified 🔴 on slang#12446 R6 @bd29d29: incomplete acquire discipline

A PR added lazy/on-demand IR body deserialization, publishing a deferred body
across threads with a single release store and reading the link with acquire.
The primary review flagged a 🔴 data race; I verified it against the head source
and it BLOCKs. The shape is transferable to any "add memory-ordering to an
existing pointer-linked structure" change.

## The mechanism

- Publish: `irPublishDecorationLink` does a **release** store of the body onto
  `lastDecoration->next` (`slang-serialize-ir.cpp:750`).
- The author converted the **named single-step accessors** to acquire:
  `getFirstDecoration` (`slang-ir.cpp:8856`), `getNextDecoration`,
  `getLastDecoration` all go through `irLoadDecorationLink` (acquire).
- But the **container range iteration** was NOT converted:
  `IRInstListBase::Iterator::operator++` is a plain `inst = inst->next`, and
  `IRInstList<T>::end()` is a plain `Iterator(last ? last->next : nullptr)`
  (`slang-ir.h:1019`). `findDecorationImpl` iterates via `for (auto dd :
  getDecorations())`, so `end()` plain-reads the exact publish slot concurrently
  with the release store.
- C++ range-for evaluates `end()` **once**. Interleaving: `end()` reads nullptr
  pre-publication; loop reaches the last decoration; `operator++` re-reads
  `->next` post-store = `bodyFirst`; `bodyFirst != end` ⇒ the walk continues
  **into the freshly-published body**, calling `getOp()` on body instructions as
  if they were decorations. Formal UB *and* a wrong-answer path.

## The transferable review probes

⭐⭐⭐ **When a change adds memory-ordering (acquire/release) to a link that was
previously plain, the unit of audit is EVERY reader of that link, not the
handful of named accessors the author converted.** Container iterators,
`begin()`/`end()`, range-for sugar, and any open-coded `->next` walk are readers
too — and they are usually the *hottest* ones (here, `findDecoration` is on the
linker's critical path). A conversion that stops at the named accessors leaves
the highest-traffic reader racy.

⭐⭐ **`end()` is a read.** For a linked range whose terminal link is the
concurrently-mutated slot, `end() = last->next` reads that slot — and range-for
caches it once, so a torn/stale value silently extends the iteration. Check the
sentinel computation, not just the step.

⭐⭐ **Reachability gate for a concurrency 🔴:** the race only bites if the
structure is shared across threads AND the racy path is taken. Here two facts
made it a BLOCK not an advisory: (a) builtin modules are loaded once into a
shared global session and read by every compile thread; (b) a sibling commit
flipped the lazy path from opt-in (`SLANG_ONDEMAND_LAZY_IR`) to **default-on**,
so the racy path is now the default. A "formally UB but off by default" race is
a weaker finding; verify the default state before rating.

## Meta-note: severity is about the CODE, not the toolchain

x86-64 makes an acquire load a plain `mov`, so this race is invisible on the CI
that exists (all x86). The PR's own comment even reasons "on x86-64 all measured
within noise." That is a reason it will pass CI, not a reason it is safe — ARM64
(`ldar`) is a supported target. **Do not let "green on the runners we have"
stand in for "correct on the targets we ship."** This dovetails with the
already-recorded gap that there is NO CI in either lazy mode at all.
