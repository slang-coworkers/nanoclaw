---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786379727146-vxsict
written_at: 2026-08-11T09:55:49.465Z
---

# [approver/human-disagreement] slang#12455 merged with my BLOCK's defect live — detection was right, severity placement was wrong for warn-only test tooling

## The join

I emitted **BLOCK** on slang#12455 (`RED_BUG` — a diagnostics-catalog lint joining
tests to compiler diagnostics by numeric code alone, which mis-resolves 3 tests whose
codes collide across definition files, and prints a remediation that would overwrite
their correct provenance digests with an unrelated diagnostic's).

Outcome: `jkiviluoto-nv` **APPROVED**, author self-merged. **Merged ⇒
APPROVED-equivalent ⇒ this is a DISAGREEMENT**, scored as a loss, not rounded up.

## The defect did ship — so this is not a false positive

Verified on merged `master` (`ec47ea72b`), importing the shipped parser:

- code-only join live at `:1523`; `parse_catalog_snapshot` still discards the `source`
  column at `:1433`; both regions byte-identical to the head I blocked.
- **3/3 collisions reproduce**, and `regenerate.py lint` on master still emits all
  three *"refresh //META doc_section_digest with `catalog-digest <code>`"* lines — the
  remediation that would corrupt correct provenance.

So the falsifiable claim splits: **"the defect is real" survived; "material enough not
to ship as-is" was refuted by a maintainer.**

## Where my calibration was off

The change is a **warn-only lint in generated-test tooling**: nothing gates CI on
warning count, no user-facing effect, and the observable cost today is 3 spurious
"stale" warnings out of 19 plus a footgun nobody has stepped on. I mapped "real defect
whose printed remediation is actively harmful" → **BLOCK**. This repo's bar is
evidently "ship it, fix forward" for that shape.

**Transferable:** for test-only / lint-only / warn-only tooling with no CI gate,
"prints advice that would be harmful if followed" is closer to
`ABSTAIN_POLICY:CHALLENGER_CONCERN` ("a human should look") than to BLOCK ("must not
merge"). BLOCK should be reserved for defects with a mechanism that harms *without a
human choosing to act on it* — wrong codegen, ABI breaks, data loss, a red gate. Ask:
**does this hurt anyone if every human ignores it?** Here the answer is no; the
laundering requires someone to follow the instruction.

Note the procedure pushed me here: any 🔴 in the review doc ⇒ BLOCK per the state
definitions, and Devin's freshness-attested review reported 🔴. So this is a
**policy-level signal about what counts as 🔴 in test-only tooling**, worth raising
upstream rather than a rule I quietly bend next time.

## The half worth recording as a win

The revision that landed while I was deciding (+105/−6) addressed **four** advisory
findings from the review + my challenger record: the identity-of-reported-issues
assertions restored, the `is_diagnostics_catalog` guard pinned, all three
`cmd_catalog_digest` paths self-tested, and the missing/empty-snapshot silent no-op
now warns. The author's new warning text — *"without it this lint passes whatever
those tests record"* — is them reasoning about the same silent-pass class from a
different direction.

**So the review's advisory findings landed and only the structural one deferred.**
That is the expected shape — cheap fixes land, re-keying a lookup defers — and it is
an argument for *reporting* structural findings clearly rather than for escalating
their state: the finding was communicated, understood, and consciously deferred. A
BLOCK added no information the ABSTAIN wouldn't have, and cost a disagreement row.

## Process note

Dispatched to decide a third revision; re-resolved live state first and found the PR
already **MERGED at the exact head I was asked to decide**, ~29 min before dispatch.
Logged `no-op: superseded by merge` and converted to a join instead of deciding a
terminal head. **A dispatch is a claim about state, not state** — and the join is the
only thing a merged head can still yield.
