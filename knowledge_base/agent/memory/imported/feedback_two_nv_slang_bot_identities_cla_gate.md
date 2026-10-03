---
name: feedback_two_nv_slang_bot_identities_cla_gate
description: "TWO GitHub identities named nv-slang-bot (App id 274397474 vs User id 286953280); the User one trips license/cla=pending and is INVISIBLE on the check-runs surface — discriminate with author.id/type, never the email string. ⛔The gate is enforcement_level=non_admins ⇒ ADVISORY for admins, NOT a merge block: rhi#808 merged with CLA still pending."
metadata:
  node_type: memory
  type: feedback
  tags:
    - slang-rhi
    - cla
    - approver
    - webhook-routing
    - identity
  originSessionId: 76f8cc33-c26d-449b-aace-01612f2502f6
---

**Two distinct GitHub identities answer to the name `nv-slang-bot`.** Measured on
shader-slang/slang-rhi 2026-08-04 via `pulls/{n}/commits --jq '.[].author'`:

| identity | `login` | `type` | `id` | CLA outcome |
|---|---|---|---|---|
| the App installation | `nv-slang-bot[bot]` | `Bot` | `274397474` | `license/cla=success`, no CLAassistant comment |
| a standalone user account | `nv-slang-bot` | `User` | `286953280` | `license/cla=pending`, `not_signed` badge comment |

cla-assistant keys off the **commit author identity** and evaluates all committers. The App
has signed; User `286953280` has not. The failing input is **that specific account**, not
"User-vs-App" as a class: PRs mixing human + App commits (rhi#782/#775/#765) pass fine. It is a
provisioning defect in whatever pushed the branch — fixable only by an **operator** (have the
account sign, or point the commit path at the App identity), never by a fixer or a review.

## It is advisory, not a merge block

`license/cla` is a required context at **`enforcement_level: non_admins`** ⇒ advisory for
admins. Decisive evidence: **rhi#808 merged 2026-08-04 22:42Z by an admin at the flagged SHA with
`license/cla` still `pending`** (merge `fcbacea7433b`; the squash in `main` is App-authored, so no
User-`286953280` commit reached `main`). Report it as a **CLA-compliance / provenance** defect.

The gate is **not fleet-wide** (mine-verified 08-04, all `non_admins`):

| repo | default branch | required contexts | `license/cla` required? |
|---|---|---|---|
| slang-rhi | `main` | 17 | yes |
| slangpy | `main` | 13 | yes |
| slang | **`master`** | 3 (`check-formatting`, `check-ci`, `SlangPy Tests`) | **no** |

⚠️`branches/main` 404s on slang — read `.default_branch` first, or the false negative reads as
"no protection at all".

## It is invisible on the check-runs surface

rhi#808's head: `commits/{sha}/check-runs` → 24 success, 2 skipped, 0 failure. The CLA lives
only on `commits/{sha}/status` (context `license/cla`). Same two-surface trap as
[[technique_merge_queue_eviction_read_both_surfaces_on_the_group_commit]]; the
check-counting copy of this fact (with the two-call recipe) is
[[feedback_check_runs_omit_legacy_commit_statuses]] — keep the two in sync.

## How to apply

- **Detect the identity — `any()` over all commits, never one index:**
  ```bash
  gh api repos/{o}/{r}/pulls/{n}/commits --jq 'any(.author.id == 286953280)'
  ```
  `commits[]` is chronological, so which single index lies depends on push order (slangpy#1054:
  7 User commits then 1 App ⇒ `[-1]` is a false clean). Discriminate on `author.id`/`type`,
  never the email string — the email correlated perfectly across 8 PRs but is only a rendering
  of the identity, and would have sent a peer hunting an email-format bug.
- **Read the enforcement scope** — `branches/{b}/protection` 403s for an App token, but the
  branch object carries a reachable summary:
  ```bash
  gh api repos/{o}/{r}/branches/{default_branch} \
    --jq '.protection.required_status_checks | {enforcement_level, contexts}'
  ```
  One 403 on one path is not a claim about a field's reachability; enumerate the endpoints.
- **Dispatching a bot PR to a `*-pr-approver`:** read `status` as well as `check-runs`; if
  `license/cla` is `pending`, say so with the identity ids so the recorded reason names the real
  blocker. The escalation is the dispatcher's — the approver is shadow-mode and posts nothing.
- The older gate-5 note in [[project_slang_12349_vulkan_pb_pushconstant_pipeline_layout]]
  ("rhi bot PRs are gated by an unsigned CLA") is right but under-specified: it applies only to
  commits by User `286953280`. A blocker stated without its discriminator reads as
  unconditional and invites the wrong fix.

## Status

- **08-04 sweep (60+ open bot PRs, three repos):** only rhi#808 (merged through it) and
  slangpy#1054 (draft) carried User `286953280`. rhi#809 *was* User-authored at `8d46f6a9f252`
  but after three force-pushes its head `6eb4ffe203e6` is App-authored, CLA `success`.
- **2026-10-02, shader-slang/slang — still being produced:** User `286953280` authors commits on
  #12674 (1/12, `2a11e28c3e`, ready, idle at CLA pending), #13352 (2/2, draft), #13363 (2/5,
  draft); the rest are App. So at least one fixer commit path still has git author
  `nv-slang-bot <nv-slang-bot@users.noreply.github.com>`. Not a merge block on slang
  (`license/cla` not required there). No record existed of an operator escalation, so it was
  sent to the operator on 10-02 with the two fixes above.

## Method lessons from the 08-04 retractions

This note was first published with three wrong claims, all caught by `slang-pr-approver`
re-probing what I had generalized:

- **"Merge block"** — inferred from "required context" without reading `enforcement_level`,
  then excused as an access limit when the field was one reachable call away.
- **"#809 carries the failing identity"** — ⭐a per-SHA fact stated as a per-PR fact expires on
  the next push, silently. Attach identity to the commit, and re-probe before republishing.
- **"#802 merged"** — a control-set member added from a different query than the one that
  defined the set (#802 is still open; valid only as a CLA-outcome control).

Two of the three rode in the message sent to *raise* rigour — the diligence slot gets audited
least ([[feedback_control_the_instrument_not_the_reasoning]]).

A fourth error: I "corrected" the approver for a concession it never made — its own artifact
used the exact endpoint I was handing it, and I had `head -40`'d that file earlier in the same
session. ⭐**"You conceded X" is a quotation claim wearing the clothes of a correction: open the
source before characterizing what someone else's artifact says.** Recall is most confident
exactly where it paraphrases something skimmed. Cf.
[[feedback_a_verification_prompt_paraphrase_manufactures_a_strawman]].

When relaying a hunch downstream, mark it as a hunch and make it an **addressed ask** naming
the tier, artifact and clause — "someone with access should confirm" names no actor and will not
fire. The passive-rule lesson in full lives in
[[feedback_a_turn_error_is_evidence_about_the_turn_not_the_work]] and
[[feedback_broader_read_access_is_not_higher_authority]].
