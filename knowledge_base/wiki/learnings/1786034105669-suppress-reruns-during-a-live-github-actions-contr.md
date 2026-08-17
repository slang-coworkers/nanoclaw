---
title: "Suppress reruns during a live GitHub Actions control-plane outage — prove futility with an in-outage retry"
type: learning
topic: misc
source: learnings/1786034105669-suppress-reruns-during-a-live-github-actions-contr.md
---

# Suppress reruns during a live GitHub Actions control-plane outage — prove futility with an in-outage retry

## Rule

When failing jobs die at `Getting action download info` with `Failed to resolve action download info. Error: Service Unavailable|Internal Server Error`, that is a **GitHub Actions control-plane outage**, not a per-PR flake. **Do not rerun while it is live** — the rerun dies at the same step and burns the daily cap for nothing.

Verify liveness with two instruments, not one:
- `curl -s https://www.githubstatus.com/api/v2/incidents/unresolved.json` → `impact`/`status` (`investigating` = still live)
- `curl -s https://www.githubstatus.com/api/v2/components.json` → the `Actions` component (`partial_outage`)

The component's `updated_at` can lag the incident's, so read the **incident**, not just the component.

## The cheap proof that makes the decision non-speculative

Don't argue from the incident page alone. Find a **sibling retry already fired during the outage** and check whether it re-failed:

Observed 2026-08-06: REUSE run `31117851655` att2 fired 16:12:53Z **re-failed 16:22:02Z** with the byte-identical signature. That single control converts "reruns are probably futile" from a hedge into a measurement — and it costs one `gh run view --log-failed`.

## Onset detection: a regime change, not a rate

A fleet-wide outage shows as a **sharp flip**, so bucket a workflow's runs chronologically rather than computing a ratio:

```bash
gh api -X GET "repos/OWNER/REPO/actions/workflows/<wf_id>/runs?per_page=100&created=YYYY-MM-DD&event=push" \
  --jq '.workflow_runs[] | "\(.created_at)  \(.status)/\(.conclusion)  \(.head_branch[0:40])"' | sort
```

REUSE push-event was **71/71 green** then **5/5 failed from 15:43:34Z**. A 5/76 failure *ratio* would have read as background noise; the sorted timeline made it unmistakable. `PR Maintenance` flipped separately at 15:18:30Z — same cause, different onset, so don't assume one timestamp covers the fleet.

## Two traps this outage exposes

**1. Same job name, different EVENT, opposite results.** `reuse-compliance-check` on `push` = failure while the *same name* on `pull_request` = SUCCESS at the identical sha (emitting `Congratulations! Your project is compliant with version 3.3 of the REUSE Specification`). Compliance was already established; the push red was cosmetic. Any dedup keyed on job name alone mis-resolves this — key on `(workflow_id, event, name)`.

**2. A twin run 14s apart is the cleanest transient proof available.** For `board-sync`, run `31115182141` (same workflow, event, and sha, created **14 seconds earlier**) succeeded and reached real work, while `31115200545` failed at action resolution. Same code, same token scope, same commit ⇒ transient by construction, and it rules out permissions/token/board-API without reading a single line of application logic.

## Also: attribution before you assume a rerun is yours

A run's attempt count rising mid-sweep is not evidence you or the bot acted. Check `actor`/`triggering_actor` **per attempt**:

```bash
gh api "repos/OWNER/REPO/actions/runs/<id>/attempts/<n>" \
  --jq '"started=\(.run_started_at) concl=\(.conclusion) trig=\(.triggering_actor.login)"'
```

`31117877792` went att1→att2 between my collection and my action pass — fired by the **PR author**, timestamp 16:29:35Z. Identity alone doesn't discriminate (`nv-slang-bot[bot]` is shared across automations); the **timestamp** does.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786034105669-suppress-reruns-during-a-live-github-actions-contr.md`_
