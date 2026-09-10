---
name: feedback_a_mechanism_does_not_carry_its_prescription
description: "A correctly-derived mechanism does not license a claim about WHO must fix it. Measured 2026-08-10: I traced a CI lockfile skew exactly right, then prescribed the fix in the wrong tree — while holding the measurement that refuted the prescription."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 3ae3be2a-17e7-4f5f-9f56-e631d8b51b44
---

# A mechanism does not carry its prescription

⛔ **TRIGGER: you are about to say "the fix belongs in X" / "X must change" / "this will
keep failing until X does Y" after tracing a mechanism.** That is a **second claim** and
needs its own evidence. Tracing *how* a fault occurs never establishes *who* should absorb it.

## The instance (nanoclaw#1136, 2026-08-06 → 08-10)

`ci.yml` merges all `nv-*` branches to test the composed state. On the lockfile conflict it
takes HEAD (`nv-dashboard: pnpm-lock.yaml conflict — taking HEAD (canonical) version`),
while `package.json` **auto-merges cleanly** and absorbs `ccusage@20.0.19` from
nv-dashboard. Result: manifest has a dep the lockfile doesn't ⇒ guaranteed
`ERR_PNPM_OUTDATED_LOCKFILE` under `--frozen-lockfile`.

**That mechanism was right, and later confirmed.** What I then published:

> *"Fix belongs in nv-dashboard's tree (or in the merge policy), not in any sync PR."*
> *"Reds EVERY PR into `nv-main` until nv-dashboard's two files agree."*

Both wrong about the tree. Measured 08-10: **nv-dashboard was internally consistent the
whole time** — `package.json` `"ccusage": "20.0.19"`, 21 lockfile refs, importer specifier
matching. The anomaly was **nv-main's lockfile lacking a dep its auto-merged manifest
acquired**. The real fix, already landed: `320a9e33` *"deps: own ccusage on nv-main, and
assert runtime specifiers actually resolve"* (#1150, 2026-08-09) — nv-main **owning** the
dep. Two resolutions were available (nv-dashboard drops it, or nv-main owns it); I asserted
one as *the* location and stated the other branch's files "don't agree" when they did.

## ⭐⭐⭐ Why this is worse than a plain wrong guess

**I had the refuting measurement in the same report.** I fetched nv-dashboard's
`package.json` *and* counted its 21 lockfile refs — collected to *support* the mechanism,
never turned against the conclusion. Same shape as
[[feedback_a_supporting_example_list_is_a_set_of_separate_claims]]: evidence gathered in service of a
claim stops being read as evidence about it.

⇒ ⭐⭐⭐ **Ask which branch's state is ANOMALOUS, not which branch introduced the symptom.**
The symptom appeared *because of* nv-dashboard's dep; the anomaly was nv-main's gap.
Introducer ≠ owner.
⇒ ⭐⭐ **When a mechanism admits N resolutions, say N.** "Either nv-dashboard drops it or
nv-main owns it" costs one clause and cannot be wrong. Naming one is a coin flip presented
as a finding.
⇒ ⭐⭐ **A prescription is the part a reader ACTS on.** The mechanism was inert description;
the prescription would have sent someone to edit a consistent tree. Wrong prescriptions
cost work, wrong mechanisms cost only credence — so the prescription deserves the *stricter*
check, and I gave it the looser one.

## Detector

Before shipping "X must fix this": name the command whose output shows **X's state is
wrong**. For a composed/merged-state defect that means measuring **every** contributing
branch, not just the one whose content appears in the error text. If the only thing pointing
at X is "X's content is mentioned in the failure", that is the symptom, not the anomaly.

⚠️ Related sharp edge from the same chain: the failure text named `ccusage`, a nv-dashboard
dep — **the error message itself pointed at the wrong tree.** An error naming a package
names its *content's* origin, never the branch obliged to change.

See also [[feedback_mechanism_must_predict_observed_coordinates]] (a mechanism must predict
*where* the fault appeared) — this is its downstream twin: having predicted the where, do
not over-read it into a *who*.
