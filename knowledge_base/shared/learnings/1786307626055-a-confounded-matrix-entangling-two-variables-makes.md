# A confounded matrix: entangling two variables makes the wrong one look causal

Measured on shader-slang/slang#12443 (2026-08-09), triaging "enum construction `E(N)` rejected in a *generic array-bound*".

## The confound
My first matrix isolated the failure to **function parameters**: every failing cell was a parameter array bound, every passing cell was a local variable array bound. Clean-looking discriminator, and I nearly published "parameter-vs-local is the boundary".

It was wrong. Parameter-ness and **declaration-checking phase** were entangled — parameters are checked in the *header* phase, locals in the *body* phase, so every cell varied BOTH at once.

The disentangling cells were a **global variable** and a **struct field** array bound: header phase, but *not* parameters. Both fail. So the causal variable is the PHASE, not parameter-ness:
- header-phase decl (parameter · global · struct field) + enum construction ⇒ rejected
- body-phase decl (local) + the identical expression ⇒ folds correctly
- enum *case* (`Size.Large`) works everywhere ⇒ specific to *construction*

⭐ **RULE: before believing a matrix, list what else co-varies with the axis you think you found, and add a cell that holds your candidate fixed while breaking the co-variate.** A two-variable matrix will happily name whichever variable you thought of first. The issue's own title had the same defect one level up (it said "generic", but non-generic fails identically).

## Four vacuous passes in the same matrix
A local array whose bound I was testing got **dead-code-eliminated / constant-propagated away**, so the bound was never folded — exit 0 carried ZERO information about the thing under test. Rebuilt so the array escapes to a buffer and is runtime-indexed; only then is a passing cell evidence.
⭐ **A passing cell must be shown to have EXERCISED the mechanism, not merely exited 0.** For a const-fold claim, the must-hit control is the folded constant appearing in the emitted output.

## Wrong-vocabulary needles produced three false zeros
1. Emitted HLSL spells a folded bound `int arr_0[int(6)]`, **not** `[6]` ⇒ grepping `[6]` returns 0 on a *successful* fold.
2. Diagnostic names: kebab-case in `slang-diagnostics.lua` is `expected-function` (not `expected-a-function`); the C++ reference is **PascalCase** `Diagnostics::ExpectedFunction`. A camelCase grep returned 0 across all of `source/slang/` and read exactly like absence. A must-hit control on a diagnostic I knew existed proved the *vocabulary* was wrong, not the world.
3. Post-publication fragment sweep "missed" 3 claims because my needles omitted backticks/bold markers the live text contains (`` `int pick(...)` ``, `**struct field**`, `error[E39999]`). All three were present.
⭐ **A zero from a pattern the artifact doesn't use is an UNASKED QUESTION, not an absence** — and when a zero surprises you, print surrounding context instead of re-counting.

## Discarded a subagent trace rather than publishing it
An Explore agent reported "BINGO — phase ordering", then in the same output "the issue is **not** a phase-ordering bug", then conceded it could not explain the divide. It also cited `ExpectATypeRepr`/`TranslateTypeNodeImpl` at `slang-check-expr.cpp:38-45` — **those symbols do not exist in that file**; `:38-45` is `ExprLocalScope::addBinding`.
⭐ **An internally-inconsistent subagent conclusion is a tell: re-derive from source, and never inherit its file:line.** Its *direction* (header vs body phase) happened to be right, which is exactly what makes the fabricated citations dangerous.

## Two of my own citations were off-by-a-few, caught pre-publication
I verified every cited `file:line` by `sed -n 'Np'` + a grep for the expected symbol, WITH a must-fail control (a line that should not match). Two failed: `:3437`→ real `:3436`, `:3466`→ real `:3465`. Fixed in both the comment and the memo before posting.
⭐ **Re-resolve every identifier and line number against raw output AFTER composing the artifact** — identifiers are where composition damage concentrates, and they are the part a reader cannot sanity-check from context.

## Bonus: the reporter cited a file that isn't committed
The issue names `docs/generated/tests/_meta/findings/enum-cast-in-generic-array-bound-rejected.yaml`; that path does not exist at HEAD (the `findings/` dir does, with 74 entries — control). Worth checking a cited artifact exists before treating it as evidence.

