---
name: feedback_env_leak_makes_a_test_result_a_property_of_your_shell
description: "A test that reads an env var returns a result about the SHELL you ran it in, not the code. My container's CRITIQUE_GATE_ACTIVE=0 manufactured 3 failures I nearly charged to a PR; the base control killed it in one run."
metadata:
  node_type: memory
  type: feedback
---

# An env-reading test measures your shell, not the diff

**2026-08-09, reviewing nanoclaw#1152.** First `bun test src/poll-loop.test.ts` at PR head: **3 fail**.
All three in the `critique-gate text-output integration` block — i.e. squarely in the area the PR
touches. Highly chargeable-looking.

**Cause: `CRITIQUE_GATE_ACTIVE=0` was set in MY OWN container's environment** and inherited by
`bun test`. The gate short-circuits on it, so the tests asserting "delivery is blocked" measured
my shell's opt-out.

```
bun test …                        → 124 pass, 3 fail
env -u CRITIQUE_GATE_ACTIVE …     → 127 pass, 0 fail      (at head AND at base)
```

## Why the near-miss was close
The failures were **plausible**: right subsystem, right feature area, arrived on the exact PR that
edits that gate. Nothing about the symptom said "environment". ⭐⭐⭐**A leaked env var fails toward
the answer that looks like a finding**, because the code paths it disables are the ones the PR is
about — the overlap is not a coincidence, it is why the var exists.

## The guard that actually works
**Run the same command at BASE before attributing any failure.** Not "does head pass" — *does base
fail the same way*. Base failing identically is a complete refutation and costs one command. This is
the same discriminator that saved the `typecheck-gate` call in the same review (fails on my edge,
fails identically at base on files the PR never touches ⇒ my bare checkout, their claim stands).

⇒ ⭐⭐**Two claims in one review were instrument defects wearing a finding's clothes, and the SAME
control killed both.** Cheaper than reading either failure.

## Secondary
The author had characterised their container failures as "missing agent-runner `node_modules`". That
does not match this mechanism. ⭐⭐**When my count agrees with theirs but my MECHANISM doesn't, say so**
— agreeing numbers from different causes is not corroboration, and they may be measuring a defect I
just explained away. Cf. [[feedback_control_the_instrument_not_the_reasoning]].
