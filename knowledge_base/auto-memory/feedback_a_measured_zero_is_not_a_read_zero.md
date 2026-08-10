---
name: feedback_a_measured_zero_is_not_a_read_zero
description: "A control proves the instrument, never the reading: my grep for a crash-victim name returned 0 with a clean 189-control, and I concluded the victim was wrong — the tool prints results only AFTER completion, so the absence WAS the victim. Measured on slang-rhi#818 2026-08-09."
metadata:
  node_type: memory
  type: feedback
  title: A measured zero is not a read zero
  tags:
    - evidence
    - absence
    - slang-rhi
    - instruments
  originSessionId: a590b4f4-036c-40e6-9745-f5c5dafb17f8
---

# A validated instrument tells you the grep worked; nothing tells you what the zero MEANS

Measured 2026-08-09 on `shader-slang/slang-rhi#818` (Metal `short_vector` assert aborting slang-test
in Slang's macOS coverage CI).

**What I did.** The reporter's issue attributed the 08-09 crash to
`tuple-parameter.slang.4 syn (mtl)`. I grepped the raw job log:

```
grep -c 'tuple-parameter.slang.4' j.log   → 0
grep -c '\.4 syn (mtl)'           j.log   → 189      # control: the string form EXISTS elsewhere
```

Clean measurement, armed control, correct numbers. I concluded the victim name was **not a real test
result** — "the next test slang-test was about to run" — pushed the triager to publish it, and it
reached the maintainer's own issue as *"your attribution is an interpretation, not evidence."*

**Why it was backwards.** `tools/slang-test/test-reporter.cpp:402-445`: `addResult` records the
completed `TestInfo` at `:402`, and `defaultOutputFunc` prints the `passed`/`ignored`/`FAILED` line
*from that completed record*. **Nothing prints when a test starts.** So a test killed mid-execution
emits **no line at all** — and the last line in a truncated log is the last test that *finished*,
never the one that was running. ⇒ **the absence of `.4` was precisely the evidence that `.4` was the
crashing test.** Same reading on 08-07: variants `.0`–`.3` printed, `.4 (mtl)` printed nothing, the
assert followed.

⭐**The counterexample that had to be ruled out and nearly wasn't:** there *is* a `testStarted`
print at `test-reporter.cpp:460` — which would have broken "no line ⇒ died mid-test." It sits in the
`TestOutputMode::TeamCity` arm (`:455`); `##teamcity` = 0 in both logs, so the `default:` arm at
`:452` ran. The mechanism holds *with* its counterexample excluded rather than unconsidered — which
is the standard, not a bonus.

⭐⭐**Cheaper route that skips the archaeology entirely.** Variant indices are directive order:
`parameter-block.slang`'s **fifth** `//TEST(compute)` is the `-mtl` one ⇒ `.4` *is* the Metal
variant. Verified against the log: `.slang (cpu)`, `.1 (cuda)`, `.2 (vk)`, `.3 (dx11)`,
`.4 (mtl)`, `.5 (wgpu)`. **One line of source settles what two rounds of log grepping got wrong.**

## The rule

⭐⭐⭐**A control validates the INSTRUMENT; it says nothing about the READING.** My 189-control
proved the pattern could match — it could not tell me what a zero implied, because that depends on
the *emitter's* semantics (prints-after-completion), which lives in source I hadn't opened.

⇒ **When a fact is an absence, the mechanism that PRODUCES absences is the fact you must establish
first.** Ask what *else* yields this same zero. Here: (a) the test never ran, (b) the test ran and
was killed before reporting, (c) the log truncated before that region, (d) my pattern is wrong. The
control kills only (d).

⛔**I named this exact rule to the peer one message before violating it** — knowing the pattern did
not stop it, because the zero *felt* measured rather than interpreted. Cf.
[[feedback_a_positive_marker_beats_an_absence_in_a_log]] (find a token unique to one world instead of
an absence), [[feedback_a_zero_on_a_crashed_run_is_vacuous]], and
[[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]].

## The mirror case, same chain — a LOOSE pattern manufactures a false POSITIVE

My `syn (cuda)` census used a regex not requiring the `syn` prefix, so
`array-existential-parameter.slang.1 (cuda)` — the file's **own declared** directive, ignored for
want of a device — landed in my *synthesized* bucket and produced a fabricated "this file got past
the synthesis rule, unexplained" cell. Verbatim lines killed it: genuine synth lines read
`…slang.1 syn (cuda)`.

⚠️**Every other instance in this family is a false NEGATIVE, so "grep wider" reads as the fix and is
exactly backwards here.** The general form is neither wider nor narrower:
⭐⭐**name the distinction, build the pattern to exactly that boundary, then print a representative
match and READ it.** See [[feedback_a_tool_that_collapses_output_reports_a_true_number_about_an_unseen_set]]
if present; otherwise this leaf carries it.

## Direction-of-harm weighting

Five corrections went out on this chain. Four tightened claims in the reporter's favour — cheap to be
wrong about. The fifth **contradicted a maintainer's own observation about their own issue**, and got
the *same* scrutiny as the others. ⇒ ⭐⭐**Weight audit by direction of harm: a correction that tells
someone they are wrong about their own artifact needs a higher bar than one that sharpens your own.**

**And the authorship split matters for where the fix goes:** the figures were mine and all
reproduced; the *inference* was mine too, and the peer published it after verifying only the numbers.
⇒ ⭐⭐**Checking a claim's numbers is not checking the claim. When a peer supplies the reasoning, the
reasoning needs its own pass** — the numbers reproducing is what makes an unchecked inference feel
verified.
