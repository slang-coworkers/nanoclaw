# Patch request: triage step 9 is comment-shaped — needs an artifact sweep

**Raised:** 2026-08-05 · **Origin:** shader-slang/slangpy#1091 chain
**Requires:** host-side edit (operator). Not applicable from inside any container — see "Why this needs you".

## The defect

`/slangpy-triage-issue` **step 9** (`#### 9. Post the triage outcome on the issue`) is written entirely
in terms of one comment: PATCH-if-last-poster-is-self, else POST-a-delta. That is correct for *adding*
a verdict and structurally unable to *correct* one — a GitHub issue is several independently-editable
artifacts, and a comment cannot fix the ones above it.

Observed on #1091: the triager posted a thorough correction (severity P3→P2, central claim retracted,
execution log attached), but a reader arriving cold still met **two confident, unmarked, refuted
claims** first — the issue body's "Only the Python surface is immune" plus its whole "The specific
victim" section, then comment 1's "torch caps rank at 64 … never rejects a constructible tensor".
Reading order is body → comment 1 → comment 2, so the correction was last.

The framing caused the miss: because step 9 is comment-shaped, the whole job felt comment-shaped.
This is a **workflow defect, not an agent lapse** — it will do the same to the next agent that runs
the step. Step 11's "re-run step 9" inherits it, so one edit at the source fixes both.

## Scope — affects BOTH triagers

Verified by grep against the composed `CLAUDE.md` of each group:

| group | step 9 present | same `Edit-if-last-poster-is-self` text |
|---|---|---|
| `slangpy-triager` | yes | yes (line ~466) |
| `slang-triager` | yes | yes (line ~453) |

So this is a shared base-workflow defect. Please apply to both, or to the shared base if step 9 is
composed from one source.

## Why this needs you (both of us are blocked)

- The triager's container has only the **composed** `CLAUDE.md` (41KB, regenerated on every wake), and
  the workflow definition source is not mounted there. Editing the composed file reverts on restart —
  worse than not editing, because it reads as fixed while the next run still gets the old step.
- From **my** container, `/workspace/extra/ephemeral` (which holds the prod group folders) is mounted
  `ro` — `findmnt` confirms `ro,relatime`. My `.instructions.md` edit failed `EROFS`.
- `ncl groups` has no verb for `.instructions.md` content.

I verified this rather than assuming it, because the previous step in this same chain was me handing
the triager an instruction that turned out to be unexecutable (set a P2 label in a repo with no
P0–P3 labels). Same rule both times: **confirm the artifact is writable before promising it.**

## Recommended application

Append to `groups/slangpy-triager/.instructions.md` and `groups/slang-triager/.instructions.md`
(durable overlay, appended after the composed spine on each wake). Precedent exists —
`slang-triager/.instructions.md` already carries a "**These override the read-only 'don't label'
posture in the base triage workflow**" section, so overlay-overrides-base is an established pattern
in this fleet.

Better, if the step-9 text is composed from one shared source: patch it there and drop the overlay.

---

## PATCH — append verbatim

```markdown
## Posting a verdict — sweep by ARTIFACT, not just by comment

This **extends step 9** of the base triage workflow (`#### 9. Post the triage outcome on the issue`).
That step is written entirely in terms of one comment — PATCH-if-self, else POST-a-delta — which is
correct for *adding* a verdict but structurally unable to *correct* one. A GitHub issue is several
independently-editable artifacts, and a comment cannot fix the ones above it.

**When your new verdict corrects, retracts, or re-scopes anything you or the issue previously
asserted, step 9's comment is necessary but NOT sufficient.** Sweep all four:

1. **The issue body.** Edit it. Add a `> [!IMPORTANT]` `CORRECTED <date>` banner at the top linking
   the current verdict, and mark the refuted section in place (`> [!WARNING] REFUTED`, strikethrough,
   or inline annotation). **Never delete — label.** What was believed stays auditable. This applies
   with full force when the body is **bot-authored**: that is our own artifact, so "not mine to edit"
   is never the reason to leave a refuted claim standing.
2. **Every prior comment carrying the claim.** PATCH each to prepend a `> [!WARNING]` `Superseded in
   part` pointer to the correction, and **scope it** — name which specific claim is retracted and
   which still stand. GitHub preserves edit history, so the original text stays visible, now
   labelled. An unscoped "superseded" note discards findings that were correct.
3. **Labels.** A severity or category revision that lives only in prose is not applied — the label is
   the machine-readable copy. **But check the label exists before promising it:** run
   `gh label list --repo <repo> --limit 100` first. `shader-slang/slangpy` has **no P0–P3 labels**, so
   "set the priority label" is unexecutable there; report the revision as prose-only rather than
   approximating with an adjacent label. And **read a label's description, not its name** —
   `slangtorch_parity` reads plausible and means "parity with functionality from slang-torch".
4. **Linked PRs.** A PR description quoting the reasoning you just corrected is a *fourth* artifact,
   on a different page, usually in front of a human reviewer. Check it. If someone else owns that
   branch, **route the amendment to them** — do not edit across chains yourself.

**The reader test — apply it before calling a correction done:** *if someone reads this from the top
and stops early, what do they believe?* If the answer is the refuted claim, you are not finished,
however thorough the correction comment is. Appending is not editing.

Step 11's "re-run step 9" inherits this rule: a final verdict that revises an earlier one triggers
the full artifact sweep, not just a comment refresh.
```

---

## Verification after applying

Restart the group and confirm the section survives composition:

```bash
ncl groups restart --id <slangpy-triager-group-id>
grep -c "sweep by ARTIFACT" groups/slangpy-triager/CLAUDE.md    # expect 1
```

A `0` means the overlay isn't being appended and the edit went to the wrong file.
