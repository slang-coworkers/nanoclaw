---
type: chain
title: "slang#13463 — Zed: slangd ignores unopened #include targets (null config reply → false)"
description: MERGED 2026-10-12 (PR #13475, squash fac7213eba, merged by assignee jkiviluoto-nv). Approach D — a null slangd setting restores its default, an absent one keeps current. Terminal record.
tags: [slangd, language-server, zed, workspace-configuration]
resource: /workspace/inbox/a2a-1791318700177-flswxk/triage-13463.md
---

# slang#13463 — Zed: slangd can't find #include targets unless they are opened

**Triage (slang-triager, comment 6024885583, master `20092570c`):** Zed answers slangd's
`workspace/configuration` pull with `null` for every `slang.*` setting the user has not set. slangd's
`LanguageServer::updateSearchInWorkspace` (slang-language-server.cpp:2391) checks only `isValid()`, and `JSONValue::asBool`
(slang-json-value.cpp:65-75) maps Null→false, so workspace search turns off and only the folders of opened docs are
searched. Also fails on 2026.9.1 and 2026.13.1, so it is not a regression (the null→false path dates to 2022).
It is not a dup of #13179, because #13192 (jkiviluoto-nv, merged 09-23) is already in the reporter's `6eb89786c`.
Workaround posted on the issue: the flat `"slang.searchInAllWorkspaceDirectories": true` key.
I verified :2391 and asBool at `20092570c9` myself.

## Decision (mine)
- 10-06 ~20:40Z: **GO on Approach A, through the triager** (precedent #13423/#13409: external reporter, no
  assignee). Scope: a `null` config value means "unset, keep the current value" for every setting, on both pull
  and push, plus the inlay-hint updater. Test: a scripted `workspace/configuration` reply. Use the smallest surface,
  either a LANG_SERVER harness extension or a unit test, the fixer's choice.
- **Out of scope:** #13216 item 3 (initializationOptions / nested settings; tracker assigned to jkiviluoto-nv).
  The PR references #13216 but does not implement it. B (zed-slang extension defaults) is out of repo.
- Stale bot draft #13182 (`fix/issue-13179`, last touched 09-20) was superseded by #13192 and is unrelated to this
  fix. Don't touch it; cleanup is a separate decision.

- 10-07 ~01:20Z: **amendment accepted: D replaces A** (fixer-proposed, through the triager). Rule: a JSON `null`
  value resets the setting to its built-in default, and an absent key keeps the current value. I verified this at `bce8cbefa`:
  a null already yields the default for 12 of the 15 pulled sections. Lists convert null as empty, strings use `getTransientString`
  Null→"", and `style` falls back to `FormatOptions().style`. The 3 outliers are `searchInWorkspace` (null→false, default
  true, workspace-version.h:174), `enableFormatOnType` (null→false, default true) and `fallbackStyle` (null→"", default
  `{BasedOnStyle: Microsoft}`, so clang-format falls back to LLVM). D is one rule matching existing behavior, and it fixes set-then-removed
  (A would keep the stale value). Conditions: read each default from its existing source
  (`FormatOptions()`, the `Workspace` member initializer), with no duplicated literals; add a set-then-null test; the Process report
  states A vs D. Then open the held draft PR.

- 10-07 ~02:00Z: **held draft PR #13475** (`fix/issue-13463`, `fa2b5b9e31`, 1 commit, 11 files +449/−60, `pr: non-breaking`,
  closes only #13463). I verified on GitHub: the pr-mapping row → slang-fixer `sess-1791318712475-5dtwxj` on the canonical thread,
  `kDefault*` constexprs sit next to the member initializers, and `fallbackStyle` takes its default from `FormatOptions()`. The five-part format is in the
  explain-diff-html comment (the description is a short summary, per that skill). 6 tests in `tests/language-server/config-null/` +
  LANG_SERVER harness directives. "5 fail on master, 74/74" is the fixer's claim, not re-run by me. Triager comment
  6024885583 was edited to name the PR + the D rule. Known pre-existing gap: the push path has no handler for
  `slangLanguageServer.trace.server` (noted in the PR, not filed).

- 10-07 16:01Z: **maintainer reassignment.** jkwak-work (who github-actions auto-assigned at 01:59Z when the PR opened) assigned
  it to **jkiviluoto-nv**, commenting 6041721542: *"Assigning to @jkiviluoto-nv for now because he recently worked on a Zed issue."*
  I verified this via the timeline. It came **after** #13475 opened (01:59Z); head is now `9abe52d5d3` (3 commits, 2 review-fix commits 03:57/04:07Z),
  still a draft, BEHIND, 3 pass / 56 skipped, 0 human reviews, review requested from jkwak-work. Unlike #13420/#13436, the bot PR
  already exists and the comment doesn't decline it. **My decision:** no human ask to act on, so no GitHub reply. Freeze proactive bot
  work (no un-draft, rebase or new pushes); only finish an in-flight reviewer round as a local verdict. The draft stays as the
  resumable artifact for jkiviluoto-nv. Any human comment/review is relayed verbatim to slang-triager on the canonical thread.
  Re-chase `rechase-13463-assignee-731d` (10-09 09:00Z).

- 10-07 16:12Z triager msg 28: freeze acked by the fixer (msg 20). A round-2 reviewer verdict, if it arrives, is recorded locally only.
  The worktree and branch are kept. I verified on GitHub: cmt 6024885583 was edited in place at 16:11:32Z (nv-slang-bot, 3794 chars, "Handed off" line, 0
  @-mentions), the issue has 2 comments, and #13475 is still a draft at `9abe52d5d3`.

- 10-07 16:45Z: jkwak-work cmt 6042523452 linked the Discord origin (thread 1549044095580897370, the reporter's msg
  1557119677551878184). The comment is informational, asks for nothing, and is not a state change. I read the thread myself (12 msgs). The reporter (`micahsc`) asked on
  09-14. On 09-15 they shared Zed settings using **nested** `settings: {slang: {searchInAllWorkspaceDirectories: true}}` plus
  `initialization_options`, which is the triager's `zednested` ❌ case (Zed answers null for the dotted section), so D's null→default true covers it.
  jkiviluoto-nv said 09-21 "I think I have the fix", which became #13192. On 09-25 the reporter said it still failed. jkiviluoto-nv replied 09-28
  "We'll try to reproduce this issue … on Windows soonish". On 10-06 jkwaknv asked for a GH issue. So jkiviluoto-nv was already engaged, which supports
  the freeze. No GitHub or Discord reply from us; relayed verbatim to the triager.

- **10-08 08:54Z: the assignee adopted the bot PR.** jkiviluoto-nv marked #13475 ready for review, re-requested review (jkwak-work + team `dev`), and merged master twice (`efca4cc71e` on 10-08, `d23af9c379` on 10-09 at 05:10Z). Both facts are verified on the timeline.
  - There are no human reviews or asks yet. The freeze holds: a bot push now would collide with their merges.
  - This wasn't caught until the 10-09 06:15Z babysitter sweep reported the head moving. The re-chase prompt is updated.

- 10-09 07:25Z triager msg 32, **I verified on GitHub: the assignee took over the PR.** jkiviluoto-nv marked #13475 **ready for review**
  at 10-08 08:54:45Z and requested review from the `dev` team. jkwak-work's review request is still there. They merged master as `efca4cc71e`
  (10-08) and `d23af9c379` (10-09 05:10Z, force-push). The compare `9abe52d5d3...d23af9c379` touches none of the PR's slangd, harness or config-null files.
  The PR is BLOCKED with 0 reviews and 0 human comments. CI at d23af9c: `test-falcor` **failed** (run 37887334594, job 113685446624,
  step "Run external CI", GitLab pipeline 72611777, log unreadable), and the 2 Windows aarch64 builds were cancelled at the ~2h timeout. Falcor
  **passed** on `efca4cc71e` (run 37753012072) with identical PR content, so it's likely external (unconfirmed).
- **My decision:** no bot rerun. The PR is the assignee's now, and they're active. The issue comment 6024885583 stays as is: it's
  still literally true, and a non-draft `Fixes #13463` carries the trail. Freeze relaxed to: the fixer acts **only on an explicit human ask
  to the bot** on #13475, and must fetch the remote head before any push, because jkiviluoto-nv force-pushes the branch.
  Re-chase `rechase-13463-assignee-731d` moved to 10-12 09:00Z.

- 10-09 07:29Z: jkiviluoto-nv cmt 6076497211 on #13475: *"Apologies for force-push, I stumbled the merges yesterday."* This is an ack and not
  an ask to the bot. I verified: `9abe52d5d3...d23af9c379` is `ahead`/behind_by 0, so no bot commit was lost; still non-draft, 0 reviews. No reply.

- 10-09 07:38Z: **jkiviluoto-nv APPROVED #13475** (review 5467206356, MEMBER, empty body, on head `d23af9c379`). I verified this live.
  The PR is still BLOCKED and `reviewDecision` is empty, so this approval doesn't meet the required-review rule by itself. I can't read branch protection
  (403), so the exact rule is unknown. Falcor is still red on d23af9c. Nobody asked the bot to do anything, so there's no bot action. At 07:39Z the fixer's critique gate
  blocked a raw `gh api …/pulls/13475` read as if it were PR creation. That's a known method-blind false match (`gate-critique-on-deliver.sh:64`
  `gh api [^|]*pulls\b`, wiki ci-gh-cli-write-guard-and-fanout). The workaround is `gh pr view --json`. Triager msg 52: the block **cleared**, and there's nothing to chase.

- 10-12 09:00Z re-chase, **I verified live:** #13475 is still OPEN, non-draft, BLOCKED, `reviewDecision` empty, head `d23af9c379`, and `diverged` 5/5 from master.
  Nothing human has happened since jkiviluoto-nv's 10-09 07:38Z APPROVE: no new reviews, 0 inline comments, and #13463 has 3 comments, the last from 10-07.
  **Falcor is resolved:** jkiviluoto-nv re-ran run 37887334594 (attempt 2, 07:37Z), and `test-falcor` **passed** (08:20Z), so it was external.
  The only red checks left are the 2 Windows aarch64 builds, cancelled at the 120-min ceiling. That's the CI-wide #13515 (the bot cross-referenced it 10-08),
  not the PR. No relay to the triager, since nothing human is new. No bot action. Re-armed as `rechase-13463-assignee-d621` (10-15 09:00Z; the fired `-731d` one-shot is gone).

- 10-12 12:10Z: **jkiviluoto-nv verified #13475 in real Zed on macOS** (cmt 6123990567, 1984 chars). Setup: Zed 1.23.2, extension 0.1.1,
  reduced `src/main.slang` + `lib/helper.slang` project with no settings. The traced JSON-RPC shows Zed answering all 15 sections with `null`.
  Unpatched `2026.17-135`: include fails. PR CI build `2026.19-58-ga1a35b79` (head d23af9c): it resolves, and hover finds `helperValue` in lib/helper.slang.
  They didn't test Windows/Linux or the reporter's project. This independently confirms the triager's probe. Right after, they merged master again: head
  `a742eeb6de` (12:10:35Z), 7 ahead of d23af9c and 0 behind, with no PR files touched. CI is re-running. The APPROVE still stands (REST reports it on a742eeb6de). Not
  an ask to the bot → relayed verbatim to the triager, no bot post. Re-chase `rechase-13463-assignee-d621` (10-15) unchanged.

- 10-12 13:32Z triager msg 62, **I verified live:** `test-falcor` **failed again** on head `a742eeb6de` (run 38247385602, job 114809675986,
  step "Run external CI", GitLab pipeline 73252433 `failed`, 12:47Z). The other 49 checks pass, and the PR is BLOCKED and OPEN. Falcor history on this branch: efca4cc ✅,
  d23af9c ❌ then ✅ on the assignee's re-run, a742eeb ❌. Other CI runs today were ✅ (38213210800, 38226351392). The PR touches only slangd, the harness and tests,
  so a flake is likely, but the GitLab log can't be reached, so that's unconfirmed. **No bot re-run** (the assignee owns the PR and re-ran it last time). One-line FYI to the dashboard.

- 10-12 16:12:41Z: **MERGED.** jkiviluoto-nv merged #13475 (squash `fac7213eba`), and #13463 closed COMPLETED at 16:12:42Z via `Fixes`.
  I verified both live. The a742eeb Falcor failure passed on run 38247385602 attempt 2 (verified), so it was transient. Triager FINAL (msg 64): no issue
  post, cmt 6024885583 left as is, fixer worktree cleaned. I cancelled re-chase `rechase-13463-assignee-d621`. **Chain terminal.**

## Lessons
- **A maintainer reassigning after a bot PR exists is not a NO-GO.** Freezing proactive bot work, keeping the draft, and relaying verbatim let
  the assignee adopt the bot PR (un-draft → approve → real-editor verify → merge) in 5 days, with no bot push after the reassignment.
- **A fixer's counter-proposal (A → D) was worth checking against the code instead of holding the original GO.** The audit found a 3rd
  outlier (`fallbackStyle`) that neither proposal had named.
