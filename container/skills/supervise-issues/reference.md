# supervise-issues — reference

Lookup tables, command snippets, and rationale for `/supervise-issues`. The SKILL.md body
states the rules and the procedure; this file holds the detail each step points to.

## Live discovery + the scan script

**`ncl` silently ignores unknown flags** — there is **no** `--thread-prefix`; passing it returns
*all* sessions, unfiltered. List with `--json` and filter the `gh-issue-` prefix **client-side**:

```bash
ncl sessions list --limit 10000 --json \
  | python3 -c 'import json,sys; print(json.dumps([s for s in json.load(sys.stdin)["data"] if (s.get("thread_id") or "").startswith("gh-issue-")]))'
```

**`--limit 10000` is mandatory** — the default is 200, which silently truncates and drops chains
from the universe (the #11802 incident: invisible for days because its session was beyond the
200-row default window).

`ncl sessions list --json` returns `{"id":…,"ok":true,"data":[…]}`; each session row has `id`,
`thread_id`, `container_status`, `last_active`, `agent_group_id`. Exact-column filters DO work
(`--container_status running`); only prefix matching is unsupported. Per-session last activity:
`ncl sessions messages --id <sess> --limit 1 --json`.

**Exhaustive pull (preferred).** Instead of assembling the chains payload by hand, pipe through the
bundled `scripts/pull-universe.sh` which calls `ncl` + `gh` for every chain deterministically:

```bash
bash scripts/pull-universe.sh --state memory/supervisor-state.json \
  | python3 scripts/scan.py > scan-out.json
```

This eliminates the sampling gap — every `gh-issue-*` session is fetched and classified. Closed
issues are filtered out automatically (the script reads `issue_open` from `gh issue view`). Use
this as the default path; fall back to manual assembly only if the script fails (e.g. `gh` auth).

**Enrichment is partial-tolerant (why the board no longer collapses to "N/M PRs").** The batched
GraphQL resolver uses `issueOrPullRequest(number:)`, not `issue(number:)` — a chain can be keyed on
a number that is actually a **PR** (a large fraction of active chains are), and `issue(number:)` is
strict-typed so it 404s on those. A PR-keyed chain's own PR becomes its artifact (`self_pr` →
`chain["pr"]`), which also stops `scan.py::we_owe_next_step` from false-flipping it to
`awaiting_us`. And `gh api graphql` returns **partial success** (HTTP 200 with a valid `data` object
*and* an `errors` array, exiting non-zero) whenever a few aliased numbers miss; `gh_graphql` now
**salvages** that data instead of discarding the whole batch — one unresolved number no longer wipes
PR discovery for the other 49. If you see a data-quality note about low PR-enrichment, the fix path
is here, not a blind re-run.

**Deterministic classification → `scripts/scan.py`.** Don't re-derive the set math and the activity
clock by hand each tick (that re-derivation is what produced the documented silent-2-days,
dark-for-days, and ~16-dropped-chains failures — see *Why these rules exist*). Assemble one JSON
payload and pipe it through the bundled script:

```bash
python3 scripts/scan.py < payload.json > scan-out.json   # python3 scripts/test_scan.py to validate
```

`scan.py` is **pure** (no network/subprocess; an `--now` override exists for tests). Input (stdin) —
its module docstring carries the full contract:

| field | what |
| --- | --- |
| `now` | ISO-8601 (with `Z`) tick time |
| `bot_logins` | optional; default `["nv-slang-bot[bot]", "nv-slang-bot"]` (App + user PAT — both are "us") |
| `state` | prior `supervisor-state.json` (`{}` on first run) |
| `sessions` | the `gh-issue-`-filtered `ncl sessions list` rows |
| `chains` | per `gh-issue-…` thread: `{repo, issue, sessions[], our_last_outbound, our_last_push, pr:{number,state,isDraft,fixes_issue}, comments:[{author,at,is_bot,kind}], pending_ask_user, disposition?}` |

Output: `{rows, summary, state}`. Each row → `state` (`awaiting_us`/`awaiting_human`/`silent`/
`pr_open`/…), `ball` (`ours`/`human`/`none`), `delta` (`new`/`updated`/`same`),
`last_activity_by_us`, `needs_nudge` + `nudge_reason`, `escalate`, `github_artifact`,
`mis_threaded`. Write `state` back to `supervisor-state.json`. The script decides *which* rows need
a nudge and *why* — **you** still compose and thread-key each nudge (Step 3) and make every
judgment call (substantive-comment decisions, escalation wording).

## Resolving a chain's real PR

The fixer branches as `fix/issue-<num>`. Find the PR by head branch, then confirm which issue it
actually fixes from the PR body — the body's `Fixes #N` is the authoritative PR↔issue link, not
the `thread_id`.

```bash
gh pr list --repo <owner>/<repo> --head fix/issue-<num> --state all \
  --json number,isDraft,state,title,headRefName
gh pr view <pr> --repo <owner>/<repo> --json body --jq '.body' \
  | grep -ioE '(fixes|closes|resolves) #[0-9]+'
```

- Body names a *different* issue than the `thread_id` → mis-threaded (reused session). Record the
  chain under the issue the PR actually fixes and flag it.
- `gh pr list --head` returns nothing → the chain has no PR yet (normal pre-PR state, not a
  mismatch). Treat it as a no-PR chain (see disposition table below).

Pull last activity per session with `ncl sessions messages --id <sess> --limit 1`.

## No-PR chain dispositions

A chain with no `fix/issue-<num>` PR is journaled like any other; its GitHub artifact is its
triage/review comment URL, and its `next` field carries the disposition so the operator sees at a
glance whether it is live or parked-and-why.

| Disposition | Meaning | `next` shows | Board behavior |
|---|---|---|---|
| `active: human-debate` | maintainers/reporters discussing our triage | "live debate — maintainers, watching" | lead row — never collapse |
| `stood-down: external-PR` | we triaged; an external contributor owns the impl | "external contributor writing PR — watch for it" | tracked-parked; surface if their PR stalls |
| `advisory: maintainer-driving` | we advised; a maintainer is driving their own fix | "maintainer on #M — no action" | tracked-parked |
| `triaged: awaiting-pickup` | triage posted, nobody has picked it up | "triaged <date>; no owner yet" | tracked-parked; nudge if very old |
| `closed-by-us` | we self-resolved (audit "no change", wontfix-after-analysis) | "audit/analysis terminal — closed by us" | terminal → `_archived` |

Persist each no-PR chain under its `gh-issue-…` key with `{disposition, githubArtifactUrl,
lastObservedActivity}`. Terminal (`closed-by-us`) chains move to `_archived` with a one-line
reason + the comment URL. Invariant: every routed+triaged issue is in the in-flight set OR
`_archived`, never absent from both.

## Classification states + thresholds

`last_activity_by_us` = the most recent of our outbound on the session, our commit/push on the PR
branch, or a comment/review authored by the bot. Direction of the ball: fetch the latest
issue/PR comment + review; if the latest actor is a non-bot with no bot reply/commit/push after
it, the ball is ours.

```bash
gh issue view <n> --repo <owner>/<repo> --json comments --jq '.comments[-1]'
gh pr view <pr> --repo <owner>/<repo> --json reviews,comments
```

| State | Condition | Action |
|---|---|---|
| `dispatched` | < 5 min ago | fresh — leave alone |
| `triaging`/`fixing`/`reviewing`/`pr_open` | < 60 min since `last_activity_by_us` | working — leave alone |
| `awaiting_human` | pending `ask_user_question`, OR bot spoke last and we await a human — **except** the fixer-owned carve-out below | leave alone — blocked on operator/maintainer |
| `awaiting_us` | latest actor is a non-bot, unanswered by us; ball in our court | STUCK regardless of how recent — nudge owning tier now (Step 3); does not wait for any stale window |
| `silent` ≥ 60 min | no `last_activity_by_us`, ball not cleanly on a human | stuck — investigate (container running? last msg answered? `[Refusal]`/`[not actionable]`?) then soft-nudge deepest tier |
| `silent` ≥ 4 h | as above, escalated | escalate via `ask_user_question(timeout: 0)`: extend / re-dispatch from triage / close (out of scope) / abandon |
| `closing` | final `[Report]`, PR opened, or refusal landed | run Step 5 comment-verification before dropping off the table |
| `closed_no_github_comment` | Step 5 found no comment | nudge responsible coworker; escalate if unmet after 2 nudges |

Discriminator for `awaiting_human` vs `awaiting_us`: **who spoke last.** Bot-last =
`awaiting_human`; human-last-unanswered = `awaiting_us`. A `pr_open` chain with a trailing
unanswered human comment is `awaiting_us`, never watch-only.

**Fixer-owned carve-out (bot-last is ambiguous).** Bot-last is not automatically "leave alone."
A bot's last word is either a genuine handoff to a human *or a promise we still owe* ("Will update
here when the PR is up"). So a bot-last chain flips to `awaiting_us` (nudge the fixer) when **all**
hold: a **fixer-role session** owns the thread, **no PR** exists yet (no owed artifact), **no
human-owned disposition** says a human is driving, and it has been **silent ≥ 60 min by us**. This
is computed deterministically in `scan.py::we_owe_next_step` and was the root cause of slang#12002
(fixer edited code, said "waiting on the build monitor", idle-exited, and was never woken because
bot-last read as `awaiting_human` forever). Human-owned dispositions that keep a bot-last chain
parked: `active:human-debate`, `stood-down:external-PR`, `advisory:maintainer-driving`,
`triaged:awaiting-pickup`, `closed-by-us` (matched on the tokens `human-debate`, `external-pr`,
`maintainer-driving`, `awaiting-pickup`, `closed-by-us`, `stood-down`, `advisory`). These
dispositions are **rehydrated by `pull-universe.sh` from the prior tick's state** before
classification — without that, the gate saw `None` every tick and over-flagged (the Tick-86 105→1
reconciliation noise).

**Bounce limb (additive to the carve-out).** The silence-clock condition is *relaxed* when the
owning container is `stopped` **and** its last outbound classed as an error
(`last_outbound_error_class` ∈ `transient`|`unknown`, set by `pull-universe.sh` from the newest
outbound text, mirroring the container's `transient-error.ts`). Such a chain has *bounced* — an a2a
handoff that errored on a transient auth/provider outage (the #12097 shape) — and will not
self-recover, so it flips to `awaiting_us` even inside the fresh window. This is belt-and-suspenders
with the **host-side a2a redrive** (once that ships): the host re-drives bounced handoffs directly in
the session layer; the supervisor is the fallback for bounces that surface as issue chains. `scan.py`
emits the per-row decision as `action` (`nudge` iff `needs_nudge`, else `none`) with an enum
`non_nudge_reason` (`human-owned:<disp>` | `pr-open` | `running` | `fresh-dispatch` |
`awaiting-human` | `terminal`); Step 3 acts on `action`, and `summary.must_nudge` is the
fails-loudly reconciliation target.

## GitHub-comment existence test (Step 5)

A chain is observably closed when the originating issue/PR carries a 5-bullet markdown comment
authored by the install's bot (or the maintainer account the chain uses), OR a linked PR
(`Fixes #N` / `Closes #N`) whose description carries the rolled-up summary.

```bash
curl -sS -H "Authorization: token $GH_APP_TOKEN" \
  "https://api.github.com/repos/<owner>/<repo>/issues/<num>/comments?per_page=20" \
  | jq -r '.[] | select(.body | startswith("- **Status:**") or contains("[Report]")) | .id'
```

For `pr_open`, the PR description IS the comment — verify it exists and contains `Fixes #N` /
`Closes #N`. If the PR exists but the issue link is missing, nudge the fixer to amend the PR
body, not to add a separate issue comment.

Nudge body when absent (send to the responsible coworker, not orchestrator):

> [Supervisor — gh-issue-X/Y-N] Chain reached `<state>` but no GitHub comment found. Post the
> 5-bullet (status / link / verdict / next-action / blocker) on
> https://github.com/X/Y/issues/N before this chain closes. Reply with the comment URL once posted.

Track `{githubCommentRequestedAt, githubCommentUrl}`; if still missing after 2 nudges, escalate
via `ask_user_question(timeout: 0)`: post on coworker's behalf / close anyway / investigate.

## Superseded-PR postmortem (Step 7)

Detect: an issue closed by a PR that is **not** our chain's PR (or our PR closed un-merged while a
sibling merged). `closedByPullRequestsReferences` is the container-proven field (`timelineItems`
is NOT a valid `gh issue view` field).

```bash
gh issue view <num> --repo <owner>/<repo> \
  --json state,stateReason,closedByPullRequestsReferences \
  --jq '{state, stateReason, closers: [.closedByPullRequestsReferences[].number]}'
# closers contains a PR != ours, OR ours CLOSED-unmerged while another merged → postmortem.
# closers == [ours] or empty → no postmortem.
```

Fires once per chain (gate on `supervisor-state.json` `postmortem.done`). Skip for our own merged
PRs and for `not_planned` closes without a PR (maintainer wontfix — note and close normally).

1. **Analyze the gap.** Compare diffs (`gh pr diff <ours>` vs `gh pr diff <theirs>`); be specific
   about what the merged fix did that ours didn't (root-cause, smaller patch, a test we missed).
   If the merged PR overlaps ours heavily, @-mention the author on their PR to ask what gap ours
   would have had — capture the reply into the takeaway.
2. **`append_learning`** titled `postmortem: <repo>#<num> superseded by PR #<theirs>` — issue, both
   approaches + links, the concrete delta, author feedback, and an actionable transferable rule.
3. **Close our draft with a pointer** linking the learning + superseding PR:
   `gh pr close <ours> --repo <owner>/<repo> --comment "Superseded by #<theirs> … Postmortem captured as <title>."`
4. **Record** `postmortem = {done, supersededByPr, learningTitle, at}` and drop the chain.

## Worktree GC (Step 8)

Disk-pressure check runs every tick before the per-chain pass. The worktree volume is mounted
read-only at `/workspace/extra/ephemeral` (host `/ephemeral`). Do not trust `df -h /workspace` —
that is a different, always-healthy disk.

```bash
df -BG --output=avail /workspace/extra/ephemeral | tail -1 | tr -dc '0-9'   # GB free
# Reap candidates: EVERY worktree in EVERY tier, name-agnostic. A worktree's .git is a
# FILE (gitdir pointer); a base clone's .git is a DIR — so `-name .git -type f` finds
# exactly the worktrees and never the base checkouts. Do NOT use a `wt-*` glob: fixer
# worktrees are named `wt-slang-<n>`, but reviewer ones are freehand (`slang-<n>-verify`,
# `slang-prNNNNN-r2`, `slang-clarity-*`, `wt-<n>-review`) and a glob silently misses them.
#
# Measure BOTH: the whole worktree (reporting only) and `build/` (what a reclaim
# actually deletes). Reporting the whole-worktree `du` as the reclaimable amount is
# what let the GC claim the target was met after freeing a fraction of it.
# Emits: <size_gb>\t<build_size_gb>\t<dir>, biggest build first.
find /workspace/extra/ephemeral/prod-groups -mindepth 2 -maxdepth 3 -name .git -type f \
  -not -path '*/.*/*' 2>/dev/null | sed 's#/\.git$##' | while read -r wt; do
    tot=$(du -sk "$wt" 2>/dev/null | cut -f1)
    bld=0; [ -d "$wt/build" ] && bld=$(du -sk "$wt/build" 2>/dev/null | cut -f1)
    awk -v t="${tot:-0}" -v b="${bld:-0}" -v d="$wt" \
      'BEGIN { printf "%.1f\t%.1f\t%s\n", t/1048576, b/1048576, d }'
  done | sort -rn -k2
```

- Surface `worktree-vol: <N>GB free` in every board rollup.
- **Every tick**: run the GC scan. Resolve worktree issue+PR states, pass them to
  `scripts/worktree-gc.py`, and dispatch save-then-remove for the REAP set plus build-only reclaim
  for anything the script puts in `reclaim`. This is lightweight (a few
  `gh` calls) and prevents closed-issue worktrees — and dead-open build trees — from accumulating
  between pressure events.
- **The script's `reclaim` list widens with pressure — always dispatch the whole list.** Below
  `PRESSURE_GATE_GB` it holds STALE-OPEN (idle > 14d) builds; below `CRITICAL_GATE_GB`
  (`summary.critical: true`, ENOSPC-imminent) it also includes **idle KEEP builds** — open PRs
  touched within 14d but idle > `CRITICAL_IDLE_DAYS` with no running session, i.e. the 7 GB fixer
  builds a routine tick can't touch. These are still **build-only** reclaims: dispatch
  `rm -rf <dir>/build` to the owning coworker (below); the worktree, branch, and PR survive and the
  coworker rebuilds on resume. Do NOT hand-judge which to spare — the script already excluded
  running sessions and too-fresh chains.
- **Free < 10 GB** → disk pressure: escalate to the operator immediately in addition to the
  routine GC. If the reclaim list is empty or too small to clear the pressure, the escalation **must**
  say so and point at the operator-only docker reclaim (below) — worktrees are usually not the
  largest lever, and silence reads as "nothing more to reclaim" when there is.

### Operator-only reclaim (escalate, never attempt)

The worktree GC is the **only** disk lever you can pull from inside the container. The bigger one —
the docker data-root at `/ephemeral/docker` (per-group image layers + build cache) — is
`drwx--x--- root`, so a container **cannot `du`, list, or prune it**. On this host the docker
footprint has been the dominant consumer (tens of GB reclaimable at a time) and an unattended fill
there once crashed the host with `ENOSPC`. A daily host timer (`nanoclaw-docker-gc.timer`,
`~/.config/nanoclaw/docker-gc.sh`) already prunes **dangling images + build cache** (never `-a`, so
tagged per-group `ag-*` images survive), but that timer cannot free tagged-but-unused images — only
an operator can, with a deliberate `docker image prune -a`.

So when `worktree-vol` free < 10 GB **and** the reap set can't clear it, the operator escalation must
name this explicitly, e.g.:

> Disk pressure: `worktree-vol` NN GB free, worktree reap {empty | frees only ~MM GB}. The remaining
> reclaim is docker images/build-cache under `/ephemeral/docker`, which I cannot reach from the
> container. The daily `nanoclaw-docker-gc.timer` handles dangling images + cache; freeing more needs
> a host-side `docker image prune -a` (operator-only — verify no idle group needs its `ag-*` image
> first). Last ENOSPC there crashed the host.

Discover the reap set from disk across **all tiers** (orphans outlive their session). Two things
per worktree from the `find` above:

- **Issue number** = the first ≥ 4-digit run in the dir basename (`basename "$wt" | grep -oE
  '[0-9]{4,}' | head -1`). This survives every naming style — `wt-slang-11982`, `slang-11544-verify`,
  `slang-pr11511-r2`, `wt-12037-A`. A worktree whose name yields **no** number is the **NO-PR** case
  below → wake the owner to confirm, never blind-delete.
- **Owning coworker** = the tier folder the path lives under (`prod-groups/<folder>/…`):
  `slang-reviewer/…` → dispatch to **slang-reviewer**, `slang-fixer/…` → slang-fixer, `slangpy-*`
  likewise. It is **not always a fixer** — reviewer worktrees are the ones the old `wt-*` glob missed.

Resolve each to **both** its issue state (`gh issue view <num> --json state`) and PR state (`gh pr
list --head fix/issue-<num>` for slang fixer branches, or the dir's own branch for reviewer/slangpy).
For an OPEN PR also read its idle age (`gh pr view <pr> --json updatedAt` → days since last touch).
**Don't judge the tier by hand — feed the resolved set to `scripts/worktree-gc.py`** (pure, tested
by `test_worktree_gc.py`), which owns the thresholds and the pressure math in one place:

```bash
# payload: {free_gb, running_dirs:[...],
#           worktrees:[{dir,size_gb,build_size_gb,has_build,issue_state,pr_state,pr_idle_days},...]}
# size_gb is the whole worktree and is reported only; build_size_gb (from the `du -sk
# "$wt/build"` above) is the ONLY figure the reclaim math uses, because build/ is all a
# reclaim deletes. Omit build_size_gb and it counts as 0 — the script then under-projects
# and keeps selecting, which is the safe direction.
python3 scripts/worktree-gc.py < payload.json > gc-out.json   # → {tiers, reclaim, summary}
```

`summary.projected_free_gb` is a LOWER BOUND, not a result (`projection_is_lower_bound:
true`). **After each build deletion, re-measure free space with `df` and decide on the
MEASURED number** — stop when measured free ≥ `TARGET_FREE_GB`, and if the list runs out
before that, say so and escalate rather than reporting the target met. Trusting the
projection is exactly how a run stopped deleting while the volume was still near ENOSPC.
`summary.unmeasured_builds` > 0 means `reclaim_gb` understates the total further still.

`summary.projected_sufficient_count` is how far down `reclaim` the projection *expects* to
get. It is a hint, **not a limit** — dispatch past it whenever measured free is still short.
`select()` used to enforce that number by truncating the list, which contradicted the rule
above: the executor stops on measured `df`, so any estimate that ran optimistic left it out
of list with eligible builds it was never handed, escalating for disk it already had the
answer to.

The four tiers it returns (semantics, not numbers — the numbers live in the script):

- **REAP** = PR `MERGED`/`CLOSED`, OR issue `CLOSED` (work done or abandoned, even if a draft PR
  lingers). → save-then-remove (below); this is the only path that pushes `wip/reap/<branch>`.
- **KEEP** = issue `OPEN` + PR `OPEN` recently active, or a `running` session. Leave untouched.
- **STALE-OPEN** = issue `OPEN` + PR `OPEN` but idle beyond the script's threshold with no running
  session. Under disk pressure the script lists these in `reclaim` (oldest-PR-first, only enough to
  clear the pressure). → **build-only reclaim**: dispatch `rm -rf /workspace/agent/<dir>/build`.
  `build/` is gitignored regenerable cmake output — source, branch, uncommitted work, and the PR are
  untouched; the coworker re-runs cmake on resume. **NEVER `git worktree remove` a STALE-OPEN chain**
  (the PR may still land). If it later goes REAP, it flows through save-then-remove.
- **NO-PR** = issue `OPEN` with no PR found (or no number in the name) → wake to confirm, never
  blind-delete.

Dispatch only the tiers that need action: every `REAP` (save-then-remove), and every worktree in
`reclaim` (build-only). `KEEP` / `NO-PR` need no build churn.

`git worktree list` from a base clone shows every worktree as `prunable` over the read-only mount
(their live sessions live elsewhere) — `prunable` is **not** a reap signal (R8); reap is decided by
issue+PR state only.

Dispatch one a2a per worktree on its canonical thread (R5, R8). `<dir>` is the worktree's own
directory name (whatever it's called); `<base-clone>` is the tier's main checkout the worktree was
derived from (`slang` for slang-*, `slangpy` for slangpy-*) — remove from the base clone, never from
inside the worktree:

> [Supervisor — worktree GC — gh-issue-X/Y-N] Issue #<num> is `<issue_state>`; PR #<pr> is `<pr_state>`; reclaim `<dir>` (~<size>G).
> **Save-then-remove:** `cd /workspace/agent/<dir>`; if `git status --porcelain` non-empty or
> ahead of upstream → `git add -A && git commit -m "wip(reap): <branch> @ <sha>" && git push -u origin HEAD:wip/reap/<branch>`
> (resume via `git worktree add <dir> wip/reap/<branch>`). THEN
> `git -C /workspace/agent/<base-clone> worktree remove --force /workspace/agent/<dir> && rm -rf /workspace/agent/active-work/<slug>`.
> Reply 'gc done <freed>G', or 'active' to keep it.

For each worktree `scripts/worktree-gc.py` puts in `reclaim` (STALE-OPEN under pressure), the
dispatch reclaims the regenerable build only — the worktree, branch, and PR stay. Quote
`build_size_gb`, never the worktree size: the coworker is being asked to delete `build/`, and
naming the larger number both misstates the ask and inflates the reclaim you expect back.

> [Supervisor — build-reclaim — gh-issue-X/Y-N] Issue #<num> `OPEN`, PR #<pr> `OPEN` but idle <days>d; reclaiming regenerable `build/` in `<dir>` (~<build_size>G of a <size>G worktree) under disk pressure.
> Run `rm -rf /workspace/agent/<dir>/build` (gitignored cmake output — source, branch, uncommitted
> work, and the PR are untouched; rebuild on resume). Do **not** remove the worktree.
> Reply 'reclaimed <freed>G', or 'active' to keep the build.

After each `reclaimed` reply, re-run the `df` above. Continue down the `reclaim` list until the
MEASURED free reaches `TARGET_FREE_GB` or the list is exhausted — never stop on
`projected_free_gb`.

Save-then-remove is mandatory — even merged-PR worktrees often hold untracked files that
`remove --force` would destroy (reviewer worktrees in particular carry ad-hoc review notes). Track
`gcRequestedAt` per worktree; if still on disk after 2 clean dispatches, escalate with the `du`/`df`
numbers + the worktree list. A woken long-idle coworker may reply `Error: No conversation found with
session ID …` on its first turn — this specific stale-continuation case self-heals (the runner
clears the stale continuation and the host re-delivers); treat as "in progress, recheck next tick,"
not as `gc done`. **This is the only "self-healing" error** — do not generalize it: a handoff that
bounced on a transient auth/provider outage surfaces as a `stopped` container with an error-class
last outbound and is a **nudge row** (see the bounce limb above), not a self-healer to wait out. The
host-side a2a redrive (when deployed) handles bounces in the session layer; the supervisor still
nudges the ones that surface as chains.

## CI status + rebase nudge

The orchestrator reads CI from its own container — `gh` works there with the injected token, so
there is no dependency on the babysitter (which runs its own separate rerun/eviction job). Our PRs
sit in **draft** and drive CI by **`workflow_dispatch`**, so the signal is the *latest run for the
`fix/issue-<num>` branch*, considering **both events but ignoring `skipped`** (a draft PR's
auto `pull_request` run is often `skipped` and would otherwise mask the real dispatch result).

```bash
# 1) latest non-skipped CI run for the branch (both events)
run=$(gh run list --repo <owner>/<repo> --branch fix/issue-<num> --workflow ci.yml --limit 20 \
  --json databaseId,event,status,conclusion,createdAt \
  --jq '[.[] | select(.conclusion != "skipped")] | sort_by(.createdAt) | last')
# 2) only when that run is a failure, is the failing job the yield gate?
gh run view <databaseId> --repo <owner>/<repo> --json jobs \
  --jq 'any(.jobs[]; .name == "wait-for-human-priority" and .conclusion == "failure")'
# 3) is the green PR behind main?
gh pr view <pr> --repo <owner>/<repo> --json mergeStateStatus --jq .mergeStateStatus
```

### The yield mechanism

The bot throttles its own draft CI: a `wait-for-human-priority` gate job runs first, and when a
human PR's CI (or an older bot run) is active it **yields** — the run ends with
`conclusion: failure` on purpose (a "Stop yielded bot CI" step does `exit 1` and annotates
`priority-gate-yielded`). There is no `yielded` conclusion; a yield is a `failure` whose failing
job is the gate. The gate only applies to the bot's own `workflow_dispatch` runs — a
`pull_request` run or a ready-for-review PR is treated as human and never yields. A dedicated
`retry-yielded-bot-ci.yml` (hourly, ages out at 12h) reruns yielded runs automatically, so the
supervisor must **show but never act** on a yield.

### CI cell legend + nudge decision

| Latest run / signal | How to tell | CI cell | Nudge? |
|---|---|---|---|
| yielded | latest run `failure` AND failing job is `wait-for-human-priority` | ⏸️ yielded | no — auto-retry owns it |
| running | latest run `in_progress`/`queued` | ⏳ running | no — wait |
| green | latest run `success`, `mergeStateStatus` not `BEHIND` | ✅ green | no |
| green but behind | `success` AND `mergeStateStatus=BEHIND` | ✅⤵️ behind | yes → rebase |
| failed/cancelled, stale | latest run `failure` (non-gate) or `cancelled`, AND same `databaseId` as last tick | ❌ stale | yes → rebase |
| failed/cancelled, fresh | bad conclusion but a newer `databaseId` than last tick | ❌ (recheck) | no — already re-dispatched |
| no run / only skipped | nothing dispatched yet | ⚪ — | no |

Store the latest run `databaseId` per chain in `supervisor-state.json`; "stale" = the bad run is
the *same id* we saw last tick (nobody re-dispatched). The rebase nudge body is in SKILL.md Step 3.
The remedy is always rebase/merge master — never `gh run rerun` from the supervisor (R9).

## 11-column board spec

Canonical schema, rendered every tick — the same the scheduled-task prompt pins:

```
Issue#(link) | Title (short) | Orch | Triage | Fixer | Rev | Github | CI | Status | State/Disposition | Next
```

- **Orch / Triage / Fixer / Rev** are clickable session deep-links
  (`<dashboard-base>/#/cw/<folder>/s/<sessionId>`; `—` if no session for that tier). Build
  `<folder>` from the session's real `agent_groups.folder` (resolve live via `ncl sessions list`
  or `ncl groups get`), never from the coworker-type name — folders and type names can diverge and
  a guessed folder 404s.
- **Github** is always a live hyperlink to the artifact — the PR for PR-bearing chains, or the
  triage/review comment URL for no-PR chains. Never a bare count or `—` when an artifact exists.
- **CI** is the cell from the legend above (✅ / ✅⤵️ / ❌ / ⏳ / ⏸️ / ⚪); `—` for no-PR chains.
- **Status** and **State/Disposition** are distinct columns — do not duplicate one into the other:
  - **Status** = the *latest observed signal*, free-text with **actor-role + what + time** — e.g.
    "maintainer APPROVED 17:08Z", "non-draft; reviewer round-trip 11:16Z→bot 11:19Z (bot-last)". It
    is the human-readable "what just happened." (Use role words — maintainer / reviewer / external /
    bot — in the spec; live ticks may name the real GitHub login.)
  - **State/Disposition** = the *canonical state value* the row classifies to — `pr_open`,
    `awaiting_us`, `in review`, `APPROVED`, `silent`, or a no-PR disposition (`active:human-debate`,
    `stood-down:external-PR`, `advisory:maintainer-driving`, …). It is the machine-comparable state
    the delta and the nudge logic key on.
  - If a row has the *same* token in both cells (e.g. both `pr_open`), the Status cell is unfilled —
    replace it with the real latest signal (actor + timestamp), never echo the state.
- One row per chain, prefixed with its delta tag (🆕 / 🔼 / •); sort 🆕 and 🔼 to the top.
- The 6-column `# | repo | tier | github | state | next` shorthand is non-conformant — it hides
  which tier owns the chain. Do not use it.

Worked example:

```
| #    | Title        | Orch | Triage | Fixer | Rev | Github              | CI    | Status                              | State/Disposition  | Next                              |
| ---- | ------------ | ---- | ------ | ----- | --- | ------------------- | ----- | ----------------------------------- | ------------------ | --------------------------------- |
| 1349 | parser crash | [o]  | [t]    | —     | —   | [triage cmt][c1349] | —     | maintainer design proposal 21:16Z   | active:human-debate| 🔼 live debate — watching         |
| 1367 | bad codegen  | [o]  | [t]    | [f]   | [r] | [PR #1386][p1386]   | ✅⤵️  | green but BEHIND main 14:02Z        | awaiting_us        | 🔼 nudged fixer: rebase master    |
| 1372 | wrong types  | [o]  | [t]    | [f]   | —   | [PR #1390][p1390]   | ❌    | CI failed 12:52Z, same run 2 ticks  | awaiting_us        | 🔼 nudged fixer: CI stale, rebase |
| 1380 | infer fixity | [o]  | [t]    | [f]   | —   | [PR #1393][p1393]   | ⏸️    | yielded to human CI 11:19Z          | pr_open            | • auto-retry owns it, watch       |
| 1441 | doc typo     | [o]  | [t]    | —     | —   | [triage cmt][c1441] | —     | external contributor opening PR     | stood-down:ext     | • external PR incoming             |

[c1349]: https://github.com/acme/widget/issues/1349#issuecomment-...
[p1386]: https://github.com/acme/widget/pull/1386
[p1390]: https://github.com/acme/widget/pull/1390
[p1393]: https://github.com/acme/widget/pull/1393
[c1441]: https://github.com/acme/widget/issues/1441#issuecomment-...
```

**Collapsing is a delta-display convenience in chat only, never a coverage reduction in the
file.** Every live chain appears as a full 11-column row in `reports/issue-chain-tracker.md` each
tick; the inline chat board may fold unchanged `•` rows into one trailing line
(`• 7 chains unchanged: #1372, #1380, …`) after the file is written. 🆕 NEW rows and
`active: human-debate` rows are never collapsed in either place; parked dispositions
(`stood-down`/`advisory`/`triaged`) may fold but ride their disposition (not a bare `•`) in the
summary.

## Delivery (Step 6)

The main operator destination is the channel named `orchestrator-dashboard` (the operator's
dashboard view). A delegated supervisor that is not the orchestrator uses `to="parent"` instead.

- `send_message(to="orchestrator-dashboard", text=<the board>)` — inline board is the primary
  deliverable.
- The on-disk `reports/issue-chain-tracker.md` is the backup; optionally
  `send_file(to="orchestrator-dashboard", path="reports/issue-chain-tracker.md", text=<one-line digest>)`.
- Post the inline board FIRST, then the file, so an attachment failure can never swallow the
  board. Retry `to="orchestrator-dashboard"` on a "multiple destinations" error.
- Run the whole tick in one session — one session → one complete board → one delivery.

5-bullet summary that follows the inline table:

- **Status:** {n} chains in flight, {nudged} nudged, {escalated} escalated; `worktree-vol: <N>GB free`
- **Link:** dashboard timeline filtered to `gh-issue-*` threads
- **Verdict:** healthy / degraded / blocked
- **Next-action:** wait for cron / await operator decisions / re-dispatch chain X
- **Blocker:** threads with no clear path forward (list 3 max, one line each)

If nothing changed since the last tick, say so in one line and skip the table.

## Why these rules exist (de-identified rationale)

Each rule traces to a recurring failure pattern. The pattern is what matters; the specific
incidents live in operator memory.

- **R1 — live discovery.** A tick that "refreshed only the rows it already had" from the tracker
  silently dropped a batch of newly-minted chains: each had a live `gh-issue-` session but was
  never in the tracker, so refreshing-known-rows never saw it. Inheriting the universe from the
  tracker is the bug; live session enumeration unioned with the state keys is the fix. This is
  independent of `new_session: true` (which is correct) — the fresh session is exactly why live
  rediscovery is mandatory.
- **R2 — key-based dedup.** A chain mentioned in a narrative/awareness note before its session
  existed had its issue number present as a substring in the state file; a later tick treated the
  substring as "already journaled" and never gave the chain a top-level key, so it was never
  artifact-checked or nudged while it aged. Dedup is a set operation on keys, never a substring
  scan of prose. An "awareness: session pending" note is re-evaluated every tick and is promoted
  to a tracked chain the instant a session exists.
- **R3 — resumable artifact / no-PR chains.** Equating "trackable" with "has a `fix/issue-<num>`
  PR" made triaged-then-handed-off chains (external contributor, maintainer-driving, live human
  debate, self-closed audit) vanish from both the board and the state file — so when a handoff
  later stalled, nobody resurfaced it. Every routed+triaged issue has a GitHub artifact (its
  triage comment) and belongs on the board with a disposition.
- **R4 — activity by us.** Computing "silent" off the chain's last touch of any kind let a dark
  chain look freshly active: every time a maintainer asked "why no progress?", a last-touch clock
  was pushed forward while our owning session was dead. The clock only resets on our own output.
  A fresh non-draft PR with same-day human activity can still be fully dark on our side —
  `awaiting_us` catches it without waiting for any stale window.
- **R5 — thread-keyed routing.** `in_reply_to` (routing Layer 1) overrides `thread_id`, and
  coworker sessions are reused across issues — so a nudge for issue N routed by the coworker's
  last inbound landed in a different issue's session, which then did N's work under the wrong
  thread and stamped a resulting PR with the wrong issue. Always key by the chain's canonical
  `thread_id`; never add `in_reply_to`.
- **R6 — closest-to-the-state authorship.** Relaying a comment second-hand drops fidelity and
  creates recipient ambiguity ("did the supervisor read the code or just the `[Report]`?"). The
  coworker holding the verdict authors the post; the supervisor enforces, never substitutes.
- **R7 — single delivery.** A bare `send_message`/`send_file` with no `to=` errors on "multiple
  destinations" and the board silently never lands. Re-deriving the table in-context yields an
  incomplete/stale board; fanning out across sessions yields many partial boards. Deliver once,
  `to="orchestrator-dashboard"`, verbatim from the on-disk tracker, from one session.
- **R8 — worktree ownership.** Worktrees live in each fixer's filesystem (read-only-mounted into
  the supervisor); a cross-namespace `git worktree remove` has killed active builds. From the RO
  mount nearly every worktree shows `prunable` — a wrong-namespace artifact, not a reap signal.
  Decide and dispatch to the owning fixer (a `stopped` session wakes on the inbound); reap by `gh`
  issue state + PR state (issue CLOSED → reap regardless of PR state).
