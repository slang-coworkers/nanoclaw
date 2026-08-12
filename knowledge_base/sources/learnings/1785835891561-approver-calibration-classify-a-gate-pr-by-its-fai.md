# [approver/calibration] Classify a gate PR by its FAILURE DIRECTION, not by resemblance — a new WRITER on an existing gate is monotone, and the dead-flag probe false-abstains on it

# A new writer on an existing gate ≠ new flag + new gate

**Context:** shader-slang/slang#12322 @`ba156ebf5c900ff89189c15347bafded7b4280ee`
— "slang-test: gate `-emit-cpu-via-llvm` tests on LLVM backend availability",
1 file, +17 −2. Decided WOULD_APPROVE 2026-08-04.

## Symptom

The PR *looks* exactly like the change class my standing 4-step gate probe exists
for: a flag is tested, a requirement is set, a gated thing then does-or-doesn't
run. Reaching for the probe (setter / order / jobs-not-passes / trigger-present
control) would have demanded a "trigger-present control" test and, absent one,
produced `ABSTAIN_POLICY:OPEN_GAP`. That would have been a **false abstain**.

## Root cause of the misclassification risk

The dead-flag probe is scoped to **new flag + new gate**, where the failure
direction is a silent *always-skip* (flag declared and read but never set ⇒ the
gated pass never runs ⇒ CI is green *by construction*).

#12322 is a different shape with the opposite risk profile:
- the gate pre-exists — `_canIgnore` (`tools/slang-test/slang-test-main.cpp:4940-4944`):
  `usedBackendFlags & availableBackendFlags != usedBackendFlags ⇒ Ignored`;
- the flag bit pre-exists — `SLANG_PASS_THROUGH_LLVM` is already written
  (`:1494`) and already probed (`:5899`, `hasLlvm` at `:5924`);
- only two new **writers** were added (`:1531`, `:4656`).

## How to catch it — prove monotonicity, in three greps

`addUsedBackEnd` (`tools/slang-test/test-context.h:55-62`) is a pure OR:
`usedBackendFlags |= 1 << type`. Then, over the tool's directory:

1. any site that **clears or masks** the field? — `git grep "usedBackendFlags\s*=\|&="`
   ⇒ only the `= 0` initializer (`test-context.h:82`).
2. how many **readers**? ⇒ exactly one, `_canIgnore:4940`.
3. can the added write make a test FAIL? ⇒ no; the single reader's only output is
   `Ignored`.

⇒ strictly one-directional: a test can move **running → Ignored, never the
reverse, and never running → Fail**. A monotone change cannot create the
always-skip-by-construction failure the probe hunts, so the probe does not apply —
same reasoning as the existing widening-only exemption (new `case` labels
broadening an existing flag false→true).

## The transferable rule

**Classify by the failure direction the change can produce, not by its surface
resemblance to a change class.** Before applying any probe, ask: *what is the
worst thing this diff can cause, and is that the thing the probe detects?* Two
diffs that both "add a flag check next to a gate" can have opposite risk
profiles.

Corollary already in my store, reconfirmed: **a probe that fires on the safe
direction of a change class is a false-abstain generator.** Scope every probe to
its failure direction when you write it.

## And then test the direction that CAN hurt

Monotone ⇒ worst case is a **silent skip** — a real hazard class here
(`slang-test` precedent: INTERPRET tests report `0% of tests passed (0/0), 1
tests ignored` when `slangi` is absent, which reads as green). So the decisive
question was empirical, not analytical: *does any CI leg lose coverage?*

Job logs at the pinned head, 11 legs: every leg that runs slang-test lists
`llvm` in its verbatim `Supported backends:` line; all 4 affected files
(`tests/language-feature/coverage/coverage-llvm-skip.slang` ×2 subtests,
`tests/llvm/{extern-func,printf,recursion-hang}.slang`) show **`passed`**;
exact-match `ignored test:` count for those files across all 11 logs = **0**,
with a must-be-non-zero control (`grep -c "ignored test:"` = 119–7613 per log,
`grep -c "% of tests passed"` = 1–3 per log). ⇒ no-op for current CI coverage.

## Fix / procedure

For a diff that touches a gate: (1) is the gate new, or only a writer? (2) is the
write monotone — pure OR, no clear site, count the readers? (3) if monotone, the
harm is a silent skip ⇒ go get job-log evidence for the specific tests affected,
with a must-be-non-zero control. Do not substitute the dead-flag probe for step 3.
