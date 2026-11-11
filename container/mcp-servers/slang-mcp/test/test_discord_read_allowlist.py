"""Tests for the read allowlist on discord_read_messages.

The read tool returns every author's text, bots included, from any channel the
bot can see, and it never passes the host router, so it needs its own channel
gate. DISCORD_ALLOWED_READ_CHANNELS / DISCORD_ALLOWED_READ_FORUMS mirror the
send allowlist: a listed channel, a listed forum, or a thread whose parent is
listed. Unset means no restriction, so existing readers keep working until the
operator sets the list. A failed parent lookup is refused.
"""

import os
from unittest.mock import AsyncMock, patch

import pytest

from src.discord.discord import ReadMessagesArgs, read_messages

ALLOWLIST_KEYS = ("DISCORD_ALLOWED_READ_CHANNELS", "DISCORD_ALLOWED_READ_FORUMS")


def _env(**values):
    env = {k: v for k, v in os.environ.items() if k not in ALLOWLIST_KEYS}
    env.update(values)
    return patch.dict(os.environ, env, clear=True)


def _rest_ok():
    return AsyncMock(return_value={"filtered": {"channel_id": "x", "messages": [], "total_count": 0}})


@pytest.mark.asyncio
async def test_unset_allowlist_reads_any_channel():
    rest = _rest_ok()
    with _env(), patch("src.discord.discord.discord_rest_read_messages", rest), patch(
        "src.discord.discord._channel_parent_id", AsyncMock()
    ) as parent:
        result = await read_messages(ReadMessagesArgs(channel_id="111", limit=5))
    assert "error" not in result
    rest.assert_awaited_once_with("111", 5)
    parent.assert_not_awaited()


@pytest.mark.asyncio
async def test_listed_channel_is_read_without_a_parent_lookup():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_CHANNELS="111, 222"), patch(
        "src.discord.discord.discord_rest_read_messages", rest
    ), patch("src.discord.discord._channel_parent_id", AsyncMock()) as parent:
        result = await read_messages(ReadMessagesArgs(channel_id="222", limit=5))
    assert "error" not in result
    parent.assert_not_awaited()


@pytest.mark.asyncio
async def test_listed_forum_itself_is_read():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_FORUMS="900"), patch("src.discord.discord.discord_rest_read_messages", rest):
        result = await read_messages(ReadMessagesArgs(channel_id="900", limit=5))
    assert "error" not in result


@pytest.mark.asyncio
async def test_thread_inside_listed_forum_is_read():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_FORUMS="900"), patch(
        "src.discord.discord.discord_rest_read_messages", rest
    ), patch("src.discord.discord._channel_parent_id", AsyncMock(return_value="900")):
        result = await read_messages(ReadMessagesArgs(channel_id="4242", limit=5))
    assert "error" not in result
    rest.assert_awaited_once()


@pytest.mark.asyncio
async def test_thread_inside_listed_channel_is_read():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_CHANNELS="111"), patch(
        "src.discord.discord.discord_rest_read_messages", rest
    ), patch("src.discord.discord._channel_parent_id", AsyncMock(return_value="111")):
        result = await read_messages(ReadMessagesArgs(channel_id="4242", limit=5))
    assert "error" not in result


@pytest.mark.asyncio
async def test_unlisted_channel_is_refused_and_not_read():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_CHANNELS="111"), patch(
        "src.discord.discord.discord_rest_read_messages", rest
    ), patch("src.discord.discord._channel_parent_id", AsyncMock(return_value="555")):
        result = await read_messages(ReadMessagesArgs(channel_id="4242", limit=5))
    assert result == {"error": "Channel 4242 is not in the allowed read list"}
    rest.assert_not_awaited()


@pytest.mark.asyncio
async def test_failed_parent_lookup_is_refused():
    rest = _rest_ok()
    with _env(DISCORD_ALLOWED_READ_FORUMS="900"), patch(
        "src.discord.discord.discord_rest_read_messages", rest
    ), patch("src.discord.discord._channel_parent_id", AsyncMock(side_effect=RuntimeError("403"))):
        result = await read_messages(ReadMessagesArgs(channel_id="4242", limit=5))
    assert result == {"error": "Channel 4242 is not in the allowed read list"}
    rest.assert_not_awaited()
