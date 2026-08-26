"""Tests for the DISCORD_READ_ONLY env-flag gate.

When DISCORD_READ_ONLY=1, every Discord-write code path (the auto-firing
on_thread_create handler is event-driven and tested separately; here we
cover the agent-callable tool functions) must abort before making the API
call and return an error dict. Without the flag, the gate must not interfere.
"""

import os
from unittest.mock import patch

import pytest

from src.discord.discord import (
    CreateChannelArgs,
    ModerateMessageArgs,
    SendMessageArgs,
    _read_only_blocked,
    create_channel,
    moderate_message,
    send_message,
)


def test_read_only_blocked_true_when_env_set():
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "1"}, clear=False):
        assert _read_only_blocked("test action") is True


def test_read_only_blocked_false_when_env_unset():
    env = {k: v for k, v in os.environ.items() if k != "DISCORD_READ_ONLY"}
    with patch.dict(os.environ, env, clear=True):
        assert _read_only_blocked("test action") is False


def test_read_only_blocked_false_when_env_other_value():
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "0"}, clear=False):
        assert _read_only_blocked("test action") is False
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "true"}, clear=False):
        # Only "1" enables — anything else is off
        assert _read_only_blocked("test action") is False


@pytest.mark.asyncio
async def test_send_message_blocked_when_read_only():
    args = SendMessageArgs(channel_id="123", content="hello")
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "1"}, clear=False):
        result = await send_message(args)
    assert "error" in result
    assert "DISCORD_READ_ONLY=1" in result["error"]


@pytest.mark.asyncio
async def test_moderate_message_blocked_when_read_only():
    args = ModerateMessageArgs(channel_id="123", message_id="456", reason="test")
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "1"}, clear=False):
        result = await moderate_message(args)
    assert "error" in result
    assert "DISCORD_READ_ONLY=1" in result["error"]


@pytest.mark.asyncio
async def test_create_channel_blocked_when_read_only():
    args = CreateChannelArgs(server_id="123", name="test", type="text")
    with patch.dict(os.environ, {"DISCORD_READ_ONLY": "1"}, clear=False):
        result = await create_channel(args)
    assert "error" in result
    assert "DISCORD_READ_ONLY=1" in result["error"]
