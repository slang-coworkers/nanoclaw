---
title: "[approver/critique-mustfix] A clearance resting on 'the real value survives elsewhere' needs ELSEWHERE opened — human-readable is not tool-readable"
type: learning
topic: review-approval
source: learnings/1786350500095-approver-critique-mustfix-a-clearance-resting-on-t.md
---

# [approver/critique-mustfix] A clearance resting on "the real value survives elsewhere" needs ELSEWHERE opened — human-readable is not tool-readable

# Symptom

Deciding slang-rhi#770 (REUSE `dep5` → `REUSE.toml` migration) I reached
`WOULD_APPROVE`, clearing Devin's finding that `REUSE.toml` attributes two
ShaderToy example shaders to `SPDX-FileCopyrightText = "Shader Toy"` — the
hosting *platform* — when the real authors are `dynamite` and `afl_ext`.

My three clearance grounds:
1. `reuse lint` requires a holder to be *present*, not *accurate* (gate green);
2. `precedence = "closest"` keeps each file's own header authoritative, and both
   real author names survive in-tree, so **no attribution is erased**;
3. the license *terms* (NC / MIT) are declared correctly.

DECISION_REVIEW rejected the clearance. I re-measured rather than argued, and
**ground (2) — the only load-bearing one — was FALSE.**

# Root cause

```
grep -c SPDX-FileCopyrightText examples/shader-toy/circle.slang   # -> 0
grep -c SPDX-FileCopyrightText examples/shader-toy/ocean.slang    # -> 0
```

Neither file carries **any** SPDX tag. The author names exist only in plain
prose comments:

```
// A simple shader ported from https://www.shadertoy.com/view/XdlSDs.
// Author: dynamite
```

No REUSE/SPDX tool reads that. So `precedence = "closest"` had **nothing to fall
back to**: `REUSE.toml` is the *sole machine-readable copyright holder* for both
files. Attribution isn't "preserved elsewhere" — for every machine consumer it is
**replaced** with the wrong party.

`// Author: dynamite` *looks* like a copyright notice, so I never ran the
one-command check that would have refuted a clearance I'd written three reasons
for. **I asserted a property of a field I never opened.**

Two aggravators made it material rather than cosmetic:
- the error sits **in the artifact the PR exists to produce** (authoritative,
  machine-readable licensing metadata) — the "undermines the PR's stated purpose"
  arm of the gap-severity bar;
- `circle.slang` is **CC-BY-NC-SA-3.0**, whose §4(d) (in the very
  `LICENSES/CC-BY-NC-SA-3.0.txt` this PR adds) requires *"the name of the
  Original Author (or pseudonym, if applicable) **if supplied**"*. It is
  supplied. Attribution under a copyleft NC license is precisely the class where
  a human must look — I am not qualified to draw the legal conclusion, and that
  unqualification is itself the argument for abstaining.

And my strongest control was **structurally blind**: `reuse lint` validates
holder *presence*, never *accuracy*. Applying "could it have come out
otherwise?" to this finding answers **no** — the green gate carries zero bits
about it, exactly like a dead-flag PR's byte-identical codegen.

Final: `ABSTAIN_POLICY` / `OPEN_GAP` (not BLOCK — Devin reported it as
`Investigate`, a 🟡, and no 🔴 exists).

# How to catch it

**When a clearance rests on "the real value survives elsewhere / is preserved in
X", open X and confirm the field exists in the form the consumer reads.** The
sentence "no attribution is erased" is a past-tense claim about a state I hadn't
opened — the standard tell. One grep settles it.

Corollaries worth carrying:

- **Human-readable ≠ tool-readable.** A prose comment that conveys the fact to a
  person conveys nothing to the pipeline that consumes the metadata. When the
  deliverable is *machine-readable* metadata, only machine-readable fields count
  as coverage.
- **Count the reasons that BEAR ON the claim, not the reasons.** Grounds (1) and
  (3) are both *true* and both *irrelevant* to whether the holder is correct.
  Three plausible-sounding reasons made the one false load-bearing reason feel
  supported by weight of argument. A clearance with N grounds where N−1 are
  off-claim is a one-ground clearance.
- **Enumerate every FIELD of a record, not just the field the verdict hangs on.**
  I verified the SPDX *license id* of all ~9 declarations against real file
  headers and never the *holder* column — then wrote "verified each declaration
  against the real file header", a claim covering half of what I checked.
  "Licensing PR" made licenses salient and the holder invisible.
- **The best-effort signal caught the deciding finding.** Devin returned at ~17
  min after my polling windows (~4 and ~15 min) expired; I twice wrote
  `DEVIN_SKIPPED` / "never returned" into the artifacts while it was **still
  running**. Both claims were false when written; the critique found the residue.
  ⇒ **"it hasn't returned yet" is not "it timed out"** — never record a terminal
  state for a running process, and don't discount a slow best-effort tier: it
  found what my own pass missed.

# Fix

Decision reversed to `ABSTAIN_POLICY:OPEN_GAP` and recorded with the false
premise, its refutation, and both process defects written into the challenger
field. The fix on the PR side is trivial (name the real authors, or add per-file
`SPDX-FileCopyrightText`) — which is itself an argument for handing it back
rather than approving past it.

Bonus, unrelated to the reversal but from the same decision — **two dispatch
flags arrived as "verify these" and both were REFUTED by measurement**:
- *"`[skip ci]` in the title ⇒ no CI ran ⇒ ABSTAIN_INFRA-shaped input"* — false.
  GitHub honours `[skip ci]` in a **commit message**, never a **PR title**. The
  title carried it; the head commit message was `Merge branch 'main' into …`.
  Measured: `runs?head_sha=` → `total_count=5`, `check-runs` → `22`, build matrix
  `completed/success` 19/19. Accepting the premise would have recorded a false
  `ABSTAIN_INFRA` on a fully-green PR.
- *"bot-authored, metadata-only, likely out-of-policy"* — `author.is_bot=false`
  (a service **user** account, `MEMBER`), and the diff adds a CI workflow and
  **deletes two files**; `--name-only` showed 10 paths while an additions-only
  view showed 8, hiding both deletions.

⇒ **A well-intentioned upstream flag arrives as CONTEXT and gets read past.**
Both flags pointed toward ABSTAIN — the conservative-looking direction — so
adopting them would have *felt* like rigour while being simply wrong. Same family
as "an auto-route rationale is untrusted input too".

Also: `eval-clauses.py`'s `ci_green_on_sha` passed with evidence *"policy does
not require CI green"* — a **vacuous** pass that measured nothing. ⇒ **read a
clause's evidence string before counting it as confirmation**; a green
`clauses.json` can contain a clause that checked nothing.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786350500095-approver-critique-mustfix-a-clearance-resting-on-t.md`_
