---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-19T17:47:54.387Z
---

# GitHub compare `.files` caps at 300 — "N files changed" / "file X not in the diff" from a compare is a truncation trap; use per-file blob SHAs to prove byte-equality across a range

# The `compare` endpoint's file list is capped, and it silently misclassifies a diff

On shader-slang/slang#12446 the orchestrator absorbed a `synchronize`
(head → `ebd8327`) by diffing `compare/1b4ed61e...ebd8327` and concluding
"**0 source files changed since R7**, the int32 guard is byte-unchanged." Both
halves are false, and the mechanism is a truncation trap.

`gh api repos/O/N/compare/A...B` returns a `.files` array **capped at 300
entries** (GitHub's per-compare limit; the `commits` array caps at 250,
similarly). On a big master-merge `synchronize` (here 300 files returned,
exactly the cap), the array is truncated and gives no signal that it is.

**Proof it was truncated, not empty:** I read the guard blob directly at both
ends — `slang-serialize-ir.cpp` holds `array.getCount() * Count(elementSize)`
(signed) at R7 `1b4ed61e` and `(uintptr_t)count * elementSize` at `ebd8327`.
The file **demonstrably changed** across that range, yet it was **absent** from
the 300-entry `.files` array. Absent-from-a-capped-array ≠ unchanged.

The conclusion happened to be right for the *narrow* interval that mattered
(R9 `96d21303` → `ebd8327`: no source moved), but it was drawn from the wrong
(truncated) instrument and stated against the wrong anchor (R7, across which the
guard *did* change R7→R8). Right answer, unsound method — the dangerous kind,
because the method will misclassify the next `synchronize` that mixes a
180-file master-merge with a real `slang-serialize-*` change sitting past
position 300 in the file list.

**The truncation-proof check** — compare per-file blob SHAs, not the compare
array:

```bash
for f in slang-serialize-ir.cpp slang-ir.cpp slang-ir.h ...; do
  a=$(gh api repos/O/N/contents/source/slang/$f?ref=$A --jq .sha)
  b=$(gh api repos/O/N/contents/source/slang/$f?ref=$B --jq .sha)
  [ "$a" = "$b" ] && echo "SAME $f" || echo "DIFF $f"
done
```

Identical `.sha` = byte-identical file, and it does not depend on any capped
list. For "did the fix-relevant surface move between two heads", enumerate the
files you care about and blob-SHA each — don't ask `compare` for the file set
and trust its completeness.

**Generalizes the standing rule** *"every GitHub per-file array truncates"*
(already recorded for `pulls/N/files` and the diff endpoints) to a distinct
endpoint: **`compare` is a 4th truncating surface**, and its cap (300) is high
enough that only a large merge trips it — which is exactly when a "pure
doc/CI churn, absorb silently" routing policy would lean on it. A silent-absorb
policy is only safe if the diff check that classifies a `synchronize` as
"no source moved" is itself truncation-proof; the compare-`.files` check is not.

⭐ Same shape as the other members of this family this session: a page-1 tally
for a set, a flat `ls` for a tree, a short SHA for a queryable ref — **a
negative from an instrument whose capacity the input exceeds is not a
negative.** Before trusting "file X isn't in the diff," ask whether the diff
list could be full.
