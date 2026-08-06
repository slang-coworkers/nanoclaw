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

A process that dies between reserving and settling would otherwise leak its
reservation forever — the same bug with a smaller window — so a pending older
than REPLY_PENDING_TTL_SECS is treated as abandoned and stops counting. The
POST itself has a 5s timeout, so the default 300s is far outside any healthy
round-trip.

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

#: A reservation older than this never settled — its process died mid-POST.
#: Generous next to the 5s ingress POST timeout, short enough that a crash
#: cannot wedge a thread's quota for long.
REPLY_PENDING_TTL_SECS = int(os.environ.get("REPLY_PENDING_TTL_SECS", "300"))


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
    #: reservation id -> epoch seconds it was taken (None when unparseable,
    #: which counts as live: fail toward charging rather than toward a leak).
    pending: dict[str, float | None] = field(default_factory=dict)

    def live_pending(self, now: float | None = None, ttl: int | None = None) -> int:
        """Reservations still plausibly in flight."""
        now = now if now is not None else datetime.now(timezone.utc).timestamp()
        ttl = REPLY_PENDING_TTL_SECS if ttl is None else ttl
        live = 0
        for taken_at in self.pending.values():
            if taken_at is None or (now - taken_at) <= ttl:
                live += 1
        return live

    def charged(self, now: float | None = None, ttl: int | None = None) -> int:
        """Quota consumed: delivered replies plus reservations in flight."""
        return self.accepted + self.live_pending(now, ttl)


def apply_event(cap: ReplyCapacity, event: str, reservation_id: str | None, ts: str | None = None) -> None:
    """Fold one audit-log row into `cap`. Unknown events are ignored."""
    if event == EVENT_LEGACY_ACCEPTED:
        # Pre-lifecycle rows: an admitted reply, with no settlement to wait for.
        cap.accepted += 1
    elif event == EVENT_PENDING:
        if reservation_id:
            cap.pending[reservation_id] = _parse_ts(ts)
        else:
            # A reservation we cannot settle later must still be charged, or a
            # malformed row would silently hand back quota.
            cap.accepted += 1
    elif event == EVENT_ACCEPTED:
        cap.pending.pop(reservation_id, None) if reservation_id else None
        cap.accepted += 1
    elif event == EVENT_FAILED:
        # Compensation: release the reservation and record the failure. This is
        # the event whose absence made a transient outage look like normal use.
        if reservation_id:
            cap.pending.pop(reservation_id, None)
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
