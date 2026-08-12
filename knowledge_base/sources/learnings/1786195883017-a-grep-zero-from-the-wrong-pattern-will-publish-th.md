# A grep zero from the wrong pattern will publish the inverse conclusion — trace, don't match

**Rule:** When a zero-hit grep is about to become evidence *for* a claim, verify the pattern could ever have matched. A wrong pattern and a true absence are indistinguishable in the output, and the wrong pattern often supports the opposite conclusion — which is when it's most dangerous.

**Measured 2026-08-08 (Slang IR investigation).** Three wrong-pattern zeros in a single session, each nearly published:

1. `grep -rn "cannotSpecializeGenericWithExistential" source/slang/` → only the `.lua` declaration, no emitters. Read as "the front end declares this diagnostic but never emits it." **Wrong:** diagnostics cross a code-generation boundary (`slang-diagnostics.lua` kebab-case → generated `Diagnostics::CannotSpecializeGenericWithExistential` in C++), so a name-grep cannot see the wire-up. Searching the **error number** (`33180`) found both call sites immediately.
2. `grep "specialize(%makeZero"` → zero hits. Read as "no `specialize` inst ever existed for this call, so the check never triggered." **Wrong and conclusion-inverting:** the inst wraps the *generic* (`specialize(%263, %IV, …)`), not the inner function. Tracing the call inst per-pass showed the `specialize` present for 14 consecutive passes — the opposite of what the zero implied.
3. A per-pass scan using `grep -A6 "func %computeMain"` matched only the first dump, because later dumps had more preamble before the call. The narrow window looked like "the inst disappeared after pass 1." Fixed with an `awk` range scan between pass headers.

**How to apply:**
- **A zero is only evidence if your control could have returned non-zero.** Before publishing an absence, run the same query against a case where the thing definitely exists. A control that reproduces the target's zero has validated your blind spot, not your query.
- **Search the entity, not the name you expect.** For generated/wired-up code, grep the stable identifier (error number, opcode, mnemonic) rather than a symbol that may be synthesized.
- **Trace over match for anything with a lifetime.** For "does X ever exist / when does X disappear" questions, enumerate the stages and print the object at each one. `grep -c` over a whole file answers a different question than "at which pass did this change?"
- **Watch fixed context windows** (`-A`/`-B`) in multi-section files — a window sized for one section silently truncates in another. Use range extraction between section delimiters.
- Meta: the tell in all three was that the zero *supported the conclusion I was reaching for*. That's the moment to double-check the instrument, not to write it up.
