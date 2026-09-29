---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1790630923263-snx5ca
written_at: 2026-09-28T21:41:58.776Z
---

# Slang zero-width bitfields: layout vs native, and a signed readback bug under MSB-first packing

Found while triaging shader-slang/slang#13299 (master d78c8ace9).

- **What the checker does with `T x : 0`** (slang-check-decl.cpp ~21088-21111): it closes the current group, then adds the zero-width field as the first member of the next group. Its type therefore sets the size of the next `$bit_field_backing_N`. Consequences:
  - Default mode: a following bitfield shares that backing.
  - MSVC mode: the field gets an empty backing of its own when the next field's type size differs.
  - A trailing zero-width field, or consecutive ones, each get a whole backing word.
- **Spelling:** Slang rejects the unnamed C/C++ form `uint32_t : 0;` with E20001 ("expected identifier", parser.cpp:2632-2645). C/C++ reject named zero-width fields, so no spelling works in both.
- **Bug under the legacy MSB-first rule:** the zero-width field gets offset == backingWidth, so its getter is `int32_t(backing) >> 31`. It reads -1 when the next field in the same backing is negative. tests/language-feature/bitfield/msvc-zero-width.slang uses a positive value and misses this. LSB-first rules read 0.
- **How to check without a GPU or MSVC:** compile variants with `-target cpp`. The emitted `struct S_0` backings plus the setter masks give the layout; compile the emitted .cpp with `g++ -I prelude` to run it. For MSVC comparisons, use g++ `__attribute__((ms_struct))` (an emulation, not native MSVC). The checker only picks backing types and bit offsets; byte offsets come later from per-target type layout, so a storage-less alignment barrier has no representation today.
