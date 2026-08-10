"""Per-thread bot-reply capacity accounting, shared by both forwarders.

WHY THIS EXISTS AS ITS OWN MODULE
---------------------------------
Two separate processes forward Discord follow-ups — the always-on
`feedback_collector` daemon (prod) and slang-mcp's `discord.py` (lego /
no-daemon) — and they share state ONLY through the append-only
`thread_state.jsonl` audit log. Each used to reimplement the fold over that
log, with a comment in one of them worrying that "the bot_reply accounting
must agree or the 15-reply cap drifts". One fold, imported twice, is the
only way that guarantee is structural rather than aspirational.

THE ACCOUNTING PROBLEM
----------------------
Both forwarders recorded the upcoming reply BEFORE POSTing to dashboard
ingress. That ordering is deliberate and correct: admission runs on an
asyncio event loop, so the gate read (`bot_reply_count >= CAP`) and the POST
are separated by an `await`. Increment-after-accept would let two OP messages
interleave, both read count=14, both post, and land the thread at 16 — the
race the pre-increment was added to prevent. There is also no lock to
serialize on: the two processes coordinate through an append-only file.

The defect was never the reservation. It was that a reservation was never
RELEASED. When the POST failed the code logged and moved on, so the quota was
spent on a reply that was never delivered. Retries walked the counter to the
cap and the thread went permanently silent — with nothing anywhere saying the
cap had been consumed by failures rather than by answers.

So: keep the reservation (it is what makes admission atomic), and make it a
real lifecycle.

    reply_pending{id}   reservation — charged immediately, so concurrent
                        admissions cannot both squeak past the cap
    reply_accepted{id}  ingress accepted the POST — a DELIVERED reply
    reply_failed{id}    ingress refused/errored — reservation released, and
                        the failure is now a durable, countable record

`charged()` = accepted + live pending. Only delivered replies (plus the
handful currently in flight) consume quota.

AGE IS NOT EVIDENCE OF FAILURE
-----------------------------
An earlier version treated a reservation older than REPLY_PENDING_TTL_SECS as
abandoned and stopped counting it. That is unsound. The failure it was aimed at
— a process that appends `reply_pending`, gets HTTP 200 from ingress, and dies
before appending `reply_accepted` — produces a reservation that is old AND
delivered. Refunding it forgets a reply the user can see, and the next
admission takes the thread past the cap.

The log cannot infer an outcome from elapsed time. So an unsettled reservation
stays CHARGED, however old it gets. The TTL survives only as a diagnostic
threshold: past it, a reservation is reported as `unresolved` — an explicit
state that callers surface and an operator can settle deliberately
(`reply_capacity_admin.py`). It is never silently reclaimed.

That is a deliberate trade. A crash permanently consumes one reply of a
thread's quota until someone settles it, which is its own availability bug —
so it is loud rather than silent, and there is a command to clear it. The
durable fix is for dashboard ingress to accept the reservation id as an
idempotency key and expose whether it was accepted, at which point these become
reconcilable instead of merely visible. The forwarders already send the id
(`reservation_id` in the POST body) so that reconciliation can be built without
another change here.

SETTLEMENT IS A STATE MACHINE, NOT A COUNTER
--------------------------------------------
Every terminal row used to increment unconditionally, so a duplicate audit row,
a retry, or an out-of-order pair double-counted or refunded something already
charged. Reservation ids are now single-settlement keys:

  * a reservation is recorded once; a replayed `reply_pending` is a duplicate
  * the FIRST terminal row for an id settles it; an identical replay is ignored
  * a CONTRADICTING second terminal is counted in `conflicts` and resolved
    toward charging — a delivered reply must consume quota, and a delivered
    reply must never be refunded. `failed` then `accepted` restores the charge;
    `accepted` then `failed` keeps it.
  * a terminal for an id with no reservation (`orphan_terminals`) settles that
    id but refunds nothing: there is no charge to release. An orphan `accepted`
    still charges, because it means a reply was delivered.

BACKWARD COMPATIBILITY
----------------------
Prod logs already contain bare `bot_reply` events. They mean "a reply was
admitted", so they fold to `accepted`. Anything else would reset live threads
to zero and re-open a cap that had legitimately been reached.
"""

import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone

# Event names in thread_state.jsonl.
EVENT_PENDING = "reply_pending"
EVENT_ACCEPTED = "reply_accepted"
EVENT_FAILED = "reply_failed"
EVENT_LEGACY_ACCEPTED = "bot_reply"

#: Past this age an unsettled reservation is REPORTED as unresolved. It keeps
#: its charge — see "age is not evidence of failure" above. Generous next to the
#: 5s ingress POST timeout, so anything older is genuinely anomalous.
REPLY_PENDING_TTL_SECS = int(os.environ.get("REPLY_PENDING_TTL_SECS", "300"))

#: Terminal states a reservation id can settle into.
TERMINAL_ACCEPTED = "accepted"
TERMINAL_FAILED = "failed"


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_reservation_id() -> str:
    return uuid.uuid4().hex[:12]


def _parse_ts(ts: str | None) -> float | None:
    if not ts:
        return None
    try:
        return datetime.fromisoformat(ts).timestamp()
    except Exception:
        return None


@dataclass
class ReplyCapacity:
    """Folded reply accounting for ONE thread."""

    accepted: int = 0
    failed: int = 0
    #: reservation id -> epoch seconds it was taken (None when unparseable).
    #: UNSETTLED reservations only; settling removes the entry.
    pending: dict[str, float | None] = field(default_factory=dict)
    #: reservation id -> TERMINAL_*. The single-settlement key set: an id in
    #: here has already been decided and cannot be settled again.
    settled: dict[str, str] = field(default_factory=dict)
    #: rows that repeated a decision already recorded — ignored, but counted so
    #: a replay storm is visible rather than invisible.
    duplicates: int = 0
    #: terminal rows that contradicted an earlier terminal for the same id.
    #: Should be zero; a non-zero value means a forwarder settled twice.
    conflicts: int = 0
    #: terminal rows whose reservation was never seen (log truncated, or a
    #: settle from a process whose pending row was lost).
    orphan_terminals: int = 0

    def live_pending(self, now: float | None = None, ttl: int | None = None) -> int:
        """Unsettled reservations young enough to still be plausibly in flight."""
        now = now if now is not None else datetime.now(timezone.utc).timestamp()
        ttl = REPLY_PENDING_TTL_SECS if ttl is None else ttl
        return sum(
            1
            for taken_at in self.pending.values()
            if taken_at is None or (now - taken_at) <= ttl
        )

    def unresolved_ids(self, now: float | None = None, ttl: int | None = None) -> list[str]:
        """Reservations too old to be in flight and never settled.

        These are STILL CHARGED. They are surfaced so the charge is explicit and
        an operator can settle them, not so it can be reclaimed automatically —
        their true outcome is unknown, and age does not reveal it.
        """
        now = now if now is not None else datetime.now(timezone.utc).timestamp()
        ttl = REPLY_PENDING_TTL_SECS if ttl is None else ttl
        return sorted(
            rid
            for rid, taken_at in self.pending.items()
            if taken_at is not None and (now - taken_at) > ttl
        )

    def charged(self, now: float | None = None, ttl: int | None = None) -> int:
        """Quota consumed: delivered replies plus EVERY unsettled reservation.

        `now`/`ttl` are accepted for signature compatibility and deliberately
        unused in the total: an unsettled reservation is charged whatever its
        age, because the log cannot tell a crash-before-settle from a
        crash-after-delivery.
        """
        return self.accepted + len(self.pending)


def apply_event(cap: ReplyCapacity, event: str, reservation_id: str | None, ts: str | None = None) -> None:
    """Fold one audit-log row into `cap`. Unknown events are ignored.

    Idempotent per reservation id: folding a log that contains replayed rows —
    or folding the same log twice — yields the same capacity.
    """
    if event == EVENT_LEGACY_ACCEPTED:
        # Pre-lifecycle rows: an admitted reply, with no settlement to wait for.
        cap.accepted += 1
        return

    if event == EVENT_PENDING:
        if not reservation_id:
            # A reservation we could never settle must still be charged, or a
            # malformed row would silently hand back quota.
            cap.accepted += 1
        elif reservation_id in cap.settled or reservation_id in cap.pending:
            cap.duplicates += 1  # replayed reservation row
        else:
            cap.pending[reservation_id] = _parse_ts(ts)
        return

    if event not in (EVENT_ACCEPTED, EVENT_FAILED):
        return

    terminal = TERMINAL_ACCEPTED if event == EVENT_ACCEPTED else TERMINAL_FAILED

    if not reservation_id:
        # Unkeyed terminal — it cannot be tied to a reservation, so it releases
        # nothing. An accepted one still charges: it means a reply went out.
        cap.orphan_terminals += 1
        if terminal == TERMINAL_ACCEPTED:
            cap.accepted += 1
        else:
            cap.failed += 1
        return

    prior = cap.settled.get(reservation_id)
    if prior is not None:
        if prior == terminal:
            cap.duplicates += 1  # exact replay of a decision already made
            return
        # Contradiction. Resolve toward CHARGING in both directions: a delivered
        # reply must consume quota, and a delivered reply must never be refunded
        # by a late failure row.
        cap.conflicts += 1
        if terminal == TERMINAL_ACCEPTED:  # failed → accepted: restore the charge
            cap.settled[reservation_id] = TERMINAL_ACCEPTED
            cap.failed -= 1
            cap.accepted += 1
        # accepted → failed: keep the charge; record only the conflict.
        return

    # First terminal for this id — the one that settles it.
    if reservation_id in cap.pending:
        del cap.pending[reservation_id]
    else:
        # Settling something we never saw reserved releases no charge.
        cap.orphan_terminals += 1
    cap.settled[reservation_id] = terminal
    if terminal == TERMINAL_ACCEPTED:
        cap.accepted += 1
    else:
        cap.failed += 1


def fold_rows(rows, thread_id: str | None = None) -> dict[str, ReplyCapacity]:
    """Fold audit-log rows into per-thread capacity.

    `rows` is any iterable of decoded JSONL dicts. When `thread_id` is given,
    only that thread's rows are folded (the slang-mcp read path wants one
    thread; the daemon wants them all).
    """
    out: dict[str, ReplyCapacity] = {}
    for row in rows:
        tid = row.get("thread_id")
        event = row.get("event")
        if not (tid and event):
            continue
        if thread_id is not None and tid != thread_id:
            continue
        cap = out.setdefault(tid, ReplyCapacity())
        apply_event(cap, event, row.get("reservation_id"), row.get("ts"))
    return out
