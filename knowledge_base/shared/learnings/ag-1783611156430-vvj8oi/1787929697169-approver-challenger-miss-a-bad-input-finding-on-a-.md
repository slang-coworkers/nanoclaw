---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787927021507-6b5ou4
written_at: 2026-08-28T15:08:17.169Z
---

# [approver/challenger-miss] A bad-input finding on a low-level function clears only after you trace that every REAL caller guards before reaching it

## Symptom

On slang-rhi#849 (WOULD_APPROVE @ddb5da2ea092, transient constant-buffer allocator
refactor), CodeRabbit's one Stability finding was: `TransientBufferHeap::allocate()`
calls `alignAllocationSize()` (a round-up) on `size` BEFORE checking
`size > maxPageSize`, so a near-`SIZE_MAX` `size` overflows the round-up to a small
`alignedSize` and the function returns `SLANG_OK` for an impossible request.

The naive reads are both wrong: (a) "it's a real overflow → OPEN_GAP/BLOCK", or
(b) "it's just a nit → clear" without evidence.

## Root cause / the right check

`TransientBufferHeap::allocate` is a lower-level primitive. The finding is only a
LIVE bug if a real caller can pass a near-`SIZE_MAX` size to it. The decision hinges
on tracing the callers, not on re-reading the flagged function:

- The production constant-buffer path is `d3d12-shader-object.cpp:645` /
  `vk-shader-object.cpp:413` → `TransientBufferArena::allocate`, which itself
  rejects `size > m_heap->getMaxPageSize()` **before** aligning. So the arena — the
  only in-repo caller of the heap for real bindings — guards the exact overflow
  first.
- The heap's unguarded path is reachable only by calling `TransientBufferHeap::allocate`
  DIRECTLY with a ~`SIZE_MAX` size, which nothing in-tree does; CB bindings are orders
  of magnitude below the 4 MiB maxPageSize.

⇒ The finding is **defensive hardening on a primitive whose sole real callers already
guard the input**, not a live defect. Under the conservative-lean gap bar this CLEARS
(trigger unreachable on the supported path), and the author may still take the belt-and-
suspenders fix.

## How to catch it / general rule

When a bot flags a bad-input path (overflow, missing bound check, unchecked cast) on a
UTILITY / library-internal function, do NOT judge it in isolation. Grep the callers:
if every real caller already enforces the precondition before the call, it's
defensive-hardening (clears); if ANY caller can reach it unguarded, or the function is
part of a public API surface external code can call directly, it does not clear —
reachability is about the caller set, not the function body. (Cf. the library-contract
rule: for a public API the "callers" are external code, so an unguarded public entry
does NOT clear. This case is the opposite — an internal primitive with in-repo-only,
guarding callers.)
