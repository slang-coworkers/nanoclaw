"""Tests for follow-up forwarding from the always-on feedback_collector daemon.

On prod the daemon (not slang-mcp) is the reliable forwarder: slang-mcp's
Discord Gateway is per-MCP-session and reaped after ~10 min idle, so its
forwarding on_message misses follow-ups. These tests cover the two extractable
units the daemon's on_message relies on:

  - _forward_followups_here() — the prod-vs-lego ownership gate that keeps
    exactly one process forwarding.
  - _post_to_dashboard(content, thread_id) — the ingress POST, which must
    include thread_id so each Discord thread routes to its own per-thread
    agent session (wiring is session_mode=per-thread).

The corresponding slang-mcp side gate (_forward_followups_disabled) is covered
too, to lock in that exactly one of the two processes forwards for a given
DISCORD_POST_SUMMON setting.
"""

import os
from unittest.mock import patch

from src.discord import feedback_collector as fc
from src.discord.discord import _forward_followups_disabled

# ── Ownership gate: daemon (feedback_collector) ─────────────────────────────

def test_daemon_forwards_by_default_prod():
    # Prod: DISCORD_POST_SUMMON unset, DISCORD_READ_ONLY unset → daemon forwards.
    env = {k: v for k, v in os.environ.items()
           if k not in ("DISCORD_POST_SUMMON", "DISCORD_READ_ONLY")}
    with patch.dict(os.environ, env, clear=True):
        assert fc._forward_followups_here() is True


def test_daemon_does_not_forward_when_post_summon_enabled():
    # DISCORD_POST_SUMMON=1 marks a no-daemon / lego / hot-failover install
    # where slang-mcp owns forwarding — the daemon must stay audit-only.
    with patch.dict(os.environ, {"DISCORD_POST_SUMMON": "1"}, clear=False):
        assert fc._forward_followups_here() is False


def test_daemon_does_not_forward_when_read_only():
    # DISCORD_READ_ONLY=1 (lego) hard-disables forwarding regardless of anything.
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "1"}, clear=False):
        assert fc._forward_followups_here() is False
    with patch.dict(
        os.environ, {"DISCORD_READ_ONLY": "1", "DISCORD_POST_SUMMON": "0"}, clear=False
    ):
        assert fc._forward_followups_here() is False


# ── Ownership gate: slang-mcp side is the mirror image ──────────────────────

def test_exactly_one_forwarder_prod():
    # Prod (POST_SUMMON unset): daemon forwards, slang-mcp does not.
    env = {k: v for k, v in os.environ.items() if k != "DISCORD_POST_SUMMON"}
    with patch.dict(os.environ, env, clear=True):
        assert fc._forward_followups_here() is True
        assert _forward_followups_disabled() is True  # slang-mcp: disabled


def test_exactly_one_forwarder_lego():
    # Lego / no-daemon (POST_SUMMON=1): slang-mcp forwards, daemon does not.
    with patch.dict(os.environ, {"DISCORD_POST_SUMMON": "1"}, clear=False):
        assert fc._forward_followups_here() is False
        assert _forward_followups_disabled() is False  # slang-mcp: enabled


# ── _post_to_dashboard thread_id passthrough ────────────────────────────────

def _capture_post_body(thread_id):
    """Call _post_to_dashboard with a mocked aiohttp and return the POST body."""
    captured = {}

    class _Resp:
        status = 200

        async def text(self):
            return "ok"

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

    class _Session:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        def post(self, url, json=None, headers=None, timeout=None):
            captured["body"] = json
            return _Resp()

    import asyncio
    with patch.object(fc.aiohttp, "ClientSession", lambda *a, **k: _Session()):
        ok = asyncio.run(fc._post_to_dashboard("hello", thread_id=thread_id))
    return ok, captured.get("body")


def test_post_to_dashboard_includes_thread_id():
    ok, body = _capture_post_body("123456789")
    assert ok is True
    assert body["group"] == fc.SUMMON_TARGET_GROUP
    assert body["content"] == "hello"
    assert body["thread_id"] == "123456789"


def test_post_to_dashboard_omits_thread_id_when_none():
    ok, body = _capture_post_body(None)
    assert ok is True
    assert "thread_id" not in body  # null thread_id → group catch-all session


# ── Cap accounting: summon pre-counts one bot_reply ─────────────────────────

def test_summon_records_bot_reply_toward_cap(tmp_path):
    # The daemon SummonView must pre-count the summon's own reply so the cap
    # math agrees with slang-mcp (both read the same thread_state.jsonl).
    tid = "thread-cap-test"
    with patch.object(fc, "FEEDBACK_DIR", str(tmp_path)), \
         patch.object(fc, "THREAD_STATE_FILE", str(tmp_path / "thread_state.jsonl")):
        fc.thread_state.clear()
        fc._record_thread_event(tid, "summoned")
        fc._record_thread_event(tid, "bot_reply")
        assert fc.thread_state[tid].summoned is True
        assert fc.thread_state[tid].bot_reply_count == 1
