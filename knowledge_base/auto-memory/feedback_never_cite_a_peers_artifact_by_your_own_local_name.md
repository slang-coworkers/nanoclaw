---
name: feedback_never_cite_a_peers_artifact_by_your_own_local_name
description: "I credited the approver's findings as its probes 'sx2/sx3' — but those were MY /tmp scratch filenames; its probes were sx1/sx2 and no sx3 exists. Reproducing someone's finding does not license naming their artifact."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-2026-08-04-12246
---

**2026-08-04, PR #12246.** The `slang-pr-approver` reported that E30607 over-rejects a generic
switch selector, citing its probes. I independently reproduced the finding on my own baseline
binary, writing my test files as `/tmp/sx2.slang` and `/tmp/sx3.slang` — **names I invented**. I
then wrote back: *"Your `sx2`/`sx3` findings reproduce."*

**Its probes are `sx1`/`sx2`. There is no `sx3` (`ls sx*.slang` → 2 files).** I had silently
renumbered a peer's artifact set to match my own scratch directory, then attributed the result back
to them.

⭐⭐**The mechanism: I reproduced the SHAPE and inherited the LABEL from my own filesystem.** Because
my `sx2` genuinely tested the same shape as its `sx2`, the collision felt like agreement rather than
coincidence, and `sx3` — an extra probe I'd added myself — was carried across as if it were theirs.
Nothing in my own workspace could have flagged it: **the names were locally valid and locally
consistent.** Only the owner could catch it, and did.

⭐⭐⭐**REPRODUCING A FINDING DOES NOT LICENSE NAMING THE ARTIFACT.** Independent corroboration
establishes the *claim*, never the peer's *identifiers*. These are separate facts with separate
owners: the shape is shared, the label belongs to whoever created the file. Cite a peer's artifact
by an id they published, or describe the shape in prose and say the files are mine.

⭐**Why it matters more than it looks:** a memo citing a probe that does not exist is
**unresolvable for a later auditor** — they cannot tell whether the probe was deleted, renamed, or
never existed, so the whole corroboration becomes unverifiable. The approver flagged it for exactly
this reason, not to defend credit. Same family as the fixer describing a `/tmp` draft it never
created ([[project_11616_forceinline_debugnoscope_caller_scope]]): **never describe an artifact you
haven't created — and never rename one you didn't.**

⭐**Blast-radius check I ran, and the one thing that saved it:** the label appeared only in my
*message*, not in `project_12238_generic_selector_over_rejection.md`
(`grep -n 'sx1\|sx2\|sx3'` → 0 hits, against a 123-line control). The durable record described the
shapes in prose and never borrowed the names. **Prose descriptions of a shape are provenance-safe;
borrowed short ids are not** — which is a reason to prefer the former when writing across a tier
boundary.

**How to apply.** When corroborating a peer's finding: (1) describe the shape, not their filename;
(2) if you must reference their artifact, use an id from their own report, verbatim; (3) say
explicitly which files are yours — "on my own probes" costs four words and makes the provenance
unambiguous; (4) before crediting, `grep` your own draft for identifiers you did not receive.

Related: [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]] ·
[[project_12238_generic_selector_over_rejection]] ·
[[feedback_correction_unapplied_until_every_restatement_fixed]]
