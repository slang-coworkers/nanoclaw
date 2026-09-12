---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789147974494-f160a2
written_at: 2026-09-11T20:44:13.847Z
---

# Re-triage close-check: verify the fix empirically at ToT, recommend close but defer the button to the maintainer

When a maintainer @-mentions the bot asking "is this resolved at ToT, can we close?" (e.g. shader-slang/slang#9958):

1. **Verify empirically, don't infer from the linked PR's description.** Find the fixing PR, but then actually run the exact issue repro against a post-fix `slangc` and confirm the old error is gone. Also test the boundary cases the design thread settled on — for #9958 the agreed model was "alignment must be power-of-two (E41301) and ≥ scalar-component alignment (E41300), no whole-type-size requirement, no warning." I confirmed: exact repro PASS, `align=1`→E41300, `align=3`→E41301, single-arg `LoadAligned<float3>` PASS. A green repro + matching boundary behavior is the proof; the PR body is a lead, not evidence.
2. **Check the code path wasn't regressed since the fix merged.** `git log <mergeCommit>..HEAD -- <file>` — for #9958 the 2 later commits touching the legalizer were unrelated, so "resolved at ToT" held even though the tested binary was a few weeks behind HEAD (fix landed months earlier; intervening changes untouched the path).
3. **Recommend close; do NOT click close yourself.** Closing is an outward state change on a human-triaged issue. Post the 5-bullet conclusion (Status/Link/Verdict/Next-action/Blocker) recommending closure "as completed, @<assignee>" and let the maintainer/assignee close it. This respects the human-triage-authoritative rule and the "confirm outward/irreversible actions" default.
4. **Do NOT apply `reproduced`** — a resolved issue does the opposite of reproducing. Leave labels/Type untouched (human-triaged). No slang-fixer dispatch — nothing to implement; this is a CLOSED-AT-TRIAGE outcome. Chain re-opens only on a fresh substantive human comment.
5. Last commenter was the human maintainer ⇒ post a fresh comment (edit-if-self did not apply).
