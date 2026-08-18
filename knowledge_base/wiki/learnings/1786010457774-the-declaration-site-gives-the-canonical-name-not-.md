---
title: "The declaration site gives the CANONICAL name, not the ACCEPTED SET — check for aliases and resolver normalization before calling a name wrong"
type: learning
topic: misc
source: learnings/1786010457774-the-declaration-site-gives-the-canonical-name-not-.md
---

# The declaration site gives the CANONICAL name, not the ACCEPTED SET — check for aliases and resolver normalization before calling a name wrong

**Verified 2026-08-06 in shader-slang/slang master.** I overruled a correct value with an incorrect one and logged it as a *caught defect* — the worst shape of error, because it launders a regression as diligence.

**The case:** a research agent said Slang's E39001 opt-out is `[allow("overlapping-bindings")]`. I read the definition site — `source/slang/slang-diagnostics.lua:4647`, whose `name` field is `"parameter-bindings-overlap"` — decided the agent had paraphrased the human-readable title into a plausible-but-fake identifier, posted a correction to a user, and recorded it as a subagent error caught. **Both names work; the agent's was the better one.**

**Two mechanisms the declaration cannot show you:**
1. **An alias table.** `source/slang/slang-diagnostics.cpp:38` — `lookup->addAlias("overlappingBindings", "parameterBindingsOverlap");`. The alias exists in a *different file* and appears nowhere in the definitions.
2. **Resolver normalization.** `DiagnosticsLookup::findDiagnosticByName` (`source/compiler-core/slang-diagnostic-sink.cpp:892-908`) infers the name convention and converts kebab-case → lowerCamel via `NameConventionUtil` before matching. `[allow(...)]` resolves through *that* path (`source/slang/slang-check-modifier.cpp:1093`) — **not** `findDiagnosticByExactName`. Documented at `source/slang/slang-rich-diagnostics.cpp:20`.

⇒ all four of `overlapping-bindings`, `overlappingBindings`, `parameter-bindings-overlap`, `parameterBindingsOverlap` resolve to E39001. And the checked-in test **`tests/diagnostics/overlapping-bindings.slang:20,23` uses the hyphenated form** — the very spelling I "corrected away" is the one with live CI behind it.

**The generalizable rule.** A declaration establishes the **canonical** name. **Acceptance is decided by the lookup/resolution function**, which is a separate mechanism in a separate file. Finding the declaration is not enumerating the valid inputs. Before declaring any name, spelling, or flag invalid:
1. `grep` for an alias/synonym table (`addAlias`, `alias`, `synonym`, `deprecatedName`).
2. Read the resolver for normalization (case folding, kebab↔camel, separator stripping).
3. **Search the tests for the spelling in question** — an enabled test using it outranks any inference from the declaration.

**Priors worth carrying:** a real system usually **accepts more spellings than it declares**, so "that identifier looks made up" is a weak hypothesis and the burden is on you to disprove acceptance, not on the other source to prove it. And when you are about to *overrule* a source that turns out to have been right, the cheapest disconfirming test is nearly always "is there a test using their value?"

**Family:** same root as *enumerate the arms, not just the consumer* and *exhaustion looks like success* — a single-site read that feels authoritative **because it is the declaration**. The tell that should have stopped me: I was contradicting a specific concrete value with nothing but an absence-of-mention at one site.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786010457774-the-declaration-site-gives-the-canonical-name-not-.md`_
