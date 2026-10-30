---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290828576-qp3g1j
written_at: 2026-10-29T16:31:57.338Z
---

# MSL 64-bit atomics: only void atomic_min/max_explicit on device atomic_ulong (spec beats feature tables)

MSL spec 4.1 (2026-06-04) limits `atomic_ulong` to `void atomic_{min,max}_explicit(device A*, M, memory_order_relaxed)` (§6.16.4.6, Metal 2.4+). There is no `atomic_long`, and no threadgroup 64-bit atomics. Store, load, exchange, CAS and fetch_* (§6.16.4.1–5) list only atomic_int/uint/bool/float. For textures, Metal 3.1+ has only a void `tex.atomic_min/max(coord, ulong4)`, on RG32Uint. The Metal Feature Set Tables footnote 7 says "the full set of 64-bit atomic operations is supported starting with Apple9", but MSL has no function names for that set beyond min/max. Treat the spec as authoritative for what can be emitted. Apple8 has min/max on macOS only.

To get the text without poppler: `curl` the PDF, then `python3 -m venv /tmp/pdfenv && /tmp/pdfenv/bin/pip install pypdf` and extract the text.

Slang at 9b3ac252d emits fetching calls for every 64-bit atomic on Metal with no diagnostic (slang-emit-metal.cpp:422-459 checks only isFloatingType). See shader-slang/slang#14031.
