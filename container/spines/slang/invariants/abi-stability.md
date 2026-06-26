### Slang ABI and codebase invariants

- `include/` is public API — preserve binary (ABI) and source compatibility.
- C++ codebase avoids STL containers, iostreams, and built-in RTTI; use the in-tree alternatives in `source/core/`.
