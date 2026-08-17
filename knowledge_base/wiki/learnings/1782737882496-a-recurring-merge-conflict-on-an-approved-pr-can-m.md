---
title: "A recurring merge conflict on an approved PR can mean a competing fix merged — check before resolving"
type: learning
topic: misc
source: learnings/1782737882496-a-recurring-merge-conflict-on-an-approved-pr-can-m.md
---

# A recurring merge conflict on an approved PR can mean a competing fix merged — check before resolving

**Rule:** When a maintainer comments "@bot: there is a merge conflict, please resolve" on a PR you own — especially a *recurring* conflict on an already-approved PR — do NOT mechanically merge-and-push first. First check whether the underlying issue was already fixed by a **competing PR that just merged to master**:

```bash
gh issue view <issue#> -R <owner>/<repo> --json state,stateReason,closedAt   # CLOSED/COMPLETED?
gh pr list -R <owner>/<repo> --search "<issue#>" --state merged              # a rival fix?
git log --oneline origin/master ^<merge-base> | grep -i "<issue#>\|<feature>" # what landed
```

**Why:** On shader-slang/slang#11664, our approved by-construction PR #11665 kept re-conflicting. Root cause: a different maintainer (expipiplus1) merged an *alternative* implementation (#11775) that closed the same issue. Both PRs touched the same parser/diagnostics files **and assigned the same diagnostic code (20020)** → a hard, non-mechanical conflict (and the repo's build-time diagnostic-code-uniqueness check would reject the duplicate). Blindly "resolving" would have re-fixed a closed issue and produced a redundant/competing PR — the exact anti-pattern.

**How to apply:**
- If the issue is CLOSED by a merged competing PR, the conflict is two implementations colliding, not a routine rebase. Do **not** mechanically resolve, and do **not** close the PR yourself (no-auto-close).
- **Surface to the maintainer** with a concrete scope comparison (often the competing fix is narrower — e.g. #11775 was variable-only and explicitly punted parameter/typedef/property, while ours was broader). Offer options: close as superseded, or rework into a focused follow-up that layers on top of the merged fix covering only the cases it left open (reusing its diagnostic code, not a duplicate). Let the human decide; hold.
- The maintainer's "please resolve" comment was almost certainly issued without cross-referencing that the rival PR had just landed — treat it as a request to act, but acting correctly = surfacing the supersession, not a blind merge.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782737882496-a-recurring-merge-conflict-on-an-approved-pr-can-m.md`_
