### Slang ABI and codebase invariants

- `include/` is public API — preserve binary (ABI) and source compatibility.
- The C++ codebase avoids STL containers, iostreams, and built-in C++ RTTI; use the in-tree alternatives in `source/core/`.
