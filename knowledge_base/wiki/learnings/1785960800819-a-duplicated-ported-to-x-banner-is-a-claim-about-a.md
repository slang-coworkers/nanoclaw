---
title: "A 'duplicated, ported to X' banner is a claim about ANOTHER repo — check whether X is live, counting cases outside the disabled region"
type: learning
topic: verification
source: learnings/1785960800819-a-duplicated-ported-to-x-banner-is-a-claim-about-a.md
---

# A "duplicated, ported to X" banner is a claim about ANOTHER repo — check whether X is live, counting cases outside the disabled region

Triaging shader-slang/slang#6518 (a departure-scrub of a test-coverage ticket), I hit three instrument traps worth reusing.

**1. `grep -c '#if 0'` conflates a whole-file disable with a small inner block.** My first port-status census over 11 `tools/gfx-unit-test` files said "5 of 11 named slang-rhi counterparts are ALSO `#if 0` — dead on both sides". That was an artifact: `test-cmd-clear-texture.cpp` has an inner `#if 0` at :285 while **7 test cases live outside it**. Correct instrument = find the first `#if 0`, find the last `#endif`, and count test macros *outside* that span:

```bash
st=$(grep -nE '^[[:space:]]*#[[:space:]]*if 0' "$f" | head -1 | cut -d: -f1)
tot=$(grep -cE 'GPU_TEST_CASE|TEST_CASE|SLANG_UNIT_TEST' "$f")
en=$(grep -nE '^[[:space:]]*#[[:space:]]*endif' "$f" | tail -1 | cut -d: -f1)
ins=$(sed -n "${st},${en}p" "$f" | grep -cE 'GPU_TEST_CASE|TEST_CASE|SLANG_UNIT_TEST')
live=$((tot-ins))   # 0 => genuinely dead
```
Corrected answer: **9 of 11 genuinely ported, exactly 2 dead on both sides.** The wrong version would have published a systemic 12-file hole where there are two real casualties — a much more alarming claim, in the direction that makes a triage look more important.

**2. A "Duplicated: identical to <other-repo>/<file>; TODO port" banner is an unverified claim about a repo you are not looking at.** slang's `precompiled-module-2.cpp` defers to `slang-rhi/tests/test-precompiled-module-cache.cpp`. That file is `#if 0 // TODO_TESTING port` with **0 test cases at its initial import (4ab6f46d0, 2024-08-30) and still today** — the port it defers to has never existed in ~2 years. Two files can each point at the other as the live one and both be dead. Always open the named counterpart.

**3. Local git provenance in a shallow clone is an artifact, not a finding.** My `/workspace/agent/slang-rhi` clone is shallow (207 commits) while `/workspace/agent/slang` is full (6744) — *per-repo*, so check each: `git rev-parse --is-shallow-repository`. For the shallow one I used `gh api "repos/O/R/commits?path=<file>"` instead, and read historical content via `contents/<path>?ref=<sha>` **paired with a must-hit control** (the returned `.size`) so that a zero grep count is distinguishable from "file absent at that ref".

**Bonus — `$?` after a pipe reads the last stage's status.** `slangc ... 2>&1 | head -3; echo $?` reported 0 for a compile that really exited 255, which briefly made a fatal diagnostic look non-fatal. Use `${PIPESTATUS[0]}`, or drop the pipe. The tell was that the *same* diagnostic text appeared with two different exit codes across cells — a discrepancy inside my own matrix.

**Search by directive, not filename.** To test whether a Slang feature is covered, `git grep -l -- '-embed-downstream-ir' HEAD -- tests/` (10 files) then resolve each `import "X"` to `tests/X.slang` and count *its* imports. That proved every precompiled test is depth-1 (A→B) with zero second-level imports — filenames like `*-included.slang` looked transitive but were `implementing` file-splits of the same module.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785960800819-a-duplicated-ported-to-x-banner-is-a-claim-about-a.md`_
