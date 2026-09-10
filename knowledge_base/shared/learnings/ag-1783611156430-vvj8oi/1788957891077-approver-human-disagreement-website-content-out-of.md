---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788458443416-23k6sb
written_at: 2026-09-09T12:44:51.077Z
---

# [approver/human-disagreement] Website-content OUT_OF_SCOPE abstain #213 confirmed by outcome — but terminal was a self-merge (not an independent approval)

## Symptom / outcome
shader-slang/shader-slang.github.io#213 ("Add SIGGRAPH 2026 roundup post", one Jekyll `_posts/*.md` entry) was decided `ABSTAIN_POLICY:OUT_OF_SCOPE:website-content` across 4 revision heads (6dbe0be2b0ef, 4b5ac5f9b36d, 87c7b8816a32, 1845dc00c998). It then **merged** at head f65b84dc (merge commit da5383df).

## What humans actually did (the diff between my read and the shipped change)
- The PR ran through a real human **editorial** loop: a MEMBER reviewer (dshreiner-nv) left two `COMMENTED` reviews — "A couple of little things, but otherwise it looks good. Thanks!" — never a formal `APPROVED`/`CHANGES_REQUESTED`.
- The author (swoods-nv) pushed ~6 "Update …-roundup.md" revisions addressing those nits; net change stayed +54/-0, i.e. pure content/wording edits — precisely the editorial judgment outside a compiler-approver's competence.
- The terminal **merge was by the author himself (swoods-nv) — a SELF-MERGE.**

## Calibration lesson (transferable)
1. **Merged ≠ independent human APPROVE when merged_by == author.** Before treating a merge as an APPROVED-equivalent human verdict, check `mergedBy` vs the PR author. A self-merge is *neither agreement nor disagreement* — it does not vindicate or refute a decision. This #213 outcome is a self-merge; contrast website PR #207, where a *different* actor approved+merged (a genuine positive human verdict). My rows here were `ABSTAIN_POLICY` anyway (excluded from agreement scoring), so nothing scores either way — but the merged-by check matters for any future WOULD_APPROVE/BLOCK row.
2. **The abstain was the right routing.** "A human must look" is exactly what happened: an editorial review + author iteration decided a blog post. The `OUT_OF_SCOPE:website-content` class determination continues to hold for `*.github.io` `_posts/*.md` changes — confirmed a second time (after #207).
3. **A `COMMENTED` review is not a joinable verdict.** dshreiner-nv's "looks good, a couple little things" is a soft, non-blocking editorial comment, not `APPROVED`/`CHANGES_REQUESTED`; don't force it into a human-verdict mapping.

## Operational note
There is **no `record_human_verdict` MCP tool** in this container (the skill references one). The `record_decision` tool's own contract states the human review outcome is **joined automatically by the host from GitHub** — so on a `pr_merged`/`pr_review` event, do NOT try to self-report the verdict; just mine the outcome and write the learning. Nothing posts to GitHub.
