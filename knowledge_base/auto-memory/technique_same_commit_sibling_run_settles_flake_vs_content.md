---
name: technique_same_commit_sibling_run_settles_flake_vs_content
description: "When a CI check fails, look for a sibling run at the SAME commit before reasoning about cause — the push/pull_request event pair gives a free duplicate, and one SHA cannot both pass and fail a content check"
metadata: 
  node_type: memory
  type: technique
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# Same-commit sibling run: the cheapest flake-vs-content discriminator

**Measured 2026-08-06 on slang PR #12155** (`REUSE Compliance Check`, head `a859c21797`). Two runs of the **same workflow at the same SHA**, created **3 seconds apart**:

| run | event | conclusion | runner | steps |
|---|---|---|---|---|
| `31121727201` | `pull_request` | **success** | `1000509863` | 6 — incl. **`4. REUSE Compliance Check [success]`** |
| `31121725027` | `push` | **failure** (job `cancelled`) | `0` | **0 — never scheduled** |

⭐⭐⭐ **A content defect cannot pass and fail simultaneously on one commit; scheduling can.** So a green sibling at the identical SHA settles "flake vs real" outright — **no cross-branch comparison, no mechanism argument, no diff reasoning.** Two rows at one SHA.

## Why this beats the usual approaches
The habitual moves are expensive and weaker: diff the branch against its base and argue no license-relevant file changed; compare against a different commit's run; reason about what the check *should* do. All of those are inferences about **cause**. The sibling run is an **observation about the same object** — the strongest available evidence, and it costs one API call.

✅ **Most GitHub workflows triggered on both `push` and `pull_request` give you this duplicate for free.** When a check fails, before doing anything else:
```
gh api repos/<owner>/<repo>/actions/runs/<id> --jq '{event,conclusion,head_sha,created_at,name}'
# then find siblings at that head_sha with the same workflow name and compare
```

## ⛔ The green must be shown to be NON-VACUOUS
A `conclusion: success` on a run that never executed the check is worthless — and that is exactly the failure mode in play here (the *failing* sibling had `steps=0`). ⇒ **check the STEP LIST, not the conclusion:**
- green sibling ⇒ the substantive step must be **present and `success`** (here: step 4 `REUSE Compliance Check`), and `runner_id` non-zero.
- failing sibling ⇒ `steps: []` + `runner_id: 0` + job `cancelled` is the signature of **never scheduled**, i.e. infra.

Without that step-list check you can talk yourself into a "vacuous green" and reach the right verdict for the wrong reason. The fixer explicitly verified the step list rather than trusting `conclusion: success` — that is the load-bearing half of the technique.

## Companion finding — a "no verdict yet" claim expires
Same branch's REUSE history:
```
92c6b259ac: success, success
7e505aa258: failure, failure     <- never scheduled
a859c21797: success, failure     <- the success genuinely ran the check
```
An earlier report of *"the license step never ran in any of four attempts, so there has still been no license verdict on this branch"* was true when written and **superseded by the next push**. ⇒ ⭐⭐**A "no result exists yet" claim is time-scoped and silently expires — re-derive before acting on it, and retract it yourself rather than leaving it in a peer's notes as an open item.** (Same family as [[feedback_a_waiting_metric_names_an_actor_verify_the_state_permits_the_wait]]: a metric about something not having happened.)

**Related:** [[project_12400_wgsl_out_param_ptr_function]] (the chain this arose on), and the session's unifying rule — *ask what the absence is an absence of: the phenomenon, or the probe* ([[feedback_a_negative_on_one_shape_is_not_a_property_of_the_target]]).
