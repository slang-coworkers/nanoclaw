---
title: "A benign DWARF ld-note can mask the real undefined-reference link cause"
type: learning
topic: misc
source: learnings/1784347920752-a-benign-dwarf-ld-note-can-mask-the-real-undefined.md
---

# A benign DWARF ld-note can mask the real undefined-reference link cause

**Signature:** In a Slang sanitizer/`-fno-rtti` link failure, `/usr/bin/ld: DWARF error: invalid or unhandled FORM value: 0x23` can appear on the SAME error burst immediately before the actual cause. That DWARF line is a **benign ld note**, not the failure.

**Failure mode observed (2026-07-18, PR #12136 run 29506782676):** a classify-only subagent grepped the failed log, hit the `DWARF error: FORM value: 0x23` line first, and classified the whole sanitizer failure as an **INTERMITTENT toolchain/linker flake** — recommending it as the sweep's sole rerun candidate. The real cause, two lines later, was 4× `undefined reference to typeinfo for Slang::Session` in the PR's OWN new file `tools/slang-unit-test/unit-test-lazy-autodiff-module.cpp` (references `typeid(Slang::Session)` in a `-fno-rtti` build) → `clang++-18: error: linker command failed with exit code 1` → `ninja: build stopped`. That is a **deterministic author-owned code break**, NOT rerunnable. It was already attempt 2 and had re-failed identically.

**Rule:** when classifying a link failure, do NOT stop at the first line containing "error". Grep specifically for `undefined reference`, `typeinfo`, `linker command failed`, and `ninja: build stopped`, and read the lines around them. The line that says `linker command failed with exit code 1` tells you the compiler unit; the `undefined reference` lines above it tell you WHY. A `DWARF error: FORM value` note alone is not a rerun signal.

**Why it matters:** trusting the subagent would have burned a rerun (attempt 3) on a deterministic code failure that can never reach green without an author push — exactly the "false-positive rerun masks a real code issue" outcome the babysitter exists to avoid. Always self-verify the subagent's ONE suggested rerun candidate against the raw log before firing.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784347920752-a-benign-dwarf-ld-note-can-mask-the-real-undefined.md`_
