# When a claim has the shape "X exists, therefore Y works", the load-bearing half is always Y — trace the CONSUMER, not the declaration (a verified premise transfers no confidence to its inference)

## The error

Writing a PR body for a new Slang warning, I told users they could suppress it with
`[allow("imported-overload-overrides-local-candidate")]`. I had verified the part that was easy to
verify: `[allow(...)]` really does resolve diagnostic names through `findDiagnosticByName`, with
kebab↔camelCase normalisation, so my name would be accepted. All true.

**And irrelevant. Name resolution is not suppression.** Tracing who *consumes* the attribute:

```
slang-ast-modifier.h:1600        class AllowAttribute           ← declaration
slang-check-modifier.cpp:1083    as<AllowAttribute>(attr)       ← name resolution while checking
slang-parameter-binding.cpp:866  as<AllowAttribute>(modifier)   ← THE ONLY CONSUMER
  └─ inside `static bool shouldDisableDiagnostic` (:860), called from exactly 2 sites
     (:979, :980), both for binding-overlap diagnostics
```

Three references tree-wide, one consumer, **file-local `static`**, two call sites. There is no
general suppression path. `[allow(...)]` on any other diagnostic parses, resolves the name
successfully, and **silently does nothing** — the worst outcome: a user follows documented advice,
gets no error, and still sees the warning.

The mechanism that does work is `-warnings-disable <code>`, applied centrally by
`DiagnosticSink::diagnose` via `m_severityOverrides` (id-based, so it works for any diagnostic).

## The rule

**When a claim has the form "X exists, therefore Y works", the load-bearing half is always Y.**
Verify the *consumer*, not the declaration:

```bash
grep -rn "AllowAttribute" source/ | grep -v "declaration-file"   # who READS it?
```
One command. If the only reader is `static` in one file, the mechanism is local no matter how general
its name sounds.

## Why it's hard to catch — the transferable part

⭐ **A verified premise transfers no confidence to the inference drawn from it, but it feels like it
does.** And the easier the premise is to check, the more likely you check *it* instead of the claim
you actually care about — checking something and getting a green result satisfies the urge to verify.

Three instances of this same shape in one session:
1. **This one** — "the name resolves" vouched for "the attribute suppresses".
2. **Offset reasoning** — one symbol's line-shift measured correctly (`+67`) vouched for six other
   citations; per-region drift was actually +67/+71/+75 and 7 citations were wrong.
3. **"Not-B implies A is complete"** — a correct argument for *not* hooking site B (it also runs on
   error paths) was silently treated as evidence that site A was the only site. A third site
   (`_coerce`, reached by single-argument `T(x)`) was unhooked, and the warning missed a whole class
   of the bug it was written for.

## Corollary for reviews

**A completeness check cannot catch this.** A reviewer asking "does the PR explain how to disable the
warning?" ticks the box: the claim was *present*, well-formed, and wrong. Coverage audits ask whether
a thing is there, never whether it is true — so any claim about a *mechanism working* needs to be run
or traced, not merely present.

When you correct such a claim, also warn the next reader why the wrong inference was reasonable
(name the file-local helper). They will otherwise derive it from the same evidence.
