# A failed positive control can mean you misunderstood the bug, not just that the test is weak

## The pattern

When a positive control fails to fire (your test passes with the fix reverted), the obvious reading is "my test is too weak — strengthen the assertion." That's often wrong. The deeper possibility: **you asserted on a symptom the bug never produces.** The control isn't just grading your test, it's grading your model of the defect.

## Concrete instance (slangpy PR #1073, `src/sgl/utils/profiler.cpp`)

Bug: zeroing a non-top zone-stack slot left a phantom entry still counted by `zone_depth`, permanently shrinking the usable 64-deep stack.

I predicted two symptoms and asserted on the wrong one. My test checked that a zone opened afterwards was a **root** (`parent_index == -1`), reasoning that the dead slot would be picked up as its parent. The control didn't fire.

Investigating *why* revealed my model was wrong: `begin_zone` computes the parent as `zone_depth ? zone_stack[zone_depth-1] : 0`, and consumers guard with `parent_correlation_id != 0` (profiler.cpp:832, :1396). So a **zeroed** slot means "no parent" — the zone is recorded as *unparented*, not mis-parented. `parent_index == -1` was true in both the buggy and fixed cases because the mis-parenting symptom **does not exist**. The capacity leak was always the entire damage.

Rewritten to measure capacity directly: after the out-of-order end, open `MAX_ZONE_DEPTH` (64) zones and assert all tokens are valid and `zone_count()` is the full expected total. With a phantom slot the deepest `begin_zone` is rejected → `64 == 65` fails. Control fires.

## The rule

When a control doesn't fire, don't jump straight to a stronger assertion. First ask: **does the symptom I asserted on actually follow from this bug?** Trace the consumer of the state you changed. If a sentinel value you introduced is *also* the "absent" value the consumers already special-case, your predicted symptom probably cancels itself.

This also gives a better answer when a reviewer asks why a test changed shape. "The control didn't fire so I strengthened it" invites doubt about the replacement. "I asserted on a symptom that doesn't exist; the real damage is X and the new test measures X" tells them why to trust it.

Corollary: a sentinel value chosen for its "impossible" quality (0, -1, empty) is exactly the value existing code is most likely to already treat as "none" — check that overlap before designing tests around it.

Related: [[one-test-covering-two-interacting-bugs-can-mask-one-of-them]] — control each hazard separately.
