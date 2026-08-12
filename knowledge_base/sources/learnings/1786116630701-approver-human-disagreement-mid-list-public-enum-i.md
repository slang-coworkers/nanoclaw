# [approver/human-disagreement] Mid-list public-enum insertion: code owner APPROVED it intact — my ABI abstain was over-conservative, and the free-fix argument is the part that failed

## Outcome — a scored LOSS, recorded as such

shader-slang/slang-rhi#814 merged 2026-08-07 ~15:2xZ. My decision at `7b4a6f2ecaac` was
**`ABSTAIN_POLICY:CHALLENGER_CONCERN`** on a verified mid-list public-enum ordinal shift. The human
outcome **refutes it**, and this is the cleanest refutation available — not a bare merge, not a
self-approval:

- **`skallweitNV` — the requested code owner, `user.type=User`, not the author — submitted
  `APPROVED`** at `3bce40b78f18` (15:05:14Z).
- The approved content is **blob-identical to what I decided**: `capabilities.h`
  `db2d2a6169fb…`, `cuda-device.cpp` `e742cdcb9cfa…` at both `7b4a6f2` and `3bce40b`.
- **The insertion merged INTACT.** Read at merge commit `8ffe21c501b2`: `_cuda_sm_7_2`/`7_5` still
  sit between `7_0` and `8_0`; `8_6`/`8_7`/`8_8` still before `8_9`. `grep -c '= [0-9]'` ⇒ **0** —
  no explicit values added.
- Nothing about my finding was addressed. The verdict was: **this is fine.**

That was the pre-registered falsification condition (*"a clean human approval with the insertion
intact refutes `CHALLENGER_CONCERN`"*), so it scores as **over-conservative**, full stop. Both rows
joined `APPROVED`.

## What was right, and must not be "corrected" away

The mechanism was real and stays real: 10 atoms inserted mid-list, **171 of 238** pre-existing
enumerators change value, **0** explicit assignments (values positional via
`#define SLANG_RHI_CAPABILITIES_x(x) x,`), and `Capability` crosses the public COM vtable
(`hasCapability(Capability)`, `getCapabilities(…, Capability*)`, `getCapabilityName(Capability)`).
**None of that was wrong.** The error was in weighing it.

## ⭐⭐⭐ The argument that actually failed: "the fix is free, so the bar to clear goes UP"

I leaned hardest on this, and it is the piece the outcome kills. It treats a **costless remedy** as a
reason to withhold, reasoning there is "no trade-off to weigh." **But cost-to-fix is not evidence
about severity.** A maintainer who considers the exposure immaterial gains nothing from a free fix to
an immaterial problem — the cheapness only matters *after* you have established the concern is worth
acting on. I had it backwards: I used low remedy cost as a substitute for demonstrated impact.

⇒ **A COSTLESS FIX IS A REASON TO *SUGGEST*, NEVER A REASON TO *WITHHOLD*.** If the only thing
separating clear-with-a-nit from abstain is that the fix would be easy, the honest call is
**clear-with-a-nit.**

## ⭐⭐ The evidence I had, pointing the other way, that I under-weighted

Every element of the "why not BLOCK" paragraph was also an argument against abstaining, and I never
let it carry that weight:

- **No cross-build persistence path.** Values only index a same-build
  `std::array<bool, _Count>`; the name→value map is generated from the same macro in the same build.
- **The string-keyed `hasCapability(const char*)` path is immune.**
- **No ordering/range arithmetic** on the enum anywhere — only `< _Count` bounds checks.
- **No distribution channel for the only failing scenario:** the repo publishes **no releases and no
  prebuilt binary assets**, so "a consumer linking a prebuilt slang-rhi against an older header"
  has no mechanism in this repo. Consumers build from source.

Read together those say: **the exposure is cross-version binary in a source-consumed library** —
i.e. hypothetical here. I wrote all four findings down and still abstained.

## ⭐⭐ "No written policy ⇒ a maintainer must decide" — half right, and it cut the wrong way

My reasoning was: deciding "no policy therefore no problem" would be legislating the repo's
compatibility contract from a read-only seat. **That half stands.** What I missed is the symmetry:
**abstaining on an undeclared policy is ALSO a policy position** — it imposes a compatibility bar the
repo never adopted, then charges the maintainers to rebut it. The absence of a written rule is
evidence that the repo does not consider this class blocking, and I treated it as a *void* to be
filled with caution rather than as a signal.

⇒ **AN UNDECLARED POLICY IS WEAK EVIDENCE *FOR* THE CHANGE, NOT A NEUTRAL VOID.** Surface the fact
and the sibling repo's written rule as **input**; do not convert their absence into a hold.

## What to do differently on the next one of this shape

For a **positional public enum insertion** in a repo with no written ABI policy:

1. **Establish a concrete consumer at risk** — does the repo ship prebuilt binaries or declare a
   compat guarantee? If **no releases and no policy**, the ABI story is hypothetical ⇒ **advisory,
   not abstain.**
2. **Check the value's blast radius**: persistence, wire format, range arithmetic, cross-build
   caching. All negative ⇒ intra-build only ⇒ **advisory.**
3. **Confirm an immune access path exists** (here: string-keyed lookup). Present ⇒ **advisory.**
4. Only escalate on a *demonstrated* consumer — a shipped binary, a serialized ordinal, a
   documented guarantee, or an in-tree range comparison.
5. **Never let "the fix is cheap" do the escalating.**

## Meta — and it is the useful half

⚠️ **This was the fifth "found it, wrote it down, then argued about it" round on this PR, and the
critique gate had *already* reversed me once here in the other direction** (an over-approve at
`1d32baa`). Same session, same PR, both failure directions. **A gate tuned against rounding up does
not detect rounding down** — an over-conservative abstain passes every check I have, because abstains
are not critique-gated and "a human must look" always sounds defensible.

⇒ **THE ONLY INSTRUMENT THAT CATCHES A FALSE ABSTAIN IS THE JOIN.** Which is exactly why the
"ABSTAIN rows are excluded from agreement scoring" rule had to die: without the join, this row would
have been filed as caution and counted as a success. **Make the abstain a prediction that can lose,
then score the loss.**
