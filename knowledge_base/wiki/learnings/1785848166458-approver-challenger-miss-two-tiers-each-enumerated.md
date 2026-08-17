---
title: "[approver/challenger-miss] Two tiers each enumerated a DIFFERENT OBJECT and both were right — pin a ref before citing source, and never cite a dirty working tree; the shallow-graft trap also breaks `git log -- <path>`"
type: learning
topic: review-approval
source: learnings/1785848166458-approver-challenger-miss-two-tiers-each-enumerated.md
---

# [approver/challenger-miss] Two tiers each enumerated a DIFFERENT OBJECT and both were right — pin a ref before citing source, and never cite a dirty working tree; the shallow-graft trap also breaks `git log -- <path>`

# "Absent" vs "present" was never a disagreement about facts — it was two unpinned objects

Supersedes the "citations do not resolve" conclusion in
`[approver/challenger-miss] A relayed file:line citation from HOST source did not resolve…` (same day,
~40 min earlier). **That note's method was right and its conclusion was under-scoped.** The code is
real; it is not on the branch I enumerated. Both measurements were correct.

## The three-way resolution

| party | object measured | result | error |
|---|---|---|---|
| me | `slang-coworkers/nanoclaw@nv-coworkers` (default branch), 7,972-blob tree | paths **absent** | none in the measurement; **under-scoped conclusion** ("do not resolve" ⊃ "not on this branch") |
| upstream tier | local clone `/workspace/agent/nanoclaw-kb`, **working tree** | paths present at `config.ts:318` | cited a **dirty checkout** (` M config.ts`, `A webhook-github.ts`) as repository state |
| truth | commit **`486c6269b46e`** (2026-07-19), on `nv-main`-family | present | — |

**Verified by me at that commit** (`contents?ref=486c6269b46e` + `Accept: …raw`), every element
independently rather than on relay:
- Commit touches `src/config.ts +16`, `src/github-webhook-server.ts +18`,
  `src/modules/pending-reviewable/ci-check.ts +73 (added)` — matches the relayed description exactly.
- `ci-check.ts` (73 lines): `PASSING = new Set(['success','neutral','skipped'])` `:25`;
  `green = status === 'completed' && PASSING.has(conclusion)` `:52`; doc `:14-15` *"Absent/failed/
  in-progress => false"*; `:64` *"a later check_suite success re-runs this."*
- `config.ts` (349 lines at that ref — **not** 368, and `:318` was approximate): `APPROVER_CI_GATE`
  `:310-311`, empty env fails `/^(1|true|yes|on)$/i` ⇒ **default OFF confirmed**.
- `store.ts` (92 lines): exports are **exactly** `parkReviewable`/`findParkedByHead`/`deleteParked`;
  **zero** hits for sweep|reap|expire|ttl|stale|age|cleanup ⇒ **no reaper**.

Note the relayed filename was `webhook-github.ts`; the committed file is `github-webhook-server.ts`.
A near-miss filename is enough to make a tree enumeration return "absent" correctly.

## Rules earned

⭐⭐ **PIN A REF BEFORE CITING SOURCE.** `file:line` without `@<sha-or-branch>` is not a citation — it's
a pointer into whatever the speaker happened to have checked out. Two correct readers reached opposite
conclusions purely because neither named an object. Cite `path:line @ <sha>`; if you can't name the
sha, you can't cite the line.

⭐⭐ **NEVER CITE A WORKING TREE.** Uncommitted modifications are invisible to every other reader by
construction — nobody can reproduce them, and `git status` is the only thing that would have revealed
it. Publish from `git show <ref>:<path>` or the API at a ref, never from the checkout.

⭐ **"Absent from X" ≠ "does not exist."** My honest scoping (*"not present at repo@branch as of
`<ts>`, by tree enumeration + raw read"*) is what made the third explanation findable — a bare
"citations don't resolve" would have closed the question wrongly. **Scope an absence to the object and
the method, and the disagreement becomes a locatable difference instead of a contradiction.**

⭐ **A file shorter than the cited line is a free tell, but it cuts both ways** — 107 lines vs `:318`
correctly told me the cited state wasn't there, and 349 lines vs `:318` at the right ref shows the
citation was roughly right all along. The tell identifies a wrong *object*, not a wrong *claim*.

## The instrument traps, now three deep
1. **`search/code` is unindexed for this repo** — returned `total=0` for a symbol I had already read.
   Positive control on the same instrument caught it. (Prior note.)
2. **A 404 body is ~127 bytes** — `wc -c` reads it as a small successful file.
3. **NEW, upstream's: `git log --all -- <path>` returned empty on a path a commit demonstrably
   touches**, because the clone is **shallow and grafted** ⇒ path-scoped history is unreliable there.
   Same family as the `--is-ancestor`/shallow-graft trap already filed. **Discriminator that worked:
   the presence/absence positive control** (a file known-present at both refs, cited files absent at
   one), with both ref objects confirmed fetched via `cat-file -t`.

## Why it mattered
This was routed to an operator as justification. The substantive conclusion **survived** — a
maintainer-gated fork parks unboundedly with no reaper and no ledger row — but it now rests on a named
commit anyone can re-read, instead of on one container's dirty checkout. **Deployment state remains
unverified from any container, and the flag defaults OFF**, so it is a question for the operator, not
a finding. Holding the routing was correct even though the claim turned out true: *the claim being
true is not evidence the evidence was good.*

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785848166458-approver-challenger-miss-two-tiers-each-enumerated.md`_
