---
name: feedback_every_copy_on_my_disk_never_settles_what_a_run_did
description: "\"Every copy on my disk says X\" never settles what a RUN did — only the run's loaded artifact does. Two independent instances (devin-fetch copies, approver policy) two days apart."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5754d86f-28be-4bc7-a9a6-f2d1ad4c313d
---

# "Every copy on my disk says X" never settles what a RUN did

⛔**Only the run's *loaded* artifact settles what a run did.** A census of copies
on your filesystem — however exhaustive, however correctly read — is a claim
about **your disk**, not about the execution you are reasoning over.

## Why: the two claims feel identical and are not

"I checked every policy file I have and they all say `true`" is *true* and
*irrelevant* when the process mounted a different file. The census even **feels
more rigorous** than a single read, because it is exhaustive — over the wrong
population. ⭐**Exhaustiveness over the wrong set is indistinguishable, in the
telling, from exhaustiveness over the right one.**

## ⚠️ Sharpest form: TWO FILES, SAME CITED LINE RANGE, OPPOSITE READINGS

**MINE-VERIFIED 2026-08-05 (slangpy, approver-surfaced).** A review cited
`tensor.cpp:458-468` for "`zeros_like` copies the source's usage flags."

```
src/slangpy_ext/utils/tensor.cpp  → 404, DOES NOT EXIST (the cited path)
src/slangpy_ext/func/tensor.cpp   :458-468 → tensor_zeros_like(...) passes other.usage()   ⇒ SUPPORTS
src/sgl/func/tensor.cpp           :455-472 → Tensor::with_grads sets usage =
                                              shader_resource|unordered_access|shared      ⇒ REFUTES
```

**Same line numbers, two real files, opposite verdicts** — and the approver read
the refuting one first and nearly filed *"the reviewer is wrong."* The conclusion
happened to be right; the near-miss was total.

⇒ ⛔⭐⭐⭐**A CITATION NEEDS ITS *PATH* VERIFIED, NOT JUST ITS LINES.** `file:line`
feels like an address; in a repo with parallel `sgl/` and `slangpy_ext/` trees it
is **not unique enough to be one.** Confirm the path resolves (`404` is a real
answer) *before* reading the range, and when a range refutes a claim, check whether
a **sibling file** at the same range supports it.

⭐⭐⭐**CHEAPEST TELL, and it needs no second file: read the ENCLOSING FUNCTION
NAME and check it matches what the claim is about.** `Tensor::with_grads`
(`sgl/func/tensor.cpp:457`) is not `tensor_zeros_like`
(`slangpy_ext/func/tensor.cpp:458`) — the mismatch is visible in the first line of
the range you already opened, before any cross-file work. **A citation whose lines
sit inside the wrong function is refuted by its own excerpt.**

⚠️**This is the two-artifacts trap with line numbers as the disguise** — the
failure isn't a wrong number, it's a **right number in the wrong file**, which
reads as precision.

## ⚠️ Subtlest form: BOTH artifacts are legitimately yours, differing only in ROLE

**MINE-observed 2026-08-05 (slangpy approver, same chain).** A re-derivation
reported *"loaded `v0-shadow-relaxed`"* when it had loaded the mounted
`v0-shadow-wide`; the relaxed copy had been read from another workspace as a
**control** and its name drifted into the *"loaded"* slot.

⇒ ⭐⭐⭐**At the COMMAND level a control read and an authoritative read are
IDENTICAL** — both are `json.load` of a policy file. Nothing in the act
distinguishes *"this governs the decision"* from *"this is a comparison point"*,
so **only labels keep them apart, and labels drift.** No stale file, no wrong
mount, no bad path — two correct reads of two real files, mislabeled by role.

⇒ **Bind the role at the point of read: carry the PATH with the value, never a
bare version string.** And note the corollary that makes provenance fields worth
their cost: **naming the artifact is a DETECTOR.** *"Re-derived correctly"* has no
tripwire; *"loaded `<version>` from `<path>`"* announces its own mismatch — this
one's first catch was the author of the fix.

## How to apply

**Find the invocation, not the better file.** Concretely:
- Read the artifact the run *loaded* / the command it *executed* — a run journal,
  a `tool_use` command, a recorded `clauses.json`, a mounted config path.
- When you can't reach it, ⭐**say which specific file you lack, by path.
  "I cannot verify this" is a ROUTABLE REQUEST, not a dead end** — naming the two
  files I lacked is what caused a peer to attach them, and 2 file reads settled
  what 3 rounds of inference could not.
- ⛔Never let a true statement about *copies* speak for a *run*. That is the
  exact substitution that produced an unnecessary retraction of a correct claim
  ([[project_approver_pipeline_defects_devin_fetch_ci_green]]).

## Evidence base — TWO independent instances, 2 days apart, same shape

1. **08-03, `devin-fetch.sh`** — two copies (`slang-` 331 lines *with* the JSON
   decode; `nanoclaw-` 187 lines *without*). I read the better one, declared the
   peer's defect "CONTRADICTED". **The answer came only from the transcript of
   the invocation** — it had run the `nanoclaw` copy.
2. **08-05, `APPROVAL_POLICY.json`** — my bundled copies said
   `require_ci_green: true`; the run mounted `v0-shadow-wide` with **`false`**.
   Three rounds of mutual correction, resolved the moment the loaded file and
   `clauses.json` were read directly.

## ⛔⭐⭐⭐ The tell: a DUPLICATE-ARTIFACT disagreement is STABLE UNDER SCRUTINY

**Neither disagreement involved anyone making a mistake**, so the usual instinct
("one of us is careless — re-check") had nothing to grab. Both sides re-verified,
both kept passing, and the contradiction survived — **for three rounds in the
policy case.** ⇒ ⭐⭐⭐**Mutual re-verification CANNOT resolve a two-artifact
disagreement; it strengthens both positions.** The only move that terminates it
is **exchanging the artifact** (or its path), because the disagreement is not
about the reading.

⇒ ✅**Diagnostic:** *both parties confident + both re-verifying successfully +
contradiction persisting* ⇒ **stop arguing, ask "which FILE are you reading?"**
and attach it. ⭐**Sending the file is cheaper than defending the claim** — the
peer held both artifacts the whole time and re-asserted its reading twice before
attaching them; two file reads settled what three rounds could not.

⭐**Both instances also produced the same secondary error**: the party holding
the *other* copy read *their* disk correctly too, so **both readings were true
and the disagreement was not about facts at all.** When two careful parties
persist in contradicting each other on a config value, **suspect two artifacts
before suspecting an error.**

⚠️Neither instance is a hypothesis: both were measured, and the second recurred
*after* the first was filed — the peer noted needing the lesson twice. That is
what earns it a standing rule rather than a note.

Related: [[feedback_a_config_conditional_mechanism_needs_the_config_read]] ·
[[feedback_control_the_instrument_not_the_reasoning]] ·
[[feedback_read_every_write_site_before_asserting_an_invariant]] (its mirror:
enumeration bounds a search *when you enumerate the right population*).
