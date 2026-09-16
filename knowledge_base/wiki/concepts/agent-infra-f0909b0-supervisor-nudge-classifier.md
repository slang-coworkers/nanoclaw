---
title: "Supervisor Nudge Classifier: Bot Detection, Ball-Direction, and Disposition Gating"
type: concept
group: agent-infra
tags: [supervise-issues, scan.py, nudge, bot-detection, ball-direction, disposition, false-positive]
source_count: 18
---

## TL;DR

`/supervise-issues` `scan.py` computes "who spoke last / is the ball ours" to decide when
to nudge an in-flight chain. Every recurring false-positive surge traces to the same few
classifier defects. A nudge premise is a CLAIM about state, not state — verify against
live GitHub before acting, and never let a nudge alone authorize a GitHub write.

- **The bot test is a DISJUNCTION: exclude an author if `__typename == "Bot"` OR its id ∈
  known-bot-id set.** A conjunction (type AND id) can never exclude our own plain
  `nv-slang-bot` account, which is `type=User`. Use ids, not logins — GraphQL truncates
  our App login to `nv-slang-bot` (dropping `[bot]`) and logins are renameable.
- **`github-actions`, `coderabbitai`, `devin-ai-integration`, `CLAassistant` carry NO
  `[bot]` suffix** in GraphQL `author.login`, so a suffix test or a 2-entry `bot_logins`
  set reads them as human. The set must be explicit.
- **A `<!-- pr-board-sync-assignment -->` "do not reply" notice is posted from a HUMAN
  account** (jhelferty-nv etc.) — match it on comment BODY, never author. Same for CLA
  bots and any `<!-- ... -->` automated notice.
- **Recency ≠ obligation.** An approval, a maintainer park/deferral, a maintainer↔maintainer
  @-mention, a "do not reply" notice, and any non-utterance EVENT (`review_requested`,
  `labeled`, `subscribed`, `mentioned`, `AssignedEvent`, a commit push, PR open) — plus the
  PR/issue `updated_at` (a bot's own push bumps it) — are not asks directed at us. Ball-direction
  must key ONLY on real `IssueComment`/`PullRequestReview`/review-thread comments by a non-bot;
  an auto-assigned PR-board shepherd who is subscribed/mentioned but never commented is not a
  human speaking.
- **Our own GitHub bot comment must count as `last_activity_by_us`** — scan reads only
  `ncl` outbound (session messages), not comments we posted on GitHub, so a chain we
  already answered on GitHub reads as "unanswered."
- **A2A activity is not GitHub-silence** — a container that messaged the orchestrator 10
  min ago can still read as GitHub-silent.
- **The human-owned/terminal disposition gate must gate BOTH the `ball=='human'` AND the
  `ball=='ours'` branches** — and the token set must match real prose (`handed_off`,
  `parked:design-gated`, `awaiting_human`, `resolved_no_pr`, `held:`, `two-track`, …), which
  is far wider than a 7-token set.
- **Stored disposition/terminal decisions must OUTRANK per-tick reclassification.** A
  human comment on a closed chain is the fixer's re-open trigger, so `ball=='ours'` must
  still surface — but terminal/silence nudges must not re-fire.
- **A `must_nudge` an order of magnitude above normal is an instrument fault, not a
  workload.** Treat `sent_nudges != must_nudge` as the designed safety valve: HOLD, verify
  limbs against live GitHub receipts, send only verified nudges, escalate the defect. Never
  mass-fire; never silence a nudge by narrating it away — fix the CLASSIFIER so the row
  emits `action='none'` with an auditable reason.
- **A mandatory-draft bot PR reads as `no PR`, and an empty maintainer APPROVE reads as
  `awaiting_us`** — both false. Resolve PRs by `closingIssuesReferences`/`Fixes #N`/
  `pr_session_mappings`, not the `fix/issue-` branch convention; treat an approve with no open
  threads as closed-pending-merge; a draft PR is resolved-pending-human, not a stall.
- **Fixing the classifier is only real once the disposition is PERSISTED to the Orchestrator's
  `supervisor-state.json`** (rehydrated each tick via `we_owe_next_step`). Auditing false
  positives off without persisting is why they recur — and a coworker's own copy of that file
  is inert, so a coworker must report its disposition UP for the orchestrator to record.

## Synthesis

### "Who spoke last" is the wrong predicate, and its bot leg is subtle

The core modeling error, stated most fully in the tick-131 postmortem, is that
**recency is not obligation**: "last non-bot comment" does not mean "a human is waiting on
us" ([supervisor nudge: who spoke last is not a human unanswered](../learnings/1786453196243-supervisor-nudge-who-spoke-last-is-not-a-human-is-.md)).
The correct predicate is three ordered filters: restrict to text-bearing collections
(issue comments + review bodies + review-thread comments, time-merged); exclude bots by
type OR id; then ask whether the text contains an ask **directed at us**. Dropping any one
manufactures false nudges. Counter-examples that all trip a naive predicate: an approval
(closes a loop, not opens one), a maintainer's park/deferral notice, human→human mentions
(`@pdeayton-nv can you look?`), a "do not reply" board-sync notice from a human account,
and pure EVENTS with a `User` actor and no text — `review_requested`, `labeled`,
`AssignedEvent`, a commit push, and PR-open itself — which make the predicate fire on
*every PR ever opened* ([supervisor "non-bot spoke last" nudge can be false](../learnings/1786452477308-approver-false-safe-a-supervisor-a-non-bot-spoke-l.md),
[human spoke last nudge fires on an approval](../learnings/1786582901413-approver-human-agreement-an-abstain-is-vindicated-.md) [context]).

The same modeling error resurfaces from a *different* input than comments: `scan.py`'s
ball-direction also counts GitHub **timeline events** (`subscribed`, `mentioned`, `assigned`,
`labeled`, board-sync) and the PR/issue `updated_at` as "a non-bot spoke last." An auto-assigned
PR-board **shepherd** who is `mentioned`/`subscribed` but *never commented* (e.g. `jhelferty-nv`
at 16:28Z), combined with the fixer's own push bumping `updated_at` (16:51Z), fabricated a phantom
"16:53Z human comment / awaiting_us" on a draft bot PR whose every actual comment was a bot
(coderabbit / CLAassistant / PR-board-sync). Ball-direction must key ONLY on real `IssueComment` /
`PullRequestReview` / review-thread comments authored by a non-bot — ignoring timeline events and
`updated_at` — and treat an auto-assigned shepherd/board login as non-speaking unless it actually
commented; a draft bot PR with only bot comments plus a subscribed shepherd is `awaiting_human`,
not `awaiting_us` ([scan.py over-flags awaiting_us from non-bot timeline events](../learnings/1789265524383-supervise-issues-scan-py-over-flags-awaiting-us-fr.md)).

The bot-detection leg has a **must-be-a-disjunction** structure that is easy to get wrong.
Our own bot runs as TWO concurrent accounts: the App `nv-slang-bot[bot]` (`__typename: Bot`,
id 274397474) and a plain user account `nv-slang-bot` (`__typename: User`, id 286953280).
So a `__typename`-only test counts our own comments as a human's on the plain-account PRs,
and a login test misses the App login because GraphQL truncates it to `nv-slang-bot`.
Hence: exclude if `__typename=="Bot"` **OR** `id ∈ known-bot-id set`; an earlier draft
saying "filter by type AND id" was wrong and silently reproduced the defect — a
conjunction's type leg never fires on the `User`-typed account, so the id leg can never act
([who spoke last is not a human unanswered](../learnings/1786453196243-supervisor-nudge-who-spoke-last-is-not-a-human-is-.md)).
Independently, third-party review bots — `github-actions`, `coderabbitai`,
`devin-ai-integration`, `CLAassistant` — carry no `[bot]` suffix, so a closed 2-entry
`bot_logins` set (`nv-slang-bot`, `nv-slang-bot[bot]`) stamps them `is_bot=false` and their
review as the newest actor flips the ball to "ours" ([scan.py counts bots as humans](../learnings/1787748905685-supervise-issues-scan-py-counts-bots-as-humans-and.md),
[over-flag is 3 concrete defects](../learnings/1788008486909-supervise-issues-scan-py-over-flag-is-3-concrete-c.md),
[scan.py over-flags nudges](../learnings/1787402461318-supervise-issues-scan-py-over-flags-nudges-bots-ta.md)).
`CLAassistant` is the sharpest of these: it posts with `user.type == "User"` (not `"Bot"`), so
any "human spoke last" heuristic keyed on `type != Bot` false-alarms whenever its "not signed"
notice is the trailing comment — yet that notice carries a real signal, so do not merely suppress
it. The CLA-not-signed status is a genuine MERGE blocker (read the body: it lists which committers
signed), and if our own bot identity `nv-slang-bot` is an unsigned committer, that is an
operator/org identity decision (how bot commits are CLA-covered), not a fixer/reviewer action —
escalate it UP rather than trying to "answer" CLAassistant on GitHub ([CLAassistant is typed User, not Bot — it trips the unanswered-human nudge](../learnings/1789521176741-claassistant-is-typed-user-not-bot-it-trips-superv.md)).

### The board-sync notice is the single largest false-positive source

Across at least seven ticks the dominant false positive is the automated
`<!-- pr-board-sync-assignment -->` "Automated notice (PR board sync) — do not reply to
this comment" posted through a real maintainer account (`jhelferty-nv`, `jvepsalainen-nv`).
Because the *author* is `type=User`, "human spoke last" trips and marks the chain
`awaiting_us` — impacting draft PRs awaiting operator ready-flip and APPROVED PRs awaiting
maintainer merge ([miscounts pr-board-sync bot comments](../learnings/1786712705926-supervise-issues-scan-py-miscounts-pr-board-sync-b.md),
[human spoke last misreads a do-not-reply comment](../learnings/1786798085259-supervisor-human-spoke-last-nudge-can-misread-a-do.md),
[awaiting_us over-fires: uncredited bots + board-sync](../learnings/1787331439589-supervisor-awaiting-us-over-fires-uncredited-bot-c.md)).
Because the account is also a genuine maintainer elsewhere, the filter must match on comment
**body** (the marker or "do not reply" text), never author.

The subtle failure that kept this alive for weeks: `scan.py` HAD the correct defense
(`is_administrative_comment()` matching board-sync markers on body) but `pull-universe.sh`
never fetched or emitted `body` — all three GraphQL selection sets requested only
`author{login} createdAt`, so the filter always saw an empty body → returned False → the
notice counted as substantive human speech ([pull-universe dropped comment body](../learnings/1786798462479-supervisor-pull-universe-dropped-comment-body-star.md)).
The general lesson: **a correctness filter matched on a field the producer doesn't emit is
dead code that reads as coverage** — when a downstream classifier "has a filter for X" but
X still leaks, trace the field back to the producer; the guard can be perfect and inert
simultaneously. The tell that a misclassification (not age) is fixed: the "~Nh unanswered"
figure *walks* (47h→23h, age recomputed each wake) while its anchor comment stays pinned
days old. Confirm the fix end-to-end with a WITH-field vs WITHOUT-field functional diff,
not just unit tests over synthetic inputs that already carry the field.

### Two credit gaps and the "not our chain" class

Beyond bots, two accounting gaps inflate `awaiting_us`. First, **our own posted GitHub bot
comment is not credited as `last_activity_by_us`** — `compute_last_activity_by_us` reads
only `ncl` outbound (session messages), so a chain where the triager already answered the
maintainer *on GitHub* reads as "human spoke last, unanswered"; the fix needs
pull-universe to feed the newest bot-comment timestamp into the credit computation
([awaiting_us over-fires: uncredited bots + board-sync](../learnings/1787331439589-supervisor-awaiting-us-over-fires-uncredited-bot-c.md)).
Second, and mirror-image, **A2A coordination is invisible** — a `running` container that
messaged the orchestrator minutes ago still flags because
`compute_last_activity_by_us` counts only GitHub events ([naive-datetime crash 115-nudge surge](../learnings/1787059894213-supervise-issues-scan-py-naive-datetime-crash-froz.md) [context]).

A distinct class is **PRs that were never ours**: a human-authored PR (author szihs,
jvepsalainen-nv) where nv-slang-bot has zero footprint — the "human replies to CI/coderabbit
bots on his own PR" trips "human spoke last" ([false-positives on author-managed PRs](../learnings/1787331527549-supervisor-nudge-false-positives-on-author-managed.md),
[scan.py over-flags nudges](../learnings/1787402461318-supervise-issues-scan-py-over-flags-nudges-bots-ta.md)).
Before treating a chain as blocked, establish it is ours: is the number an issue or a PR;
does `nv-slang-bot[bot]` appear in any comment/review/inline; are we a requested reviewer
or @-mentioned. If all no → report up "not actionable" and do NOT post (a first-ever bot
comment on a human's actively-managed PR is pure noise; for a read-only/no-role tier,
invariant 4 is satisfied by reporting up, not a GitHub write).

A tick-226 audit of 12 `action='nudge'` chains found only ONE real catch (a substantive reply
that had gone out as a comment *edit*, which GitHub doesn't notify, so the maintainer was
genuinely un-pinged) — the other eleven were the same handful of classifier gaps re-firing at a
~90% false-positive rate, each burning a fixer wake per chain per tick. Two of those classes go
beyond the bot/timeline defects above. First, **an empty maintainer APPROVE with no open threads
or questions is not `awaiting_us`** — it closes a loop, and under the standing silence-on-success
hold (a clean approval is deliberately never replied to on GitHub) it needs no reply; treat a
maintainer APPROVE with no open threads/questions as `awaiting_human` / closed-pending-merge, even
on an already-MERGED PR. Second, **a mandatory-draft bot PR reads as "no PR"** and trips the
fixer-owned-no-PR nudge: the PR-resolution heuristic keys on the `fix/issue-<n>` head-branch
convention, but slangpy fixers use `dev/slangpy-fixer/<n>`, so a complete, green, linked draft PR
(with `report_pr_created` done) resolves to `pr=None`. Resolve PRs by the `Fixes #<n>` body /
`pr_session_mappings` / the GraphQL `closingIssuesReferences` link (a bare `Fixes #N` and a
fully-qualified `Fixes owner/repo#N` both populate it), not only the branch convention — and note
a draft PR is resolved-pending-human, NOT a stall you can clear, because policy forbids
`gh pr ready`/`gh pr merge` (a human decision). A prose "it's done / not blocked" reply does NOT
stop the automated re-nudge; persist the resolved disposition (below), and where the detector is
wrong reconcile it to treat "open draft + green + closingIssuesReferences + report_pr_created" as
resolved-pending-human ([four false-positive classes inflate awaiting_us](../learnings/1789477984124-supervisor-scan-py-four-false-positive-classes-inf.md),
[issue-supervisor nudges completed bot work — mandatory-draft PRs read as "no PR"](../learnings/1789521755042-issue-supervisor-nudges-completed-bot-work-because.md)).

### Disposition gating: both branches, wider vocabulary, and persistence

Even with correct bot labels, the disposition gate has a structural hole: the
`HUMAN_OWNED_DISPOSITION` / terminal guard is wired ONLY into the `ball=='human'` branch
(`we_owe_next_step`), NOT the `ball=='ours'` branch — so a chain explicitly marked
`advisory:maintainer-driving` re-flags every tick the moment a maintainer comments, despite
a docstring promising "a human-owned disposition never reaches needs_nudge"
([stored disposition must outrank per-tick reclassification](../learnings/1786498066587-supervise-issues-scan-py-stored-disposition-must-o.md),
[ignores human-owned disposition on ball==ours](../learnings/1787490423993-supervise-issues-scan-py-ignores-human-owned-dispo.md),
[over-flag is 3 concrete defects](../learnings/1788008486909-supervise-issues-scan-py-over-flag-is-3-concrete-c.md)).
The fix is to move the disposition check to the top of `classify()` before the ball branch
and widen the token set — the real disposition prose (`handed_off:`, `parked:design-gated`,
`human-gated`, `awaiting_human`, `resolved_no_pr`, `held:`, `triaged:PARKED`, `no work owed`,
`two-track`) vastly exceeds the 7-token `HUMAN_OWNED_DISPOSITION`. A separate `TERMINAL_DISPOSITION`
gate must guard the SILENCE/bot-last nudge but NOT `ball=='ours'`, because a genuine human
comment on a closed chain is the fixer's stated re-open trigger. Underlying all of these:
**a stored per-chain disposition must OUTRANK a fresh per-tick classification** — the same
shape as a stored `ballOverride` losing to a recomputed `ball`.

A concrete disposition class the gate must recognize and persist is a **maintainer-owned,
actively-driven** or **explicitly-deferred/parked** chain: one whose newest issue event is the
human assignee's *own* comment (assignee == commenter, human) or a milestone-push/defer, with the
coworker's last action being a posted verdict plus a "do not dispatch fixer" decision. That chain
is *intentionally* quiet, not stuck — a "gone silent — are you blocked?" nudge just makes the
coworker re-conclude "not blocked; the maintainer owns the fix." Measured on slang#8957 (assigned
to jkwak-work, who was actively root-causing it and had explicitly deferred it to Q4), the 12h
supervisor fired that nudge anyway, and the resulting a2a handoff **dead-lettered** on the old
(June-created) triager session's provider-wake — making a benign false nudge indistinguishable
from a real dropped handoff. Suppress such chains and keep them out of the nudge set on subsequent
ticks rather than nudging ([suppress nudges on maintainer-owned / explicitly-deferred chains](../learnings/1789252641916-supervise-issues-suppress-nudges-on-maintainer-own.md)).

Fixing the classifier is only real once the disposition is **persisted**. pull-universe
rehydrates `disposition` (not `github_artifact_url`) each tick, and `we_owe_next_step`
honors it — so writing a HUMAN_OWNED token into `supervisor-state.json` suppresses via the
tested path. The reason the over-flag recurred for eight consecutive ticks: prior ticks
audited the false positives off but never persisted the disposition
([over-flag is 3 concrete defects](../learnings/1788008486909-supervise-issues-scan-py-over-flag-is-3-concrete-c.md)).
Critically, that `supervisor-state.json` is the **Orchestrator's** — the cron runs from the
orchestrator's workspace and rehydrates each chain's disposition from the orchestrator's
prior-tick file (`scan.py`'s `prior.get("disposition")`); live GitHub carries no disposition. A
coworker (triager/fixer) writing `advisory:maintainer-driving` (or any disposition) into its OWN
workspace's `memory/supervisor-state.json` is **inert** — that file is never read by the cron, so
a coworker cannot self-suppress its own re-wake. It must report the disposition UP to the
orchestrator, whose action it is to record it in the authoritative file. The suppressing tokens
(`HUMAN_OWNED_DISPOSITION`, substring-matched on the lowercased disposition) are
`maintainer-driving`, `advisory`, `stood-down`, `human-debate`, `external-pr`, `awaiting-pickup`,
`closed-by-us`; the canonical value is `advisory:maintainer-driving — <who> driving; bot stood
down, no PR` ([coworkers can't self-suppress the re-wake — disposition lives in the Orchestrator's state file](../learnings/1789416255279-coworkers-can-t-self-suppress-the-supervisor-re-wa.md)).

### The safety valve: a surge is an instrument fault, and mass-firing is destructive

The SKILL's `sent_nudges != must_nudge` "fails-loudly" rule is designed to catch
UNDER-nudging real dead sessions; it does not by itself catch an OVER-flagging instrument.
Every surge postmortem lands on the same operational rule: a `must_nudge` an order of
magnitude above normal (115, 181/435, 182, 184, 228, ~250) is an **instrument-recovery
backlog, not a workload** ([115-nudge surge after a naive-datetime crash](../learnings/1787059894213-supervise-issues-scan-py-naive-datetime-crash-froz.md),
[over-flags nudges: four defects](../learnings/1787402461318-supervise-issues-scan-py-over-flags-nudges-bots-ta.md),
[ignores human-owned disposition](../learnings/1787490423993-supervise-issues-scan-py-ignores-human-owned-dispo.md),
[counts bots as humans, 0 genuine](../learnings/1787748905685-supervise-issues-scan-py-counts-bots-as-humans-and.md),
[over-flag is 3 concrete defects](../learnings/1788008486909-supervise-issues-scan-py-over-flag-is-3-concrete-c.md)).
When N coworkers independently report "you nudged my terminal chain again," THAT is the
trigger to fix the classifier, not to re-send. The correct move: HOLD the mass nudges,
recompute ball-direction yourself from `chains[t].comments[-1]` with the full bot set,
drop posted-disposition chains and chains already at 2+ nudges (escalate those), send only
the receipts-verified genuine nudges, deliver the board, and escalate the defect + backlog
to the operator. Never mass-fire (it re-nudges refuted chains and wakes terminal sessions —
a fleet-scale, credibility-damaging, sometimes-unretractable action, since the template
escalates to "answer them on GitHub" and issue-comment writes are 403 for our token), and
never suppress a nudge by prose narration — the `[MUST] no prose suppression` rule is
satisfied by making the classifier emit `action='none'` with an auditable `non_nudge_reason`.
Also verify the surge's root cause first: a naive-datetime crash froze state for ~23h and
the first clean scan produced a 115-nudge recovery backlog (~0 genuine) — the crash's
oversized/lost transcripts (`API Error 400 unexpected end of data`) need operator/transcript
intervention, not a plain wake ([naive-datetime crash](../learnings/1787059894213-supervise-issues-scan-py-naive-datetime-crash-froz.md)).

**Source learnings (18):**
- [A supervisor "non-bot spoke last" nudge can be false: last event was a BOT review](../learnings/1786452477308-approver-false-safe-a-supervisor-a-non-bot-spoke-l.md) — filter by `author.__typename` before taking newest event; a nudge is a claim about state, not state; never let it authorize a write.
- [supervisor nudge: "who spoke last" is not "a human is unanswered"](../learnings/1786453196243-supervisor-nudge-who-spoke-last-is-not-a-human-is-.md) — the definitive postmortem: bot test is a DISJUNCTION (type OR id), two concurrent bot accounts, recency≠obligation, three ordered filters.
- [scan.py: stored disposition must outrank per-tick reclassification](../learnings/1786498066587-supervise-issues-scan-py-stored-disposition-must-o.md) — human-owned/terminal gate must cover both ball branches; N coworkers reporting a re-nudge is the trigger to fix the classifier.
- [scan.py miscounts pr-board-sync bot comments as human, false awaiting_us](../learnings/1786712705926-supervise-issues-scan-py-miscounts-pr-board-sync-b.md) — match the board-sync marker on body; also gate ball on real reviewer reviews, not `REVIEW_REQUIRED`.
- [Supervisor "human spoke last" nudge can misread a do-not-reply bot comment](../learnings/1786798085259-supervisor-human-spoke-last-nudge-can-misread-a-do.md) — re-derive from live GitHub with read-only MCP tools; a person's account can post a do-not-reply automation artifact.
- [supervisor pull-universe dropped comment body, starving the board-sync filter](../learnings/1786798462479-supervisor-pull-universe-dropped-comment-body-star.md) — a filter keyed on a field the producer never emits is inert dead code; confirm with a with/without-field functional diff.
- [Supervisor awaiting_us over-fires: uncredited bot comments + board-sync notices as human](../learnings/1787331439589-supervisor-awaiting-us-over-fires-uncredited-bot-c.md) — our GitHub bot comment isn't credited as our activity; expect 60-70% false positives until the two credit gaps are fixed.
- [Supervisor nudge false-positives on author-managed PRs](../learnings/1787331527549-supervisor-nudge-false-positives-on-author-managed.md) — establish the chain is ours (issue vs PR, bot footprint, requested reviewer) before treating it as blocked.
- [scan.py over-flags nudges: bots is_bot=false + board-sync as human-last](../learnings/1787402461318-supervise-issues-scan-py-over-flags-nudges-bots-ta.md) — four independent classification defects upstream of `action='nudge'`; don't blindly fire when the set jumps fleet-wide.
- [scan.py ignores human-owned disposition on ball==ours](../learnings/1787490423993-supervise-issues-scan-py-ignores-human-owned-dispo.md) — the guard is only in the ball==human branch; move it above the ball branch and widen the token set.
- [scan.py counts bots as humans and disposition-posted as owed](../learnings/1787748905685-supervise-issues-scan-py-counts-bots-as-humans-and.md) — 228 flagged → 0 genuine; recompute ball yourself with the full bot set, drop posted-disposition and 2+-nudged chains.
- [scan.py over-flag is 3 concrete classifier defects, not noise](../learnings/1788008486909-supervise-issues-scan-py-over-flag-is-3-concrete-c.md) — bot set, PR-reviews-in-ball, disposition-on-ball==ours; persist the disposition or it recurs; a real owed-PR backlog hides inside the refrain.
- [scan.py over-flags awaiting_us from non-bot timeline events (shepherd subscribe/mention)](../learnings/1789265524383-supervise-issues-scan-py-over-flags-awaiting-us-fr.md) — ball-direction counts timeline events (subscribed/mentioned/assigned/labeled/board-sync) and `updated_at` as human-last; key only on real IssueComment/PullRequestReview by a non-bot; a subscribed auto-assigned shepherd is not speaking.
- [supervise-issues: suppress nudges on maintainer-owned / explicitly-deferred chains](../learnings/1789252641916-supervise-issues-suppress-nudges-on-maintainer-own.md) — a chain whose newest event is the assignee's own comment or a defer, with a posted "do not dispatch" verdict, is intentionally quiet; nudging it dead-lettered on an old triager session (slang#8957).
- [scan.py: four false-positive classes inflate awaiting_us](../learnings/1789477984124-supervisor-scan-py-four-false-positive-classes-inf.md) — empty maintainer APPROVE, bot-only comments, CODEOWNERS auto-assign, and slangpy draft PRs (`dev/slangpy-fixer/<n>` branch) all misread as awaiting_us; ~90% false-positive rate; one real catch was a comment-edit reply GitHub didn't notify.
- [CLAassistant is typed User, not Bot — it trips the "unanswered human comment" nudge](../learnings/1789521176741-claassistant-is-typed-user-not-bot-it-trips-superv.md) — `user.type=="User"` false-alarms a `type != Bot` heuristic; don't reply, but surface the CLA-not-signed MERGE blocker and escalate the bot-identity CLA decision to the operator.
- [issue-supervisor nudges completed bot work — mandatory-draft PRs read as "no PR"](../learnings/1789521755042-issue-supervisor-nudges-completed-bot-work-because.md) — verify `closingIssuesReferences` + `report_pr_created` + cross-referenced; a draft PR is resolved-pending-human, not a stall (can't un-draft — policy); a prose "it's done" doesn't stop the re-nudge.
- [coworkers can't self-suppress the re-wake — disposition lives in the Orchestrator's state file](../learnings/1789416255279-coworkers-can-t-self-suppress-the-supervisor-re-wa.md) — the cron reads the orchestrator's `supervisor-state.json`, not a coworker's copy; report the disposition up; suppressing tokens listed.
