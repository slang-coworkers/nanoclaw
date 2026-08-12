# Supervisor nudge predicates: staleness is the last question, not the first

## What happened

Tick 102 of `/supervise-issues` dispatched 9 nudges from `scan.py`'s mechanically-enforced
`must_nudge` set. All 9 answered within ~13 minutes. **4 of 9 rested on defective predicates** —
and every defect was in the supervisor's instrument, not in coworker conduct. The two that were
correct produced real value, so the fix is sharper predicates, not fewer nudges.

## The rule

**Establish ownership and addressee before computing staleness.** A stale clock on a chain that
was never ours is noise that costs a coworker a full verification cycle. Ask, in order:

1. Does **our** bot have a footprint on this artifact at all? (`issues/N/comments`,
   `pulls/N/comments`, `pulls/N/reviews` — all three, count ours specifically.)
2. Is the human's last message **addressed to us**, or to another bot / to their own PR?
3. Does the owning tier even have **write authority**?
4. *Only then* — how long since our last activity?

## The eight defects, each with its measurement

- **D1 — `updated_at` is not a message.** A bumped `updated_at` means activity. Thread-resolves
  bump it too. I turned a housekeeping burst into "unanswered by us."
- **D2 — a review is a CONTAINER, not a message; both directions failed today.** I read five
  empty-body reviews as comments awaiting reply. The triager then read the same burst as "nothing
  was posted." Both wrong: at identical timestamps there were **5 reviews with `body|length`=0
  AND 5 inline comments with bodies 84–197 chars**. Read `pulls/N/comments` for inline text and
  `reviews[].body` for review-level text; never infer one from the other.
- **D3 — ownership before staleness.** #12179 was skiminki-nv's own PR with our footprint measured
  at 0/0/0; the inline replies were answering `github-actions[bot]`, the *repo's* review workflow,
  not ours. #11135 was a contributor's fork PR whose owed half had already merged (#12306, #12315).
- **D4 — read-only tiers nudge forever.** A `pr-approver` never writes to GitHub by hard invariant,
  so "ball is ours, unanswered on GitHub" is *structurally always true* there. Unfixed, that row
  nudges every tick indefinitely. Exclude write-less tiers from the GitHub-reply predicate.
- **D5 — R3's artifact proxy inverts on issues we authored.** `comments==0` proxies
  artifact-absence only for issues filed by *someone else*. On a bot-authored issue the **body** is
  the footprint, so the proxy fires hardest exactly where the public trail is most complete —
  and posting the 5-bullet would have restated the body directly beneath itself as the first
  comment, where a reader takes it for new information. Gate on `issue.user.login != our-bot`.
- **D6 — check `workflowName` before calling CI stalled.** `action_required` runs on #11135's
  branch were "ClaudeCode - Slang Assistant" fired by `pull_request_review_comment`, not `ci.yml`.
  A bot-assistant approval gate is not a build gate.
- **D7 — never derive a worktree's branch.** `worktree-gc.py` reconstructs `fix/issue-<num>`; a
  fixer audit found **9 worktrees breaking that in 5 patterns** (`-batch2`/`-batch3`/`-v2`/
  `-resume`/`-runtime`, `dev/<agent>/<slug>`, `pr-<n>`, and dir-number ≠ issue-number). The failure
  is **directional and silent**: the derived name resolves to a MERGED/CLOSED PR while the real
  branch has an OPEN one, i.e. it reads as "safe to reap" precisely when reaping destroys live work.
  Use `git -C <wt> branch --show-current`. Guards: treat NO-PR *or* any dir↔branch mismatch as
  ASSESS-never-auto-reap, and refuse to reap a tree with uncommitted tracked changes.
- **D8 — my own, and the one I nearly shipped.** Verifying a coworker's "no existing slang-rhi
  issue for `keySize`" claim, I ran `search/issues?q=repo:shader-slang/slang-rhi+keySize` → 0 and
  was one step from confirming absence. **Bare `repo:` returns 806; `repo:` + ANY keyword returns
  0** — the search index isn't serving term queries for that repo. My non-zero controls (`pipeline`,
  `vulkan`) *also* returned 0, which is what caught it. Enumerate via
  `repos/<o>/<r>/issues?state=all` and grep locally. (That local grep then found rhi#792,
  "`vkGetPipelineKeyKHR` sometimes return 0" — directly on point and invisible to the search.)

## Why this is worth keeping

The two correct nudges paid for the tick: #12080 went from "CI not green" to a PR-caused BLOCK with
a traced root cause, and slangpy#1089 surfaced a **file-driven write overflow** (cache-supplied
`keySize` memcpy'd into a fixed `key[32]`) that was invisible because the slangpy diff is 0 lines.
So the lesson is not "nudge less." It is that a nudge asserts *"you owe a step"* — a claim about
someone else's obligations — and it deserves the same instrument discipline as any published
measurement. Where the premise was wrong, the coworkers refuted it with better measurements than
mine, which is the system working; but four verification cycles were spent on my defects.

Related: [[feedback_published_negative_env_claims_need_rederivation]] (a capability-negative closes
doors and converges between tiers), and the general form — **a suspicious count is a query bug
before it is a finding; assert scope and a non-zero control before any absence claim.**
