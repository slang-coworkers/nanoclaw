---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:51:47.886Z
---

# [approver/critique-mustfix] Fixing the line you were pointed at is not fixing the claim — re-grep for its other phrasings (3 instances in one review)

## Symptom

In a single approval review (slang#12450) the critique gate had to **re-flag the same three
corrections it had already made me make**, because each time I edited exactly the line cited and
left an identical copy of the false claim elsewhere in the same artifact set:

| Claim | Fixed where | Left standing where |
|---|---|---|
| "job 93449546870 was GitHub-hosted" (it is self-hosted) | Probe 3 paragraph | **Probe 6**, which re-derived the whole hosted-vs-self-hosted contrast |
| "this file is the sole durable record" (over-claim) | body text | **the section heading** |
| log token written as `NODE24: true` (real name `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`) | prose sentence | **the embedded JSON result block** |

Three rounds, three re-flags, each costing a full critique cycle.

## Root cause

A reviewer cites *one instance* as a pointer to a *belief*. I read the citation as the scope of the
defect. But a false belief propagates to every surface written from it — and the copies hide
preferentially in places that don't read like prose:

- **headings** (feel like structure, not assertions)
- **JSON/YAML string values** (feel like data, not claims)
- **summary tables and abstracts** (written earliest, from the wrong premise, revisited least)
- **the memory/knowledge file** — the worst case, because it is the copy that gets read as *fact* by
  the next session. I corrected all three claims in the decision artifacts and initially left all
  three live in my memory child.

## How to catch it

After every correction, before declaring it addressed:

1. **Grep all artifacts for the belief, not the wording you just fixed** — in your own vocabulary
   *and* the reviewer's. For the hosted-runner case:
   `grep -rn -iE "github-hosted|hosted runner|windows-2022|windows-latest" <artifacts>`
2. **Read every hit**, including ones inside headings and JSON strings. Expect the deliberate
   correction notes; anything else is a live stale copy.
3. **Include derived/summary artifacts in the sweep** — the abstract, the frontmatter
   `description:`, the index row, the memory child. A one-line summary written from a wrong premise
   is still wrong after you fix the body.
4. **Report the sweep, not the edit.** "Fixed at line N, and grepped the artifact set for
   `<pattern>` — zero remaining hits outside the correction notes" is checkable; "fixed" is not.

## Fix

Adopted as a mechanical step: a correction is not complete at the edit, it is complete at the
**negative grep**. The three-line diff between the two is where a reviewer's second round goes.

Related, same review, same genus: an over-claim in a *heading* survived a body fix, which is a
reminder that headings are assertions with authority — a reader who skims sees only them.

**Transferable rule: a citation is a pointer to a belief, not a bounding box on the defect. Fix the
belief, then prove it with a negative grep across every surface — prose, headings, structured
values, summaries, and your own memory store.**
