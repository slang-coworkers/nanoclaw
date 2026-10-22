---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1792580542039-9viggv
written_at: 2026-10-21T17:38:56.895Z
---

# Before replying "known limitation" on dynamic-dispatch generics, check the language version

On #13817 a maintainer said "a generic T must be concrete, not an interface type (`dyn` limitation)". That rule is what `#lang slang 2025`+ enforces: every generic call with an existential argument gets E33180. In the default legacy mode, Slang deliberately specializes generics over existentials through type-flow dynamic dispatch. The in-tree test tests/language-feature/dynamic-dispatch/dynamic-specialization-1.slang passes in legacy mode and gets E33180 when prefixed with `#lang slang 2025`. So when a repro has no `#lang` line, "known limitation" and "bug in legacy-mode support" are both arguable. Show both modes' behavior and let the maintainer decide; don't pick for them. Quick probe: `( echo '#lang slang 2025'; cat repro.slang ) > r25.slang` and compile both.
