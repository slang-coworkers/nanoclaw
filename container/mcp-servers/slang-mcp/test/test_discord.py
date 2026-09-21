"""Tests for Discord API integration."""

import os
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import dotenv
import pytest

import discord

# Load environment variables for testing
dotenv.load_dotenv()

from src.discord import (  # noqa: E402
    CreateThreadArgs,
    GetUserInfoArgs,
    ReadMessagesArgs,
    SendMessageArgs,
    create_thread,
    get_user_info,
    read_messages,
    send_message,
)


@pytest.fixture
def mock_discord_client():
    """Mock for Discord client."""
    mock_client = MagicMock()
    # Ensure sync methods don't return coroutines
    mock_client.get_user = MagicMock()
    mock_client.get_channel = MagicMock()
    with patch("src.discord.discord.client", mock_client):
        yield mock_client


@pytest.fixture
def mock_init_discord_client(mock_discord_client):
    """Mock for init_discord_client function."""
    with (
        patch("src.discord.discord.init_discord_client") as mock_init,
        patch("src.discord.discord.ensure_client_connected") as mock_ensure,
    ):
        mock_init.return_value = AsyncMock()

        # ensure_client_connected should make sure the client is available
        async def mock_ensure_func():
            # Make sure the global client variable is set to our mock
            import src.discord.discord as discord_module

            discord_module.client = mock_discord_client
            return mock_discord_client

        mock_ensure.side_effect = mock_ensure_func
        yield mock_init


@pytest.fixture
def allow_send_channel(monkeypatch):
    """Permit sending to the channel these tests mock.

    `send_message` grew a DISCORD_ALLOWED_SEND_CHANNELS allow-list after these
    tests were written, and nothing ran them, so they sat red: every send
    returned "No allowed send channels or forums configured". Granting the
    permission HERE rather than in conftest keeps the guard on by default for
    every other test — a blanket default would quietly disable a safety
    allow-list across the suite.
    """
    monkeypatch.setenv("DISCORD_ALLOWED_SEND_CHANNELS", "67890")


@pytest.mark.asyncio
async def test_send_message(mock_discord_client, mock_init_discord_client, allow_send_channel):
    """Test send_message function."""
    # Setup mock channel and message
    mock_channel = AsyncMock()
    mock_message = MagicMock()
    mock_message.id = 12345
    mock_message.channel.id = 67890
    mock_message.content = "Test message"
    mock_message.created_at = datetime.now()
    mock_message.jump_url = "https://discord.com/channels/123/67890/12345"

    # Configure mocks
    mock_discord_client.get_channel.return_value = mock_channel
    mock_channel.send.return_value = mock_message

    # Test function
    args = SendMessageArgs(channel_id="67890", content="Test message")
    with patch.dict(os.environ, {"DISCORD_ALLOWED_SEND_CHANNELS": "67890"}, clear=False):
        result = await send_message(args)

    # Verify results
    assert "message_id" in result
    assert "channel_id" in result
    assert "content" in result
    assert "timestamp" in result
    assert "url" in result
    assert result["message_id"] == "12345"
    assert result["channel_id"] == "67890"
    assert result["content"] == "Test message"
    assert result["url"] == "https://discord.com/channels/123/67890/12345"

    # Verify client was used correctly
    mock_discord_client.get_channel.assert_called_once_with(67890)
    # `view=` arrived with SummonView after this assertion was written, and
    # nothing ran the suite, so the drift went unnoticed.
    mock_channel.send.assert_called_once_with("Test message", view=None)


@pytest.mark.asyncio
async def test_send_message_to_thread_in_allowed_channel(
    mock_discord_client, mock_init_discord_client
):
    """Threads inherit the parent text channel's send allowlist."""
    mock_parent = MagicMock(spec=discord.TextChannel)
    mock_parent.id = 67890
    mock_thread = MagicMock(spec=discord.Thread)
    mock_thread.id = 111
    mock_thread.parent = mock_parent
    mock_thread.parent_id = 67890
    mock_message = MagicMock()
    mock_message.id = 222
    mock_message.channel.id = 111
    mock_message.content = "Thread reply"
    mock_message.created_at = datetime.now()
    mock_message.jump_url = "https://discord.com/channels/1/111/222"
    mock_thread.send = AsyncMock(return_value=mock_message)
    mock_discord_client.get_channel.return_value = mock_thread

    args = SendMessageArgs(channel_id="111", content="Thread reply")
    with patch.dict(os.environ, {"DISCORD_ALLOWED_SEND_CHANNELS": "67890"}, clear=False):
        result = await send_message(args)

    assert result["message_id"] == "222"
    assert result["channel_id"] == "111"
    mock_thread.send.assert_called_once_with("Thread reply", view=None)


@pytest.mark.asyncio
async def test_send_message_to_thread_rejects_unlisted_parent(
    mock_discord_client, mock_init_discord_client
):
    mock_parent = MagicMock(spec=discord.TextChannel)
    mock_parent.id = 99999
    mock_thread = MagicMock(spec=discord.Thread)
    mock_thread.id = 111
    mock_thread.parent = mock_parent
    mock_thread.parent_id = 99999
    mock_thread.send = AsyncMock()
    mock_discord_client.get_channel.return_value = mock_thread

    args = SendMessageArgs(channel_id="111", content="nope")
    with patch.dict(os.environ, {"DISCORD_ALLOWED_SEND_CHANNELS": "67890"}, clear=False):
        result = await send_message(args)

    assert result["error"] == "Channel 111 is not in the allowed send list"
    mock_thread.send.assert_not_called()


@pytest.mark.asyncio
async def test_read_messages(mock_discord_client, mock_init_discord_client):
    """Test read_messages function."""
    # Setup mock channel and messages - use spec to match TextChannel
    mock_channel = AsyncMock(spec=discord.TextChannel)
    mock_channel.name = "test-channel"
    mock_channel.type = discord.ChannelType.text

    # Create message history
    mock_messages = []
    for i in range(3):
        mock_message = MagicMock()
        mock_message.id = i + 1
        mock_message.content = f"Message {i+1}"
        mock_message.created_at = datetime.now() - timedelta(hours=i)
        mock_message.edited_at = None
        mock_message.author.id = 123
        mock_message.author.name = "TestUser"
        mock_message.author.display_name = "Test User"
        mock_message.author.bot = False
        mock_message.attachments = []
        mock_message.embeds = []
        mock_message.mentions = []
        mock_message.role_mentions = []
        mock_message.pinned = False
        mock_message.jump_url = f"https://discord.com/channels/123/67890/{i+1}"
        mock_messages.append(mock_message)

    # Configure mocks
    mock_discord_client.get_channel.return_value = mock_channel

    # Setup async iterator for mock history
    async def mock_history_iterator():
        for msg in mock_messages:
            yield msg

    # Mock the history method to return an async iterable
    mock_channel.history.return_value = mock_history_iterator()

    # Test function
    args = ReadMessagesArgs(channel_id="67890", limit=3)
    result = await read_messages(args)

    # Verify results - the function returns a nested structure
    assert "filtered" in result
    assert "channel_id" in result["filtered"]
    assert "channel_name" in result["filtered"]
    assert "messages" in result["filtered"]
    assert "total_count" in result["filtered"]
    assert result["filtered"]["channel_id"] == "67890"
    assert result["filtered"]["channel_name"] == "test-channel"
    assert len(result["filtered"]["messages"]) == 3
    # Check first message content
    assert result["filtered"]["messages"][0]["content"] == "Message 1"

    # Verify client was used correctly
    mock_discord_client.get_channel.assert_called_once_with(67890)
    mock_channel.history.assert_called_once_with(limit=3)


@pytest.mark.asyncio
async def test_get_user_info(mock_discord_client, mock_init_discord_client):
    """Test get_user_info function."""
    # Setup mock user
    mock_user = MagicMock()
    mock_user.id = 123
    mock_user.name = "TestUser"
    mock_user.display_name = "Test User"
    mock_user.discriminator = "1234"
    mock_user.bot = False
    mock_user.created_at = datetime.now() - timedelta(days=30)
    mock_user.avatar = MagicMock()
    mock_user.avatar.url = "https://cdn.discordapp.com/avatars/123/abc123.png"
    mock_user.banner = None

    # Configure mocks - get_user should return a regular mock, not async
    mock_discord_client.get_user.return_value = mock_user

    # Test function
    args = GetUserInfoArgs(user_id="123")
    result = await get_user_info(args)

    # Verify results
    assert "id" in result
    assert "name" in result
    assert "display_name" in result
    assert "discriminator" in result
    assert "bot" in result
    assert "created_at" in result
    assert "avatar_url" in result
    assert result["id"] == "123"
    assert result["name"] == "TestUser"
    assert result["display_name"] == "Test User"
    assert result["discriminator"] == "1234"
    assert result["bot"] is False
    assert result["avatar_url"] == "https://cdn.discordapp.com/avatars/123/abc123.png"

    # Verify client was used correctly
    mock_discord_client.get_user.assert_called_once_with(123)


@pytest.mark.asyncio
async def test_send_message_channel_not_found(
    mock_discord_client, mock_init_discord_client, allow_send_channel
):
    """Test send_message function when channel is not found."""
    # Setup mocks
    mock_discord_client.get_channel.return_value = None
    mock_discord_client.fetch_channel.side_effect = Exception("Channel not found")

    # Test function
    args = SendMessageArgs(channel_id="99999", content="Test message")
    with patch.dict(os.environ, {"DISCORD_ALLOWED_SEND_CHANNELS": "99999"}, clear=False):
        result = await send_message(args)

    # Verify error is returned
    assert "error" in result
    assert "Channel not found" in result["error"]

    # Verify client was used correctly
    mock_discord_client.get_channel.assert_called_once_with(99999)


def _thread_env():
    return patch.dict(
        os.environ,
        {"DISCORD_ALLOWED_SEND_CHANNELS": "67890", "DISCORD_READ_ONLY": "0"},
        clear=False,
    )


def _mock_thread(*, thread_id=111, name="Status report", parent_id=67890):
    mock_thread = MagicMock(spec=discord.Thread)
    mock_thread.id = thread_id
    mock_thread.name = name
    mock_thread.parent_id = parent_id
    mock_thread.jump_url = f"https://discord.com/channels/1/{thread_id}"
    return mock_thread


@pytest.mark.asyncio
async def test_create_thread_standalone(mock_discord_client, mock_init_discord_client):
    """Standalone public thread when message_id is omitted."""
    mock_channel = MagicMock(spec=discord.TextChannel)
    mock_thread = _mock_thread()
    mock_channel.create_thread = AsyncMock(return_value=mock_thread)
    mock_discord_client.get_channel.return_value = mock_channel

    args = CreateThreadArgs(channel_id="67890", name="Status report")
    with _thread_env():
        result = await create_thread(args)

    assert result == {
        "thread_id": "111",
        "thread_name": "Status report",
        "channel_id": "67890",
        "url": "https://discord.com/channels/1/111",
    }
    mock_channel.create_thread.assert_called_once_with(
        name="Status report",
        type=discord.ChannelType.public_thread,
        auto_archive_duration=1440,
    )


@pytest.mark.asyncio
async def test_create_thread_from_message(mock_discord_client, mock_init_discord_client):
    """Thread attached to an existing channel message."""
    mock_channel = MagicMock(spec=discord.TextChannel)
    mock_message = MagicMock()
    mock_message.id = 555
    mock_thread = _mock_thread(name="Daily report")
    mock_message.create_thread = AsyncMock(return_value=mock_thread)
    mock_channel.fetch_message = AsyncMock(return_value=mock_message)
    mock_discord_client.get_channel.return_value = mock_channel

    args = CreateThreadArgs(
        channel_id="67890",
        name="Daily report",
        message_id="555",
        auto_archive_duration=10080,
    )
    with _thread_env():
        result = await create_thread(args)

    assert result["thread_id"] == "111"
    assert result["message_id"] == "555"
    assert result["thread_name"] == "Daily report"
    mock_channel.fetch_message.assert_called_once_with(555)
    mock_message.create_thread.assert_called_once_with(
        name="Daily report",
        auto_archive_duration=10080,
    )
    mock_channel.create_thread.assert_not_called()


@pytest.mark.asyncio
async def test_create_thread_rejects_forum(mock_discord_client, mock_init_discord_client):
    mock_channel = MagicMock(spec=discord.ForumChannel)
    mock_discord_client.get_channel.return_value = mock_channel

    args = CreateThreadArgs(channel_id="67890", name="Nope")
    with _thread_env():
        result = await create_thread(args)

    assert "error" in result
    assert "discord_send_message" in result["error"]
    assert "thread_name" in result["error"]


@pytest.mark.asyncio
async def test_create_thread_rejects_existing_thread(
    mock_discord_client, mock_init_discord_client
):
    mock_channel = MagicMock(spec=discord.Thread)
    mock_discord_client.get_channel.return_value = mock_channel

    args = CreateThreadArgs(channel_id="67890", name="Nope")
    with _thread_env():
        result = await create_thread(args)

    assert "error" in result
    assert "already a thread" in result["error"]


@pytest.mark.asyncio
async def test_create_thread_not_on_allowlist(
    mock_discord_client, mock_init_discord_client
):
    args = CreateThreadArgs(channel_id="99999", name="Status")
    with patch.dict(
        os.environ, {"DISCORD_ALLOWED_SEND_CHANNELS": "67890"}, clear=False
    ):
        result = await create_thread(args)

    assert result["error"] == "Channel 99999 is not in the allowed send list"
    mock_discord_client.get_channel.assert_not_called()


@pytest.mark.asyncio
async def test_create_thread_message_missing(
    mock_discord_client, mock_init_discord_client
):
    mock_channel = MagicMock(spec=discord.TextChannel)
    mock_channel.fetch_message = AsyncMock(
        side_effect=discord.NotFound(MagicMock(), "missing")
    )
    mock_discord_client.get_channel.return_value = mock_channel

    args = CreateThreadArgs(channel_id="67890", name="Status", message_id="1")
    with _thread_env():
        result = await create_thread(args)

    assert "error" in result
    assert "not found" in result["error"]
