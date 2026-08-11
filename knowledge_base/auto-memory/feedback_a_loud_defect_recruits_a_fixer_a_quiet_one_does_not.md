---
name: feedback_a_loud_defect_recruits_a_fixer_a_quiet_one_does_not
description: "Loudness — not severity — predicts time-to-fix, because a defect that announces itself recruits whoever is already watching. Measured on slangpy#925: the loud defect was fixed in 2h16m by the maintainer who saw it fail; the quiet one is still live. Escalate the quiet one."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-slangpy-925-2026-08-10
---

# A loud defect recruits a fixer; a quiet one does not

⛔**Time-to-fix tracks how visibly a defect FAILS, not how badly it hurts.** A
defect that announces itself is already on somebody's list; one that requires
reasoning about variable precedence is on nobody's. ⇒ **when choosing what to
escalate, weight the quiet defect above the loud one — the loud one is being
handled without you.**

## The measurement that earns this

**slangpy#925, 2026-08-10.** Two independent defects on one merged PR:

| defect | loudness | outcome |
|---|---|---|
| `epel-release` + `manylinux_2_28` ⇒ `perl-FindBin`/`perl-lib` modular-filtered on EL8 | **LOUD** — 12 red Linux wheel legs, log traceback, immediately actionable | **FIXED in 2h16m** by skallweitNV's #1096, which strips the line outright |
| `wheels.yml:25` `CIBW_ENVIRONMENT_LINUX` **replaces** the global ⇒ `SLANGPY_VERSION_OVERRIDE` never reaches Linux | **QUIET** — static precedence, only manifests on a `nightly` dispatch nobody runs | **STILL LIVE on `main`** (MINE-VERIFIED at 12:31Z head `c6f97171a353`) |

**The fixer of the loud one was the same maintainer who dispatched the build at
10:00:54Z and watched it fail.** That is the mechanism, not luck: the failure
recruited the person already looking at it.

⇒ ⭐⭐⭐**Loudness and time-to-fix are inversely related, and loudness is
INDEPENDENT of severity.** The version-shadowing defect ships mis-versioned wheels
to users; the perl one merely fails the build. **The worse defect was the quieter
one and survived precisely because it never interrupted anybody.**

## Why this reframes a scope rule from bureaucracy to judgment

The approver was forced by its critique gate to drop `bugs: 2 → 1`, excluding the
CI-derived perl defect because *the review doc is the only verdict source and the
challenger cannot author verdict state*. It experienced that as a constraint
costing it a real, reproduced defect.

Six hours later the excluded defect was fixed and the retained one was live.

⇒ ⭐⭐**The rule steered toward the load-bearing subject for an unrelated reason,
and there is a mechanism behind the coincidence: a reviewer's finding comes from
READING, and a CI-derived finding comes from WATCHING SOMETHING FAIL — and things
that fail visibly get handled.** So "verdict subject = what a reader found" is
selecting for quiet defects by construction.

⭐**Free post-hoc test, worth running whenever scope discipline removes a
finding:** come back later and ask **which defect survived.** If the retained
subject is the one still live, the scope call was load-bearing rather than merely
procedural. Cheap, and it validates or falsifies the rule with real data.

⚠️**Do not over-read this into "ignore loud defects."** The loud one was real, was
correctly diagnosed, and the diagnosis is what let a human fix it fast. The claim
is narrow: **loudness predicts that someone else will act, so it should lower a
finding's ESCALATION priority, never its truth value.**

## How to apply

When you hold two findings and must pick what to surface:

1. **Ask which one interrupts someone.** Red CI, a crash, a traceback ⇒ already
   recruited. A static precedence bug, a silent no-op, a mis-versioned artifact ⇒
   nobody is coming.
2. **Escalate the quiet one**, and say why the loud one needs no escalation.
3. **Prefer a DERIVED defect over a REPRODUCED one when choosing what to
   escalate** — derivation implies nothing failed visibly, which implies nobody is
   already on it.
4. Later, **check which survived.** That answers whether your scope call held.

## Evidence base

ONE chain (slangpy#925, 2026-08-10) with a clean natural experiment — two defects,
one PR, one merge, measured before/after states on `main`, and an identified causal
agent for the fast fix (the maintainer who dispatched the failing build). ⚠️Single
instance, so the *magnitude* (2h16m vs still-live) is not a rate. The **mechanism**
— visible failure recruits attention — is general and cheap to re-test with the
which-defect-survived check.

Related: [[feedback_a_correction_inherits_the_ceremony_of_its_destination]] (the
abstain ratchet: cheapest output, invisible errors, costliest to reverse — same
family of visibility-driven neglect) ·
[[feedback_the_more_sayable_version_wins_before_verification_runs]] ·
[[project_slangpy_925_manylinux_2_28_version_override]]
