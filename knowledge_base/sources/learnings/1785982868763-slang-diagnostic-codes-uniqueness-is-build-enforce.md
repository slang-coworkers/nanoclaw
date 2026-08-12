# Slang diagnostic codes: uniqueness is build-enforced across five catalogs, not just conventional

When picking a new diagnostic code in shader-slang/slang, the safety argument is **not** "I checked the
max in the band and went one higher." Band arithmetic against a possibly-stale base is exactly how
duplicate codes ship. The durable property is structural:

**`source/slang/slang-diagnostics-helpers.lua` enforces uniqueness at build time and `error()`s out on a
clash.** So a collision fails the build loudly rather than silently producing a duplicate code. This is
what makes two in-flight PRs claiming adjacent codes safe to merge in **either order**, independent of
anyone's enumeration being complete.

Two things the check spans that a single-file grep will miss:

1. **Five catalogs share one code space**, not one. `slang-diagnostics.lua` (~786 entries),
   `source/slang/diagnostics/type-errors.lua`, and three C++ catalogs the helper explicitly folds in via
   `cpp_diagnostic_defs_files`: `source/compiler-core/slang-{misc,lexer,json}-diagnostic-defs.h`. A new
   `*-diagnostic-defs.h` joining the compiler code space **must** be added to that list or its codes stop
   participating in the collision check. The `*-diagnostic-defs.h` files under `tools/` are deliberately
   excluded — each is a separate self-contained enumeration numbering from ~0.
2. **Duplicates are legal for an allow-listed set.** `is_intentional_shared(code)` permits all negative
   codes (internal sentinels, e.g. `-1` for decorating notes) plus an explicit
   `intentional_shared_code_list` (20002–20012). That is why 39999 appears 27× and 99999 6× without
   failing the build — those are named umbrellas, not bugs.

**Two enumeration traps, both of which produce confidently wrong answers:**

- **`type-errors.lua` uses entirely different syntax** — `diagnostic "argument_type_mismatch" { code =
  "E30019", ... }` — and contains **zero integer tokens**. An integer-anchored scan returns a clean,
  meaningless `0` for it. And because one catalog stores codes as *strings*, an integer-only search is
  blind to that representation everywhere: re-run for `E116`/`E0116`/`E00116`/`"116"` too, with a positive
  control (`E30019`) proving the string method fires.
- **The helper's own doc comment contains `warning("my-warning", 123, "message", span{...}, pedantic)`** —
  a commented example. A call-shape regex counts it as a real diagnostic occupying code 123. Strip
  comments, or search integer-in-band anywhere and *read the surrounding line*.

A call-shape regex (`err\(\s*"name",\s*NNN,`) also misses helpers you didn't enumerate — `standalone_note`
holds 102 and 103 in the 100-band. Prefer "any standalone integer in band, anywhere, then read the line"
over a syntax-anchored match.

**Rendering, useful for writing tests:** the rich renderer emits severity immediately followed by the
zero-padded bracketed code — `slang-rich-diagnostics-render.cpp:803` produces `error[E00116]`. That form
is *not* in the message text, so asserting on `error[E00116]` **pins severity as well as the ID**: a
downgrade from `err(` to `warning(` breaks the assertion. The older plain sink path
(`slang-diagnostic-sink.cpp:166`) emits `error 116:` instead. Also note `internal(` maps to
`Severity::Internal`, which sorts **above** `Fatal` in the `Severity` enum, so it triggers
`SLANG_ABORT_COMPILATION` at `slang-diagnostic-sink.cpp:619` — an `internal(` diagnostic aborts the
compile, which can make a downstream test abort before reaching the code it targets.

Measured at master `ff45b15ed3` (2026-08-05): band 100–114 contiguous, nothing until the commented 123.
