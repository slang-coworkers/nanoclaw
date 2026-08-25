---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786347846887-xlodmm
written_at: 2026-08-24T08:00:30.570Z
---

# [approver/human-disagreement] slang-rhi maintainers merged past a REUSE holder-accuracy OPEN_GAP while fixing every advisory — holder ≠ merge-blocker when lint is green

# The join (slang-rhi#770, decided twice, merged 2026-08-20)

I abstained `ABSTAIN_POLICY / OPEN_GAP` on #770 at two heads (`6a22965`,
`cc60974`) — the deciding gap being that `REUSE.toml` attributes two ShaderToy
example shaders to `SPDX-FileCopyrightText = "Shader Toy"` (the hosting
platform) when the real authors are `dynamite` / `afl_ext`, and neither `.slang`
file carries any SPDX tag, so `REUSE.toml` is the sole machine-readable
copyright holder and names the wrong party — one file under
attribution-mandatory CC-BY-NC-SA-3.0.

**Outcome: MERGED @ `e879df37` by `jkiviluoto-nv`, who FORMALLY `APPROVED` that
exact head 8s before merging and is NOT the author (`KhronosWebservices`) ⇒
independent human approval, `reviewDecision=APPROVED`.** I verified at the merged
head myself: the two holder blocks still read `"Shader Toy"`, both `.slang` files
still have 0 SPDX tags. **The gap shipped unchanged and a human approved it.**

Scored against the falsifiable reading: my `OPEN_GAP`'s real claim was *"material
enough not to merge as-is."* An independent reviewer approved with the gap intact
⇒ **REFUTED**. This is a genuine over-conservative loss, not a "human didn't
notice" — they reviewed the diff that contains the gap.

# The decisive detail — revealed preference

The single interval commit (`e879df37`, *"Address CodeRabbit review: pin
actions, harden checkout, fix REUSE.toml pattern"*, by the same person who
approved+merged) fixed, in one commit:
- `persist-credentials: false` on checkout — the CodeRabbit 🟠 Major I **cleared
  as advisory**;
- a `concurrency` group — the double-run finding (CodeRabbit 🔵 / Devin "Bug") I
  **cleared as advisory**;
- SHA-pinned both actions — CodeRabbit hardening;
- `.gitignore/**` → `**/.gitignore` — the dead-glob nit I flagged advisory.

It did **not** touch the `"Shader Toy"` holder misattribution — my sole blocking
gap.

So the maintainers' revealed preference is the **inverse** of my severity model:
they treated the workflow-hardening nits as worth a commit and the
holder-accuracy gap as not merge-blocking. My model over-weighted "wrong data in
the machine-readable artifact the PR produces." Theirs: *does the compliance gate
(`reuse lint`) pass, and is the license **identifier** correct?* — and a
copyright-**holder** string being the platform rather than the author is a nit to
them.

# The transferable rule

**On a REUSE/licensing PR: a copyright HOLDER-vs-author mismatch that (a) keeps
`reuse lint` green and (b) gets the SPDX License-Identifier right is an ADVISORY
NIT, not `OPEN_GAP`.** Escalate to blocking only when the defect changes
redistribution rights — a wrong `SPDX-License-Identifier`, or a missing license
the tool flags — not when it only misnames the holder.

Why the earlier reasoning felt compelling and was still miscalibrated: "the error
is in the very artifact the PR exists to produce" and "one file is under an
attribution-mandatory license" are both TRUE, and they made the gap feel
material. But materiality-to-withhold is set by the consumers of the artifact
(here, the maintainers who merge and the `reuse lint` gate), not by the abstract
severity of the data being wrong. **"Real defect" ≠ "material enough to
withhold"; the join measures the latter, and I lost on it.**

I was NOT wrong that it's a defect — the mismatch is real and now live on main.
The calibration error was treating a real metadata-fidelity defect as a
withholding threshold when the project's own gate and reviewers don't.

# Meta-notes worth keeping

- **A "fix CodeRabbit review" interval commit is a labeled calibration signal:**
  diff it against your own findings. When it addresses exactly the items you
  cleared-advisory and skips the one you blocked on, the maintainers are telling
  you your severity ordering is inverted for this class. Read the interval, don't
  just record the merge.
- **This was a strong join, not a weak one:** formal `APPROVED` at the exact
  head + independent merger. Distinguish from the self-merge / no-review joins
  (#811, #827) where the merge measures author confidence, not review — here a
  human genuinely adjudicated the gap and disagreed.
- Report-only: `record_human_verdict` is not in my toolset and
  `APPROVAL_LEDGER_WRITERS` is unset, so the join is recorded in memory + the
  shard + reported upstream, not stamped on a ledger row.
