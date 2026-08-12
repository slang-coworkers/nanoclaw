# Slang: semicolon-less `throw` orphans a following `else` (parser omission has an un-obvious rejection side)

Verified at shader-slang/slang master `53b76e6d3` (triage of #12326), with a built-and-reverted probe.

## The omission
`ParseThrowStatement` (`source/slang/slang-parser.cpp:7580-7587`) returns after `ParseExpression()` with no `ReadToken(TokenType::Semicolon)`. Siblings all read it: `return` :7567, `break` :7547, `continue` :7556, `discard` :6949 (inline in dispatch), expression stmt :7596. `defer` :7571 also doesn't — correctly, it parses a nested Stmt with its own terminator. `throw` is dispatched by plain keyword lookahead at :6977-6980, NOT a syntax table, and the dispatch framework never consumes semicolons — each parse fn owns its terminator.

## The non-obvious consequence (the part worth remembering)
Everyone frames a missing-`;` requirement as "compiler accepts too much". Here it also makes the compiler **reject valid code**:

```slang
if (n < 0) throw 1; else return 2;   // REJECTED at HEAD
```
→ `E20001 unexpected token ... expected ';'` + `E30015 undefined identifier 'else'`.

Mechanism: `parseIfStatement` (`:7381-7386`) does `positiveStatement = ParseStatement(...)`, which returns the ThrowStmt with the `;` unconsumed; the next `LookAheadToken("else")` sees `;`, so the else never attaches. `if (c) return 1; else return 2;` is fine for contrast. **Lesson: when triaging a "missing terminator requirement" issue, always test the unbraced `if/else` shape — the leftover `;` becomes a sibling EmptyStmt and can silently orphan trailing clauses.**

## Requiring `;` does NOT fix the misparse — separate the two claims
Greedy `ParseExpression()` absorption of the next line is generic, not throw-specific; Slang's grammar is newline-insensitive by design. `return`, which *already* requires `;`, absorbs identically: `return x` ⏎ `- 5;` emits `return x_0 - int(5);`. So a `;` requirement converts a *silent* misparse into an honest diagnostic; it does not tighten the expression bound. Don't accept "add the `;` and the ambiguity goes away" without testing.

Silent cases are worse than the erroring ones. Sweep of the line after a semicolon-less `throw x`:
- `- 5;` `-n;` `+ 5;` `* 2;` → **silent** absorb, wrong thrown value, zero diagnostics
- `--n;` `++n;` → absorbed as **postfix** (`x--`), dangling token ⇒ misleading error
- `(n);` → absorbed as a call ⇒ `E30016`
- `g(n);` `buf[0]=1;` `int y=1;` `return 5;` `if(...)` → unaffected

⚠ Sweep gotcha: a detector that compares the *thrown value* reports `--n;`/`++n;` as "not absorbed", because postfix returns the original value. Confirm via side effect or the dangling token instead, or you'll under-count.

## Method notes that generalize
- **Read emitted code, not error text, to prove a parse.** The decisive evidence was HLSL emission: missing `;` → `packAnyValue4_0(x_0 - int(5))` vs control `packAnyValue4_0(x_0)`. Error strings let you infer; emission shows the actual AST outcome. (`slangi` was useless here — hit an unrelated `VM operand access out of bounds in constants section`.)
- **A prebuilt binary is valid for probing an older path if the path is unchanged.** `build/Debug/bin/slangc` was at `3649fb982`, but `git diff 3649fb982 HEAD -- source/slang/slang-parser.cpp` touched no throw code, so probes were HEAD-valid. Check the specific function, not the version string.
- **`git worktree add` does NOT bring submodules** → `cmake --preset default` fails on `external/unordered_dense`, `miniz`, `lz4`, `cmark`, and can trigger a ~30-min DXC-from-source build (GLIBC 2.36 < 2.38). For a one-line triage probe, patch the main clone's already-configured build tree, back up the file first (`cp` to /tmp), then restore and rebuild. Verify the restore behaviorally, not just with `git diff`: the *binary* still carries the patch until you rebuild.
- **Don't trust DeepWiki on doc-vs-code contradictions.** It asserted `docs/.../grammar.md` states `ThrowStmt ::= 'throw' Expr ';'`. False at HEAD: `grammar.md:342-344` says `'throw' Expr` **with an explicit note that the `;` is not consumed**, and a prior doc-review logged this exact question as F-006 → `rejected-bogus` (`docs/generated/design/_meta/remediations/syntax-reference/grammar.md.remediation.md:31`) — the doc was deliberately aligned TO the parser. So "the grammar doc already requires it" is not an available argument. Generated docs under `docs/generated/design/_meta/{reviews,remediations}/` are a great source for "was this already litigated?".
- `gh issue list --search` goes through GraphQL (401 on the scoped bot token); `gh api search/issues?q=repo:owner/name+terms` works over REST.
- `slang-test <dir>` silently ran "no tests run" for `docs/generated/tests/...` subtrees; sweeping file-by-file over the glob gave the real 68/69. If a directory invocation reports no tests, don't read that as green.

## Fallout, if anyone fixes this
Exactly **one** semicolon-less `throw` statement exists in the whole tree: `docs/generated/tests/design/syntax-reference/grammar/stmt-throw-no-semicolon.slang:30`, auto-generated (`//META: generated=true`) specifically to assert the current behavior — a behavior-mirror, not an independent requirement. 18 throw statements total, 17 already terminated; core module, prelude, all `*.meta.slang`, examples and tools have **zero**. Measured with the probe: `error-handling` 32/32, `tests/diagnostics/` 711/711, `tests/language-feature/` 2187/2187, grammar bundle 68/69. Two generated doc lines document the omission and would need updating (`grammar.md:342-344`, `ast-reference/statements.md:112`).

Also: `SLANG_LANGUAGE_VERSION_202C` does **not** exist at HEAD — it arrives with unmerged PR #12179. Enum at `include/slang.h:5758-5765` is UNKNOWN/LEGACY=2018/2025/2026, LATEST=2026, DEFAULT=LEGACY. Not every skiminki-nv frontend issue is a 202c-gated proposal; check for the gate rather than assuming the cluster pattern. And a langver gate is a bad fit for a fix that *un-rejects* valid code — it would preserve the bug on the default version for no compat gain.
