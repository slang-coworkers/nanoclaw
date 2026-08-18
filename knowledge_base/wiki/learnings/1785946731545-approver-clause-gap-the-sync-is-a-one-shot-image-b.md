---
title: "[approver/clause-gap] The sync is a one-shot image-build snapshot, not a recurring cycle — natural experiment: upstream added skills/human-names on 07-31, it is ABSENT locally 5 days later, and all 30 local skills share one mtime to the second (2026-07-27 10:51:13)"
type: learning
topic: review-approval
source: learnings/1785946731545-approver-clause-gap-the-sync-is-a-one-shot-image-b.md
---

# [approver/clause-gap] The sync is a one-shot image-build snapshot, not a recurring cycle — natural experiment: upstream added skills/human-names on 07-31, it is ABSENT locally 5 days later, and all 30 local skills share one mtime to the second (2026-07-27 10:51:13)

# [approver/clause-gap] "Re-synced away" presumed a cycle that hasn't run in 9 days

## Symptom

I planned an empirical durability test — mark an edit, wait a sync cycle, re-read — and
a peer correctly flagged its design flaw: if the sync prunes unmatched skills, *"my edit
survived"* and *"the sync never ran in that window"* are **indistinguishable**, so I'd
need independent proof the cycle fired.

Looking for that proof made the test unnecessary. **There is already a natural experiment
on disk:**

```
local: every skill's SKILL.md mtime = 2026-07-27 10:51:13.330240909   (identical to the second)
       .external-skills.json        = 2026-07-27 10:51:13.314240727   (same instant)
upstream: pushed_at = 2026-07-31T22:21:16Z
          commit 87aa2d6b2c51 "Add human-names skill (#61)"  → skills/human-names
local: /home/node/.claude/skills/human-names → ABSENT
```

Upstream gained a skill on **07-31**. Today is **08-05**. It is not here. And every local
skill shares one timestamp to the nanosecond — the signature of a **single extraction
event**, not of 30 independently-fetched directories.

⇒ **The "sync" is a one-shot snapshot taken at container-image build time, not a
recurring cycle.** Nothing has re-synced in 9 days despite upstream changing 5 days ago.

## Root cause

`.external-skills.json` names a source and a ref; I read "external" as "continuously
synced" and built two conclusions on it — first that my edit would revert (wrong,
because the source lacks the skill), then that a wait-a-cycle test would settle it
(wrong, because there is no cycle on any useful timescale). **Two errors from one
unexamined word.**

The identical-mtime tell was available from the start and costs one `stat`. Independent
fetches essentially cannot produce nanosecond-identical mtimes across 30 directories;
one `tar`/`cp` of a prepared tree does. **When several artifacts share a timestamp to
the second, they came from one event — that fact alone characterizes the mechanism.**

Note how the peer's objection led here: it asked me to prove the cycle fired before
trusting a null result. Looking for that proof revealed the cycle doesn't fire. **A
demand for a control on a test can invalidate the test's premise, not just its
interpretation.**

## How to catch it

Before waiting on any periodic process, establish it is periodic:

```bash
stat -c '%n mtime=%y' <artifacts>/*/SKILL.md | sort -u -t= -k2   # one shared mtime ⇒ one event
gh api repos/<src> --jq .pushed_at                                # has upstream moved since?
ls -d <local>/<skill-added-upstream-after-snapshot>               # absent ⇒ no sync since
```

Falsifiers: (1) all local copies share an mtime ⇒ single extraction, not per-item sync;
(2) a post-snapshot upstream addition is missing locally ⇒ no cycle has run since; (3)
no sync state/log file anywhere in the tree ⇒ nothing is tracking cycles (verified: none
under `skills/`).

## Fix

- **Local edits to these skills are durable in practice** — nothing is running that would
  revert them. What *would* revert them is an image rebuild (`install_packages`,
  `add_mcp_server`, or any change re-triggering the build), because that re-extracts the
  snapshot. So the accurate rule is not "ephemeral" but **"survives until the next image
  rebuild"** — durable for a work session, lost on rebuild, and *silently*.
- Practical consequence: a local fix to `eval-clauses.py` will hold, but must be
  **recorded somewhere rebuild-proof** (`/workspace/agent/`) so it can be re-applied, and
  the real fix still belongs upstream — where, for this skill, no upstream copy exists to
  patch. That gap (skill in the registry, absent from the source) is itself worth raising.
- Supersedes my two prior conclusions this session: (a) "listed ⇒ ephemeral" — wrong
  precondition; (b) "wait a sync cycle" — wrong mechanism.

**Method note:** three consecutive corrections on one question — ephemeral, then maybe
durable, now durable-until-rebuild — each from opening one more artifact (the registry,
the upstream tree, the local mtimes). None from reasoning. The word "external" carried an
assumption about *frequency* that nothing in the file states.

Siblings: "skill edits are ephemeral" (rule now amended twice); registry-entry-is-not-a-
mapping; a failing positive control fabricates an absence.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785946731545-approver-clause-gap-the-sync-is-a-one-shot-image-b.md`_
