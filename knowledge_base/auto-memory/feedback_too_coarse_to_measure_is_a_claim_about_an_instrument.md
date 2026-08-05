---
name: feedback_too_coarse_to_measure_is_a_claim_about_an_instrument
description: "I parked a false hypothesis by declaring it unfalsifiable — wrote 'a 0.2-min delta cannot be resolved from floor-minute timestamps' when GitHub's started_at/completed_at carry SECONDS, 8x the needed resolution. A 30-second subtraction refuted it an hour later. An unfalsifiability verdict is the only verdict that ENDS inquiry while reading as rigour. Before writing 'cannot be resolved', print the two raw values."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04
---

**Mine, 2026-08-04, on the SLANGWIN5 rerun-affinity chain ([[project_slangwin5_spirv_val_runner_defect]]).**

## What happened

`slang-ci-babysitter` proposed a mechanism for why reruns kept landing on the defective box: it
**fails fast** (10.4 min to fail vs ~10.6 min for a healthy pass), so it goes idle first and claims
the next queued job. It labelled the hypothesis unproven, correctly.

I "verified" it and wrote this into the chain memo:

> Main-measured durations: all three #12125 attempts ~10 min, consistent with the mechanism but **far
> too coarse to confirm it — a 0.2-min delta cannot be resolved from `floor`-minute timestamps.**

**That sentence is false, and it is the load-bearing error.** GitHub's job objects carry
`started_at` and `completed_at` as **full ISO-8601 with seconds**:

```
att2 runner=SLANGWIN5 failure started=2026-08-04T16:16:39Z completed=2026-08-04T16:27:09Z
att3 runner=SLANGWIN5 failure started=2026-08-04T16:28:39Z completed=2026-08-04T16:38:59Z
```

Second resolution is **8× finer** than the 0.2-min delta I declared unresolvable. There were no
`floor`-minute timestamps anywhere; I had been reading a rendered duration (`10m`) and attributed its
precision to the underlying field.

## What it cost — and it is not the usual cost

The author refuted its own mechanism an hour later with two subtractions on those same fields:

| quantity | value |
|---|---|
| fail on SLANGWIN5 | mean **10.36** min (n=5) |
| pass on SLANGWIN4 | **10.63** min |
| ⇒ head start | **≈ 16 s** |
| idle gap between attempts | **1.5 min** (#12125) · **5.2 min** (#12322) |

The idle gap is **6–20× the head start**, so a 16-second earlier finish cannot bias assignment. Every
box is already idle and waiting when the rerun is queued.

**A 30-second subtraction was available the whole time.** My verdict didn't merely fail to catch the
error — it **removed the reason to look.** "Plausible and unconfirmed; do not promote it" reads as
appropriate caution, and functions as *parked*. The hypothesis then sat live in two memory files and
one shared learning for an hour, where it was one relay away from reaching a maintainer as an
explanation for the affinity.

## ⭐⭐⭐ The rule

**"Too coarse to measure" / "cannot be resolved" / "not falsifiable with available data" are claims
about an INSTRUMENT, and they need exactly the verification a claim about the world needs.** I
asserted a precision limit without ever printing the field. The check is one command.

⇒ **Before writing that something cannot be measured, print the two raw values you would subtract.**
If you can't name the field and its format, you haven't checked.

## ⭐⭐ Why this class is nastier than an ordinary wrong measurement

Every other measurement defect in this store produces a **wrong answer**, which can collide with
someone else's answer and get caught. This one produces **no answer**, and no-answer collides with
nothing:

- A wrong number invites a contradicting number. **A verdict of "unmeasurable" invites silence.**
- It arrives wearing the costume of the virtue it violates. Declining to confirm a hypothesis on
  thin data *is* the correct move nine times in ten — which is why nobody, including me, re-read it.
- **It is self-sealing:** having declared the question unanswerable, I had no reason to run the probe
  that would have shown my premise false. The error protects itself.

⭐**Compare the shape to the inert-guard family** ([[feedback_a_guard_can_be_inert_and_read_as_passing]]):
an inert guard is byte-identical to a working one from the reader's seat. An unfalsifiability verdict
is byte-identical to genuine epistemic caution. **Both are failures whose symptom is the absence of a
symptom.**

## ⚠️ Where it will recur

Any phrase that closes a line of inquiry without producing a measurement:
*"too coarse"*, *"not observable from here"*, *"we hold no such log"*, *"retention has expired"*,
*"the endpoint doesn't expose that"*, *"structurally impossible"*. Each may be true — I have written
true ones today — but each is a **claim requiring a check**, and each is load-bearing precisely
because it stops work.

⭐**Sibling instance from the same day:** I wrote *"`#if` structurally cannot take a device term"* and
it was false (`helpers.cpp:64`). Same family — an assertion of impossibility, unverified, that would
have foreclosed the right question if the conclusion it supported hadn't happened to be right. See
[[feedback_control_the_instrument_not_the_reasoning]].

## ✅ What survived, and why that matters

The **practical rule** derived alongside the mechanism — *cap reruns at 2 per run, then prefer a fresh
dispatch* — is untouched by the retraction, because it came from the observed **distribution** (3 of 4
draws stuck), not from the story about idling. ⭐⭐**A conclusion resting on a measurement outlives the
explanation attached to it.** That is the argument for retracting a mechanism promptly rather than
defending it: the operational advice usually does not depend on it, so there is nothing to lose.

Related: [[project_slangwin5_spirv_val_runner_defect]] · [[feedback_a_guard_can_be_inert_and_read_as_passing]] ·
[[feedback_control_the_instrument_not_the_reasoning]] · [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]
