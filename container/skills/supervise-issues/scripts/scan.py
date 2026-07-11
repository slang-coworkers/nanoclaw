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
     {"id","thread_id","container_status","last_active","agent_group_id","group_folder"?}
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
             needs_nudge,nudge_reason,github_artifact,disposition,mis_threaded} ],
  "summary": {"in_flight","new","updated","same","awaiting_us","silent",
              "needs_nudge","escalate","closed"},
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


def is_bot_author(comment, bot_logins):
    """A comment is ours if it says so, else if its author is a known bot login."""
    if isinstance(comment.get("is_bot"), bool):
        return comment["is_bot"]
    return comment.get("author") in bot_logins


def latest(comments, predicate=lambda c: True):
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


def compute_last_activity_by_us(now, chain, bot_logins):
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
    if newest_bot is not None:
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
    return silent_age is not None and silent_age >= SILENT_S


def classify(now, chain, sessions_by_id, bot_logins):
    """Return (state, ball, last_activity_by_us, needs_nudge, nudge_reason)."""
    ball = compute_ball(chain, bot_logins)
    last_by_us = compute_last_activity_by_us(now, chain, bot_logins)
    silent_age = age_seconds(now, last_by_us)  # None if we've never acted
    running = any_session_running(chain, sessions_by_id)
    pr = chain.get("pr")

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
        # We have never acted and there's no activity — brand-new / dispatched.
        return ("dispatched", ball, last_by_us, False, "")
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


def mis_threaded(thread, chain):
    """The thread_id names issue N; the PR body says it fixes M != N (reused session)."""
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
    journaled_keys = {k for k in prior_state.keys() if k.startswith("gh-issue-")}
    archived_keys = {k for k in archived.keys() if k.startswith("gh-issue-")}
    new_keys = live_keys - journaled_keys - archived_keys

    rows = []
    next_state = dict(prior_state)  # shallow copy; we refresh per-chain snapshots
    counts = {
        "in_flight": 0, "new": 0, "updated": 0, "same": 0,
        "awaiting_us": 0, "silent": 0, "needs_nudge": 0, "escalate": 0,
        "closed": 0,
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

        escalate = state == "silent" and (age_seconds(now, last_by_us) or 0) >= ESCALATE_S

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
            "escalate": escalate,
            "github_artifact": github_artifact(chain),
            "disposition": chain.get("disposition") or prior.get("disposition"),
            "mis_threaded": mis_threaded(thread, chain),
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
        if needs_nudge:
            counts["needs_nudge"] += 1
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
