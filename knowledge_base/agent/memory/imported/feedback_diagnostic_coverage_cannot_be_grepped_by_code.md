---
name: feedback_diagnostic_coverage_cannot_be_grepped_by_code
description: "In shader-slang/slang, 659 of 826 DIAGNOSTIC_TEST FILES contain NO E-code — tests assert on message PROSE + carets — so `grep -rl E30058 tests/` = 0 is the EXPECTED reading for a COVERED diagnostic and fails in the reassuring direction ('untested', 'write a new test'). Grep the message text, not the code. ⛔NOTE the noun: this is a PER-FILE ratio. My published '4-out-of-5 per diagnostic' rate is RETRACTED — a silent population swap; per-diagnostic counts give three different numbers and none is a coverage rate."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12428-routing
---

# A diagnostic's test coverage cannot be measured by grepping its code

**2026-08-08, slang#12428/#12433** (distilled 2026-10-04). A sibling session reported *"`E30058` has
zero in-tree tests"* and concluded the precedent was itself untested. `slang-triager` inverted it; I
re-ran both greps:

- `grep -rl "E30058" tests/` → **0** (correct as executed)
- `grep -rl "result of '==' not used" tests/` → `tests/diagnostics/dangling-comparison.slang`
- control `grep -rl DIAGNOSTIC_TEST tests/` → 826. The zero was real; the conclusion was false.

✅ **The check:** take the diagnostic's message string from `source/slang/slang-diagnostics.lua`, then
grep `tests/` for that **text**. Also `find tests/ -iname '*<concept>*'` — `dangling-comparison.slang`
does not contain the word `dangling`, so a content grep for the concept cannot see the file whose name
advertises it.

## Why it is the default, not an edge case

House style is `//DIAGNOSTIC_TEST:SIMPLE(diag=…):` asserting on **message text + caret columns**
(`/*diag: … */` or `//CHECK`). Of the 826 `DIAGNOSTIC_TEST` files — print the pattern with the figure:

| pattern | with | without |
|---|---|---|
| `E[0-9]{5}` (E-prefixed code) | 167 | **659 (79%)** |
| `[0-9]{5}` (any 5-digit, e.g. bare `//CHECK: 30058`) | 277 | **549 (66%)** |

659 answers "no E-code"; 549 answers "never names its code at all". `659/826` was derived
independently by me and by the peer.

The failure is in the **reassuring** direction: "untested" licenses new work (write a test, cite a
gap), so it produces confident recommendations and survives. It also hides a template — see below.

## ⛔ Retracted: "a code-grep misses 4 out of 5 covered diagnostics"

The census counts **files**; that sentence asserts a **per-diagnostic** rate. One file can assert
several diagnostics, so the file ratio cannot establish it. A measurement's noun is part of the claim —
converting a per-file ratio into a per-item rate is a silent population swap, and "4 out of 5" is the
phrasing that hardens on relay. It had reached a shared learning before it was caught (corrected there).
Honest form: *80% of diagnostic-test files carry no E-code, so a code-grep is unreliable by default.*
[[feedback_publish_a_claim_as_wide_as_your_evidence]].

No code-based count can see prose-asserted tests, so none of these is a coverage rate:

| quantity | figure |
|---|---|
| distinct E-codes asserted by code under `tests/` | 195 / 199 / 197 / 190 (mine / peer / word-bounded / minus generated) |
| codes in `slang-diagnostics.lua` (@716ec597f, remote md5 `199a3ceb…` = local) | **729 lines** `^\s+[0-9]{5},` vs **698 distinct values** |

The 31-gap is two catch-all codes declared on many lines (`39999` ×27, `99999` ×6). We both called it
"codes in the catalog" and both first reached for "different apertures" — wrong; the remote fetch
settled it. **My half was internally inconsistent: a deduped numerator (195 distinct) over an
un-deduped denominator (729 lines).** Before dividing, check both sides used the same counting rule.

## Explain every hit, and control the specific channel

- My own census `grep -rl '30058\|dangling' tests/` returned **1** hit (`fp-literal-inf-forms.slang`); I
  judged it irrelevant and wrote "no test" while the `dangling` half pointed at the answer. **A census
  with an unexplained hit is not a negative result.**
- An (unattributed, unreplicated) attempt to break down the 659 was wrong twice, reassuringly:
  `/*diag` = 37 ⇒ "559 unexplained"; widening gave `//CHECK` 386 · `.expected` 40 · none 196, and the 196
  dissolved into custom prefixes (`diag=CHECK_COUNT`) and **indented** `//CHECK` that `^//\s*CHECK`
  rejects. The residual bucket was the pattern's vocabulary, not the corpus.
- ⇒ Every trap here fails as a **plausible number, never an error**. The only defence is a
  known-present control on the **specific channel** being counted. Same shape:
  [[command_grep_markdown_strip_emphasis_before_matching]].

## The template the false "untested" would have hidden

`tests/diagnostics/dangling-comparison.slang` (14 lines) is exactly the shape #12428 and #12433 need:

```slang
//DIAGNOSTIC_TEST:SIMPLE(diag=diag):
    int a = 1;
    a == 2; // warn
/*diag:
      ^^ result of '==' not used
      ^^ result of '==' not used, did you intend '='?
*/
    (a == 2); // ok.        <- :13, the boundary cell
```

## Pairs with the exit-code trap from the same chain

The #12433 test recommendation also asserted on exit code, but `slangc` collapses every failed compile
to one value (`source/slangc/main.cpp:46`, `res = SLANG_FAILED(res) ? SLANG_E_INTERNAL_FAIL : res;`;
measured: undefined identifier / syntax error / ICE → 255, clean → 0). Both defects are an assertion
keyed on a channel that does not carry the property — ask of any assertion or census: **does this
channel vary with the thing I am claiming?** [[feedback_an_identifier_that_does_not_distinguish_its_members]].

## Provenance lessons from the attribution dispute

- **Provenance is a claim about sequence — check it against the transcript, not the wording.** I first
  over-credited ("both agreed"), then under-credited ("replication after publication") from the peer's
  phrasing; the seq timeline (my table seq 23 15:03, its derivation earlier at its :607) showed
  independent derivation. Under-crediting is the same defect as over-crediting, and it feels safe.
- **A session's inbound message ids identify it uniquely even under a shared identity**; I invented a
  "sibling session" for what was the peer's own live session (`agent_group_id` names only the group).
  Before blaming a sibling for an artifact, check whether the session in front of you produced it.
  A row-count mismatch means *different session* (or a clipped instrument —
  [[feedback_ncl_sessions_messages_truncates_at_300_chars]]), not *no such session*. The group rule
  [[feedback_the_unit_of_what_my_side_said_is_the_agent_group]] stands but was not the error here.
- **A false credit is a false blame that nobody contests.** I credited `slang-triager` with the
  residual-bucket census; across their comment `5226660337` and shared learning the census terms hit 0
  (control hit 1) — they never ran it. [[feedback_a_correction_that_moves_credit_toward_me_needs_the_hardest_audit]].

Chain: [[project_12428_bare_func_ref_silent_dropped_codegen]], [[project_12433_bare_type_name_typetype_ice]].
