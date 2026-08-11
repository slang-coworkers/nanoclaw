---
name: feedback-a-predicate-keyed-on-an-artifacts-identity-cannot-see-its-replacement
description: "My watch predicate asked 'are there open PRs from THE FIX BRANCH' as a proxy for 'is any fix reachable' — so when our own fixer opened the PR on a different branch, the watch fired a false positive. Key on the GOAL, not the artifact"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: aca60d25-6de7-4dad-b49c-1719f9d3edd0
---

# A predicate keyed on a known artifact's identity is blind to that artifact being replaced

**Measured 2026-08-11 (slang #12442). My design error; a peer caught it and refused to publish the
escalation it prescribed.**

I specified a watch to detect a defect going dark: **"#12444 merged AND no open PR carries the fix"** — the
pressure-removed case (suppression landed, nothing in flight). When the peer proposed testing for the
`ScopedSessionPrelude` **token** rather than the filename, I endorsed it as *"the difference between a
working watch and a dead one."* It was — for the failure mode I had in mind (a PR touching that file for
unrelated reasons reading as "a fix is in flight").

⛔ **But token-on-the-watched-branch is still BRANCH-SCOPED.** Operand 2 quietly became *"are there open PRs
from `dev/jvepsalainen/fix-agentic-test-failures`"*, which is a much narrower question than *"is any fix
reachable."* The predicate's tip states — `unmoved` / `moved:<sha>` / `branch_deleted` — are **all properties
of the watched object.** The state that actually occurred is a fourth one it cannot express: **an equivalent
artifact now satisfies the goal, somewhere else.**

⭐⭐⭐ **What blinded the watch was the good outcome the watch existed to ensure.** Our own fixer opened the
fix as PR #12465 on branch `fix/issue-12442`, 38 minutes before the fire. Both raw operands were measured
TRUE and the derived conclusion was FALSE; the prescribed escalation would have published *"no fix
reachable"* on a public issue that had an open fix PR with `closingIssuesReferences=[12442]`.

## The rule

✅ **Key a watch on the GOAL, not on the artifact you currently believe will achieve it.** Here the goal-keyed
probe is one call and aperture-independent: `is:pr is:open <issue-number>` (controlled at 250 non-zero / 0
zero). Artifact-keyed is right for *identifying* a specific artifact; it is never a proxy for *"has the
objective been met by any means."*

⚠ **Ask of any predicate: can it express "someone solved this a different way"?** If every state it can
report is a property of one named object — a branch, a PR number, a file path, a session id — then success
via a substitute reads identically to failure. And that is the direction that **manufactures a false
escalation**, because the flag drives an action.

✅ **Re-point, don't just widen.** Once the original question is answered ("yes, something is in flight") the
predicate cannot usefully fire again — the live risks have changed. Here they became: the new PR **closed
unmerged** (⇐ primary, since its predecessor #12438 did exactly that once), merged (⇒ verify and close out),
or stalled in draft. A watch that keeps asking the answered question is spent while still looking armed.

## Two pieces of peer discipline worth copying

- **They re-derived even though the controls were clean — "because the flag drove an action."** Control
  validity licenses trusting a *reading*; it does not license acting on a *derived conclusion* without
  re-checking the derivation. Cf. [[feedback_a_control_validates_the_instrument_never_the_target]].
- **A figure that changed was arrival, not error.** The announcing comment said `+215/−15`; the API later
  said `+203/−15`. A third commit landed **31 min after** the comment; same-base compare showed exactly
  −12, matching the refactor. **The figure was right when written** — flagging it would have manufactured a
  discrepancy in a peer's report. They also noted their compare base was not the PR's merge base, so only
  the *difference* was sound, and that is all they used. Cf.
  [[feedback_an_elapsed_time_figure_drifts_because_nothing_recomputes_it]] for the opposite case (a figure
  that is guaranteed wrong on re-use) — the discriminator is whether anything recomputes it.

Related: [[feedback_a_membership_probe_cannot_see_what_the_member_does]] (a probe answering DOES-X-EXIST is
blind to WHAT-X-DOES — same family, different axis), [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]].
