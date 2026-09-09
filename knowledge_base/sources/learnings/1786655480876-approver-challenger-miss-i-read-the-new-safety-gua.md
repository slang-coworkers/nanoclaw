---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786435332070-exgjs1
written_at: 2026-08-13T21:11:20.876Z
---

# [approver/challenger-miss] I read the NEW safety guard for what it CATCHES, not what it's COMPUTED IN — a signed int32 count-multiply overflows the containment check before it runs (slang#12446 R7, 32-bit)

# A WOULD_APPROVE the critique gate caught: overflow inside the guard I'd cleared

On slang#12446 R7 @`1b4ed61e` I had verified the headline concurrency fix (my own
R6 data-race BLOCK, now fixed by construction) and all prior gaps, confirmed CI
green and 5 genuine new tests, and drafted **WOULD_APPROVE**. The DECISION_REVIEW
critique (codex) surfaced a real latent defect I had walked straight past, and it
was **inside the very guard I had cited as the fix** for a prior gap.

## The defect

`spansAreOwnedByTheBlob` (`slang-serialize-ir.cpp:1205`) is the containment net
that validates each `SerializedArray` view lies inside the retained blob before
deferral is allowed (else it falls back to eager). Its per-array check:

```cpp
spanIsInsideBlob((const Byte*)array.getBuffer(), array.getCount() * Count(elementSize));
```

`Count = Int = SlangInt`, which is **`int32_t` when `SLANG_PTR_IS_32`** (WASM,
32-bit ARM — both shipped; `include/slang.h:559`). So on a 32-bit build,
`getCount() * Count(8)` for an `Int64` array above ~268M elements **overflows the
signed multiply before `spanIsInsideBlob` ever runs**. A wrap to a small positive
then *passes* the containment check — admitting a multi-GB out-of-blob span to be
dereferenced later, the exact UAF the guard exists to reject. The author had
guarded the *pointer* arithmetic against wrap (the comment even names a 34GB
threshold) but not the *count* multiply feeding it.

## Why I missed it, and the transferable probe

I audited the guard for **what it catches** (does it check all 5 arrays? does it
fall back to eager? — yes, yes) and treated "the net exists and is total" as
sufficient. I never audited **the arithmetic the net is computed in.**

⭐⭐⭐ **A BOUNDS/CONTAINMENT CHECK IS ITSELF CODE THAT CAN OVERFLOW BEFORE IT
DECIDES. When you clear a guard, check the type and width of every value it
computes — especially a `count * size` product — against the platform where the
type is narrowest, not the 64-bit dev host.** The failure is invisible on x86-64
CI (where `Int` is 64-bit) and only bites on a shipped 32-bit target — same
"green on the runners we have ≠ correct on the targets we ship" trap as an
acquire that's a plain `mov` on x86.

⭐⭐ **The safety net is the highest-value place to look for a bug, not the lowest.**
A guard added in response to a prior finding carries an implicit "this is now
handled" that suppresses scrutiny — the same free pass a reassuring comment gets.
I had literally quoted this guard as the fix for the `:1013` view-lifetime gap.

## The decision lesson

⭐⭐⭐ **An independent reviewer adding a genuine concern I missed means my
investigation was NOT clean — and WOULD_APPROVE requires a clean one.**
Investigation can only *add* caution (skill Step 3). The correct move was to
downgrade WOULD_APPROVE → **ABSTAIN_POLICY / OPEN_GAP** (plausible trigger: a
corrupt/hostile `.slang-module` on 32-bit; real blast radius; but not on the
trusted embedded-builtin path, so not a verified 🔴/BLOCK). Conservative-lean:
any doubt ⇒ abstain, never round up.

This is exactly why WOULD_APPROVE and BLOCK are critique-gated and abstains are
not: the gate is the second reader whose whole job is to make the positive claim
survive an adversary. It did.

## A second, smaller miss in the same pass

My draft said the concurrency test runs "16 threads." It runs **8**
(`kThreadCount = 8`, `unit-test-ir-deferred-body.cpp:171` and the in-tree harness
`slang-serialize-ir.cpp:1749`). The "16" came from a stale **code comment**, not
the runtime spawn. ⭐ **Read the value off the code that executes, never off the
prose next to it** — the same "verify against the code, not the narration" rule
that the overflow miss violated one level up.
