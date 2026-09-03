#!/usr/bin/env python3
"""supervise-issues deterministic scan core.

The /supervise-issues skill (SKILL.md) is judgment-heavy prose, but a handful of
its rules are *pure computation* that the LLM kept getting wrong tick-to-tick —
each one has a documented production failure (#11613 silent 2 days, #11594 dark
for days, ~16 chains dropped 2026-06-05). Those are exactly the parts that
belong in tested code, not re-derived in-context every 6 hours:

  * NEW-chain discovery   = {live gh-issue threads} - {journaled keys} - {_archived keys}
  * last_activity_by_us   = max(our outbound / our commit-push / our bot comment)
  * direction-of-the-ball = latest actor bot vs non-bot, any bot reply after?
  * state classification   = awaiting_us / awaiting_human / silent / pr_open / ...
  * PR<->issue resolution   = trust the PR body's `Fixes #N`, not the thread_id

This script is PURE: it reads ONE JSON blob on stdin (the agent fetches all the
live data via `ncl` + `gh` and assembles it — see SKILL.md §1), classifies every
chain deterministically, and writes the result + the next supervisor-state.json
to stdout. No network, no subprocess, no clock surprises (an `--now` override is
accepted for tests). The LLM keeps every *judgment* call (nudge wording,
substantive-comment decisions, escalation) — it just acts on a trusted table
instead of recomputing the set math and the activity clock by hand.

INPUT (stdin), a JSON object:
{
  "now": "2026-06-26T10:00:00Z",            # optional; defaults to --now or error
  "bot_logins": ["nv-slang-bot[bot]", "nv-slang-bot"],   # optional, sensible default
  "state": { ...prior supervisor-state.json... },        # last tick; {} on first run
  "sessions": [                              # ncl sessions list --json -> .data
     {"id","thread_id","container_status","last_active","agent_group_id","group_folder"?,
      "cost_status"?}                        # 'ok'|'warn'|'escalated'|'stopped'|'unknown';
                                              # stamped by pull-universe.sh via `ncl cost-cap
                                              # status --session <id>`. Absent/'unknown' means
                                              # no signal — NOT treated as cost_stopped.
  ],
  "chains": {                                # per gh-issue-<owner>/<repo>-<num> thread, what the agent fetched
     "gh-issue-shader-slang/slang-11487": {
        "repo": "shader-slang/slang", "issue": 11487,
        "sessions": ["sess-..."],                         # session ids on this thread
        "our_last_outbound": "2026-06-20T..Z"|null,       # newest outbound BY US on any of those sessions
        "pr": {"number":1234,"state":"OPEN","isDraft":true,"fixes_issue":11487,"body_has_fixes":true}|null,
        "issue_open": true,
        "comments": [                                      # issue+PR comments/reviews, any order
           {"author":"andersjel","at":"2026-06-22T..Z","is_bot":false,"kind":"comment"},
           {"author":"nv-slang-bot[bot]","at":"2026-06-21T..Z","is_bot":true,"kind":"review"}
        ],
        "our_last_push": "2026-06-20T..Z"|null,           # newest commit/push on the PR branch BY US
        "pending_ask_user": false,                        # an open ask_user_question for this thread?
        "disposition": "active:human-debate"|...|null     # agent-supplied for no-PR chains (§1a), optional
     }, ...
  }
}

`is_bot` per comment is authoritative when present; otherwise the author is
matched against bot_logins. Either identity (App `…[bot]` or user PAT) counts as
us — mirrors the host-side own-bot guard.

OUTPUT (stdout), a JSON object:
{
  "now": "...",
  "rows": [ {thread,repo,issue,pr,state,ball,delta,last_activity_by_us,
             needs_nudge,nudge_reason,action,non_nudge_reason,escalate,
             github_artifact,disposition,last_outbound_error_class,
             stopped_session_count,mis_threaded,needs_cost_notice,
             cost_notice_session,cost_notice_folder,cost_notice_link} ],
  # cost_notice_* are populated only on a cost_stopped row (the specific
  # blocked session id, its coworker folder, and the dashboard session-mode
  # deep-link "#/cw/<folder>/s/<session>"), empty strings otherwise.
  # action = 'nudge' iff needs_nudge else 'none' (strict 1:1; no 'suppress').
  # non_nudge_reason = enum-like token on 'none' rows (human-owned:<disp> |
  #   pr-open | running | fresh-dispatch | awaiting-human | cost-stopped |
  #   terminal), else null.
  # state can be 'cost_stopped': a session on the chain hit its Tier-2 cost
  #   ceiling and is hard-blocked pending a human Continue/Stop decision (the
  #   dashboard's cost-approval card) — see any_session_cost_stopped. This
  #   ALWAYS has needs_nudge=False (nudging a blocked container does nothing;
  #   it cannot process another turn until a human acts). needs_cost_notice is
  #   the separate, mechanically-enforced trigger for the one-line factual
  #   GitHub comment: True only on the tick the chain enters (or changes
  #   within) cost_stopped, False on every subsequent unchanged tick — dedup
  #   reuses the same delta/lastState-transition tracking already computed for
  #   the board's 🆕/🔼/• tags, so it re-arms correctly across a
  #   resume-then-re-stop cycle with no extra bookkeeping.
  "summary": {"in_flight","new","updated","same","awaiting_us","silent",
              "needs_nudge","must_nudge","escalate","closed","cost_stopped"},
  "state": { ...next supervisor-state.json (merged, snapshots refreshed)... }
}

Only OPEN issues appear in `rows` and the in-flight counts. A chain whose issue
is CLOSED (`issue_open:false`) is moved to `state._archived` (once) and dropped
from the live board — never classified or nudged. `summary.closed` reports how
many were archived this tick.

The script never decides *whether to send* a nudge — it sets needs_nudge + a
reason so the LLM composes and routes it (thread-keyed, per SKILL.md §3).
"""

import argparse
import json
import sys
from datetime import datetime, timezone

# Staleness windows (seconds) — mirror SKILL.md §2 thresholds.
FRESH_DISPATCH_S = 5 * 60
WORKING_S = 60 * 60
SILENT_S = 60 * 60
ESCALATE_S = 4 * 60 * 60

DEFAULT_BOT_LOGINS = ["nv-slang-bot[bot]", "nv-slang-bot"]


def parse_ts(value):
    """ISO-8601 (with trailing Z) -> aware datetime, or None."""
    if not value or not isinstance(value, str):
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def age_seconds(now, value):
    ts = parse_ts(value)
    if ts is None:
        return None
    return (now - ts).total_seconds()


def session_dispatch_ts(chain):
    """Earliest dispatch time for the chain, from the oldest session id.

    Session ids are minted `sess-<ms>-<rand>` at the moment the a2a dispatch
    creates the session, so the smallest embedded epoch-ms dates the chain's
    dispatch. It is already in scan's inputs (no extra query) and lets us age a
    chain that has produced ZERO activity-by-us — otherwise invisible to the
    silence clock, which is null until our first outbound/push/bot-comment.
    Returns an aware datetime, or None when no session id parses (non-standard
    ids / tests), in which case callers fall back to prior 'dispatched' behavior.
    """
    best = None
    for sid in chain.get("sessions", []):
        parts = str(sid).split("-")
        if len(parts) >= 3 and parts[0] == "sess" and parts[1].isdigit():
            ts = datetime.fromtimestamp(int(parts[1]) / 1000, tz=timezone.utc)
            if best is None or ts < best:
                best = ts
    return best


def is_bot_author(comment, bot_logins):
    """A comment is ours if it says so, else if its author is a known bot login."""
    if isinstance(comment.get("is_bot"), bool):
        return comment["is_bot"]
    return comment.get("author") in bot_logins


def latest(comments, predicate=lambda _: True):
    """Most recent comment (by `at`) matching predicate, or None."""
    best = None
    best_ts = None
    for c in comments:
        if not predicate(c):
            continue
        ts = parse_ts(c.get("at"))
        if ts is None:
            continue
        if best_ts is None or ts > best_ts:
            best, best_ts = c, ts
    return best


def compute_last_activity_by_us(chain, bot_logins):
    """max(our outbound, our push, our newest bot comment/review). ISO or None.

    SKILL.md §2 [MUST]: the silence clock is BY US — a human comment starts our
    responsiveness clock, it never resets it. So we deliberately ignore non-bot
    activity here.
    """
    candidates = []
    for key in ("our_last_outbound", "our_last_push"):
        ts = parse_ts(chain.get(key))
        if ts is not None:
            candidates.append(ts)
    bot_comment = latest(chain.get("comments", []), lambda c: is_bot_author(c, bot_logins))
    if bot_comment is not None:
        candidates.append(parse_ts(bot_comment.get("at")))
    candidates = [c for c in candidates if c is not None]
    if not candidates:
        return None
    return max(candidates).isoformat().replace("+00:00", "Z")


def compute_ball(chain, bot_logins):
    """Direction of the ball (SKILL.md §2 [MUST]).

    'ours'   -> latest actor is a non-bot AND no bot reply/comment after it.
    'human'  -> latest actor is the bot (we spoke last; waiting on a human), or
                a pending ask_user_question exists.
    'none'   -> no comments either way.
    """
    if chain.get("pending_ask_user"):
        return "human"
    comments = chain.get("comments", [])
    newest = latest(comments)
    if newest is None:
        return "none"
    if is_bot_author(newest, bot_logins):
        return "human"
    # Newest is a non-bot. Is there ANY bot activity strictly after it?
    newest_ts = parse_ts(newest.get("at"))
    newest_bot = latest(comments, lambda c: is_bot_author(c, bot_logins))
    # newest_ts can be None (the newest comment's `at` was missing/unparseable)
    # even though `newest` itself is non-None — guard it explicitly, else a
    # bot_ts-vs-None comparison below raises TypeError on malformed input.
    if newest_bot is not None and newest_ts is not None:
        bot_ts = parse_ts(newest_bot.get("at"))
        if bot_ts is not None and bot_ts >= newest_ts:
            return "human"
    return "ours"


def any_session_running(chain, sessions_by_id):
    for sid in chain.get("sessions", []):
        s = sessions_by_id.get(sid)
        if s and s.get("container_status") == "running":
            return True
    return False


def stopped_session_count(chain, sessions_by_id):
    """How many of this chain's sessions have a stopped container.

    A `stopped` container is one that exited — the sweep may respawn it on the
    next inbound, but right now nothing is running. `any_session_running` treats
    a stopped session identically to an absent one (it only branches on
    =='running'); this counts them so a stalled chain whose owning container
    died is visible for prioritization/explainability (NOT a nudge gate).
    """
    n = 0
    for sid in chain.get("sessions", []):
        s = sessions_by_id.get(sid)
        if s and s.get("container_status") == "stopped":
            n += 1
    return n


def any_stopped_errored(chain, sessions_by_id):
    """A session on this chain is stopped AND its last outbound classed as an error.

    Stopped-ness is derived from live session data (`container_status`, always
    present via `ncl sessions list`). `last_outbound_error_class` is set by
    pull-universe.sh from the newest outbound text (transient|unknown|permanent|
    None). Together they are the strongest "the handoff bounced" signal the
    supervisor can see — but it is additive prioritization only; the #12097
    nudge does NOT depend on it (scan already reached the right call for #12097
    via the silence clock — see we_owe_next_step).
    """
    return stopped_session_count(chain, sessions_by_id) > 0 and (
        chain.get("last_outbound_error_class") in ("transient", "unknown")
    )


def first_cost_stopped_session(chain, sessions_by_id):
    """The first cost-stopped session on this chain, as (session_id, group_folder).

    Deterministic order: walks `chain["sessions"]` in the exact order the agent
    listed them (the same single walk `any_session_cost_stopped` uses) and
    returns the FIRST session whose live `cost_status == "stopped"`. Returning
    the first — not "a" — match is what lets the row name one specific blocked
    session stably tick-to-tick, so the supervisor's factual GitHub notice
    (needs_cost_notice) can carry a concrete session-id + dashboard deep-link
    instead of re-deriving them. `group_folder` is "" when the session row
    didn't carry one (pull-universe.sh stamps it from `ncl groups list`;
    absent -> ""). Returns None when no session on the chain is cost-stopped.
    """
    for sid in chain.get("sessions", []):
        s = sessions_by_id.get(sid)
        if s and s.get("cost_status") == "stopped":
            return (sid, s.get("group_folder") or "")
    return None


def any_session_cost_stopped(chain, sessions_by_id):
    """A session on this chain hit its Tier-2 cost ceiling and is hard-blocked
    pending a human Continue/Stop decision (the dashboard's cost-approval card).

    `cost_status` is stamped per session by pull-universe.sh via `ncl cost-cap
    status` (container/agent-runner's persistCostCap() -> outbound.db
    session_state['cost_cap'].status). This is a POLICY/RUNTIME stop, not a
    liveness signal — orthogonal to `container_status` (which only tracks
    whether the container PROCESS exited) and to `last_outbound_error_class`
    (which infers a bounced handoff from outbound text). A cost-stopped
    container can easily still read container_status=='running': the runner
    ends the in-flight turn and refuses to spend further, it does not
    necessarily exit. So neither existing signal catches this case — a chain
    in this state will NOT self-recover from a nudge or from time passing; it
    is unstuck only by a human clicking Continue (or Stop) on the dashboard.

    Reimplemented in terms of first_cost_stopped_session so detection and the
    row's cost_notice_* naming fields share one deterministic walk.
    """
    return first_cost_stopped_session(chain, sessions_by_id) is not None


# Dispositions where a HUMAN (maintainer, external contributor, reporter) genuinely
# owns the next step, or the chain is terminal — bot-last there is a correct wait, not
# a stalled promise. Any other bot-last chain a fixer owns is ours to drive.
HUMAN_OWNED_DISPOSITION = (
    "human-debate", "external-pr", "maintainer-driving",
    "awaiting-pickup", "closed-by-us", "stood-down", "advisory",
)


def we_owe_next_step(chain, sessions_by_id, silent_age):
    """Bot-last, but WE own the next step (root cause of slang#12002).

    The direction-of-the-ball heuristic (compute_ball) reads bot-last as
    'awaiting_human', but bot-last is ambiguous: it is either a genuine handoff to
    a human OR a promise we still owe ("Will update here when the PR is up"). This
    disambiguates deterministically: a fixer-role session is on the thread, no PR /
    owed artifact exists yet, no human-owned disposition says otherwise, and we've
    been silent past the soft-nudge window. Such a chain is ours to wake, not park.
    """
    disp = (chain.get("disposition") or "").lower()
    if any(tok in disp for tok in HUMAN_OWNED_DISPOSITION):
        return False  # a human genuinely owns it -> leave alone
    if chain.get("pr"):
        return False  # PR exists -> artifact present; Step 2b/CI owns the nudge
    has_fixer = any(
        "fixer" in (sessions_by_id.get(sid, {}).get("group_folder") or "")
        for sid in chain.get("sessions", [])
    )
    if not has_fixer:
        return False  # triage-only chain -> bot-last legitimately awaits a human
    # Additive limb (does NOT weaken the existing condition): a fixer-owned chain
    # whose owning container is stopped with an error-class last outbound has
    # BOUNCED — it will not self-recover on its own, so it is ours to wake even if
    # the silence clock is still fresh. This is the #12097 shape (transient auth
    # bounce). Belt-and-suspenders with the host a2a-redrive; the supervisor is
    # the fallback for handoffs that surface as issue chains.
    if any_stopped_errored(chain, sessions_by_id):
        return True
    return silent_age is not None and silent_age >= SILENT_S


def compute_non_nudge_reason(chain, sessions_by_id, ball, state, needs_nudge):
    """Deterministic, enum-like reason a NON-nudge row is not being nudged.

    Only meaningful when needs_nudge is False (a nudge row's `action` is always
    'nudge' and carries no non_nudge_reason). The value is a closed token set —
    NOT free prose — so the board is auditable and the LLM cannot recreate the
    same "narrate-it-away" ambiguity that stranded #12097 in a prose field.

    Tokens:
      cost-stopped        a session hit its cost ceiling; awaiting human decision
      human-owned:<disp>  human-owned disposition genuinely owns the next step
      pr-open             a PR/owed artifact exists; CI/Step-2b owns the nudge
      running             a live container acted within the working window
      awaiting-human      we spoke last, no fixer-owed promise outstanding
      fresh-dispatch      dispatched/working; inside the fresh/working window
      terminal            not in-flight (closed/archived)
    """
    if needs_nudge:
        return None
    if state == "cost_stopped":
        return "cost-stopped"
    disp = (chain.get("disposition") or "").lower()
    for tok in HUMAN_OWNED_DISPOSITION:
        if tok in disp:
            return f"human-owned:{tok}"
    if chain.get("pr"):
        return "pr-open"
    if state in ("fixing", "pr_open") and any_session_running(chain, sessions_by_id):
        return "running"
    if state in ("dispatched", "working"):
        return "fresh-dispatch"
    if ball == "human":
        return "awaiting-human"
    return "terminal"


def classify(now, chain, sessions_by_id, bot_logins):
    """Return (state, ball, last_activity_by_us, needs_nudge, nudge_reason)."""
    ball = compute_ball(chain, bot_logins)
    last_by_us = compute_last_activity_by_us(chain, bot_logins)
    silent_age = age_seconds(now, last_by_us)  # None if we've never acted
    running = any_session_running(chain, sessions_by_id)
    pr = chain.get("pr")

    # cost_stopped — a session on this chain hit its Tier-2 cost ceiling and is
    # hard-blocked pending a human Continue/Stop decision. This MUST run before
    # all three ball branches below (including 'ours'): no nudge can un-stick
    # this regardless of who spoke last on GitHub — the container will not
    # process another turn until a human acts on the dashboard. Left to fall
    # through, a long-silent cost-stopped chain would eventually hit the
    # ordinary silence-clock nudge paths (we_owe_next_step's SILENT_S fallback
    # on the 'human' branch, or the silence-clock checks on the 'none' branch)
    # exactly like a genuinely stuck chain — which is the bug this guards
    # against. `escalate` (computed by the caller) is gated on state=='silent',
    # so it is naturally False here too — a cost stop is not something the
    # supervisor escalates via ask_user_question; the dashboard card already
    # carries that decision to the human.
    if any_session_cost_stopped(chain, sessions_by_id):
        return ("cost_stopped", ball, last_by_us, False, "")

    # awaiting_us — ball is in our court, our session is not actively closing it.
    # STUCK regardless of how recent the human comment is (SKILL.md §2 [MUST]).
    if ball == "ours":
        # A running session that has acted within the working window is allowed
        # to be mid-response; otherwise it's on us and needs a wake.
        if running and silent_age is not None and silent_age < WORKING_S:
            return ("fixing" if pr is None else "pr_open", ball, last_by_us, False, "")
        return ("awaiting_us", ball, last_by_us, True, "human spoke last, unanswered by us; wake owning tier")

    # awaiting_human — we spoke last / a question is pending. Leave alone UNLESS a
    # fixer owns an artifact-less chain that has gone dark: bot-last there is a
    # promise we still owe, not a handoff (root cause of slang#12002).
    if ball == "human":
        if we_owe_next_step(chain, sessions_by_id, silent_age):
            return ("awaiting_us", ball, last_by_us, True,
                    "fixer owns this chain, no PR, silent ≥ threshold; wake the fixer")
        return ("awaiting_human", ball, last_by_us, False, "")

    # ball == 'none' — no GitHub conversation yet; fall back to the silence clock.
    if silent_age is None:
        # We have produced NO activity-by-us (no outbound, no push, no bot
        # comment). A brand-new dispatch is legitimately quiet — but a chain that
        # has held a session for a long time with zero activity AND no resumable
        # artifact has stalled at the handoff: its triage/fix turn bounced before
        # writing anything, so the silence clock stays null and the chain hid as
        # 'fresh' forever. Root cause of slang#12165 — the triager turn bounced
        # (bounced-transient, zero outbound, no issue comment) yet the retry
        # container read as "triager RUNNING — fresh, not stuck" tick after tick.
        # Age against the dispatch time (oldest session id's ms) instead. Liveness
        # is NOT progress: a 'running' container whose message bounced is still
        # stuck, so we deliberately do NOT let any_session_running suppress this.
        if github_artifact(chain):
            # Something landable exists; the PR / CI / §2b paths own its nudge.
            return ("dispatched", ball, last_by_us, False, "")
        dts = session_dispatch_ts(chain)
        dispatch_age = (now - dts).total_seconds() if dts is not None else None
        if dispatch_age is None or dispatch_age < WORKING_S:
            return ("dispatched", ball, last_by_us, False, "")
        if dispatch_age < ESCALATE_S:
            return ("silent", ball, last_by_us, True,
                    ("dispatched ≥ working window, zero activity/artifact by us "
                     "— handoff likely bounced; wake owning tier"))
        return ("silent", ball, last_by_us, True,
                ("dispatched ≥ 4h, zero activity/artifact by us — handoff "
                 "bounced; escalate to operator"))
    if silent_age < FRESH_DISPATCH_S:
        return ("dispatched", ball, last_by_us, False, "")
    if silent_age < WORKING_S:
        return ("pr_open" if pr else "working", ball, last_by_us, False, "")
    if silent_age < ESCALATE_S:
        return ("silent", ball, last_by_us, True, "no activity by us ≥ 60 min; soft nudge")
    return ("silent", ball, last_by_us, True, "no activity by us ≥ 4h; escalate to operator")


def github_artifact(chain):
    pr = chain.get("pr")
    if pr and pr.get("number"):
        repo = chain.get("repo", "")
        return f"https://github.com/{repo}/pull/{pr['number']}"
    # No-PR chain: the agent supplies the triage/review comment URL (§1a).
    return chain.get("github_artifact_url")


def mis_threaded(chain):
    """The thread_id names issue N; the PR body says it fixes M != N (reused session).

    `chain["issue"]` is already N (pull-universe.sh parses it out of the
    thread_id once when building the chain universe — see THREADS in that
    script), so this doesn't need the thread_id string itself.
    """
    pr = chain.get("pr")
    if not pr:
        return False
    fixes = pr.get("fixes_issue")
    return fixes is not None and fixes != chain.get("issue")


def run(payload):
    now = parse_ts(payload.get("now"))
    if now is None:
        raise SystemExit("scan.py: input missing a valid 'now' (ISO-8601 with Z)")
    bot_logins = payload.get("bot_logins") or DEFAULT_BOT_LOGINS
    prior_state = payload.get("state") or {}
    sessions = payload.get("sessions") or []
    chains = payload.get("chains") or {}

    sessions_by_id = {s["id"]: s for s in sessions if s.get("id")}

    # --- NEW-chain discovery: set math on KEYS only (SKILL.md §1 [MUST]). ---
    # Live universe = every gh-issue thread the agent passed in `chains`
    # (the agent built it from `ncl sessions list` filtered client-side, since
    # `--thread-prefix` is silently ignored by ncl — see SKILL.md note).
    live_keys = set(chains.keys())
    archived = prior_state.get("_archived", {}) if isinstance(prior_state, dict) else {}
    journaled_keys = {k for k in prior_state if k.startswith("gh-issue-")}
    archived_keys = {k for k in archived if k.startswith("gh-issue-")}
    new_keys = live_keys - journaled_keys - archived_keys

    rows = []
    next_state = dict(prior_state)  # shallow copy; we refresh per-chain snapshots
    counts = {
        "in_flight": 0, "new": 0, "updated": 0, "same": 0,
        "awaiting_us": 0, "silent": 0, "needs_nudge": 0, "escalate": 0,
        "closed": 0,
        # must_nudge = number of action='nudge' rows this tick. The §3
        # fails-loudly check compares the nudges the LLM actually sent against
        # this count; a mismatch is a SUPERVISOR INVARIANT VIOLATION. It equals
        # needs_nudge by construction (action is 1:1 with needs_nudge) but is
        # emitted separately as the explicit reconciliation target.
        "must_nudge": 0,
        # cost_stopped = chains currently in the cost_stopped state this tick
        # (regardless of whether needs_cost_notice fired — see that field).
        "cost_stopped": 0,
    }

    for thread in sorted(live_keys):
        chain = chains[thread]

        # We only supervise OPEN issues. A chain whose issue is CLOSED
        # (pull-universe emits it as a minimal stub with issue_open:false) is
        # done — never classify, nudge, or count it as in-flight. Move it to
        # _archived once and drop it from the live board. Without this guard the
        # closed stub (empty comments) classifies as 'dispatched'/'silent' and
        # keeps consuming a board row and, worse, could draw a nudge — work on a
        # chain no human is waiting on.
        if chain.get("issue_open") is False:
            archived_map = next_state.get("_archived")
            if not isinstance(archived_map, dict):
                archived_map = dict(archived) if isinstance(archived, dict) else {}
            if thread not in archived_map:
                prior_snap = prior_state.get(thread, {}) if isinstance(prior_state, dict) else {}
                archived_map[thread] = {
                    "issue": chain.get("issue"),
                    "repo": chain.get("repo"),
                    "reason": "issue closed",
                    "archivedAt": now.isoformat().replace("+00:00", "Z"),
                    "githubArtifactUrl": prior_snap.get("githubArtifactUrl"),
                }
            next_state["_archived"] = archived_map
            next_state.pop(thread, None)  # drop the live top-level snapshot
            counts["closed"] += 1
            continue

        state, ball, last_by_us, needs_nudge, reason = classify(
            now, chain, sessions_by_id, bot_logins
        )

        prior = prior_state.get(thread, {}) if isinstance(prior_state, dict) else {}
        is_new = thread in new_keys
        # Delta vs last tick: state change or fresher activity than the snapshot.
        changed = (
            prior.get("lastState") != state
            or prior.get("lastActivityAt") != last_by_us
            or prior.get("lastPrState") != (chain.get("pr") or {}).get("state")
        )
        if is_new:
            delta = "new"
        elif changed:
            delta = "updated"
        else:
            delta = "same"

        # needs_cost_notice — the mechanically-enforced trigger for the ONE-LINE
        # factual GitHub comment (never a nudge). True only when the chain is
        # cost_stopped AND something changed since last tick (delta != 'same') —
        # i.e. the FIRST tick of a given stop episode, or a resume that flips
        # back to cost_stopped later (which necessarily passes through a
        # different lastState in between, so delta is 'updated' again on
        # re-stop). A chain that stays cost_stopped tick-to-tick with nothing
        # else changed has delta=='same' here, so this stays False — no repeat
        # comment. Reuses `delta`'s existing lastState-transition tracking
        # rather than inventing a second dedup mechanism (same spirit as R4).
        needs_cost_notice = state == "cost_stopped" and delta != "same"

        # cost_notice_* — ready-made fields for the supervisor's factual GitHub
        # notice on a cost_stopped chain: the SPECIFIC blocked session id, its
        # coworker folder, and a dashboard session-mode deep-link
        # (#/cw/<folder>/s/<session>; NO domain — a relative hash route, kept
        # domain-less on purpose so the internal dashboard host never leaks into
        # the PUBLIC shader-slang issue/PR comment). Empty strings on any
        # non-cost_stopped row (not applicable), so every row carries the keys.
        cost_notice_session = ""
        cost_notice_folder = ""
        cost_notice_link = ""
        if state == "cost_stopped":
            stopped = first_cost_stopped_session(chain, sessions_by_id)
            if stopped is not None:
                cost_notice_session, cost_notice_folder = stopped
                cost_notice_link = f"#/cw/{cost_notice_folder}/s/{cost_notice_session}"

        # Effective age escalates on the dispatch clock when we never acted
        # (last_by_us is None) — else a bounced-at-dispatch chain would nudge but
        # never escalate, since age_seconds(None) is None -> 0.
        eff_age = age_seconds(now, last_by_us)
        if eff_age is None:
            dts = session_dispatch_ts(chain)
            eff_age = (now - dts).total_seconds() if dts is not None else None
        escalate = state == "silent" and (eff_age or 0) >= ESCALATE_S

        # Action plan — the mechanical enforcement surface (SKILL.md §3).
        # `action` is a strict 1:1 function of `needs_nudge`: True -> 'nudge',
        # False -> 'none'. There is DELIBERATELY no 'suppress' action — a nudge
        # row can never be turned off downstream. The human-owned case does not
        # need one: we_owe_next_step already returns False for it, so it never
        # reaches needs_nudge=True and surfaces here as action='none' with a
        # 'human-owned:<disp>' non_nudge_reason. This closes the prose-override
        # hole that stranded #12097 (PR #901's wording alone was insufficient).
        action = "nudge" if needs_nudge else "none"
        non_nudge_reason = compute_non_nudge_reason(
            chain, sessions_by_id, ball, state, needs_nudge
        )

        rows.append({
            "thread": thread,
            "repo": chain.get("repo"),
            "issue": chain.get("issue"),
            "pr": (chain.get("pr") or {}).get("number"),
            "state": state,
            "ball": ball,
            "delta": delta,
            "last_activity_by_us": last_by_us,
            "needs_nudge": needs_nudge,
            "nudge_reason": reason,
            "action": action,
            "non_nudge_reason": non_nudge_reason,
            "escalate": escalate,
            "github_artifact": github_artifact(chain),
            "disposition": chain.get("disposition") or prior.get("disposition"),
            "last_outbound_error_class": chain.get("last_outbound_error_class"),
            "stopped_session_count": stopped_session_count(chain, sessions_by_id),
            "mis_threaded": mis_threaded(chain),
            "needs_cost_notice": needs_cost_notice,
            "cost_notice_session": cost_notice_session,
            "cost_notice_folder": cost_notice_folder,
            "cost_notice_link": cost_notice_link,
        })

        # Refresh the durable snapshot — preserve prior bookkeeping fields
        # (nudgedAt, postmortem, etc.) the LLM/other steps maintain.
        snap = dict(prior)
        snap["lastState"] = state
        snap["lastActivityAt"] = last_by_us
        snap["lastPrState"] = (chain.get("pr") or {}).get("state")
        snap["lastObservedActivity"] = now.isoformat().replace("+00:00", "Z")
        if chain.get("disposition"):
            snap["disposition"] = chain["disposition"]
        art = github_artifact(chain)
        if art:
            snap["githubArtifactUrl"] = art
        next_state[thread] = snap

        counts["in_flight"] += 1
        counts[delta] = counts.get(delta, 0) + 1
        if state == "awaiting_us":
            counts["awaiting_us"] += 1
        if state == "silent":
            counts["silent"] += 1
        if state == "cost_stopped":
            counts["cost_stopped"] += 1
        if needs_nudge:
            counts["needs_nudge"] += 1
            counts["must_nudge"] += 1
        if escalate:
            counts["escalate"] += 1

    # Sort: 🆕 new + 🔼 updated first, then awaiting_us / silent, then same.
    order = {"new": 0, "updated": 1, "same": 2}
    rows.sort(key=lambda r: (order.get(r["delta"], 3), 0 if r["needs_nudge"] else 1, str(r["thread"])))

    return {"now": payload.get("now"), "rows": rows, "summary": counts, "state": next_state}


def main():
    ap = argparse.ArgumentParser(description="supervise-issues deterministic scan core")
    ap.add_argument("--now", help="override 'now' (ISO-8601 with Z); else taken from stdin payload")
    args = ap.parse_args()

    raw = sys.stdin.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise SystemExit(f"scan.py: stdin is not valid JSON: {e}")
    if args.now and not payload.get("now"):
        payload["now"] = args.now
    result = run(payload)
    json.dump(result, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
