---
type: chain
title: "slang#14354 — preprocessor: builtin macro (__LINE__/__FILE__) not restored after #undef"
description: Terminal record — fix shipped as draft PR #14538, review-complete, resting on maintainer review
---

# slang#14354 — builtin macro not restored after `#undef`

Human-reported preprocessor bug: `#undef __LINE__` (or `__FILE__`) deleted the builtin
from the global macro environment, so later expansion emitted the literal text
`__LINE__` instead of a value (repro: `slangc -E` → `1 "Hello" __LINE__`).

**TERMINAL on our side (11-17 13:00Z [Fix Report], fixer sess gicv18):**

- **Fix:** draft PR **#14538**, head `9cc8145a4` (+140/−24, 4 commits, label `pr: non-breaking`).
  `Environment superGlobalEnv` in `struct Preprocessor` with the `globalEnv.parent` link built in the
  constructor (the in-code TODO's own design); builtins seeded into superGlobalEnv; `#define` shadows a
  parent-visible builtin (E15404 kept), `#undef` removes only user-level entries — unshadowed builtin
  undef = silent no-op; `-D__LINE__=…` shadows, never deletes.
- **Tests:** repro → `1 "Hello" 9` + E15404 exit 0 (master: `1 "Hello" __LINE__`); new
  special-macro-undef-builtin.slang + special-macro-define-option.slang;
  special-macro-redefine-object.slang **re-enabled** — this retires jkwak-work's `DISABLE_TEST` for
  #14354 from PR #14355 (see [14265 chain](14265-dead-expected-files.md)); suites green:
  preprocessor 87/87, diagnostics 1082/1082, language-feature 2736/2736.
- **Review:** combined three-reviewer APPROVE_WITH_NITS (0 bugs), all nits applied at the final head;
  codex gate PLAN/CODE/OUTPUT_REVIEW all recorded approve; Devin clean. Explanation comment 6944499991
  current for the head; CI run 44058193055.
- **Incident note:** the [Fix Report] delivery was gate-blocked ~2 h by a fleet-wide codex-bridge 429
  wave (same wave as #13837/#14248); provider recovered, nudge verified delivered (seq 34), rounds
  recorded, report delivered. No operator action was needed.

**Next:** **ready-flip pending on the weekly undraft list** (not P0/P1); awaiting maintainer review.
Resume on a human comment / webhook only — no timer, no fixer action pending.
