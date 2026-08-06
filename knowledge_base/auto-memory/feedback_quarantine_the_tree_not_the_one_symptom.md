---
name: feedback_quarantine_the_tree_not_the_one_symptom
description: "I noticed a symlinked node_modules poisoned my typecheck and withheld that — then published TEST COUNTS from the same tree; and FETCH_HEAD masqueraded as a branch, nearly producing a false 'live on main' alarm"
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1081
---

# A poisoned tree poisons every reading, not the one you noticed

**2026-08-05, nanoclaw#1081, two errors in one review round.**

## 1. Partial quarantine is not quarantine

I symlinked `node_modules` into a review worktree. `bun run typecheck` failed with `Cannot find type definition file for 'bun'`, I correctly identified that as **my environment, not a PR defect**, and withheld it from the review. Good.

Then I ran `bun test` **in that same tree** and published `275 pass / 12 fail / 9 errors` — including a "baseline is byte-identical" regression claim built on it. With real deps (`bun install --frozen-lockfile`) the true numbers were **342/3** and **340/5**. The 12 "pre-existing failures" were largely artifacts of the broken install, and the head/base comparison I'd called clean was measuring noise against noise.

⭐⭐⭐ **Recognizing that an environment is broken creates an obligation over EVERY reading from it, not just the symptom that revealed it.** I treated the typecheck error as a local fact ("this one command is unreliable here") when it was a global one ("this tree is not the project"). ⇒ **When you catch your instrument lying once, discard the whole session's readings from it and re-measure — don't triage them individually.**

⚠️ The conclusion happened to survive (there really were no regressions at that head), which is exactly what makes this dangerous: **a wrong number with a right conclusion reads as confirmation.** Had I been asked to defend the figure I'd have had nothing.

## 2. `FETCH_HEAD` is not a branch

`git fetch origin pull/1081/head:pr1081-v3 nv-main` leaves `FETCH_HEAD` pointing at **whatever was fetched last**. I then ran `git merge-base pr1081-v3 FETCH_HEAD` and got back the PR head itself — which I read as *"`nv-main` contains this commit"*, i.e. a compile break already live on the shared branch. I was one step from publishing that alarm.

Re-checked against the explicit remote ref: `git merge-base --is-ancestor <c> origin/nv-main` → **NO** for all three commits. `nv-main` was clean the whole time; the merge-base was the PR branch compared against itself.

⭐⭐⭐ **Never use `FETCH_HEAD` as a stand-in for a branch — name `origin/<branch>`.** A multi-ref fetch silently makes it ambiguous, and the failure mode is a *base == head* result, which reads as "already contained" rather than as an error.

⇒ **Corollary for containment questions specifically:** "is X live on the shared branch?" is one of the highest-consequence claims in a review (it escalates a blocker to an incident). It gets an explicit named ref and a fresh fetch, always.

## The pattern both share

Both errors are a **stale or aliased handle read as authoritative** — a `node_modules` that isn't the project's, a ref that isn't the branch. Neither announced itself; both returned confident, plausible numbers. This is the same family as the store's root rule: a claim about a state I had not actually opened. The instrument *ran*, so it felt verified.

**What would have caught both, cheaply:** name the thing you are measuring and confirm the handle resolves to it — `ls node_modules/@types/` before trusting a typecheck, `git log --oneline -1 origin/nv-main` before trusting a containment result. One command each.

Related: [[feedback_control_the_instrument_not_the_reasoning]], [[feedback_a_size_figure_names_a_file_check_which_one]], [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]], [[project_nanoclaw_1081_silent_turn_undelivered]].
