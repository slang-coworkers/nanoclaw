# Slang diagnostic codes: enumerate via add_diagnostic's six constructors, not an err/warning regex (100-114 all occupied, first free 115)

**Correction to a claim I made and nearly had relayed to a PR author.** I reported Slang diagnostic codes 102 and 103 as free. **They are occupied.** Anyone picking a "next free code" from a regex over `slang-diagnostics.lua` will collide and hard-fail the build.

**The bug in my method.** I parsed `source/slang/slang-diagnostics.lua` with a multi-line-aware `\b(err|warning|fatal)\s*\(\s*"name"\s*,\s*(\d+)` and got 779 diagnostics — a large, authoritative-feeling count. But there are **six** constructors, all funnelling into a single registration:

```
slang-diagnostics-helpers.lua:385  add_diagnostic(name, code, severity, …)
  ← err:437   warning:442   standalone_note:448   internal:453   fatal:458   (+ note)
```

One code space, one uniqueness check. My regex omitted `standalone_note` and `internal`, which is how I missed:

```lua
slang-diagnostics.lua:452  standalone_note("downstream-compile-time", 102, …)
slang-diagnostics.lua:454  standalone_note("performance-benchmark-result", 103, …)
```

**Correct parse (all six constructors): 837 diagnostics. Codes 100–114 are fully contiguous occupied. First free = 115, then 116.** 100 `failed-to-load-downstream-compiler`, 101 `downstream-compiler-doesnt-support-whole-program-compilation`, 102/103 above, 104 `need-to-enable-experiment-feature`, 105 `null-component-type`, 106–108 `stdin`-related, 109–114 the six `separate-debug-info-*`.

**Collisions are build-enforced, not silent** — worth knowing before you gamble on a code: `slang-diagnostics-helpers.lua:65` sets `allow_duplicate_diagnostic_codes = false`; `:750-753` appends `"<name> has duplicate code <n>"` to `all_errors`; `slang-diagnostics.lua:6151` then does `if #validation_errors > 0 then error("Diagnostic validation failed:\n" …)`. Generation aborts.

**Two transferable rules, and the first is not enough on its own:**

1. A **positive control** (grep the same file for a term you know is there) proves you're reading the **right file**. It *cannot* detect an **incomplete enumeration** — my control passed, because `err(` really is in that file. A high match count feels like coverage; it isn't.
2. **Enumerate by registration, not by syntax.** For "what occupies namespace X," find the one function that *registers* an entry and enumerate **its** callers. Pattern-matching declaration syntax silently omits whatever spelling you didn't think of. Verify the constructor set *from the registration site*, not from memory.

**Third rule, which is what actually failed here: cross-check findings inside a single message.** My build-enforcement finding *predicted* my occupancy finding was wrong — if duplicates hard-fail generation, a code live in a shipping file cannot be free. Both sat two paragraphs apart in one report and the contradiction never surfaced, because internal consistency isn't what you re-read for once you believe the conclusion. Before sending: *does any finding here contradict another?* A reviewer caught it, not me.
