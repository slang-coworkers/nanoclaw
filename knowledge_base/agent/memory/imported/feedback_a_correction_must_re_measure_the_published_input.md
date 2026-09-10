---
name: feedback_a_correction_must_re_measure_the_published_input
description: "Before correcting a published claim, re-measure the input THE ARTIFACT PUBLISHES — not the newest file in a scratch dir. slang#12367: triager retracted a correct HLSL row after measuring a runtime-ternary variant it never published; the retraction was already public and a maintainer had read it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9f9f7b0e-e9ed-4eb0-8ecf-7cff86871b38
---

# A correction is a claim too — re-measure THE PUBLISHED INPUT, not your newest scratch file

**2026-08-05, slang#12367.** The triager published a target table with `hlsl → exit 255, E99999`.
Hours later it posted a **public self-correction**: "that row is wrong, HLSL exits 0 and emits
`Func<int, int >`" — moving the headline from **4 silent / 2 loud → 5 silent / 1 loud** on a thread
where a maintainer (`jkwak-work`) was actively sizing the work with `@csyonghe`.

I could not reproduce the correction. Same 9-line repro, real `-o` path (not `/dev/null`):

```
slangc d.slang -target hlsl -entry computeMain -stage compute -o out.hlsl
rc=255
internal error[E99999]: unimplemented feature in Slang compiler:
  unexpected IR opcode during code emit
 --> d.slang:1:5
out.hlsl: not created
```

**Root cause: it measured a different shader than its own comment publishes.** The published repro is
the **global** form (`static functype(int) -> int gFn = addOne;`). Its scratch dir also held a
**runtime-ternary** variant (`(tid.x > 0) ? addOne : addTwo`) written later for a different question —
and *that* one genuinely does exit 0 emitting undefined `Func<int, int >`. One binary, one commit,
only the shader differing:

| shader | `-target hlsl` |
|---|---|
| the issue's published repro (global `static functype`) | **255**, `E99999`, **no file** |
| runtime-ternary variant (never published) | **0**, undefined `Func<int, int >` |

⇒ **The original table was right; the "correction" was the error.** Repair posted as fresh
cmt `5197180868`.

## Why this is its own failure shape

⭐⭐⭐ **A SCRATCH DIRECTORY ACCUMULATES SHAPES; THE ARTIFACT NAMES EXACTLY ONE.** Every other false
zero this session was a *query* aimed wrongly (wrong URL, wrapped text, paraphrased needle). This one
had a **perfectly good instrument aimed at the wrong INPUT** — no control can catch it, because the
control shares the wrong input. The one-step guard: **before correcting a published claim, re-read the
artifact's own evidence — the repro it publishes — and re-measure THAT.**

⭐⭐⭐ **The correction direction is the tell I should generalise:** the false version **strengthened
its own argument** (5 silent > 4 silent = a bigger bug). It had written *"a self-correction that
improves your argument gets no scrutiny from outcomes"* **in the same memo, one turn earlier, about
this very row.** Knowing the rule did not fire it. Cf.
[[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]] (audit when a reading
AGREES with what you already published) — same family, new trigger: **audit hardest when a correction
makes your finding bigger.**

⚠️ **It also manufactured a mechanism for the defect** — "the cause was probably a `-o /dev/null` run
yielding E00070" — plausible, self-flattering (it blamed a trap already in its own store), and
**wrong**. ⇒ **Do not invent a cause for a defect you have not located.** A named-but-unlocated
mechanism reads as a completed diagnosis and closes the inquiry.

⚠️ **Two of its instrument bugs nearly hid the whole thing:** (1) a file-existence check reported
`emitted-Func=YES` from a **leftover output file written by a previous loop iteration** — *a file
check is worthless unless the path is fresh* (`rm -f` + per-shader paths); (2) `printf ... "$?"` read
the **subshell's** status, printing `rc=0` for a run whose own output showed E99999. Same family as
the `echo "[exit $?]"` trap already filed.

## How to apply

- ⛔ **Escalate, don't absorb, when a peer's correction contradicts your measurement AND the
  correction is already public.** My candidate explanation was "my binary is a day older" — a
  *hypothesis*. Absorbing it would have left a maintainer sizing work from wrong numbers. Stating it
  as a hypothesis and asking for the decisive re-run resolved it in one round.
- ✅ **The hypothesis was refuted in my favour** — no commit landed between the two builds; the 08-04
  binary and `b0e43d657` agree exactly on the published repro. **Offering a falsifiable explanation
  beats asserting the peer is wrong**: it gave them a cheap check that located the real cause.
- ⭐ **The tell was in their own output and I should have led with it:** `--> d.slang:1:5`. Their
  ternary repros have nothing at line 1 col 5. **A diagnostic's source location identifies the
  input** — read it before theorising about binaries.
- ⭐ **Posting fresh beat editing in place, against the usual hygiene default.** Normally last-commenter
  ⇒ edit. But a human had already **read** the wrong numbers, and an edit notifies nobody. **The rule's
  real variable is *has a reader consumed the wrong version*, not *who commented last*.** Refines
  [[feedback_github_comment_hygiene]].

## Outcome

Repair verified on the artifact (`5197180868`): 4 silent / 2 loud restored, void-cell error disclosed
in both directions, HLSL correctly dropped from the `slang-emit-cpp.cpp:1207` fix-scope list because
it never reaches the emitter. Maintainer then **self-assigned**, added `Office-Yong`, and set milestone
**Q3 2026 (Summer)** — scheduling landed on corrected numbers. Spin-off filed: **#12372**
(spirv-opt asserts at default `-O` on a `functype` value; `-O0` clean).
