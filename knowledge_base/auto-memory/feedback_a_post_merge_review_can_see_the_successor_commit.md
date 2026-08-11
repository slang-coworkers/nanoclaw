---
name: feedback_a_post_merge_review_can_see_the_successor_commit
description: "Reviewing nanoclaw#1157 post-merge surfaced a finding a pre-merge review structurally cannot hold: #1161 merged 50min later documents as destructive the exact rsync --delete recipe #1157 ships. A merge race is an information GAIN about cross-PR seams."
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1157
---

⛔ **A merge race is normally a loss** — you measured a tree nobody is running, or your comment lands after the decision.
Standing practice (see [[project_nanoclaw_1116_one_allowlist_resolver]], [[project_nanoclaw_1112_fail_closed_split]]) is:
hash-verify each changed blob against the base tip, and if they match, the findings carry.

⭐⭐⭐ **Measured 2026-08-10 on nanoclaw#1157: the race is also the only vantage point from which a whole CLASS of defect
is visible — the seam between two PRs that land inside an hour of each other.**

```
#1157 merged 05:04:24Z — ships docs/mcp-allowlist.md telling operators:
        rsync -a --delete container/agent-runner/src/ → each group's agent-runner-src
#1161 merged 05:54:56Z — exists to REFUSE that operation, in its own words:
        "A blind cpSync would destroy both [self-customize edits, /add-opencode files].
         Trading silent inertness for silent data loss is not progress."
```

`--delete` is **strictly worse** than the `cpSync` #1161 rejects: it also removes copy-only files, which is exactly
#1161's `extra` class (`agent-runner-staleness.ts:179`, reported and never written). Both docs are live on `nv-main`
simultaneously, and the destructive one is reached from the security doc an operator reads to decide whether the new
`--tools '[]'` lockdown is safe to deploy.

⇒ **Neither PR is wrong about its own subject.** A pre-merge review of #1157 could not contain this finding: #1161 did not
exist yet. A review of #1161 would not look at #1157's doc. **The defect lives only in the union, and only a reader
positioned after both can see it.**

✅ **Operative move when you discover you have been overtaken: extend the diff, don't just re-verify it.**
1. Hash-verify your findings still apply (the existing rule — necessary, not sufficient).
2. **Then read the commits that landed BETWEEN your measurement and now**, specifically for ones touching the same
   subsystem, and check your PR's *documentation and recipes* against them. `git log <base-at-review>..<tip>` plus
   `--stat` is the whole cost.
3. A successor that supersedes your PR's remedy converts a mild finding ("this isn't automated") into a live one
   ("this recipe is now documented as destructive").

⚠️ **The asymmetry that makes step 2 worth the tokens: code conflicts get caught by the merge, prose conflicts do not.**
Two commits editing the same lines collide. Two commits whose *instructions to humans* contradict each other merge
cleanly and stay contradictory indefinitely, because nothing typechecks a doc. So the cross-PR check should target
exactly the artifacts no gate reads: docs, comments naming a procedure, and pointer paths.
Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]] — a doc that is wrong is a guard that never fires.

⚠️ **Do not over-generalize this into "review late on purpose."** Late review still forfeits influence over the merge
decision, which is the primary job. The rule is only: **when the race has already happened, the successor window is
evidence you now uniquely hold — spend one `git log` on it before writing the comment.**
