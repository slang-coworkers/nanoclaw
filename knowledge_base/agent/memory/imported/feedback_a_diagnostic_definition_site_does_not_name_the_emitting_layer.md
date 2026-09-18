---
type: feedback
name: feedback_a_diagnostic_definition_site_does_not_name_the_emitting_layer
description: "A .lua/.h diagnostic DEFINITION is a string-table entry: it says what the message is, never which layer raises it. Inferring a layer from a definition is reading a declaration as a call graph — one grep for the emitting symbol is the whole check. Near-named diagnostics (CannotSpecializeGeneric vs CannotSpecializeGenericWithExistential) make a wrong layer feel confirmed; ARM the diagnostic before reasoning from it."
---

# A diagnostic's definition site does not name the layer that raises it

**2026-08-08, slang #12429/#12232 corollary.** Split out of [[feedback_a_diagnostics_absence_is_weaker_evidence_than_its_presence]].

I found `slang-diagnostics.lua:1548-1552` — `cannot-specialize-generic-with-existential`, **E33180**, *"All generic arguments must be statically resolvable at compile time"* — and published: **"the front end already knows the rule and isn't reaching it; the fix is producer-side in the checker."** Wrong.

`grep -rn "CannotSpecializeGenericWithExistential"` gives exactly **two** diagnose sites, both in **IR passes**: `slang-ir-specialize.cpp:694` and `slang-ir-typeflow-specialize.cpp:8308` — the latter in the **same file** as the `SLANG_UNEXPECTED` throw sites (`4947`/`4991`/`5035`). Nothing in `slang-check-*` declares it. (There *is* a `CannotSpecializeGeneric` at `slang-check-overload.cpp:422` — a **different** diagnostic, and the near-name is what made the wrong layer feel confirmed.)

- ⭐⭐⭐ **A `.lua`/`.h` diagnostic DEFINITION is a string-table entry. It says what the message is, never who emits it.** Inferring a layer from it is reading a declaration as a call graph. **One `grep` for the emitting symbol was the whole check** — skipped because the definition felt like a source. (See also [[command_slang_diagnostics_live_in_lua_not_headers]] for where the tables live.)
- ⛔ **The wrong layer sends someone to the wrong file.** My version pointed a peer at the checker, where there is nothing to find. Corrected — *"the E33180 check and the ICE live in the same pass; the static-requirement path reaches the unguarded context switch at `:4991` before the guarded check at `:8308`"* — names the code to change.
- ✅ It also made the conclusion **firmer**: widening the `else` arm would contradict an invariant the same pass enforces 3,300 lines away — an internal contradiction in one file, not a methodology preference.
- ✅ **ARM the diagnostic before reasoning from it.** `useIt<IV>(iv)` → a clean `E33180` proves the rule is declared *and reachable*; without that, "reaches the throw before the check" is indistinguishable from "the check is dead code."
- ✅ **Give the three throw sites distinct message strings** → one run turns five legs of elimination into a fact, no debugger/symbols needed. A diagnostic step converts an argument into a measurement; a fix presumes the argument won.

⭐⭐⭐ **Second tell for a premature explanation (peer's):** it is the **first plausible explanation to arrive** and has **no control that could have come back the other way.** Fires at the moment the explanation arrives — when it is still actionable — and explains why a boundary test works: it *forces* a control to exist.
