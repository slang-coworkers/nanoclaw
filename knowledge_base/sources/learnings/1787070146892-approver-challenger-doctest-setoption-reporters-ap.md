---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787066066143-xxo0gc
written_at: 2026-08-18T16:22:26.892Z
---

# [approver/challenger] doctest setOption(--reporters) appends, not replaces — verify per-registered-reporter activation before pricing the trigger

## Symptom
On slangpy#1116 (add `-skip-device-tests` to sgl_tests), Devin flagged a 🔴 at
`sgl_tests.cpp:54` — the new `context.setOption("--reporters", "sgl")` causing
"duplicated, mixed-up test output" when a CLI output format is chosen.
CodeRabbit rated merge risk ⚪ Minimal and never caught it; the default-path CI
was green. Easy to either dismiss (CI green, CodeRabbit clean) or over-state
(BLOCK on "any -r=<fmt>").

## Root cause (verified from vendored external/include/doctest/doctest.h)
1. `parseCommaSepArgs` only ever `push_back`s into the target filter vector; it
   NEVER clears it (~6503-6545). `--reporters`/`-r` map to `filters[8]`
   (~6630-6631).
2. `Context::setOption("--reporters","sgl")` builds `"---reporters=sgl"` and
   calls `parseArgs` AGAIN (~6755-6759) → APPENDS "sgl" to filters[8]. It does
   not replace the CLI-provided reporters.
3. `run()` iterates each REGISTERED reporter ONCE (`for(auto& curr :
   getReporters())`) and activates it if its name matches ANY filters[8] entry
   (~6851-6853). So multiplicity comes from DISTINCT registered reporters
   matching — NOT from a duplicated filter entry.

Net: default (no -r) → single sgl reporter (works, CI green). `-r=sgl` or an
unregistered name → still ONE reporter. But a DIFFERENT registered reporter
(`-r=xml` / `--reporters=junit` / `-r=console`; registered at 5650/5943/6411)
→ both it and sgl activate → XML/JUnit stream interleaved-and-malformed, or
duplicated console output. Pre-PR main() had no reporter override so `-r=xml`
was clean → this is a public-CLI-contract regression.

## How to catch it
- A test-harness `main()` that force-sets a library option AFTER constructing
  the context from argc/argv is a claim about REPLACE semantics. Verify it:
  does the library's option setter clear-then-set, or append? For doctest it
  appends, and the run loop de-dups per REGISTERED reporter, not per filter
  entry — so the reachable trigger is "a different registered reporter is
  selected," which is narrower than "any --reporters value" but still plainly
  reachable (xml/junit/console are common CI choices).
- Price the trigger from the activation loop's shape, not the flag's name.
  Enumerate the registered option values (grep `REGISTER_REPORTER`) to state
  exactly which inputs fire the bug and which are inert.

## Fix (for the author; approver never posts)
Replace/clear the CLI reporter selection instead of appending (e.g. clear
filters[8] before setting "sgl", or only set the default when none was given),
or make sgl the default reporter without forcing it over an explicit CLI choice.

## Process note
The critique gate (OUTPUT_REVIEW) twice corrected my initial "no-dedup / any
-r=<fmt>" overstatement — the per-registered-reporter loop DOES de-dup a
repeated filter entry. Lesson: when a BLOCK rests on a library-internal
mechanism, cite the exact loop/branch and enumerate the input set; "no dedup"
is a strong claim that must be read off the loop, not assumed.
