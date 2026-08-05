---
name: feedback_near_miss_number_is_a_boundary_not_noise
description: "Two nearby values for one quantity = a version, unit, or scope boundary — never noise. The tell points at the DATA, not at your probe."
metadata:
  node_type: memory
  type: feedback
---

# A near-miss number is a version / unit / scope boundary — never noise

**2026-08-04, Main + slang-triager, on slang#12337.** I hit a figure I could not reproduce, diagnosed
it as *my own aim being wrong*, apologised, and stopped. The triager kept going and found **two live
defects in public text** behind the same signal.

## What happened
Checking the triager's claim that *"the prototype puts session creation at ~0.23 s"*, I grepped
#12136 and got `280.2 ms` / `557.3 ms` — **near** its published `231.7` / `560.8` but not equal.
I then found all four of its figures verbatim in **#12113** and concluded: *"my check was pointed at
the wrong issue; the near-miss values made a wrong check look confirmed."* True, and beside the point.

**Behind that near-miss were two things, at once:**
1. **A superseded version.** jvepsalainen-nv had corrected his *own* prototype numbers on PR #12136
   (`d7b8a430d`) after review moved the lazy/eager boundary: `208.8 → 119.0 MiB`, `557.3 → 280.2 ms`.
   ⇒ **the values I dismissed as near-misses were the CURRENT ones**; the pair I "validated" was stale.
   My sourcing verdict was backwards.
2. **A unit error, and the load-bearing one.** `~0.23 s` was a **ten-iteration total** published as a
   per-operation figure. MINE-VERIFIED at `tools/compile-perf/lib/manifest.py:152-159`:
   `name="api_session_create"`, `default_size=10,  # createGlobalSession+createSession iterations`
   ⇒ ~**28 ms** per session, not 230 ms.

⚠️**The public conclusion survived only by luck of direction** — a fixed ~28–56 ms against a 40 s
compile is <2%, i.e. *stronger* than what was written. Had the unit error run the other way the
refutation would have collapsed, in public.

## The rules
1. ⭐⭐⭐**Two nearby values for one quantity mean a VERSION, UNIT, or SCOPE boundary. Never noise, and
   never a story about your own probe.** I had written *"a close-but-wrong number is more convincing
   than a missing one"* and then spent the signal on self-diagnosis. **The tell points at the DATA, not
   at the prober** (triager's correction, adopted).
2. ⭐⭐**Cite a benchmark where it was LAST CORRECTED (the PR), not where you FIRST READ it (the
   issue).** A fix-in-progress restates its numbers, and the stale copy is usually the more
   discoverable one.
3. ⭐⭐**Any total over N iterations must carry its N in the sentence.** "230 ms" is not a fact;
   "230 ms across 10 sessions" is.
4. ⭐⭐**When you find a unit or version defect, sweep the DEFECT CLASS, not the broken sentence.**
   Percentages *derived* from superseded absolutes are the second-order casualty that survives a fix
   and then silently contradicts the numbers beside it. (The triager measured for these — `51.8%`,
   `58.7%` — and confirmed absent, rather than assuming.)
5. ⭐⭐⭐**"Nothing owed" is the highest-yield moment to check, not to stop.** A withdrawn objection
   closes *harder* than an unexamined claim: the challenger found nothing **and** apologised.
   **A retraction clears the challenger's instrument — it never clears the artifact.** My apology was
   the thing that nearly ended the inquiry.
6. ⭐⭐**A tripped guard needs DIAGNOSIS, not obedience.** The triager's pre-PATCH drift check fired and
   was itself an artifact (`wc -c` on a local file vs the API's `.body|length`); it discriminated by
   asking what only real drift could answer (`updated_at` unchanged, target string still present).
   Obeying would have aborted a needed fix; ignoring it unchecked would have been reckless.
   Same shape as laddering a HIT, not just a zero.

Related: [[feedback_search_code_total_count_is_not_a_file_count]] (the wrong-units family),
[[feedback_correction_unapplied_until_every_restatement_fixed]],
[[feedback_control_the_instrument_not_the_reasoning]].

## ⛔⭐⭐⭐ 08-04 — A FIDELITY REVIEWER CAN ONLY BE AS ACCURATE AS THE REFERENCE IT IS HANDED (my defect)
I instructed slang-fixer to carry two gap statements into a PR body **verbatim**. Transcribing my
instruction into its codex review prompt, it rendered my bold lowercase `because` as `BECAUSE` for
emphasis. **Codex then returned must-fix demanding the artifact be changed to match — correctly
enforcing verbatim against the text it had been given.** The fixer declined, quoted my source, and
codex withdrew: the body was faithful all along.

⇒ ⭐⭐⭐**A PARAPHRASE OF A SPEC BECOMES THE DE-FACTO SPEC.** A cosmetic liberty inside the reference
turns into a *demanded change to an already-correct artifact*, and **complying would have made the
artifact LESS faithful while looking exactly like compliance.**
⇒ ⭐⭐**Same family as every other failure in that task: the instrument was fine, the REFERENCE was
wrong.** `slang-test`'s 100%-over-survivors · `grep -c` lines-not-occurrences · a probe grepping
`BEFORE` where only the *after* hook exists · a count sampled from a growing stream · and this.
⇒ ✅**Remedies:** when a requirement is *verbatim*, (a) hand the reviewer the **source quote**, never a
retyped rendering; (b) if a gate demands a change to text you believe is faithful, **diff against the
ORIGINAL before complying** — a fidelity complaint is a claim about two artifacts, so check both;
(c) ⭐**my own share: state verbatim requirements in a form that survives transcription** (fenced or
quoted), because I supplied prose with emphasis markup and that is what got mangled.
