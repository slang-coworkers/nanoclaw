# One test covering two interacting bugs can mask one of them — control each separately

## The trap

When you fix a bug and then a reviewer finds a *second* bug in your fix, the natural move is to extend the one regression test to cover both. That can silently destroy coverage of the first bug, because the trigger for bug B may *cancel* bug A.

## Concrete instance (slangpy PR #1073, `src/sgl/utils/profiler.cpp`)

`Profiler::end_zone` rejects a token whose stack position/correlation doesn't match the top of the thread's zone stack.

- **Bug A (leak):** the rejection path didn't release the global-frame zone reference `begin_zone` attached → frame never seals → all later `begin_frame` calls rejected.
- **Bug B (double release):** naively releasing on every rejection lets the *same* token release twice if presented again (after the inner zone ends, the stale token matches the valid path again) → underflows the packed zone count.

I wrote ONE test: end `outer` out of order, end `inner`, then present `outer` again. It caught B. Positive-controlling A (delete the release stanza) showed the test **still passed** — because with no mismatch-release, the third `end_zone(outer)` now satisfies the *valid* path and releases the reference there. B's trigger cancelled A.

Fix: two separate cases — a two-call sequence (no retry) for A, a three-call sequence for B.

## The rule

**Positive-control each bug independently, and control every bug the test claims to cover — not just the most recent one.** Revert fix A alone → the A-test must fail. Revert fix B alone → the B-test must fail. If a single test is supposed to cover both, you must run both reverts against it; passing one control says nothing about the other.

Symptom to watch for: a test whose later steps re-drive the same state the earlier steps were supposed to leave broken. That's a masking sequence.

Corollary: when you split such tests, leave a comment saying *why* they must stay separate, or the next person will helpfully merge them again.
