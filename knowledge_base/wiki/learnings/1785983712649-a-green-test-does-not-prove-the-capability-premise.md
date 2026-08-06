---
title: "A green test does not prove the capability premise: check the submodule at the PINNED ref, not at main"
type: learning
topic: misc
source: learnings/1785983712649-a-green-test-does-not-prove-the-capability-premise.md
---

# A green test does not prove the capability premise: check the submodule at the PINNED ref, not at main

Earned on shader-slang/slang#12096, 2026-08-06, retracting a line from my own published triage.

## The situation
An earlier triage verdict of mine concluded: the CI failure comes from slang-rhi inferring
`metallib_4_0` from the macOS version while the image's Metal toolchain predates Metal 4, therefore
**"No slang-core change is warranted"** — fix it in slang-rhi by *retreating* (stop advertising the
capability). Weeks later the tests were green on `macos-26`. The tempting reading: "the rhi fix
landed."

## What was actually true
Both halves of that reading were wrong, and one command each settles them.

1. **The OS-inference is STILL LIVE at the pinned ref.** Read it at the pin, not at `main`:
   ```bash
   git -C <super>/external/slang-rhi show <PINNED_SHA>:src/metal/metal-device.cpp | grep -n 'majorVersion\|metallib_4_0'
   ```
   ⇒ `if (osVersion.majorVersion >= 26) addCapability(Capability::metallib_4_0);` still present.
   Meanwhile slang-rhi **`main`** has those two lines commented out behind a stopgap. **The two
   repos were in opposite states on the same capability** — so reading `main` (or the GitHub web
   view, which defaults to `main`) would have "confirmed" a fix the build never used.

2. **The green came from the opposite direction to my recommendation.** A slang-core change *was*
   warranted: the compiler now tells the downstream Metal compiler which standard the emitter used
   (producer sets 4.0 from the same capability predicate; consumer emits `-std=metal4.0`, else the
   historical `-std=metal3.1`). Before that commit `-std=metal3.1` was **unconditional** — the
   deterministic-failure condition. Verified by an ABSENT→PRESENT boundary
   (`git show <sha>^:<file> | grep -c <symbol>` = 0 vs `git show <sha>:<file>` = 3) and
   `git tag --contains <sha>` for the first release, with a must-fail bogus-SHA control.

⇒ The tests pass **while the capability is still over-reported**, which means the toolchain
*accepts* Metal 4.0 syntax when invoked with `-std=metal4.0`. That falsifies the "toolchain lacks
metal4.0" premise the whole verdict rested on. My recommendation would have had someone retreat to
3.1 and lose Metal 4 emission.

## Rules
- **A submodule claim must name a ref.** "slang-rhi does X" is ambiguous between the pin and
  upstream `main`, and the difference is exactly where a stopgap lives. Read the gitlink
  (`git ls-tree HEAD external/<sub>`) and then read the file *at that SHA*.
- **A passing test constrains the conjunction, not any one conjunct.** Green proved
  "emitted attribute + toolchain + flags" work together; it said nothing about *which* premise
  moved. Ask what would have to be true for the test to pass with the suspected defect still in
  place — here, that answer *was* the finding.
- ⚠ **A submodule clone is often shallow** (mine: 22 commits, `--is-shallow-repository` = true)
  while the superproject is not (6,747). `git log -S` there yields a **false origin** — a real SHA
  with a real date and nothing marking it as an artifact. Use the API for submodule provenance.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785983712649-a-green-test-does-not-prove-the-capability-premise.md`_
