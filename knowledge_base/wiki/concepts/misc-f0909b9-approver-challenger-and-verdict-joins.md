---
title: "Slang/SlangPy PR-approver: challenger probes, coverage bar, and human-verdict joins"
type: concept
group: misc
tags: [approver, challenger, open_gap, coverage, positive-control, feature-mapping, human-verdict, calibration, bot-self-merge]
source_count: 17
---

## TL;DR

Two calibration surfaces for the PR-approver's Step-3 challenger and its
decision-vs-outcome joins.

**Challenger probes (what to verify beyond the diff):**
- For "add a callback/handler/event" PRs, read the WHOLE file at head: a robustness
  concern a bot flags on the diff-in-isolation is often a *pre-existing
  cross-cutting property* of the subsystem, not new risk — but pre-existing ≠
  inconsequential.
- For name→feature / capability-mapping PRs, open the backend DETECTION site and ask
  whether one bit/condition implies all N names.
- For "enable extension when ANY sub-bit is set" RHI PRs, ask what happens on a
  device that supports the extension but only a subset of bits (device-creation
  blast radius).
- The strong positive control for a drifted declaration↔consumption mapping is a
  direct *enumerate-every-key* unit test over the producer, NOT an emit/PTX test
  whose output is filtered/floored downstream.
- **Negative/absent-path safety evidence carries zero bits about the present
  path.** When the gated branch IS the PR's purpose, an unverified present path is
  `OPEN_GAP`, not clearable by pointing at the safe default.
- Piecewise-constituent coverage of a newly-enabled combination is NOT "branch
  covered elsewhere" — it's `OPEN_GAP`. The bar is "any plausible real trigger or
  blast radius → OPEN_GAP; uncertainty → ABSTAIN," never "is the code correct in my
  judgment."

**Human-verdict joins (the "merged ⇒ APPROVED" mapping's limits):**
- A **bot self-merge or bot self-close with zero reviews** is neither agreement nor
  disagreement — do NOT join it as a human verdict.
- An **author self-close** of a content PR is "neither," not REJECTED.
- A **`Superseded by #N`** close on a bot branch-sync is a dedup, not a rejection.
- A **merge at your exact ABSTAIN commit with no follow-up commits** confirms the
  code shipped as reviewed; abstains are excluded from scoring, so this is not a
  miss. Read `mergedBy`/`author`/`reviews`/timeline actor before mapping any
  terminal state.

## Challenger probes

**Read the whole file, not the diff — a flagged concern is often pre-existing.**
On slangpy#1133 (a Window `on_refresh` callback mirroring `on_resize`
byte-for-byte), an assertive bot flagged "a user callback that throws propagates a
C++ exception through GLFW's C frames" as a Major blocker "before merge." But all
6 sibling callbacks invoke from a GLFW C trampoline with no exception boundary —
the PR adds one more instance of the accepted pattern, zero new risk class. The
tell: grep the file for sibling handlers and check whether the concern applies to
all of them identically. Yet pre-existing ≠ clearly-inconsequential: a raising
callback is a plausible real trigger with app-termination blast radius, so it does
NOT clear to WOULD_APPROVE — the correct call is `ABSTAIN_POLICY:OPEN_GAP` whose
challenger field *documents* the pre-existing context so the human can clear it fast
([mirror-a-sibling-callback PRs](../learnings/1788416787180-approver-challenger-calibration-mirror-a-sibling-c.md)).

**Read the backend DETECTION code on mapping/gating PRs.** slang#12735 mapped all
5 `VK_NV_cooperative_matrix2` sub-feature names onto one coarse `rhi::Feature`
derived from a single bit — which cannot distinguish the 5 independent Vulkan
capability bits. The production bot, CodeRabbit, and Devin all missed it; only the
adversarial challenger reading slang-rhi's feature detection caught it, and a
maintainer independently re-routed the fix (slang-rhi#850, one granular feature
per bit). The probe "when N names collapse to 1 coarse feature, open the DETECTION
SITE and ask whether one bit implies all N" is load-bearing
([coarse-feature-mapping abstain confirmed by maintainer](../learnings/1788420466105-approver-human-agreement-coarse-feature-mapping-ab.md)).
The sibling shape is "enable extension X when ANY sub-bit is set, then advertise
each sub-feature independently" (slang-rhi#852): the challenger must ask what
happens on a device that supports the extension but only a subset of bits — does
`vkCreateDevice` still succeed? A verified break there is a device-creation
blast-radius OPEN_GAP/BLOCK, not a nit
([slang-rhi enable-if-ANY-bit device-creation edge](../learnings/1788419979566-approver-challenger-miss-slang-rhi-enable-extensio.md)).

**Positive controls for capability-mapping and texture-query PRs.** For a drifted
declaration↔consumption mapping (slang#12842, `cuda_sm_8_9 → sm_80`), the strong
positive control is a static unit test enumerating every `_cuda_sm_*` atom and
asserting the mapping's digits match the atom name — NVRTC-independent and
second-producer-independent. A `-capability cuda_sm_X_Y` PTX/emit test is a
*broken* positive control because the emitted arch is floored to the NVRTC minimum
and a second producer can supply it, so it can pass on unpatched master. Treat a
deliberate scope-split (fix existing atoms now, defer new atoms that would shift
serialized `CapabilityName` IDs) as a quality signal
([CUDA SM capability-mapping: enumerate-every-atom unit test is the positive control](../learnings/1788502196859-approver-challenger-calibration-cuda-sm-capability.md)).
For the "new arg must become live in the emitted intrinsic asm" class (slang#12685
CUDA mip/LOD texture queries), the decisive positive control is GPU-free and lives
in the test's own SIMPLE filecheck — the mip overload's PTX must differ from the
non-mip form AND bind the arg as an input operand (`%2` + `"r"($input)`); a
byte-identical asm would mean the arg is still dead
([CUDA mip/LOD texture-query args have a GPU-free positive control](../learnings/1788380290256-approver-calibration-cuda-mip-lod-texture-query-ar.md)).

**Absent-path safety proves nothing about the present path.** slangpy#1141 adds
`version += os.environ.get("SLANGPY_VERSION_SUFFIX", "")`. The suffix-*absent*
direction is a provably-safe identity no-op, but it carries zero bits about the
suffix-*present* direction — which is the PR's entire stated purpose, with a real
trigger (the internal build sets the env var) and wheel-publication blast radius.
"Unreachable on the public path" is true but irrelevant. The rule: name the PR's
purpose, ask which branch delivers it, and if that branch is exercised by nothing
in-repo, it's `OPEN_GAP` — never round up, even for a one-liner, even with a
maintainer approval
([a no-op-by-default absent branch is not evidence for the present branch](../learnings/1788518256361-approver-challenger-miss-a-no-op-by-default-absent.md)).

**Piecewise coverage is not "covered elsewhere."** slang#12901 newly routes HostVM
shifts through a helper (`preserveShiftOperandElementType=false`); no executing
test covers `matrix<uint,R,C> << scalar`, though the Metal test exercises the
*other* branch and vector/matrix tests each cover one dimension. Clearing the gap
by arguing "every constituent is exercised piecewise" is the one-directional-approval
false-safe. Enumerate the reachable input combinations the new path admits, and for
each ask: is there an *executing* test whose assertion fails if this exact
combination regresses? Correctly-traced code + zero-bug reviews still abstain if a
reachable newly-enabled path is untested
([piecewise coverage of a newly-enabled reachable path is not "branch covered elsewhere"](../learnings/1788466997165-approver-critique-mustfix-piecewise-coverage-of-a-.md)).
The missing-test signal is not one class: a *trivial, correct-by-inspection,
caller-less* utility mirroring an already-tested idiom (slangpy#1129 `hash_append`)
is a likely-waivable nit maintainers routinely ship without a dedicated test, and
repeatedly abstaining on that sub-class is over-conservative (91% of
abstains-with-verdict were later approved). Reserve OPEN_GAP for missing tests with
a reachable trigger or a behavioral claim at stake
([OPEN_GAP on a trivial correct caller-less utility — maintainer approved as-is](../learnings/1788443875935-approver-human-disagreement-open-gap-on-a-trivial-.md)).
The recurring safe shape at the other end: a test-only PR editing only test
expectations to absorb a new diagnostic from a race-merged PR is stale-test
reconciliation, low intrinsic risk
([test-only PRs reconciling a test vs a concurrently-merged diagnostic](../learnings/1788474978105-approver-calibration-test-only-prs-reconciling-a-t.md)).

## Human-verdict joins — read who acted before mapping the terminal state

The host auto-joins a terminal `pr_merged`/`pr_closed` as a human verdict, but the
naive "merged ⇒ APPROVED / closed-unmerged ⇒ REJECTED" mapping mislabels several
automated cases. Discriminate by pulling `mergedBy`, `author`, `reviews`, and the
`closed`/`merged` timeline actor:

- **Bot self-merge, zero reviews** — an automated sync pipeline merging its own PR
  once CI is green is a LOW-WEIGHT / non-joinable signal, not a human read
  ([pr_merged where merged_by == the bot author is a weak human-verdict signal](../learnings/1788504907831-approver-calibration-pr-merged-where-merged-by-the.md),
  [nv-* sync PR "merged" join is a bot auto-merge, not a human approval](../learnings/1788880961965-approver-human-disagreement-nv-sync-pr-merged-join.md)).
- **Bot self-close, zero reviews** — the self-close variant is equally non-joinable
  ([bot self-CLOSE ≠ human verdict — do not join](../learnings/1788879724766-approver-human-disagreement-bot-self-close-not-jus.md)).
- **`Superseded by #N`** on a bot branch-sync is a mechanical dedup (head renamed to
  satisfy a path-guard); the identical diff re-routes under #N. The auto-joined
  "REJECTED-equivalent" is misleading — flag the supersede context in the report
  ([closed-unmerged on a bot branch-sync is often a supersede, not a content rejection](../learnings/1788879697628-approver-human-disagreement-closed-unmerged-on-a-b.md)).
- **Author self-close** of a content PR (e.g. a now-stale SIGGRAPH announcement) is
  a withdrawal, "neither," not a maintainer verdict — the symmetric case to author
  self-merge; time-sensitive announcement posts have a benign post-window withdrawal
  mode
  ([author self-close of a content PR is "neither" and vindicates an OUT_OF_SCOPE abstain](../learnings/1788458283027-approver-human-agreement-author-self-close-of-a-co.md)).

When a genuine human DOES merge/approve at your exact ABSTAIN commit with no
follow-up commits, the code shipped as reviewed — abstains are excluded from
agreement scoring, so it is neither a false-safe nor a disagreement. slang#12830
merged at the tier_eligible-abstain commit, and the highest-value output of that
engagement was a *build-verified challenger crash-find* (a null-deref SIGSEGV both
production bots cleared as "memory-safety clean") that shipped as a fix — do NOT
trust "N bots agree it's clean" over a reproduction
([MERGED at my ABSTAIN(tier_eligible) commit — the challenger crash-find shipped as a fix](../learnings/1788453624703-approver-human-disagreement-merged-at-my-abstain-t.md)).
The `external/**` + oversize class (slangpy#1140 opacity-micromap, correctness-bearing
code in the `external/slang-rhi` submodule the approver can't see) will ALWAYS
abstain and humans routinely APPROVE + merge — CONFIRMED-correct routing, a
candidate for a future narrower human-owned tier, not a self-adopted loosening
([CONFIRMED-correct ABSTAIN on a trusted-author slang-rhi-integration PR → human APPROVED + merged](../learnings/1788512650346-approver-human-disagreement-confirmed-correct-abst.md)).
The packaging-suffix case is the disagreement direction done right: the in-repo
verification gap is REAL but *unclosable inside the repo by design* (env var set
only by an out-of-repo internal build), so maintainers predictably merge —
ABSTAIN:OPEN_GAP working as intended, phrase the next-action as "verify via the
internal build, cannot be shown in this repo's CI"
([ABSTAIN:OPEN_GAP vs human MERGE on a no-op-default packaging change](../learnings/1788781046062-approver-human-disagreement-abstain-open-gap-vs-hu.md)).
Throughout, the discipline is that the human verdict is host-joined for scoring and
never used to *derive* the call — else the approver launders the human decision and
yields no signal.

**Source learnings (17):**

- [CUDA mip/LOD texture-query args have a GPU-free positive control](../learnings/1788380290256-approver-calibration-cuda-mip-lod-texture-query-ar.md) — the emitted PTX must bind the mip arg as an input operand; a byte-identical asm means the arg is still dead.
- [Mirror-a-sibling-callback PRs — a pre-existing cross-cutting gap does not clear, but it is not new risk](../learnings/1788416787180-approver-challenger-calibration-mirror-a-sibling-c.md) — read the whole file; document the pre-existing pattern in the OPEN_GAP challenger field.
- [slang-rhi "enable-extension-if-ANY-bit" Vulkan feature PRs have a partial-support device-creation edge](../learnings/1788419979566-approver-challenger-miss-slang-rhi-enable-extensio.md) — probe what happens on a device supporting the extension but only a subset of bits.
- [coarse-feature-mapping abstain (slang#12735) confirmed by maintainer — the granularity probe is load-bearing](../learnings/1788420466105-approver-human-agreement-coarse-feature-mapping-ab.md) — open the backend detection site; one bit rarely implies all N names.
- [piecewise coverage of a newly-enabled reachable path is not "branch covered elsewhere"](../learnings/1788466997165-approver-critique-mustfix-piecewise-coverage-of-a-.md) — enumerate reachable input combinations and demand an executing test per combination.
- [Test-only PRs reconciling a test vs a concurrently-merged PR's new diagnostic are a recurring safe shape](../learnings/1788474978105-approver-calibration-test-only-prs-reconciling-a-t.md) — stale-test-expectation reconciliation after a race-merge; low intrinsic risk, whole diff in tests/.
- [CUDA SM capability-mapping fix: a direct enumerate-every-atom unit test is the positive control, not a PTX test](../learnings/1788502196859-approver-challenger-calibration-cuda-sm-capability.md) — assert the mapping function directly; a scope-split deferring new atoms is a quality signal.
- [A no-op-by-default absent branch is NOT evidence for the present branch — OPEN_GAP when the present branch IS the purpose](../learnings/1788518256361-approver-challenger-miss-a-no-op-by-default-absent.md) — verifying the safe branch tells you nothing about the branch carrying the risk.
- [OPEN_GAP on a trivial correct caller-less utility lacking a test — maintainer approved it as-is](../learnings/1788443875935-approver-human-disagreement-open-gap-on-a-trivial-.md) — distinguish genuine OPEN_GAP (reachable trigger / behavioral claim) from a likely-waivable trivial-utility nit.
- [MERGED at my ABSTAIN(tier_eligible) commit — the challenger crash-find shipped as a fix](../learnings/1788453624703-approver-human-disagreement-merged-at-my-abstain-t.md) — a build-reproduced SIGSEGV both bots missed shipped as the fix; a core-maintainer self-merge with REVIEW_REQUIRED is the approval signal.
- [Author self-close of a content PR is "neither" (not REJECTED) for the join](../learnings/1788458283027-approver-human-agreement-author-self-close-of-a-co.md) — pull the terminal actor + reviews; time-sensitive announcement posts have a benign post-window withdrawal.
- [pr_merged where merged_by == the bot author is a weak human-verdict signal](../learnings/1788504907831-approver-calibration-pr-merged-where-merged-by-the.md) — an automated self-merge is not a maintainer vetting the change against your abstain.
- [CONFIRMED-correct: ABSTAIN (external/** + oversize) on a trusted-author slang-rhi-integration PR → human APPROVED at the same commit](../learnings/1788512650346-approver-human-disagreement-confirmed-correct-abst.md) — correctness-bearing code lives in a submodule the approver can't see; a candidate for a future human-owned narrower tier.
- [ABSTAIN:OPEN_GAP vs human MERGE on a no-op-default packaging change whose only trigger is an out-of-repo build](../learnings/1788781046062-approver-human-disagreement-abstain-open-gap-vs-hu.md) — the in-repo gap is real but unclosable by design; phrase the next-action as an out-of-repo hand-off.
- [closed-unmerged on a bot branch-sync is often a supersede, not a content rejection](../learnings/1788879697628-approver-human-disagreement-closed-unmerged-on-a-b.md) — a `Superseded by #N` close is dedup; the identical diff re-routes under #N.
- [Bot self-CLOSE (not just self-merge) ≠ human verdict — do not join](../learnings/1788879724766-approver-human-disagreement-bot-self-close-not-jus.md) — bot/automation actor + zero reviews ⇒ not a joinable verdict.
- [nv-* sync PR "merged" join is a bot auto-merge, not a human approval](../learnings/1788880961965-approver-human-disagreement-nv-sync-pr-merged-join.md) — check mergedBy==author==bot and reviews==0 before scoring an ABSTAIN-vs-merged join as over-strictness.
