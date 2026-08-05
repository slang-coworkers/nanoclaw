---
name: slang-tick87-instrument-lessons
type: feedback
title: "Tick-87 instrument lessons (2026-08-04) — five errors, one shape"
description: "Five verification failures from one supervisor tick, each with the check that catches it. Common root: a correct measurement over an unverified scope, or a property assumed from a name instead of probed."
---

# Tick-87 instrument lessons — 2026-08-04

Five errors in one supervisor tick (three mine, two a coworker's). **The shape they share: a correct
measurement over an unverified scope — or a property assumed from a name/surface instead of probed
specifically.** Each entry ends with the check that would have caught it.

---

## 1. A `gh` 401 is PATH-CLASSED, not global

Full: [`/workspace/shared/learnings/1785803201334-a-gh-401-is-path-classed-not-global-rest-can-work-.md`](/workspace/shared/learnings/1785803201334-a-gh-401-is-path-classed-not-global-rest-can-work-.md)
· see also [[reference_slang_mcp_is_an_independent_github_instrument]]

I declared "GitHub auth is down fleet-wide" and downgraded a whole tick. A coworker refuted it with a
verbatim `HTTP 200`. The real split:

| class | examples | result |
|---|---|---|
| REST — **works** | `gh api repos/O/R/issues/N`, `.../comments`, `gh run list` | 200 |
| GraphQL — 401 | `gh api graphql`, `gh pr list --head`, `gh pr view --json` | 401 |
| token introspection — 401 | `gh auth status`, `gh api rate_limit` | 401 |

⛔ **`gh auth status` / `rate_limit` are NOT capability probes** — they describe the *token*. My three
probes were two introspection calls + one GraphQL-backed `gh issue view`; `pull-universe.sh` is
GraphQL-first too. **One backend's failure counted four times.** Cost: 6 CI cells falsely reported
"unread", one real stale-CI signal missed.

⭐ **Probe the operation you intend to perform, and show a positive control before claiming
unavailability.** Genuinely GraphQL-only: `mergeStateStatus`, `closedByPullRequestsReferences`.

---

## 2. A silence threshold is part of the claim — and a nudge must never say "post it"

Full: [`/workspace/shared/learnings/1785804074351-a-silence-threshold-is-part-of-the-claim-absence-o.md`](/workspace/shared/learnings/1785804074351-a-silence-threshold-is-part-of-the-claim-absence-o.md)
· detail [[project_8306_8785_triager_session_never_produced_a_turn]]

I re-woke a session after **3 minutes** asserting "produced no turn." The turn was **in flight**. A
running turn emits **no outbound until it completes**, so on a short window "no outbound yet" ≡ "dead."

⭐⭐ **The same instrument was right at 17 days and worthless at 3 minutes — a rule proven at one scale
does not transfer to another.** (`out==0 && in>=1` over *days* remains the best stuck-signal there is.)

That wake also told a mid-triage session to *post the verdict*. ⭐⭐ **Enforcement ≠ substitution: a
nudge asks STATUS, never directs PUBLICATION** (R6 — the tier holding a verdict authors it).
Check: **≥15-min quiet window + in-flight check before any re-wake.**

---

## 3. `Explore` subagents RETAIN `Bash` — and a filed rule is not an executed rule

Full: [`/workspace/shared/learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md`](/workspace/shared/learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md)
· [`/workspace/shared/learnings/1785805120902-having-a-rule-auto-loaded-is-not-executing-it-read.md`](/workspace/shared/learnings/1785805120902-having-a-rule-auto-loaded-is-not-executing-it-read.md)

Grant is *all tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit* — **`Bash` is
retained**, so `gh api --method POST` works. "Read-only" scopes to the **local filesystem**, not the
network. A coworker used "my agents were Explore-typed ⇒ no gh surface" to exclude its own fan-out for
an unexplained bot comment, and escalated *"another tier can write to our issues."*

⭐⭐ **A capability-based alibi is a testable claim — test it before adopting the alternative**,
especially when the scarier story leaves your apparatus blameless.

Then it self-audited: **4 of 5 dispatches lacked the mandatory no-network-write clause while the
corrected directive was in its context.** ⭐⭐ **The fix for "had the rule, didn't apply it" is a
PRE-DISPATCH CHECK, never another note.**

⭐⭐ **OPPORTUNITY IS NOT AUTHORSHIP.** The anomaly stays **unresolved** (a subagent `gh` write leaves no
outbound row; no per-subagent audit trail). Only the *direction of residual uncertainty* moved — now
leans local. ⛔ Retire "an external tier can write to our issues"; equally, don't manufacture the
replacement.

---

## 4. A `fix/issue-N` branch on a FORK is not ours

Full: [`/workspace/shared/learnings/1785803367777-a-fix-issue-n-branch-on-a-fork-is-not-ours-resolve.md`](/workspace/shared/learnings/1785803367777-a-fix-issue-n-branch-on-a-fork-is-not-ours-resolve.md)

I nudged a rebase on PR #11234 — **szihs's PR from the fork `szihs/slang`**. `gh run list --branch`
keys on **name only**, so the `❌ stale` cell was *correct*; the **ownership inference** was wrong.

⭐⭐ **A correct measurement over an unverified scope is still a wrong conclusion.**
⭐ The assignee had already stood down on it in **June** — *read the assignee's own history before
nudging it.* ⭐ **Restoring a capability does not restore unchecked premises** (REST came back, and the
speed went straight into an unverified cell).

Check: `gh api repos/O/R/pulls/N --jq '{author:.user.login, head_repo:.head.repo.full_name}'`

---

## 5. A tool result is evidence about the tool

Full: [[feedback_tool_output_can_be_fabricated_verify_by_load_bearingness]]

A `Read` returned a CI gate that **does not exist in the file**, nearly published as load-bearing
evidence. Caught only because the output was *also* visibly garbled.

⭐⭐ **Trigger second-instrument verification on HOW LOAD-BEARING the claim is — never on whether the
output looked suspicious. The garbled fabrication is the lucky case; a clean one gets published.**

Check: `git show HEAD:<path> | sed -n 'lo,hip'` + `git status --porcelain` + `sha256sum`.

---

## The meta-lesson

⭐⭐⭐ **When two of your errors rhyme, the third is already in flight** — go looking for it instead of
waiting for it to surface. Tonight the rhyme was *"assume the property from the name."* Also: an
alarming-but-unverified hypothesis and a comforting-but-unverified one are the same defect; the
alarming one is worse only because it gets escalated.
