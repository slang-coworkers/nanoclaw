---
name: feedback_parse_whole_failure_set_before_characterizing
description: "Parse every row of a multi-assertion failure set before naming its signature — the head is often unrepresentative and each reader sees their own hypothesis"
metadata:
  node_type: memory
  type: feedback
  originSessionId: unknown-prior-session
---

When a test failure carries **many** assertion rows (tens to hundreds), do not characterize the
signature from the first screenful. Extract **all** rows programmatically — value, expected, and
index — and report the distribution.

**Why:** on slang-rhi#802 (08-03) the same 77-assertion set was read twice and described wrongly
both times, in *opposite* directions:
- I called it "**the shader reads ALL ZEROS**" — from the first ~10 rows, which happen to be zeros.
- The approver called it "a neat off-by-one **indexing** shift (`result[i] == i`)" — and used that
  to argue *against* the residency hypothesis.

The full parse: **56/77 `result==0` and 21/77 `result == expected-1` exactly** — a *mixture*, per
case (buffers 10/7, textures 46/14). Worse, the shifted rows are **not** indexed by `i` (the same
`i=0` fails with result 1, 3, and 5 in different sub-checks), so `result[i]==i` was wrong on its own
terms. Each of us saw the hypothesis we brought: I was primed for non-residency (uniform zeros), the
approver for handle plumbing (coherent shift). The head of the list confirmed whoever read it first.

**How to apply:**
- Parse with a script, then state counts and the *split* (`N of M zero, K of M shifted by exactly
  d`), not an adjective.
- ⚠️ **Then map each row to the assertion that produced it, before inferring anything from the
  split.** My own follow-on claim — *"a mixture rules out any hypothesis predicting a uniform
  failure mode, so this needs a mixture-aware cause"* — was **WRONG**, and it was the same species of
  error one level up: I characterized the *distribution* correctly and then over-read it, having
  still not looked at the test source. Reading `test-bindless.cpp` collapsed it to **one** cause:
  the shifted rows are all **second-phase read-backs** (`compareComputeResult(device, rwBuffer,
  {2.f,3.f})` etc.) observing each RW resource's **unmodified initial contents** — I verified all 14
  texture-case shifted rows equal their `float data[...]` initializers exactly. So "resources never
  bound" predicts **both** classes: reads yield `0`, and writes never land so RW buffers keep their
  seed values. Different *assertion phases*, not different mechanisms.
  **Rule: a heterogeneous signature does not imply a heterogeneous cause** — check whether the
  classes correspond to different *phases or targets* of the test first. One cause + two observation
  points is the common case; it looks like a mixture only until you group by assertion site.
- Compare Debug vs Release (or any two configs) as **ordered tuples**, not summary counts.
  Byte-identical ordered sequences ⇒ deterministic logic/codegen, not UB or a race. Equal *counts*
  prove nothing.
- Check whether the split **partitions by sub-check** before treating it as noise — that usually
  names the mechanism.
- This is the measurement discipline behind
  [[feedback_label_dispatch_suspicions_as_hypotheses]]: a hypothesis is only worth relaying once the
  evidence can distinguish it from its rival, and a truncated view of the evidence usually can't.
  Related: [[feedback_never_relay_a_verdict_not_in_hand]],
  [[feedback_actions_job_logs_are_public_follow_redirect]] (how to get the log at all).
