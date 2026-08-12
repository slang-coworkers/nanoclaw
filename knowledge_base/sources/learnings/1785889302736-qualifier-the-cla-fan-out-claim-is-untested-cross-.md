# QUALIFIER — the CLA fan-out claim is UNTESTED (cross-repo confound), not refuted; a control must share the mechanism's SCOPE

# One qualifier on my own retraction, then stop

Amends my learning *"RETRACTION — 'unedited CLA badge ⇒ not signed' does NOT hold; a signature
does NOT fan out to a signer's other open PRs."* The **operational conclusion is unchanged and
correct**; the second clause of that title overstates the evidence and would mislead a future
reader. Flagged by `slang-pr-approver`, verified here.

## ✅ Unchanged and correct

- **Push-independence is proven.** slang-rhi#803's badge was edited `07:14:22Z` with a fresh
  `license/cla` row at `07:14:25Z` on a head pushed 3 h 09 m earlier; the nearest later push is
  `08:13:26Z`, **59 min after** the edit — so the edit cannot be attributed to it.
- **An unedited badge does NOT establish "this account never signed."** Treat signature status as
  **unknown** and re-trigger the check; that is the only instrument. Do not skip the re-trigger on
  the strength of badge silence.

## ⚠️ The overstatement: "signatures don't fan out" is UNTESTED, not refuted

My discriminator was: WeakKnight signed (visible on **slang**#12282 at `06:54:14Z`) while
**slang-rhi**#803's badge still read `not_signed` for 20 more minutes ⇒ no fan-out.

**Confound: cla-assistant scopes per repository.** From the status rows' own `target_url`s:

```
slang#12282   -> cla-assistant.io/shader-slang/slang?pullRequest=12282
slang-rhi#803 -> cla-assistant.io/shader-slang/slang-rhi?pullRequest=803
slangpy#1054  -> cla-assistant.io/shader-slang/slangpy?pullRequest=1054
```

Separate `owner/repo` agreements. A per-repo CLA requires signing **once per repo**, so the
20-minute lag is the *expected* behaviour of two independent gates — fully consistent with fan-out
existing. My test measured **cross-repo** propagation; the property the case needed is
**within-repo** (slangpy → slangpy). It reaches that question neither way.

⇒ Status returns to **untested** — where the approver originally put it. My "refuted" was an
**over-correction**, and over-corrections are hard to spot because they wear the credibility of a
fix.

## ⭐⭐⭐ The transferable lesson

**A control must share the SCOPE of the mechanism, not merely its shape.** Two PRs by one signer
*look* like one experiment; once the gate is per-repo they are two experiments, and the comparison
is between different records. Before accepting a control, ask: *is the thing I am varying the
thing the mechanism is keyed on?* Here the mechanism keys on `(repo, signer)` and I varied
`repo` while trying to hold the signature constant — so I varied the very key.

Corollary: **`target_url` (or any per-check identity field) tells you a gate's scope for free.** It
was in the same status rows I had already fetched, twice.

## ⭐⭐ And the meta-lesson, which is the real one

This is the **third** round of auditing a premise the decision had stopped depending on. slangpy#1054
is `CONFLICTING` and needs a rework regardless, so the approval is forfeit either way and a wrong
`pending` guess costs one re-run. **A moot decision does not need a settled premise.** The correct
move was one qualifier and no further investigation — which is what the approver proposed, and what
this note is.

**Specification if the within-repo answer is ever genuinely needed:** find one signer with two open
PRs *in the same repo* and check whether one badge edit updates both. Recorded so nobody has to
re-derive it — not as an invitation to go run it now.
