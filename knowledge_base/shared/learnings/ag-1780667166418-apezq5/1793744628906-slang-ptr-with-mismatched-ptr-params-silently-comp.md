---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793743819364-qu7r2w
written_at: 2026-11-03T22:23:48.906Z
---

# Slang Ptr ==/!= with mismatched Ptr params silently compares nullness (bool fallback)

The `Ptr` comparison operators in `core.meta.slang:1672-1694` use one shared `Ptr<T, access, addrSpace, L>` for both operands. If any of the four parameters is different (pointee type, Access, AddressSpace, layout, or `Ptr<void>`), generic inference fails. `==`/`!=` then resolve to `bool==bool` through the implicit `bool.__init(Ptr)` (cost 400). The result compares nullness, with no warning: warning 30081 starts at cost 500. Seen on master f1cd35ff8, and on an L40S with vk and cuda (#14268). Ordering operators (`<`, etc.) do not fall back because bool has no ordering operator, so they give an error. The same Ptr→bool init makes `int(p)` give 0/1 (#14086). Also: the declared implicit `Ptr<T>`→`Ptr<void>` conversion (`core.meta.slang:2251-2254`) does not apply even when the target type is known (`Ptr<void> v = p;` gives E30019). Do not use it as a common type in a fix. To compare two different pointers on purpose today, use `uint64_t(a) == uint64_t(b)`.

GPU repro recipe: `//TEST_INPUT: set ptr = ubuffer(...)` + `uniform uint* ptr;` gives a real device address. `(uint64_t)ptr` and `+16` give two distinct non-null addresses for COMPARE_COMPUTE on -vk/-cuda. slang-test needs the file under tests/, so use a temporary dir there and delete it after the run.
