---
title: "run_attempt-1 is NOT a valid proxy for your own rerun count — the bot identity is SHARED (see amendment: by peer coworkers, not by the retry workflows)"
type: learning
topic: misc
source: learnings/1785874822609-run-attempt-1-is-not-a-valid-proxy-for-your-own-re.md
---

# run_attempt-1 is NOT a valid proxy for your own rerun count — the bot identity is SHARED (see amendment: by peer coworkers, not by the retry workflows)

> ## ⛔ AMENDED 2026-08-04 ~20:4xZ by Main — the CONCLUSION STANDS, the NAMED CAUSE IS REFUTED
> The author retracted its own mechanism within ~20 min of publishing and asked for this amendment
> (`/workspace/shared/` is write-only to Main). **Main independently re-verified every claim below
> against the GitHub API.** Read this before the body; the body's "Why" section is wrong.
>
> ### ❌ Refuted: "`ci-retry.yml` / `ci-retry-yielded-bot.yml` fired the attempt"
> All three candidates were enumerated and excluded — not argued away:
>
> | candidate | verdict | evidence (Main-verified) |
> |---|---|---|
> | `ci-retry.yml` (id `242489420`) | ❌ | newest run **2026-06-24**, `total_count=63`, actor **`github-actions[bot]`** — not our identity, and nothing today |
> | `ci-retry-yielded-bot.yml` (id `304423273`) | ❌ for this attempt | 83 runs today; **4 actually reran** (`#29722/#29727/#29736/#29745`), **none targeting #11709's runs** `30927395260` or `30941094570` |
> | `retry-on-gpu-failure` (`ci.yml:716`) | ❌ | gated `event_name == 'merge_group'`; the attempt's event was `pull_request` |
>
> ### ✅ Actual cause: `nv-slang-bot[bot]` is shared by PEER COWORKER AGENTS
> A peer bot coworker **authors** #11709. It pushed `b7307a34` at 18:41:34Z; attempt 3 was created
> **18:42:46Z — 72 s later** — re-ran only `test-falcor` + 2 dependents (3 of 37 jobs), and was
> cancelled by that coworker's next push at 18:53:52Z.
>
> ⇒ ⭐⭐⭐**This is WORSE than the published version, not milder: `triggering_actor` stays unattributable
> even after you have excluded every workflow in the repo.** The body's remedy — *grep for retry
> workflows* — is therefore **insufficient**; a clean grep result proves nothing.
>
> ### ⛔ Two corrections Main made to the retraction itself
> - **"Zero reruns from `ci-retry-yielded-bot` today" is false** — 4 of 83 runs really did rerun
>   (log line `Rerunning yielded bot CI run #N (id=…)`). The safe claim is *"none of them touched
>   #11709."* ⭐⭐**A no-op verdict observed on some runs is not a property of the workflow** — read the
>   verdict line per run, and note the workflow carries `--max-reruns 1`, so it *is* an active rerun source.
> - **"A retry workflow existing in-tree does not mean it ran"** (author's own addition, and the
>   sharpest line here) — `ci-retry.yml` is `state=active` and had been dormant for **6 weeks**.
>   Presence in the tree licensed a mechanism; the runs endpoint refuted it in one call.
>
> ### ✅ What survives, unchanged and load-bearing
> **`run_attempt - 1` is not your rerun count; your own write-time ledger is. Never reconcile the
> ledger upward to match the API.** Doing so here would have burned a rerun-cap slot on #11709 that
> was never spent — silently reducing future CI coverage, with nothing left behind to challenge.
> ⭐⭐⭐**The discriminator is a TIMESTAMP, never an identity** (logged decline 18:33Z vs attempt
> 18:42:46Z). That instinct was right in the original and is the only reason this was caught.
>
> ### ⚠️ Consequence for cap design, not in the body
> A cap keyed on *your* actions does not bound total reruns on a PR when a **co-authoring coworker
> shares your identity**. #11709 shows 2 reruns on one run against a correctly-charged ledger of 1.
> If a PR appears to exceed its daily cap, **co-authorship is the likely explanation, not a ledger bug.**
>
> ⭐⭐**Why this correction was worth making at all:** the wrong cause is *more* plausible than the right
> one and points at a fixable artifact (a workflow file), so the next reader would have grepped, found
> the file, and stopped — landing on a true conclusion via reasoning that cannot detect the real case.

## The trap

Reconciling the CI-babysitter rerun cap, I compared the tracker's charged count against GitHub's ground truth `run_attempt - 1` and found a mismatch: slang run 30927395260 showed `run_attempt=3` (⇒ 2 reruns executed) while I had charged myself 1. The natural reading — "I under-counted, my cap ledger is broken" — is **wrong**, and acting on it would have wrongly consumed a PR's daily rerun budget.

## ❌ Why — REFUTED, see the amendment at the top of this file

*(Kept verbatim for the audit trail. `ci-retry.yml` last ran 2026-06-24 as `github-actions[bot]`;
`ci-retry-yielded-bot` reran 4 things today, none on #11709. The real sharer of the identity is a peer
coworker agent authoring the PR. The 18:31–19:49Z bot-actor rows listed below are **dispatches that
no-opped**, which is exactly the trap: bot-actor rows in a run list look damning and did nothing.)*

`shader-slang/slang` ships **in-repo retry automation**: `.github/workflows/ci-retry.yml` and `.github/workflows/ci-retry-yielded-bot.yml`. The body is literally:

```yaml
env:
  GH_TOKEN: ${{ github.token }}
run: |
  gh run watch ${{ inputs.run_id }} > /dev/null 2>&1
  gh run rerun ${{ inputs.run_id }} --failed
```

Because it authenticates with `${{ github.token }}`, its reruns surface as `triggering_actor = nv-slang-bot[bot]` — **the same identity the babysitter uses**. On 2026-08-04 `ci-retry-yielded-bot` fired repeatedly (18:31:39Z, 18:43:29Z, 18:58:55Z, 19:10:20Z, 19:47:52Z, 19:49:50Z as the bot; also dispatched by humans jkwak-work, skiminki-nv, jvepsalainen-nv) — routine, tied to the `wait-for-human-priority` yield cycle.

The decisive disambiguation was a **timestamp**, not an identity: attempt 3 was created 18:42:46Z, but my own action log recorded the decision "no 3rd attempt" at 18:33Z. I could not have fired it.

## Rules

- **`run_attempt - 1` counts ALL reruns from every source** (you, in-repo retry automation, maintainers pressing re-run in the UI). It is a fine control for *"did my rerun actually take effect?"* immediately after firing one — verify the counter incremented — but it is **invalid as an audit of how many reruns YOU fired today.**
- **`triggering_actor` cannot separate you from token-based repo automation.** Both are the bot. Don't attribute by actor alone. ⛔**AMENDED — it also cannot separate you from a PEER COWORKER sharing the identity, which is what actually happened here.** So this rule is *stronger* than written: excluding every workflow does not make the actor attributable.
- **Your own write-time tracker/log is the only sound cap ledger.** Attempt counts legitimately exceeding your charged count is expected, not evidence of a bug. Do not "repair" the ledger to match `run_attempt`.
- Before concluding an accounting discrepancy is your error, **grep the repo for retry/rerun workflows** (`ls .github/workflows | grep -iE 'retry|rerun'`) and compare your own logged decision times against the attempt `created_at`. ⛔**AMENDED — the grep is INSUFFICIENT and a clean result proves nothing** (the real source was a peer coworker, not a workflow). And a *hit* proves nothing either: check `actions/workflows/<id>/runs` for whether it ran **today**, then read the per-run verdict line for whether it reran **this** run. ⭐**A workflow's presence in the tree is not evidence it fired — `ci-retry.yml` is `state=active` and had been dormant 6 weeks.** ⇒ **the timestamp comparison is the load-bearing half; treat it as the primary test, not the fallback.**

Generalizes beyond Slang: any repo with token-based rerun automation makes actor- and attempt-count-based self-attribution unreliable.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785874822609-run-attempt-1-is-not-a-valid-proxy-for-your-own-re.md`_
