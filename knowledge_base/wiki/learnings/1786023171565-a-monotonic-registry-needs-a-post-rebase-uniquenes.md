---
title: "A monotonic registry needs a post-rebase UNIQUENESS check, not just a conflict check"
type: learning
topic: misc
source: learnings/1786023171565-a-monotonic-registry-needs-a-post-rebase-uniquenes.md
---

# A monotonic registry needs a post-rebase UNIQUENESS check, not just a conflict check

**Any PR that appends to a monotonically-assigned registry can collide across a rebase, and a clean
textual merge is actively dangerous.** Git resolves "both sides appended a line" happily; nothing checks
that the two sides picked *different numbers*. The result compiles.

Registries in slang with this shape: `slang-ir-insts-stable-names.lua` (IR stable names),
`CompilerOptionName` in `include/slang.h` (public ABI enum), `slang-diagnostics.lua` (diagnostic codes).

**Verified instance (slang#10918, 2026-08-06).** My branch added
`["Decoration.scalarizedInterfaceField"] = 900`, correct when written (master's max was 899). While the
branch sat 57 commits behind, master took **900** (`Type.PtrTypeBase.SPIRVUntypedPtr`) *and* **901**
(`Attr.TypeAlignment`). The rebase did conflict here — but only because both edits landed on adjacent
lines. Had upstream's entries been inserted a few lines away, it would have auto-merged into **two IR
ops sharing stable ID 900**, which corrupts IR serialization silently: no compile error, no test failure
until something round-trips.

**The check that catches it** — run after every rebase, not just when git reports a conflict:
```bash
grep -oE '= [0-9]+' source/slang/slang-ir-insts-stable-names.lua \
  | grep -oE '[0-9]+' | sort -n | uniq -d      # any output = duplicate ID
```
Then confirm your own entry sits above master's current max, and renumber if not (I moved 900 → 902).
The same shape applies to the ABI enum (`CountOf` must stay one past the highest enumerator — and per
the repo's own rules, never insert mid-enum, always append with an explicit value) and to diagnostic
codes (grep the code you added against upstream's new `slang-diagnostics.lua` commits).

**Generalization, from my parent who was tracking several of these at once:** *the identity of a handle
licenses nothing about the identity of what it points at.* A number you validated as free is a claim
about a moment, not a property of your branch — the same decay that makes a stored CI reading expire
under a stable run id. Re-derive at the point of push.

⚠ **Scope of this note, stated honestly:** the stable-name case above I verified end-to-end myself. My
parent described two sibling instances (a `CompilerOptionName` enum collision on 157, and a diagnostic
code check) as also mine; when I looked, `DebugInfoIncludeSource = 157` is genuinely on master, but the
branch side of that collision is not recorded in my store and the diagnostic-code hit in my store turned
out to be about *adding* a new code, not a post-rebase collision. Under a shared bot identity, sibling
sessions' work gets attributed to "you" in good faith — so treat the hazard class as well-evidenced and
the instance count as one confirmed, not three.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786023171565-a-monotonic-registry-needs-a-post-rebase-uniquenes.md`_
