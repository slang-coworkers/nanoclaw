"""Per-thread reply-capacity accounting (F15).

The defect these lock down: both forwarders recorded `bot_reply` BEFORE POSTing
to dashboard ingress and, when the POST failed, logged and moved on. Nothing
rolled the charge back and nothing recorded a failure, so a transient ingress
outage permanently consumed quota. Retries walked the per-thread counter to the
15-reply cap WITHOUT EVER DELIVERING A REPLY, after which the thread was
silently suppressed — indistinguishable, to a user, from a bot that had simply
answered 15 times.

Verified against the pre-fix tree: 15 failed forwards left bot_reply_count at
15 with zero replies delivered and no failure record anywhere, in BOTH
forwarders.

The tests below pin the four properties the fix has to hold at once:
  1. a failed POST consumes no quota
  2. N consecutive failures never reach the cap
  3. a genuine cap hit is still enforced (the leak is not "fixed" by removing
     the limit)
  4. concurrent admission still cannot double-count — the reservation is
     charged the moment it is taken, which is why it must precede the POST
"""

import json
import os
import time

import pytest

from src.discord import feedback_collector as fc
from src.discord import discord as dmod
from src.discord.reply_capacity import (
    EVENT_ACCEPTED,
    EVENT_FAILED,
    EVENT_PENDING,
    ReplyCapacity,
    apply_event,
    fold_rows,
)


# ── Fixtures: point both modules at a temp audit log ────────────────────────

@pytest.fixture
def daemon(tmp_path, monkeypatch):
    """feedback_collector wired to an isolated thread_state.jsonl."""
    monkeypatch.setattr(fc, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(fc, "THREAD_STATE_FILE", str(tmp_path / "thread_state.jsonl"))
    fc.thread_state.clear()
    yield fc
    fc.thread_state.clear()


@pytest.fixture
def mcp(tmp_path, monkeypatch):
    """slang-mcp's discord.py wired to an isolated thread_state.jsonl."""
    monkeypatch.setattr(dmod, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(dmod, "_feedback_path", lambda name: str(tmp_path / name))
    return dmod


def _events(path):
    with open(path) as f:
        return [json.loads(line) for line in f if line.strip()]


# ── 1. A failed POST consumes no quota ──────────────────────────────────────

def test_failed_forward_refunds_the_reservation_daemon(daemon):
    tid = "t-refund"
    daemon._record_thread_event(tid, "summoned")

    reservation = daemon._reserve_reply(tid)
    assert daemon.thread_state[tid].bot_reply_count == 1, "reservation charges immediately"

    daemon._settle_reply(tid, reservation, delivered=False)  # ingress down
    assert daemon.thread_state[tid].bot_reply_count == 0, "a reply never delivered costs nothing"
    assert daemon.thread_state[tid].failed_reply_count == 1


def test_delivered_forward_keeps_the_charge_daemon(daemon):
    tid = "t-delivered"
    reservation = daemon._reserve_reply(tid)
    daemon._settle_reply(tid, reservation, delivered=True)
    assert daemon.thread_state[tid].bot_reply_count == 1
    assert daemon.thread_state[tid].failed_reply_count == 0


def test_failed_forward_refunds_the_reservation_mcp(mcp):
    tid = "t-refund-mcp"
    reservation = mcp._reserve_reply(tid)
    assert mcp._read_thread_state(tid)["bot_reply_count"] == 1

    mcp._settle_reply(tid, reservation, delivered=False)
    assert mcp._read_thread_state(tid)["bot_reply_count"] == 0
    assert mcp._read_thread_state(tid)["failed_reply_count"] == 1


# ── 2. N consecutive failures never reach the cap ───────────────────────────

@pytest.mark.parametrize("mod_name", ["daemon", "mcp"])
def test_repeated_ingress_failures_never_reach_the_cap(mod_name, daemon, mcp):
    """The exact pre-fix scenario: ingress is down, the OP keeps trying.

    Before the fix this loop ended with the counter at the cap and the thread
    permanently suppressed, having delivered nothing.
    """
    tid = "t-outage"
    cap = fc.MAX_BOT_REPLIES_PER_THREAD
    delivered = 0

    for _ in range(cap * 2):  # twice the cap's worth of failed attempts
        if mod_name == "daemon":
            charged = daemon.thread_state[tid].bot_reply_count
            if charged >= cap:
                break
            rid = daemon._reserve_reply(tid)
            daemon._settle_reply(tid, rid, delivered=False)
        else:
            charged = mcp._read_thread_state(tid)["bot_reply_count"]
            if charged >= cap:
                break
            rid = mcp._reserve_reply(tid)
            mcp._settle_reply(tid, rid, delivered=False)

    final = (
        daemon.thread_state[tid].bot_reply_count
        if mod_name == "daemon"
        else mcp._read_thread_state(tid)["bot_reply_count"]
    )
    assert delivered == 0
    assert final == 0, "30 failed attempts must leave the quota untouched"
    assert final < cap, "the thread is still allowed to be answered"


# ── 3. A genuine cap hit is STILL enforced ──────────────────────────────────

def test_cap_is_still_enforced_for_delivered_replies(daemon):
    """Do not fix the leak by removing the limit."""
    tid = "t-cap"
    cap = fc.MAX_BOT_REPLIES_PER_THREAD

    for _ in range(cap):
        rid = daemon._reserve_reply(tid)
        daemon._settle_reply(tid, rid, delivered=True)

    assert daemon.thread_state[tid].bot_reply_count == cap
    assert daemon.thread_state[tid].bot_reply_count >= cap, "cap reached → admission gate closes"


def test_mixed_success_and_failure_charges_only_the_delivered(daemon):
    tid = "t-mixed"
    for delivered in (True, False, True, False, False, True):
        rid = daemon._reserve_reply(tid)
        daemon._settle_reply(tid, rid, delivered=delivered)

    assert daemon.thread_state[tid].bot_reply_count == 3
    assert daemon.thread_state[tid].failed_reply_count == 3


# ── 4. Concurrent admission cannot double-count ─────────────────────────────

def test_concurrent_reservations_are_both_charged(daemon):
    """Two admissions interleaved across the POST await must not both squeak in.

    The reservation is written synchronously, before any await, so the second
    admission's gate check sees the first one's charge. This is why the charge
    has to PRECEDE the POST — incrementing only on success would let both read
    the same pre-increment count.
    """
    tid = "t-race"
    cap = fc.MAX_BOT_REPLIES_PER_THREAD

    for _ in range(cap - 1):
        rid = daemon._reserve_reply(tid)
        daemon._settle_reply(tid, rid, delivered=True)
    assert daemon.thread_state[tid].bot_reply_count == cap - 1

    # Handler A admits and reserves; its POST is still in flight.
    rid_a = daemon._reserve_reply(tid)
    # Handler B now runs its gate check — it must see A's charge and refuse.
    assert daemon.thread_state[tid].bot_reply_count >= cap, "B is refused; no 16th reply"

    # A's POST fails, so the quota comes back and the thread can be answered.
    daemon._settle_reply(tid, rid_a, delivered=False)
    assert daemon.thread_state[tid].bot_reply_count == cap - 1


# ── Backward compatibility with logs already in prod ────────────────────────

def test_legacy_bot_reply_rows_still_count(daemon):
    """Deployed threads must not have their counters reset to zero.

    `bot_reply` (pre-lifecycle) means "a reply was admitted", so it folds to
    accepted. Anything else would re-open a cap that had legitimately been hit.
    """
    tid = "t-legacy"
    for _ in range(3):
        daemon._record_thread_event(tid, "bot_reply")
    assert daemon.thread_state[tid].bot_reply_count == 3

    # …and a replay from disk agrees.
    fc.thread_state.clear()
    fc._load_thread_state()
    assert fc.thread_state[tid].bot_reply_count == 3


def test_replay_from_disk_matches_live_state(daemon):
    tid = "t-replay"
    daemon._record_thread_event(tid, "summoned")
    for delivered in (True, False, True):
        rid = daemon._reserve_reply(tid)
        daemon._settle_reply(tid, rid, delivered=delivered)
    live = daemon.thread_state[tid].bot_reply_count

    fc.thread_state.clear()
    fc._load_thread_state()
    assert fc.thread_state[tid].bot_reply_count == live == 2
    assert fc.thread_state[tid].summoned is True
    assert fc.thread_state[tid].failed_reply_count == 1


# ── The two forwarders must agree on the same log ───────────────────────────

def test_both_forwarders_fold_the_same_log_identically(tmp_path, monkeypatch):
    """The cap drifts the moment these two disagree — hence one shared fold."""
    state_file = tmp_path / "thread_state.jsonl"
    monkeypatch.setattr(fc, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(fc, "THREAD_STATE_FILE", str(state_file))
    monkeypatch.setattr(dmod, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(dmod, "_feedback_path", lambda name: str(tmp_path / name))
    fc.thread_state.clear()

    tid = "t-agree"
    fc._record_thread_event(tid, "summoned")
    fc._record_thread_event(tid, "bot_reply")          # legacy row
    rid = fc._reserve_reply(tid)
    fc._settle_reply(tid, rid, delivered=True)
    rid = fc._reserve_reply(tid)
    fc._settle_reply(tid, rid, delivered=False)
    fc._reserve_reply(tid)                              # still in flight

    assert fc.thread_state[tid].bot_reply_count == 3    # 2 accepted + 1 pending
    assert dmod._read_thread_state(tid)["bot_reply_count"] == 3


# ── Failures are durably visible, not absorbed ──────────────────────────────

def test_failure_leaves_a_durable_record(daemon):
    """Pre-fix, a failed forward left no trace outside stderr, so a suppressed
    thread could not be told apart from a normally-exhausted one."""
    tid = "t-visible"
    rid = daemon._reserve_reply(tid)
    daemon._settle_reply(tid, rid, delivered=False)

    rows = _events(daemon.THREAD_STATE_FILE)
    kinds = [r["event"] for r in rows]
    assert EVENT_PENDING in kinds
    assert EVENT_FAILED in kinds
    failed = [r for r in rows if r["event"] == EVENT_FAILED]
    assert failed[0]["reservation_id"] == rid, "the failure names the reservation it released"
    assert daemon.thread_state[tid].failed_reply_count == 1


# ── A crashed process must not leak its reservation forever ─────────────────

def test_abandoned_reservation_stops_counting_after_the_ttl():
    """A process that dies between reserving and settling would otherwise
    reproduce the original bug with a smaller window."""
    cap = ReplyCapacity()
    apply_event(cap, EVENT_PENDING, "rid-stale", ts="2020-01-01T00:00:00+00:00")
    assert cap.charged() == 0, "a reservation from 2020 is not in flight"

    fresh = ReplyCapacity()
    apply_event(fresh, EVENT_PENDING, "rid-live", ts=None)
    assert fresh.charged() == 1, "an unparseable timestamp charges (fail toward the cap)"

    live = ReplyCapacity()
    apply_event(live, EVENT_PENDING, "rid-now", ts=fc._now_iso())
    assert live.charged() == 1


def test_fold_rows_ignores_other_threads_and_unknown_events():
    rows = [
        {"thread_id": "a", "event": EVENT_PENDING, "reservation_id": "r1", "ts": None},
        {"thread_id": "b", "event": EVENT_PENDING, "reservation_id": "r2", "ts": None},
        {"thread_id": "a", "event": "something_new", "reservation_id": None, "ts": None},
        {"event": EVENT_ACCEPTED, "reservation_id": "r9"},  # no thread_id
    ]
    folded = fold_rows(rows, thread_id="a")
    assert set(folded) == {"a"}
    assert folded["a"].charged() == 1
