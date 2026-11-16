"""Tests for the feedback collector's startup backfill of summon buttons.

on_thread_create posts the summon button only while the daemon is connected, so a forum
thread created during downtime never gets one. backfill_summon_buttons() replays that at
READY. These tests drive it with small fakes for the client, forum, thread and messages.
"""

from datetime import datetime, timedelta, timezone

import pytest

from src.discord import feedback_collector as fc

NOW = datetime(2026, 11, 16, 9, 0, tzinfo=timezone.utc)
BOT_ID = 42


class User:
    def __init__(self, uid):
        self.id = uid


class Child:
    def __init__(self, custom_id):
        self.custom_id = custom_id


class Row:
    def __init__(self, *custom_ids):
        self.children = [Child(c) for c in custom_ids]


class Message:
    def __init__(self, author_id, content="", custom_ids=()):
        self.author = User(author_id)
        self.content = content
        self.components = [Row(*custom_ids)] if custom_ids else []


class Thread:
    def __init__(self, tid, *, age_days=1.0, archived=False, locked=False, history=()):
        self.id = tid
        self.name = f"thread-{tid}"
        self.parent_id = 100
        self.created_at = NOW - timedelta(days=age_days)
        self.archived = archived
        self.locked = locked
        self._history = list(history)
        self.sent = []

    async def history(self, limit=50):
        for m in self._history[:limit]:
            yield m

    async def send(self, content, view=None):
        self.sent.append((content, view))


class Forum:
    def __init__(self, threads):
        self.id = 100
        self.threads = threads
        self.guild = None


class Client:
    def __init__(self, forum):
        self.user = User(BOT_ID)
        self._forum = forum

    def get_channel(self, cid):
        return self._forum if cid == self._forum.id else None

    async def fetch_channel(self, cid):
        raise LookupError(cid)


class FakeView:
    """Stands in for SummonView, which needs a running discord.py client."""


@pytest.fixture(autouse=True)
def collector(monkeypatch):
    monkeypatch.setattr(fc, "WATCHED_FORUM_IDS", {"100"})
    monkeypatch.setattr(fc, "SummonView", FakeView)
    monkeypatch.delenv("DISCORD_READ_ONLY", raising=False)
    monkeypatch.delenv("DISCORD_BACKFILL_DAYS", raising=False)
    return fc


async def run(threads):
    return await fc.backfill_summon_buttons(Client(Forum(threads)), now=NOW, pause_seconds=0)


@pytest.mark.asyncio
async def test_new_thread_without_button_gets_one():
    t = Thread(1, history=[Message(7, "my question")])
    counts = await run([t])
    assert counts["posted"] == 1
    assert len(t.sent) == 1
    text, view = t.sent[0]
    assert fc.SUMMON_MARKER in text
    assert isinstance(view, FakeView)


@pytest.mark.asyncio
async def test_thread_with_summon_button_is_skipped():
    t = Thread(2, history=[Message(BOT_ID, fc._summon_prompt_text(), [fc.SUMMON_CUSTOM_ID]), Message(7, "q")])
    counts = await run([t])
    assert counts == {"scanned": 1, "posted": 0, "had_button": 1, "skipped": 0, "errors": 0}
    assert t.sent == []


@pytest.mark.asyncio
async def test_button_found_by_text_when_components_are_missing():
    t = Thread(3, history=[Message(BOT_ID, fc._summon_prompt_text())])
    assert (await run([t]))["had_button"] == 1


@pytest.mark.asyncio
async def test_a_bot_reply_with_only_feedback_buttons_is_not_a_summon_button():
    t = Thread(4, history=[Message(BOT_ID, "Here is the answer.", ["feedback:helpful", "feedback:resolved"])])
    counts = await run([t])
    assert counts["posted"] == 1


@pytest.mark.asyncio
async def test_archived_and_locked_threads_are_skipped():
    a = Thread(5, archived=True)
    lk = Thread(6, locked=True)
    counts = await run([a, lk])
    assert counts["skipped"] == 2
    assert a.sent == [] and lk.sent == []


@pytest.mark.asyncio
async def test_threads_older_than_the_window_are_ignored(monkeypatch):
    monkeypatch.setenv("DISCORD_BACKFILL_DAYS", "3")
    old = Thread(7, age_days=4)
    counts = await run([old])
    assert counts["scanned"] == 0 and old.sent == []


@pytest.mark.asyncio
async def test_read_only_posts_nothing(monkeypatch):
    monkeypatch.setenv("DISCORD_READ_ONLY", "1")
    t = Thread(8)
    counts = await run([t])
    assert counts["posted"] == 0 and t.sent == []


@pytest.mark.asyncio
async def test_days_zero_turns_the_backfill_off(monkeypatch):
    monkeypatch.setenv("DISCORD_BACKFILL_DAYS", "0")
    t = Thread(9)
    counts = await run([t])
    assert counts["scanned"] == 0 and t.sent == []


def test_a_bad_days_value_keeps_the_default(monkeypatch):
    monkeypatch.setenv("DISCORD_BACKFILL_DAYS", "seven")
    assert fc._backfill_days() == fc.DEFAULT_BACKFILL_DAYS


def test_summon_text_is_unchanged():
    # The text is shared by on_thread_create and the backfill; this pins it so the refactor
    # changed nothing a user sees.
    assert fc._summon_prompt_text() == (
        "🤖 *Need help? Click below for a bot answer.*\n"
        f"*After the first reply, I'll keep responding to **your** follow-ups in this thread "
        f"(up to {fc.MAX_BOT_REPLIES_PER_THREAD} messages total). "
        f"Click **Resolved** on any of my replies to pause me; click again to resume.*"
    )
