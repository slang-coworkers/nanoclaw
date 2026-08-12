# [approver/challenger-miss] Parse the WHOLE failure set before naming a signature — two reviewers read the same 77 assertions and each found the hypothesis they brought (corrects slang-rhi#802 calibration note)

## Symptom

On slang-rhi#802, two independent reviewers characterized the same CI failure — 77 failed
assertions across `bindless-buffers.metal` + `bindless-textures.metal` — and **both got the
signature wrong, in opposite directions**:

- Reviewer A (primed by a **non-residency** hypothesis, which predicts uniform garbage):
  "the buffers read **all zeros**."
- Reviewer B — **me** (primed by **handle/slot plumbing**, which predicts a coherent shift):
  "`result[i] == i` where `expected == i+1` — a neat off-by-one **indexing** shift."

The truth is a **mixture**, and neither description survives it:

| | zero (`result==0`) | shifted (`expected-actual == 1.00`) | total |
|---|---|---|---|
| `bindless-buffers.metal`  | 10 | 7  | 17 |
| `bindless-textures.metal` | 46 | 14 | 60 |
| **total**                 | **56** | **21** | **77** |

My `result[i] == i` claim is not merely imprecise, it is **falsified**: at `logged: i := 0` the
actual value is `0.0`, `1.0`, `3.0` **and** `5.0` in different sub-checks, so the value is not a
function of `i` at all (across shifted rows, `actual - i` ∈ {−10, 1, 3, 5}). The shift is real —
every shifted row is exactly `diff == 1.00` — but it is a **minority** and not `i`-indexed.

## Root cause of the miss

**We each read the head of a long list and pattern-matched it to the hypothesis we walked in
with.** The head of this particular list happens to be all zeros, which is why one of us
"confirmed" uniform zeros and the other, scanning for a shift, latched onto the first few
shifted rows further down. Same bytes, same file, two confident and incompatible conclusions.

This is confirmation bias with a mechanical enabler: a 77-row failure list is long enough that
nobody reads all of it by default, and short enough that it feels like you did.

## How to catch it

**Never characterize a multi-failure signature from a sample.** Parse every row with a script
and produce the full distribution before naming anything:

```python
pat = re.compile(r'values:\s*CHECK_GE\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)')
rows = pat.findall(open(log).read())          # ALL of them; assert len(rows) == expected count
# then bucket, and cross-tab by test case
```

Specific discriminators that would have caught both errors in seconds:
- **Bucket and count** — "56/21 mixture" is immediately incompatible with both "all zeros" and
  "a shift."
- **Cross-tab per test case** — the 10/7 vs 46/14 split shows the mixture is present in *both*
  cases, not one case per mode.
- **Test the functional claim you're about to make.** Before writing "`result[i] == i`", group by
  `i` and check for a unique actual per `i`. Multiple distinct actuals at one `i` kills it. A
  signature claim of the form "output is a function of input X" is trivially checkable — check it.
- **Compare Debug vs Release as ordered tuples, not counts.** Equal counts prove little; a
  byte-identical *ordered* 77-tuple is what licenses "deterministic, not UB/race." (That claim did
  survive both reviews, verified twice.)

## Fix / consequence for the hypotheses

A wrong signature steers the fixer at the wrong subsystem, so this matters beyond bookkeeping:

- **H1 residency — WEAKENED, not confirmed.** Pure non-residency predicts zeros *uniformly*; 21
  rows returning coherent real-looking data mean it cannot be the whole story. (I declined to
  conclude residency, which was right — but my stated reason was itself wrong.)
- **H2 handle/slot plumbing — relatively strengthened.** "Coherent but wrong slot" fits the
  shifted rows.
- **H3 mixture-aware (new, and the one to test):** the split may partition **per-sub-check** —
  some sub-checks read a valid-but-wrong slot (shifted), others an unbound slot (zero).
  **Discriminator:** map each failing assertion to its sub-check in `test-bindless.cpp` and test
  whether zero-vs-shifted partitions cleanly. Cheap, needs no Apple6 hardware, separates H1/H2.

**Corrects the earlier atom** `[approver/calibration] slang-rhi#802 — a source-verified-CORRECT
implementation still FAILED once Metal actually executed`, which asserted the off-by-one
signature. That atom's *calibration* headline stands unchanged and is if anything stronger — a
source-verified-correct implementation still computed wrong results on hardware, so WOULD_APPROVE
would have been a false-approve. Only its signature paragraph is retracted.

Generalization: this is the same failure family as the enumeration rule (never establish a count
or an absence from a summarizing read). **A signature is a claim about a whole set; deriving it
from a prefix is the same error as counting from a truncated page.**
