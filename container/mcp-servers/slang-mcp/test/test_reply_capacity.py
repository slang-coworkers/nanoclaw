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

import pytest

from src.discord import discord as dmod
from src.discord import feedback_collector as fc
from src.discord import reply_capacity as rc
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


# ── Age is not evidence of failure ──────────────────────────────────────────
#
# This block REPLACES a test that asserted the opposite — that a reservation
# older than the TTL stops counting. That behaviour was the P1: the crash it was
# aimed at (append pending, get HTTP 200, die before appending accepted) leaves a
# reservation that is old AND delivered, so expiring it forgets a reply the user
# can see and lets the next admission pass the cap. The TTL is now a reporting
# threshold only.

def test_an_old_unsettled_reservation_stays_charged():
    """The crash-after-200 case: old, unsettled, and possibly delivered."""
    cap = ReplyCapacity()
    apply_event(cap, EVENT_PENDING, "rid-stale", ts="2020-01-01T00:00:00+00:00")
    assert cap.charged() == 1, "age is not proof the reply was never delivered"

    fresh = ReplyCapacity()
    apply_event(fresh, EVENT_PENDING, "rid-live", ts=None)
    assert fresh.charged() == 1, "an unparseable timestamp charges too"

    live = ReplyCapacity()
    apply_event(live, EVENT_PENDING, "rid-now", ts=fc._now_iso())
    assert live.charged() == 1


def test_an_old_unsettled_reservation_is_reported_as_unresolved():
    """Still charged, but explicitly — so it can be surfaced and settled."""
    cap = ReplyCapacity()
    apply_event(cap, EVENT_PENDING, "rid-stale", ts="2020-01-01T00:00:00+00:00")
    apply_event(cap, EVENT_PENDING, "rid-now", ts=fc._now_iso())

    assert cap.unresolved_ids() == ["rid-stale"]
    assert cap.live_pending() == 1, "the fresh one is still plausibly in flight"
    assert cap.charged() == 2, "both are charged regardless"


def test_settling_an_unresolved_reservation_releases_it():
    """The operator path: a deliberate terminal row, not an automatic refund."""
    cap = ReplyCapacity()
    apply_event(cap, EVENT_PENDING, "rid-stale", ts="2020-01-01T00:00:00+00:00")
    assert cap.charged() == 1

    apply_event(cap, EVENT_FAILED, "rid-stale")
    assert cap.charged() == 0
    assert cap.unresolved_ids() == []
    assert cap.failed == 1


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


# ── Settlement is a state machine (P1-b) ────────────────────────────────────
#
# Before the fix every terminal row incremented unconditionally, so a duplicate
# audit row, a retry, or an out-of-order pair double-counted or refunded
# something already charged. Reservation ids are single-settlement keys now.

def _reserved(rid: str = "r1") -> ReplyCapacity:
    cap = ReplyCapacity()
    apply_event(cap, EVENT_PENDING, rid, ts=fc._now_iso())
    return cap


def test_duplicate_accepted_charges_once():
    cap = _reserved()
    apply_event(cap, EVENT_ACCEPTED, "r1")
    apply_event(cap, EVENT_ACCEPTED, "r1")
    apply_event(cap, EVENT_ACCEPTED, "r1")

    assert cap.accepted == 1, "a replayed audit row is not a second reply"
    assert cap.charged() == 1
    assert cap.duplicates == 2
    assert cap.conflicts == 0


def test_duplicate_failed_refunds_once():
    cap = _reserved()
    apply_event(cap, EVENT_FAILED, "r1")
    apply_event(cap, EVENT_FAILED, "r1")

    assert cap.failed == 1, "one failure, however many times it was logged"
    assert cap.charged() == 0
    assert cap.duplicates == 1


def test_accepted_after_failed_restores_the_charge():
    """A delivered reply must consume quota even if a failure was logged first."""
    cap = _reserved()
    apply_event(cap, EVENT_FAILED, "r1")
    assert cap.charged() == 0

    apply_event(cap, EVENT_ACCEPTED, "r1")
    assert cap.charged() == 1, "the reply went out — it has to be charged"
    assert cap.accepted == 1
    assert cap.failed == 0, "the refund is withdrawn, not double-counted"
    assert cap.conflicts == 1, "and the contradiction is visible"


def test_failed_after_accepted_keeps_the_charge():
    """A late failure row must never refund a reply that was delivered."""
    cap = _reserved()
    apply_event(cap, EVENT_ACCEPTED, "r1")
    apply_event(cap, EVENT_FAILED, "r1")

    assert cap.charged() == 1
    assert cap.accepted == 1
    assert cap.failed == 0
    assert cap.conflicts == 1


def test_replaying_the_whole_log_is_idempotent():
    """Fold the same rows twice — a restart re-reading the audit log."""
    rows = [
        {"thread_id": "t", "event": EVENT_PENDING, "reservation_id": "a", "ts": fc._now_iso()},
        {"thread_id": "t", "event": EVENT_ACCEPTED, "reservation_id": "a"},
        {"thread_id": "t", "event": EVENT_PENDING, "reservation_id": "b", "ts": fc._now_iso()},
        {"thread_id": "t", "event": EVENT_FAILED, "reservation_id": "b"},
    ]
    once = fold_rows(rows, thread_id="t")["t"]
    twice = fold_rows(rows + rows, thread_id="t")["t"]

    assert once.charged() == twice.charged() == 1
    assert once.accepted == twice.accepted == 1
    assert once.failed == twice.failed == 1


def test_orphan_terminal_rows_have_defined_behaviour():
    """Terminals whose reservation row is absent — a truncated log."""
    accepted_orphan = ReplyCapacity()
    apply_event(accepted_orphan, EVENT_ACCEPTED, "gone")
    assert accepted_orphan.charged() == 1, "a delivered reply is charged even so"
    assert accepted_orphan.orphan_terminals == 1

    failed_orphan = ReplyCapacity()
    apply_event(failed_orphan, EVENT_FAILED, "gone")
    assert failed_orphan.charged() == 0, "nothing was reserved, so nothing is released"
    assert failed_orphan.failed == 1
    assert failed_orphan.orphan_terminals == 1

    # …and an orphan is still single-settlement.
    apply_event(failed_orphan, EVENT_FAILED, "gone")
    assert failed_orphan.failed == 1
    assert failed_orphan.duplicates == 1


def test_duplicate_reservation_row_reserves_once():
    cap = _reserved()
    apply_event(cap, EVENT_PENDING, "r1", ts=fc._now_iso())
    assert cap.charged() == 1
    assert cap.duplicates == 1


def test_a_settled_id_cannot_be_reserved_again():
    """Replaying pending AFTER its terminal must not re-charge the thread."""
    cap = _reserved()
    apply_event(cap, EVENT_ACCEPTED, "r1")
    apply_event(cap, EVENT_PENDING, "r1", ts=fc._now_iso())

    assert cap.charged() == 1
    assert cap.duplicates == 1


# ── The crash-after-200 case (P1-a) ─────────────────────────────────────────
#
# The exact sequence the TTL refund could not survive: append `reply_pending`,
# receive HTTP 200 from ingress, die before appending `reply_accepted`. The
# reply IS delivered and the user can see it. Age must not hand the quota back.

def test_crash_after_ingress_200_keeps_the_charge_across_a_restart(daemon, monkeypatch):
    tid = "t-crash"
    # A reply was reserved and POSTed. Ingress said 200. The process then died,
    # so no terminal row was ever appended.
    daemon._reserve_reply(tid)
    assert daemon.thread_state[tid].bot_reply_count == 1

    # Restart: a fresh process replays the audit log from disk.
    daemon.thread_state.clear()
    daemon._load_thread_state()
    assert daemon.thread_state[tid].bot_reply_count == 1, "the delivered reply is still charged"

    # …and it stays charged however old it gets. Before the fix this dropped to
    # 0 once the reservation aged past the TTL, and the next admission could
    # take the thread past the cap on a reply the user had already received.
    monkeypatch.setattr(rc, "REPLY_PENDING_TTL_SECS", 0)
    daemon.thread_state.clear()
    daemon._load_thread_state()
    assert daemon.thread_state[tid].bot_reply_count == 1, "age is not evidence of failure"
    assert daemon.thread_state[tid].unresolved_reply_count == 1, "but it IS reported"


def test_crash_after_200_cannot_push_a_thread_past_the_cap(daemon, monkeypatch):
    """The user-visible consequence: a 16th reply on a 15-reply cap."""
    tid = "t-crash-cap"
    cap = fc.MAX_BOT_REPLIES_PER_THREAD
    monkeypatch.setattr(rc, "REPLY_PENDING_TTL_SECS", 0)  # everything looks "abandoned"

    for _ in range(cap):
        daemon._reserve_reply(tid)  # each POST returned 200; each process died

    daemon.thread_state.clear()
    daemon._load_thread_state()

    charged = daemon.thread_state[tid].bot_reply_count
    assert charged == cap, f"{cap} delivered replies are still {cap} charges, not 0"
    assert charged >= cap, "so the admission gate is closed — no 16th reply"
    assert daemon.thread_state[tid].unresolved_reply_count == cap


# ── The operator path for unresolved reservations ───────────────────────────

def test_admin_lists_unresolved_and_exits_nonzero(tmp_path, monkeypatch, capsys):
    from src.discord import reply_capacity_admin as admin

    monkeypatch.setattr(admin, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(rc, "REPLY_PENDING_TTL_SECS", 0)
    path = tmp_path / "thread_state.jsonl"
    path.write_text(
        json.dumps({"thread_id": "t1", "event": EVENT_PENDING,
                    "reservation_id": "stuck", "ts": "2020-01-01T00:00:00+00:00"}) + "\n"
    )

    rc_code = admin.main(["list"])
    out = capsys.readouterr().out
    assert rc_code == 1, "a held charge with no known outcome is not a clean state"
    assert "stuck" in out and "unresolved=1" in out


def test_admin_settle_releases_the_charge(tmp_path, monkeypatch, capsys):
    from src.discord import reply_capacity_admin as admin

    monkeypatch.setattr(admin, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(rc, "REPLY_PENDING_TTL_SECS", 0)
    path = tmp_path / "thread_state.jsonl"
    path.write_text(
        json.dumps({"thread_id": "t1", "event": EVENT_PENDING,
                    "reservation_id": "stuck", "ts": "2020-01-01T00:00:00+00:00"}) + "\n"
    )

    assert admin.main(["settle", "t1", "stuck", "--failed"]) == 0
    assert admin.main(["list"]) == 0, "nothing is unresolved any more"

    rows = [json.loads(x) for x in path.read_text().splitlines() if x.strip()]
    assert rows[-1]["event"] == EVENT_FAILED
    assert rows[-1]["settled_by"] == "operator", "a human decision is marked as one"
    assert fold_rows(rows, "t1")["t1"].charged() == 0


def test_admin_refuses_to_settle_twice(tmp_path, monkeypatch, capsys):
    """Settlement happens once — the tool has no privileged path around that."""
    from src.discord import reply_capacity_admin as admin

    monkeypatch.setattr(admin, "FEEDBACK_DIR", str(tmp_path))
    monkeypatch.setattr(rc, "REPLY_PENDING_TTL_SECS", 0)
    path = tmp_path / "thread_state.jsonl"
    path.write_text(
        json.dumps({"thread_id": "t1", "event": EVENT_PENDING,
                    "reservation_id": "stuck", "ts": "2020-01-01T00:00:00+00:00"}) + "\n"
    )

    assert admin.main(["settle", "t1", "stuck", "--failed"]) == 0
    assert admin.main(["settle", "t1", "stuck", "--accepted"]) == 2
    err = capsys.readouterr().err
    assert "already settled" in err


def test_admin_requires_exactly_one_outcome(tmp_path, monkeypatch):
    from src.discord import reply_capacity_admin as admin

    monkeypatch.setattr(admin, "FEEDBACK_DIR", str(tmp_path))
    assert admin.main(["settle", "t1", "r1"]) == 2
    assert admin.main(["settle", "t1", "r1", "--accepted", "--failed"]) == 2
