---
name: GitHub comment hygiene — edit-in-place when the bot was last to post
description: If nv-slang-bot was the last commenter on an issue/PR, EDIT that comment to keep it current; only post a NEW comment after a different user has replied since
type: feedback
originSessionId: d817064a-285d-47fd-85c1-be1069defc90
---
⛔⭐⭐⭐ **DROPPING `<N>` FROM A COMMENTS URL THROWS ON A SINGLE-COMMENT READ BUT *SILENTLY
SUCCEEDS* ON A LIST READ — THE MUTE ARM IS THE HAZARD, THE 404 IS THE LUCKY OUTCOME.** Full 2×2, all
four cells measured on my own edge (#12367, 2026-08-05; triager found the 404 arm, probed the other
two, and I re-ran every cell rather than inheriting):

| | with `<N>` | without `<N>` |
|---|---|---|
| **single comment** | `issues/<N>/comments/<id>` → ⛔ **404 Not Found** | `issues/comments/<id>` → ✅ the comment |
| **list** | `issues/<N>/comments` → ✅ only that issue's rows | `issues/comments` → ⚠️ **repo-wide rows, NO error** |

`issues/comments` is a *genuine* repo-wide endpoint: identical row shape, plausible content, no 404
to warn you. Verified the rows are foreign — first five belonged to issues **22/38/40/54/55** while
the `<N>` control returned exactly **1** row for 12367. So *"did my comment post?"* or *"is this
issue quiet?"* asked against that spelling returns a **confident wrong answer**; the 404 arm at least
halts you.

⚠️ **Do NOT store a row count for the mute arm.** Triager measured 100, I measured 30 — not a
contradiction: bare call = 30, `?per_page=100` = 100. The count is a **paging default, not a property
of the endpoint**, so any stored figure decays. Store the *shape* (foreign rows, no error), never the
tally.

⭐⭐⭐ **Why the 404 arm still matters: piped into a fragment sweep, its body contains none of your
load-bearing strings, so the sweep returns 0/12 — byte-identical to "none of my claims made it into
the posted comment."** An instrument that cannot distinguish *claims missing* from *wrong URL* will
invert a correct verdict into a phantom failure (the triager nearly retracted a good 8KB comment;
`issues/<N> --jq .comments` = 1 caught it). ⇒ **Before believing a zero from any `gh api` sweep,
confirm the endpoint returns a NON-ZERO body at all** — the positive control belongs on the
*endpoint*, not just the corpus. Same family as the `grep` false zero, one layer earlier: this one
fails at the URL, before any matching happens.

⇒ ⭐⭐⭐ **GENERAL RULE, worth more than the endpoint fact: when one arm of a URL-shape typo 404s,
PROBE THE OTHER ARM BEFORE FILING THE LESSON.** "Form X 404s, use form Y" leaves the next reader
unwarned about a mute failure one row over that corrupts data instead of halting. A loud failure
tempts you to file immediately — it feels like the finding *is* the error. Enumerate the cells.

When surfacing a blocker / status / update to GitHub on an issue or PR:
- **If `nv-slang-bot[bot]` was the LAST commenter** (no other-user comment since our last one) → **edit our existing comment in place** (edit-if-self) to keep it up-to-date. Do NOT stack a second bot comment.
- **Only post a NEW comment if a different user (human/maintainer/other bot) has commented since** our last one — i.e. there's a real follow-up to respond to.

**Why:** Granted 2026-06-08 by dashboard-admin. GitHub is the surface where the human author/maintainer replies, so blockers MUST be surfaced there — but multiple stacked bot comments are noise. One living bot comment, kept current, is the rule. Pairs with the GitHub-as-primary-artifact reinforcement.

⛔⭐⭐ **A STORED "edit cmt N" INSTRUCTION IS NOT A MODE — IT IS A CLAIM ABOUT THREAD STATE AT WRITE
TIME, AND THREAD STATE MOVES** (#11616, 2026-08-04). Two independent stores (mine and the triager's)
both carried "refresh issue cmt `4865870445` in place" for **7 weeks**. Wrong by the time it was read:
`4865870445` (our verdict, 07-02 12:51Z) was followed by **`4868054234` — maxime-modulopi, a HUMAN,
07-02 16:37Z.** A PATCH would have buried the update inside a comment two humans had already scrolled
past. Correct action was a **fresh incremental** comment (`5176412391`, posted 08-04 08:21Z, verified:
count went 3→4, not stacked-on-self).
⇒ **The step-1 fetch below is mandatory EVEN WHEN a memo/parent/relay names a specific comment id to
edit.** The id tells you *which* comment was ours; only a live read tells you whether editing it is
still right. Never let a recorded mode substitute for the check — cf.
[[feedback_control_the_instrument_not_the_reasoning]] (role/state cited from memory of an older
artifact) and [[feedback_correction_unapplied_until_every_restatement_fixed]].

**How to apply:**
1. Before posting, fetch recent comments (`gh api repos/<o>/<r>/issues/<n>/comments --jq 'last'` or check the latest author). **Do this immediately before posting, every time.**
2. Last author == nv-slang-bot → PATCH/edit that comment with the refreshed content.
3. Last author != nv-slang-bot (a real follow-up) → post a new comment responding to it.
4. This is the mechanic the fixer already used on #11495 ("edit-if-self"); now it's the standing rule for all tiers surfacing GitHub updates.

**Comments are NOT gated — edit-in-place is HYGIENE, not a gate (corrected 2026-06-24):** per `feedback_github_writes_operator_authorized` (operator **2026-06-16, SUPERSEDING**), verified comments/replies/reactions/labels POST FREELY on nv-slang-bot's authority after HEAD verification; only `gh pr ready` + `gh pr merge` are operator-gated. The older 2026-06-04 "comments gated / not orchestrator-overridable" framing is **RETIRED**. Edit-in-place governs *how* (don't stack bot comments), never *whether*.

⚠️ **Self-correction (#11538, 2026-06-24):** early in the chain I accepted slang-fixer's 06-04 "comments gated" citation, withdrew a legitimate issue-comment-update instruction, and even wrote the stale framing into this note — all wrong. Coworkers may still cite the retired 06-04 directive and refuse to post; correct them with the 06-16 policy rather than agreeing. Still verify facts at HEAD and don't overstate (see authorize-comment-matches-memo-hedging), but a factual status/observability comment is never gated.

⚠️ **Emoji-only ack reads as "ignored":** on #11538 the bot reacted to skiminki-nv's directive with only an emoji and otherwise stayed GitHub-silent during internal deliberation; the maintainer publicly asked "what's the deal with the bot... not seeing any activity." When a maintainer directly `@nv-slang-bot`-mentions with a directive, post a brief factual status (received / working on it / will follow up), not just a reaction. Silence during in-flight work is a bug.

⚠️ **Comment-edit permission is PER-TOKEN and inconsistent across coworker sessions — model revised repeatedly (#11718, 2026-06-24); treat the fallback chain below as the operating rule, not a clean theory:** Probed receipts: (a) slang-triager token PATCHes its OWN comments fine (×2 OK) but 403s cross-author on a peer's comment ("Must have admin rights to Repository"); (b) slang-fixer token 403s on PATCH **even of its own comment**, repeatably (retried — NOT transient), and can only CREATE. So some coworker tokens can edit their own comments and some cannot; cross-author PATCH always 403s. All comments render as one `nv-slang-bot[bot]` App, but the underlying session tokens differ in edit scope. *(Provenance: triager+fixer probes, not independently re-verified by Main; the model shifted 4× in one session — edit-in-place → "neither can edit" → "creator-binding" → "per-token". Stay skeptical; re-probe if load-bearing.)*
- **Operating fallback chain when surfacing/refreshing a GitHub comment:** (1) prefer editing your OWN living comment in place; (2) if your token 403s on PATCH **repeatably** (retry once to rule out a transient gh-4xx, per `feedback_gh_auth_status_misleading`), fall back to a **superseding CREATE** — CREATE always works — leading with a `"supersedes <old-id>"` line; (3) to fix a *peer's* comment, ask that peer to refresh its own; if the peer's token also can't PATCH, a superseding CREATE is the only bot path (the stale comment is undeletable by any bot).
- **Accuracy > tidiness under an edit-impossible constraint.** The single-living-comment preference is a clutter guideline, NOT a mandate to preserve a stale/FALSE comment. When in-place edit is impossible AND the live comment is inaccurate, a superseding CREATE is correct even without the other-user-replied escape hatch — a live false public claim is worse than a marked-superseding duplicate. (#11718: comment 4793075082 claimed a *deleted* runtime test still passed 1/1 + an overbroad 57006 rule; neither bot could PATCH it → authorized superseding CREATE.)
- **Re-confirmed again (#12009, 2026-07-09):** fixer token PATCH of its OWN comment 4920280530 → 403 "Must have admin rights to Repository", identical both attempts (retried, NOT transient). Fallback executed correctly: superseding CREATE 4920297346 directly beneath the stale one, leading with "Correction to my note above…". Model stable ~2 weeks on. Main-verified live. Operating rule holds: any "edit the bot's comment in place" directive will 403 with the fixer token — correct via follow-up CREATE instead.
- **Re-confirmed + mechanism (#9382, 2026-06-29):** fixer-path edit/delete genuinely 403s ("Must have admin rights"), CREATE-only — and the underlying signal is **`GH_TOKEN` invalid**: `gh auth status` shows the env token invalid, POSTs succeed via gh's *fallback* credential, but `PATCH`/`DELETE /issues/comments` consistently 403. So the CREATE-only behavior may be a **fixable credential-health issue** (an invalid/expired `GH_TOKEN` forcing a fallback credential that GitHub doesn't recognize as the comment author), not necessarily a permanent per-token scope limit. Don't re-spend cycles hypothesizing a PAT-routing/PAT-shadow collision — that was tested and did NOT hold on this path. Operating rule unchanged: edit own comment → on repeatable 403 fall back to a superseding/follow-up CREATE. If edit-in-place becomes load-bearing across the fleet, the lever is fixing the fixer's `GH_TOKEN`, not the comment logic.
- **⭐ NEW MECHANISM — GraphQL edit succeeds where REST PATCH 403s, SAME token (#11951 babysitter, 2026-07-15):** editing a bot comment in place, REST `PATCH /repos/<o>/<r>/issues/comments/{id}` returned **403 "Must have admin rights to Repository"**, but **GraphQL `updateIssueComment(input:{id, body})` SUCCEEDED with the identical App token** (comment 4976834356 edited in place, verified live). So the long "own-comment PATCH 403 → fall back to superseding CREATE" chain above may be **avoidable**: try the GraphQL mutation FIRST before conceding to a CREATE. Revised fallback chain: (1) REST PATCH own comment; (2) on 403, **try GraphQL `updateIssueComment`** (often succeeds where REST 403s — App-token quirk); (3) only if BOTH fail → superseding CREATE. This preserves single-living-comment hygiene in the common case instead of stacking. *(Provenance: babysitter probe on #11951 retraction; Main-directed edit-in-place, babysitter reported the REST-403/GraphQL-OK split + logged its own learning. Re-probe if load-bearing, but this is a clean same-token A/B.)*
- **Re-confirmed own-comment REST PATCH OK on the triager token (#12325, 2026-08-03, Main-verified live):** triager edited its own `5167081493` in place — **REST `PATCH` succeeded first try**, no 403, so no GraphQL and no superseding CREATE. Verified: comment count still **1**, `created 13:40:51Z` / `updated 13:53:39Z`, 4701→5955 chars, no HTML-escaping. So line 25's split still holds (**triager** token: own-comment PATCH fine, cross-author 403; **fixer** token: CREATE-only). Triager also notes GraphQL has been 401 in several recent sessions while REST PATCH works — i.e. **the step-30 "try GraphQL on 403" rung can itself be unavailable**; order the chain REST-first and don't treat GraphQL as a reliable rescue. Pairs with [[project_github_actions_graphql_401_outage]].
- **Re-confirmed cross-author 403 + a prevention lesson (#12051, 2026-07-10):** on a *held-no-PR* triage outcome, triager edited its triage comment in place to "held" while the fixer independently CREATE'd a fresh "held" comment 32s later → two non-contradictory bot "held" comments. Triager's DELETE **and** PATCH of the fixer's comment both 403'd (cross-author, as line 25). Only the fixer's own token could collapse it (delegated; leave-if-403 fallback = two comments is acceptable). **Prevention lesson recorded by triager:** a *held-no-PR* state is **triage's** GitHub surface (spine rule: fixer posts only when a PR *opens*); on such a hold the fixer should **ping the triager to refresh the existing comment, not second-post**. So the duplicate is avoidable upstream of the 403 — the fix is who-posts discipline, not comment cleanup.

- **⭐⭐ EDIT vs NEW-COMMENT: the notification cost is asymmetric, and I got the recommendation wrong (#10480, 2026-08-04).** I found a false number in a posted verdict ("125 tests across 12 `unit-test-replay-*.cpp` files" — that glob = **10** files/**120** tests; 125 needs `unit-test-record-replay-api.cpp`; 12 only counts a test-free header). I flagged it but **recommended leaving it**, reasoning it "costs a maintainer's attention for no decision change." The triager corrected me and patched it. **A REST `PATCH` of an existing comment sends NO notification and stacks nothing** — the attention cost I was avoiding belongs to a **new** correction comment, not an edit. ⇒ **The attention objection is an argument against a superseding CREATE, never against an in-place edit.** Verified live after their patch: comment count still **1**, `created 07:38:23Z / updated 08:03:19Z`, corrected text present, old "across 12" string absent, all other claims + the 🤖 disclaimer intact.
  ⭐ **What I actually failed at: I reasoned about the cost instead of reading this file**, which already recorded (line 31) that the **triager token PATCHes its own comments fine, first try**. The decision needed no cost model — only a lookup. Same recall-not-measurement defect as [[feedback_shallow_clone_makes_your_head_the_graft_root]]'s duplicate-note incident.
  ⇒ **Standing rule: a false public claim + an author whose token can PATCH = edit it, don't weigh it.** "Minor, self-consistent, not worth a round trip" is a judgment about *stacking a new comment*; it is not a reason to leave a wrong number live.

- **⭐⭐ A distinct failure mode from the triager's side, worth naming: EVERY INPUT VERIFIED, OUTPUT FALSE.** Their 125 was a correct sum over 11 test-bearing files; their 12 was a correct `ls | grep` over replay-*named* files. **Both figures individually measured, the sentence still false — because two numbers from two different sets were presented as one measurement.** This is not the denominator error (claiming a whole from a part) and not a bad instrument; it's a **set-boundary mismatch between adjacent clauses**. ⇒ **When a sentence carries two numbers, check they describe the SAME set** — and publish the boundary next to the figure ("125 across 11 test-bearing files: the 10 matched by `unit-test-replay-*.cpp` holding 120, plus `unit-test-record-replay-api.cpp` holding 5").
  ⚠️ **Mirror-image error, same root, from my side:** bound-testing their 125 with a deliberately WIDER net (`grep -rl SLANG_UNIT_TEST | xargs grep -l -i replay`) returned **134** and looked like a refutation. The extra 9 were `unit-test-repro-validator.cpp` — the **`-load-repro`** system, matching on one prose comment and a `replayRequest` local, no replay header. **Too narrow a glob and too wide a substring are the same defect in opposite directions: the scope and the claim were not the same set.** ✅ **Filter on subsystem-header include or a test-name prefix — never a substring in prose or identifiers**, which cannot distinguish membership from coincidence.
