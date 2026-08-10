"""Discord API integration module for MCP server."""
# pyright: reportOptionalMemberAccess=false, reportAttributeAccessIssue=false, reportCallIssue=false, reportArgumentType=false, reportGeneralTypeIssues=false, reportPossiblyUnboundVariable=false

import asyncio
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional

# Add dotenv import
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator

import aiohttp
import discord

# Load environment variables from .env file
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("discord-api")

# Discord client instance
client = None

# Initialize Discord bot with necessary intents
intents = discord.Intents.default()
intents.message_content = True
intents.members = True

from ..config import IsDebug  # noqa: E402
from .reply_capacity import (  # noqa: E402
    EVENT_ACCEPTED,
    EVENT_FAILED,
    EVENT_PENDING,
    fold_rows,
    new_reservation_id,
)

# ── Event Forwarding Config ─────────────────────────────────────────────────

DASHBOARD_INGRESS_URL = os.environ.get(
    "DASHBOARD_INGRESS_URL",
    f"http://127.0.0.1:{os.environ.get('DASHBOARD_INGRESS_PORT', '3839')}/api/dashboard/inbound",
)
DASHBOARD_SECRET = os.environ.get("DASHBOARD_SECRET", "").strip()
SUMMON_TARGET_GROUP = os.environ.get("SUMMON_TARGET_GROUP", "slang-discord-support")
WATCHED_FORUM_IDS = set(
    f.strip()
    for f in os.environ.get("DISCORD_WATCHED_FORUMS", "1494023079666647200,1313936640661524601").split(",")
    if f.strip()
)

# Continuation cap: maximum bot replies per summoned thread before the bot
# silently stops. Default 15. Counts bot's own answers; the agent is told on
# its final allowed reply to ask the user to open a new thread.
MAX_BOT_REPLIES_PER_THREAD = int(os.environ.get("MAX_BOT_REPLIES_PER_THREAD", "15"))


# ── Read-only mode + summon-post gate ──────────────────────────────────────
# DISCORD_READ_ONLY=1 hard-blocks every Discord-write code path (lego uses
# this; prod doesn't). DISCORD_POST_SUMMON=1 enables slang-mcp's
# on_thread_create to post the summon button — defaults OFF because
# feedback_collector.py is the canonical poster (eager-init makes slang-mcp
# a reliable fallback when feedback_collector is down). Both gates are
# defense-in-depth; the agent's allowed_mcp_tools list is the primary control.

def _read_only_blocked(action: str) -> bool:
    """Return True if DISCORD_READ_ONLY=1 — caller must abort the write."""
    if os.environ.get("DISCORD_READ_ONLY") == "1":
        logger.warning(f"DISCORD_READ_ONLY=1 — blocked Discord write: {action}")
        return True
    return False


def _post_summon_disabled() -> bool:
    """Return True when slang-mcp should NOT post SummonView in on_thread_create.

    Default is True — feedback_collector.py is the canonical SummonView poster.
    Set DISCORD_POST_SUMMON=1 only on installs that don't run feedback_collector.py
    and intentionally want slang-mcp to be the poster (or as a hot-failover).
    """
    return os.environ.get("DISCORD_POST_SUMMON", "0") != "1"


def _forward_followups_disabled() -> bool:
    """Return True when slang-mcp should NOT forward OP follow-ups in on_message.

    Default is True — on prod the always-on feedback_collector.py daemon is the
    canonical forwarder (this module's Gateway is per-MCP-session and reaped
    after ~10 min idle, so it can't reliably catch follow-ups). Forwarding
    follows the same ownership axis as summon-posting: only installs that run
    slang-mcp as the poster (DISCORD_POST_SUMMON=1, i.e. no daemon / lego /
    hot-failover) forward here. Keeping exactly one forwarder prevents a
    duplicate public reply when both processes' Gateways are momentarily warm.
    """
    return os.environ.get("DISCORD_POST_SUMMON", "0") != "1"


# ── Per-thread continuation state helpers ───────────────────────────────────
# State is sourced from two append-only audit files in the feedback dir:
#   summon_requests.jsonl — written when a user clicks "Get Bot Help"
#   thread_state.jsonl    — written by SummonView, FeedbackView, and on_message
# Read on every event (low traffic) instead of holding an in-memory cache,
# because feedback_collector.py and this module are two separate processes
# and would otherwise drift.

def _feedback_path(name: str) -> str:
    return os.path.join(os.environ.get("DISCORD_FEEDBACK_DIR", "/tmp/discord-feedback"), name)


def _has_summon(thread_id: str) -> bool:
    """True if the thread has at least one summon click recorded."""
    path = _feedback_path("summon_requests.jsonl")
    if not os.path.exists(path):
        return False
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    if json.loads(line).get("thread_id") == thread_id:
                        return True
                except Exception:
                    continue
    except Exception:
        return False
    return False


def _read_thread_state(thread_id: str) -> dict:
    """Replay thread_state.jsonl events and return current state for thread.

    `bot_reply_count` is the CHARGED count — delivered replies plus
    reservations still in flight — folded by reply_capacity.py, the same
    module the feedback_collector daemon folds with. A forward whose ingress
    POST failed is refunded and does not count. Shape is unchanged, so the
    admission gates below read it exactly as before.
    """
    state = {
        "resolved": False,
        "bot_reply_count": 0,
        "failed_reply_count": 0,
        "unresolved_reply_count": 0,
    }
    path = _feedback_path("thread_state.jsonl")
    if not os.path.exists(path):
        return state
    rows = []
    try:
        with open(path) as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except Exception:
                    continue
                if row.get("thread_id") != thread_id:
                    continue
                e = row.get("event")
                if e == "resolved":
                    state["resolved"] = True
                elif e == "unresolved":
                    state["resolved"] = False
                else:
                    rows.append(row)
    except Exception:
        pass
    cap = fold_rows(rows, thread_id).get(thread_id)
    if cap is not None:
        state["bot_reply_count"] = cap.charged()
        state["failed_reply_count"] = cap.failed
        # Charges held by reservations that never settled. They keep consuming
        # quota — see reply_capacity.py — so they are reported, not reclaimed.
        state["unresolved_reply_count"] = len(cap.unresolved_ids())
    return state


def _record_thread_event(thread_id: str, event: str, reservation_id: str | None = None) -> None:
    """Append an event to thread_state.jsonl."""
    path = _feedback_path("thread_state.jsonl")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    row = {
        "thread_id": thread_id,
        "event": event,
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    if reservation_id:
        row["reservation_id"] = reservation_id
    try:
        with open(path, "a") as f:
            f.write(json.dumps(row) + "\n")
    except Exception as e:
        logger.error(f"Failed to record thread event {event} for {thread_id}: {e}")


def _reserve_reply(thread_id: str) -> str:
    """Charge one reply BEFORE POSTing and return its reservation id.

    Mirror of the daemon's helper — see reply_capacity.py for why the charge
    has to precede the POST and why it must be refundable.
    """
    rid = new_reservation_id()
    _record_thread_event(thread_id, EVENT_PENDING, rid)
    return rid


def _settle_reply(thread_id: str, reservation_id: str, delivered: bool) -> None:
    """Keep the charge on delivery; refund it (durably) on failure."""
    _record_thread_event(
        thread_id, EVENT_ACCEPTED if delivered else EVENT_FAILED, reservation_id
    )


# ── REST-based Discord API (no Gateway needed, works through OneCLI proxy) ──

_discord_http_client: Optional["httpx.AsyncClient"] = None

DISCORD_API_BASE = "https://discord.com/api/v10"


async def _get_discord_http_client():
    """Get or create a shared httpx client for Discord REST API."""
    global _discord_http_client
    if _discord_http_client is None:
        import httpx
        from ..config import get_ssl_verify_config

        _discord_http_client = httpx.AsyncClient(
            verify=get_ssl_verify_config(),
            timeout=httpx.Timeout(30.0, connect=10.0),
        )
    return _discord_http_client


async def discord_rest_read_messages(channel_id: str, limit: int = 20) -> Dict[str, Any]:
    """Read messages from a Discord channel using REST API (no Gateway).

    Goes through OneCLI proxy which injects Bot token automatically.
    """
    import httpx

    client_http = await _get_discord_http_client()
    url = f"{DISCORD_API_BASE}/channels/{channel_id}/messages"
    params = {"limit": min(limit, 100)}

    try:
        resp = await client_http.get(url, params=params)
        resp.raise_for_status()
        messages = resp.json()

        filtered = []
        for msg in messages:
            filtered.append({
                "id": msg.get("id"),
                "author": msg.get("author", {}).get("username", "unknown"),
                "author_id": msg.get("author", {}).get("id"),
                "is_bot": msg.get("author", {}).get("bot", False),
                "content": msg.get("content", ""),
                "timestamp": msg.get("timestamp"),
                "attachments": [a.get("url") for a in msg.get("attachments", [])],
                "embeds_count": len(msg.get("embeds", [])),
            })

        return {
            "filtered": {
                "channel_id": channel_id,
                "messages": filtered,
                "total_count": len(filtered),
            }
        }
    except httpx.HTTPStatusError as e:
        return {"error": f"Discord API error {e.response.status_code}: {e.response.text[:200]}"}
    except Exception as e:
        return {"error": f"Discord REST request failed: {str(e)}"}


async def _post_to_dashboard(
    content: str, thread_id: str | None = None, reservation_id: str | None = None
) -> bool:
    """Forward an event to the dashboard ingress to wake the target agent."""
    if not DASHBOARD_INGRESS_URL:
        return False
    headers = {"Content-Type": "application/json"}
    if DASHBOARD_SECRET:
        headers["Authorization"] = f"Bearer {DASHBOARD_SECRET}"
    body = {"group": SUMMON_TARGET_GROUP, "content": content}
    # thread_id routes each Discord thread to its own per-thread agent session
    # (wiring is session_mode=per-thread); without it every thread collapses
    # into the group's single thread_id=null catch-all session.
    if thread_id:
        body["thread_id"] = thread_id
    # Sent so ingress CAN become idempotent and reconcilable later: with this id
    # echoed back, a crash between "HTTP 200" and "reply_accepted" would be
    # resolvable instead of merely visible. Ingress ignores it today; it costs
    # nothing to send and it is the half of the fix that lives on this side.
    if reservation_id:
        body["reservation_id"] = reservation_id
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                DASHBOARD_INGRESS_URL,
                json=body,
                headers=headers,
                timeout=aiohttp.ClientTimeout(total=5),
            ) as resp:
                if resp.status == 200:
                    return True
                text = await resp.text()
                logger.error(f"Dashboard ingress returned {resp.status}: {text}")
                return False
    except Exception as e:
        logger.error(f"Dashboard ingress POST failed: {e}")
        return False


# ── Summon View ─────────────────────────────────────────────────────────────

class SummonView(discord.ui.View):
    """'Get Bot Help' button auto-posted on new forum threads."""

    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Get Bot Help",
        style=discord.ButtonStyle.blurple,
        custom_id="summon:get_help",
        emoji="\U0001f916",
    )
    async def get_help(self, interaction: discord.Interaction, button: discord.ui.Button):
        channel = interaction.channel
        if isinstance(channel, discord.Thread) and channel.owner_id:
            if interaction.user.id != channel.owner_id:
                await interaction.response.send_message(
                    "Only the thread author can summon the bot.", ephemeral=True
                )
                return

        os.makedirs(FEEDBACK_DIR, exist_ok=True)
        thread_id = str(interaction.channel_id)
        entry = json.dumps({
            "type": "summon",
            "thread_id": thread_id,
            "thread_name": getattr(interaction.channel, "name", ""),
            "parent_id": str(channel.parent_id) if isinstance(channel, discord.Thread) and channel.parent_id else None,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        with open(os.path.join(FEEDBACK_DIR, "summon_requests.jsonl"), "a") as f:
            f.write(entry + "\n")

        # Mark thread as summoned and reserve the upcoming first reply against
        # the cap. on_message gates rely on these events. The reservation is
        # settled after the POST — a failed ingress refunds it, so re-clicking
        # "try again" during an outage no longer burns the thread's quota.
        _record_thread_event(thread_id, "summoned")
        reservation = _reserve_reply(thread_id)

        thread_name = getattr(interaction.channel, "name", "?")
        thread_url = (
            f"https://discord.com/channels/{interaction.guild_id}/{interaction.channel_id}"
            if interaction.guild_id
            else ""
        )
        prompt = (
            f"A user has summoned you to answer a question.\n"
            f"Thread: {thread_name}\n"
            f"Thread ID: {thread_id}\n"
            f"Link: {thread_url}\n"
            f"Please read the thread and draft an answer.\n"
            f"\n"
            f"MANDATORY research before drafting (not optional, even if you think you "
            f"know the answer — Slang's API surface evolves and your training lags):\n"
            f"  1. At least one `mcp__deepwiki__ask_question` against the relevant "
            f"shader-slang repo (slang / slangpy / slang-rhi) with a focused question.\n"
            f"  2. At least one `mcp__slang-mcp__github_search_issues` or "
            f"`mcp__slang-mcp__github_get_file_contents` for related issues, PRs, or "
            f"docs/source.\n"
            f"Cite your sources inline in the answer (link to DeepWiki finding, GitHub "
            f"issue/PR, or source file path). Users trust replies that show their work.\n"
            f"\n"
            f"This is your FIRST reply in this thread. After your answer, append the "
            f"following italicized footer on its own line, exactly as written:\n"
            f"\n"
            f"  *Keep asking follow-ups in this thread (up to {MAX_BOT_REPLIES_PER_THREAD} replies). "
            f"Click **Resolved** on any of my messages to pause me; click again to resume.*\n"
            f"\n"
            f"Use this exact phrasing — users see it on every first reply."
        )
        posted = await _post_to_dashboard(prompt, thread_id=thread_id, reservation_id=reservation)
        _settle_reply(thread_id, reservation, posted)

        if posted:
            button.label = "Bot summoned!"
            button.style = discord.ButtonStyle.green
            button.disabled = True
        else:
            logger.error(
                f"Dashboard ingress refused summon for thread {thread_name}; "
                f"reservation {reservation} refunded (no quota consumed)"
            )
            button.label = "Couldn't reach bot — try again"
            button.style = discord.ButtonStyle.red
            button.disabled = False
        await interaction.response.edit_message(view=self)


#
# Data Models
#
class SendMessageArgs(BaseModel):
    """Arguments for the send_message tool."""

    channel_id: str = Field(..., description="Discord channel ID (text channel, thread, or forum channel)")
    content: str = Field(..., description="Message content")
    thread_name: Optional[str] = Field(None, description="For forum channels: creates a new thread/post with this title. Ignored for text channels and threads.")
    add_feedback_buttons: bool = Field(False, description="If true, attach Resolved/Helpful/Not Helpful feedback buttons to the message")


class ReadMessagesArgs(BaseModel):
    """Arguments for the read_messages tool."""

    channel_id: str = Field(..., description="Discord channel ID")
    limit: Optional[int] = Field(
        10, description="Number of messages to fetch (max 100)"
    )

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v):
        if v < 1:
            raise ValueError("Limit must be at least 1")
        if v > 100:
            raise ValueError("Limit cannot exceed 100")
        return v


class GetUserInfoArgs(BaseModel):
    """Arguments for the get_user_info tool."""

    user_id: str = Field(..., description="Discord user ID")


class ModerateMessageArgs(BaseModel):
    """Arguments for the moderate_message tool."""

    channel_id: str = Field(..., description="Channel ID containing the message")
    message_id: str = Field(..., description="ID of message to moderate")
    reason: str = Field(..., description="Reason for moderation")
    timeout_minutes: Optional[int] = Field(
        None, description="Optional timeout duration in minutes"
    )

    @field_validator("timeout_minutes")
    @classmethod
    def validate_timeout_minutes(cls, v):
        if v is not None:
            if v < 0:
                raise ValueError("Timeout minutes cannot be negative")
            if v > 40320:  # 4 weeks in minutes
                raise ValueError("Timeout cannot exceed 4 weeks (40320 minutes)")
        return v


class GetServerInfoArgs(BaseModel):
    """Arguments for the get_server_info tool."""

    server_id: str = Field(..., description="Discord server (guild) ID")


class ListMembersArgs(BaseModel):
    """Arguments for the list_members tool."""

    server_id: str = Field(..., description="Discord server (guild) ID")
    limit: Optional[int] = Field(100, description="Maximum number of members to fetch")

    @field_validator("limit")
    @classmethod
    def validate_limit(cls, v):
        if v < 1:
            raise ValueError("Limit must be at least 1")
        if v > 1000:
            raise ValueError("Limit cannot exceed 1000")
        return v


class AddRoleArgs(BaseModel):
    """Arguments for the add_role tool."""

    server_id: str = Field(..., description="Discord server (guild) ID")
    user_id: str = Field(..., description="User ID to add role to")
    role_id: str = Field(..., description="Role ID to add")
    reason: Optional[str] = Field(None, description="Reason for adding the role")


class RemoveRoleArgs(BaseModel):
    """Arguments for the remove_role tool."""

    server_id: str = Field(..., description="Discord server (guild) ID")
    user_id: str = Field(..., description="User ID to remove role from")
    role_id: str = Field(..., description="Role ID to remove")
    reason: Optional[str] = Field(None, description="Reason for removing the role")


class CreateChannelArgs(BaseModel):
    """Arguments for the create_channel tool."""

    server_id: str = Field(..., description="Discord server (guild) ID")
    name: str = Field(..., description="Channel name")
    type: str = Field("text", description="Channel type ('text', 'voice', 'category')")
    topic: Optional[str] = Field(None, description="Channel topic (for text channels)")
    parent_id: Optional[str] = Field(
        None, description="Category ID to place channel under"
    )

    @field_validator("type")
    @classmethod
    def validate_type(cls, v):
        if v not in ["text", "voice", "category"]:
            raise ValueError("Channel type must be one of: 'text', 'voice', 'category'")
        return v

    @field_validator("name")
    @classmethod
    def validate_name(cls, v):
        if len(v) < 1 or len(v) > 100:
            raise ValueError("Channel name must be between 1 and 100 characters")
        return v


async def init_discord_client():
    """Initialize Discord client and connect to Discord API.

    This is called when the server starts to establish a connection to Discord.

    Returns:
        The initialized Discord client

    Raises:
        ValueError: If DISCORD_BOT_TOKEN is not set
        TimeoutError: If client initialization times out
        Exception: For other initialization errors
    """
    global client

    # Handle closed event loops by creating a new one if needed
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            logger.info("Event loop was closed, creating a new one")
            asyncio.set_event_loop(asyncio.new_event_loop())
    except RuntimeError:
        logger.info("No event loop found, creating a new one")
        asyncio.set_event_loop(asyncio.new_event_loop())

    # If client exists but is closed, clean it up first
    if client and (hasattr(client, "is_closed") and client.is_closed()):
        logger.info("Cleaning up closed Discord client before creating a new one")
        client = None

    # If client is already initialized and connected, return it
    if client and hasattr(client, "is_ready") and client.is_ready():
        return client

    token = os.environ.get("DISCORD_BOT_TOKEN")
    if not token:
        logger.info("DISCORD_BOT_TOKEN not set — Gateway disabled, REST API via OneCLI proxy still works")
        return None

    # Create a new client with intents
    client = discord.Client(intents=intents)

    # Set up the on_ready event before starting
    ready_event = asyncio.Event()

    @client.event
    async def on_ready():
        logger.info(f"Discord client initialized as {client.user}")
        client.add_view(FeedbackView())
        client.add_view(SummonView())
        logger.info("FeedbackView + SummonView registered for persistent buttons")
        ready_event.set()

    # on_thread_create — gated double-post protection.
    # By default, feedback_collector.py is the canonical summon-button poster
    # (DISCORD_POST_SUMMON=0). With eager init at startup (see arun() in
    # server.py), slang-mcp's Gateway is reliably connected on every restart,
    # so this handler exists as a fallback poster — flip
    # DISCORD_POST_SUMMON=1 on installs without feedback_collector running.
    # DISCORD_READ_ONLY=1 (lego) blocks regardless.
    @client.event
    async def on_thread_create(thread: discord.Thread):
        if not (thread.parent_id and str(thread.parent_id) in WATCHED_FORUM_IDS):
            return
        if _post_summon_disabled():
            logger.info(
                f"DISCORD_POST_SUMMON!=1 — slang-mcp skipping SummonView post; "
                f"feedback_collector.py is the canonical poster. thread={thread.id}"
            )
            return
        if _read_only_blocked(f"post SummonView in on_thread_create thread={thread.id}"):
            return
        try:
            await thread.send("", view=SummonView())
            logger.info(f"Posted SummonView on new thread: {thread.name}")
        except Exception as e:
            logger.error(f"Failed to post SummonView: {e}")

    @client.event
    async def on_message(message: discord.Message):
        if message.author.bot:
            return
        channel = message.channel
        if not isinstance(channel, discord.Thread):
            return
        if not channel.parent_id or str(channel.parent_id) not in WATCHED_FORUM_IDS:
            return

        # Ownership gate: on prod the feedback_collector.py daemon forwards
        # follow-ups (its Gateway is always warm). Only forward here when this
        # install has no daemon canonicalized (DISCORD_POST_SUMMON=1). Prevents
        # a duplicate wake when both Gateways are momentarily warm.
        if _forward_followups_disabled():
            return

        # OP-only continuation: only the thread author's follow-ups wake the bot.
        # Other members can read along, but a knowledgeable bystander can't
        # rack up the OP's reply cap or steer the bot off-topic.
        if channel.owner_id and message.author.id != channel.owner_id:
            return

        thread_id = str(channel.id)

        # Continuation gates — silent skips, not errors
        if not _has_summon(thread_id):
            return  # bot was never summoned in this thread; do not auto-engage
        state = _read_thread_state(thread_id)
        if state["resolved"]:
            return  # OP marked the thread resolved; conversation ended
        if state["bot_reply_count"] >= MAX_BOT_REPLIES_PER_THREAD:
            return  # cap reached; bot has tapped out

        # Reserve first: the charge has to precede the POST for admission to be
        # atomic (see reply_capacity.py), and `is_final` then reads the same
        # post-reservation number the next admission will see.
        reservation = _reserve_reply(thread_id)
        is_final = _read_thread_state(thread_id)["bot_reply_count"] >= MAX_BOT_REPLIES_PER_THREAD
        final_clause = (
            "\n\nThis will be your FINAL allowed reply in this thread. End your "
            "message with a polite single-line note telling the user that further "
            "questions should be opened in a new thread."
            if is_final else ""
        )
        prompt = (
            f"New message in Discord thread.\n"
            f"Thread: {channel.name} (ID: {channel.id})\n"
            f"Author: {message.author.name}\n"
            f"Content: {message.content[:500]}\n"
            f"\n"
            f"MANDATORY research before drafting if the follow-up asks a substantive "
            f"question (not just thanks/clarification): at least one "
            f"`mcp__deepwiki__ask_question` against the relevant shader-slang repo, "
            f"and a `mcp__slang-mcp__github_*` call for related issues / source. "
            f"Cite sources inline. Even if you think you know the answer, verify — "
            f"Slang evolves and your training lags.\n"
            f"{final_clause}"
        )

        posted = await _post_to_dashboard(prompt, thread_id=thread_id, reservation_id=reservation)
        _settle_reply(thread_id, reservation, posted)
        if posted:
            logger.info(
                f"Forwarded follow-up to dashboard ingress for thread {channel.name} "
                f"(replies charged: {_read_thread_state(thread_id)['bot_reply_count']}"
                f"/{MAX_BOT_REPLIES_PER_THREAD}, final={is_final})"
            )
        else:
            # Refunded, not absorbed: a retry costs nothing, and the
            # reply_failed row makes the outage visible in the audit log.
            logger.error(
                f"Failed to forward follow-up for thread {channel.name}; "
                f"reservation {reservation} refunded (no quota consumed)"
            )


    # Start the client
    try:
        # Create a task to run the client
        connect_task = asyncio.create_task(client.start(token))

        # Wait for the client to be ready
        await asyncio.wait_for(ready_event.wait(), timeout=30)

        logger.info("Discord client connected and ready")
        return client
    except asyncio.TimeoutError:
        logger.error("Timed out waiting for Discord client to be ready")
        if "connect_task" in locals() and not connect_task.done():
            connect_task.cancel()
            try:
                await connect_task
            except asyncio.CancelledError:
                pass
        if client:
            await cleanup_discord_client()
        raise TimeoutError("Discord client initialization timed out")
    except Exception as e:
        logger.error(f"Error initializing Discord client: {str(e)}")
        if "connect_task" in locals() and not connect_task.done():
            connect_task.cancel()
            try:
                await connect_task
            except asyncio.CancelledError:
                pass
        if client:
            await cleanup_discord_client()
        raise e


async def cleanup_discord_client():
    """Clean up Discord client when server is shutting down.

    This function ensures the Discord client is properly closed and cleaned up
    to prevent connection leaks or hanging connections.
    """
    global client

    if client:
        try:
            logger.info("Closing Discord client connection...")
            # Check if the client has is_closed method and is not already closed
            if hasattr(client, "is_closed") and not client.is_closed():
                # Check if event loop is still open
                try:
                    loop = asyncio.get_event_loop()
                    if not loop.is_closed():
                        # Close the client gracefully
                        await client.close()
                        # Give it a moment to clean up
                        await asyncio.sleep(0.1)
                    else:
                        # If loop is already closed, we can't properly close
                        logger.warning(
                            "Event loop already closed during client cleanup"
                        )
                except RuntimeError:
                    logger.warning("No event loop found during client cleanup")
            else:
                logger.info("Discord client was already closed")

            # Set global client to None regardless
            client = None
            logger.info("Discord client disconnected successfully")
        except Exception as e:
            logger.error(f"Error during Discord client cleanup: {str(e)}")
            # Force client to None even if cleanup fails
            client = None


FEEDBACK_DIR = os.environ.get("DISCORD_FEEDBACK_DIR", "/tmp/discord-feedback")


# In-memory toggle state per message_id. Mirrors feedback_collector.py so both
# Discord clients hand the same UX regardless of which one Discord routes the
# interaction to. Per-process — that's fine because the persisted truth lives
# in feedback.jsonl and thread_state.jsonl which both clients read.
_active_selections: dict[str, set[str]] = {}


class FeedbackView(discord.ui.View):
    """Persistent feedback buttons: Resolved / Helpful / Not Helpful.

    Toggleable: clicking a selected button un-selects it. Resolved toggling
    flips between resolved/unresolved in thread_state.jsonl, which gates the
    continuation forwarder in on_message.
    """

    def __init__(self):
        super().__init__(timeout=None)

    async def _check_op(self, interaction: discord.Interaction) -> bool:
        channel = interaction.channel
        if isinstance(channel, discord.Thread) and channel.owner_id:
            if interaction.user.id != channel.owner_id:
                await interaction.response.send_message(
                    "Only the thread author can provide feedback.", ephemeral=True
                )
                return False
        return True

    def _save_feedback(self, label: str, action: str, interaction: discord.Interaction):
        os.makedirs(FEEDBACK_DIR, exist_ok=True)
        entry = json.dumps({
            "label": label,
            "action": action,
            "message_id": str(interaction.message.id) if interaction.message else None,
            "channel_id": str(interaction.channel_id),
            "user": interaction.user.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
        with open(os.path.join(FEEDBACK_DIR, "feedback.jsonl"), "a") as f:
            f.write(entry + "\n")

    async def _toggle(self, label: str, interaction: discord.Interaction):
        if not await self._check_op(interaction):
            return
        msg_id = str(interaction.message.id) if interaction.message else ""
        selections = _active_selections.setdefault(msg_id, set())
        thread_id = str(interaction.channel_id)
        if label in selections:
            selections.discard(label)
            self._save_feedback(label, "removed", interaction)
            if label == "resolved":
                _record_thread_event(thread_id, "unresolved")
        else:
            selections.add(label)
            self._save_feedback(label, "added", interaction)
            if label == "resolved":
                _record_thread_event(thread_id, "resolved")
        try:
            await interaction.response.edit_message(view=self._updated_view(selections))
        except discord.NotFound:
            logger.warning(
                f"Could not update feedback view for thread {thread_id} "
                f"(interaction expired); feedback was recorded regardless."
            )

    @discord.ui.button(label="Resolved", style=discord.ButtonStyle.grey, custom_id="feedback:resolved")
    async def resolved(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._toggle("resolved", interaction)

    @discord.ui.button(label="Helpful", style=discord.ButtonStyle.grey, custom_id="feedback:helpful")
    async def helpful(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._toggle("helpful", interaction)

    @discord.ui.button(label="Not Helpful", style=discord.ButtonStyle.grey, custom_id="feedback:not_helpful")
    async def not_helpful(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self._toggle("not_helpful", interaction)

    @staticmethod
    def _updated_view(selections: set[str]) -> "FeedbackView":
        view = FeedbackView()
        for item in view.children:
            label = {
                "feedback:resolved": "resolved",
                "feedback:helpful": "helpful",
                "feedback:not_helpful": "not_helpful",
            }.get(getattr(item, "custom_id", ""), "")
            if label in selections:
                item.style = (  # type: ignore
                    discord.ButtonStyle.green if label == "resolved"
                    else discord.ButtonStyle.blurple if label == "helpful"
                    else discord.ButtonStyle.red
                )
            else:
                item.style = discord.ButtonStyle.grey  # type: ignore
        return view


async def send_message(args: SendMessageArgs) -> Dict[str, Any]:
    """Send a message to a Discord channel or forum thread.

    Allowed targets:
    - Channels listed in DISCORD_ALLOWED_SEND_CHANNELS (comma-separated IDs)
    - Threads whose parent forum is listed in DISCORD_ALLOWED_SEND_FORUMS

    If neither env var is set, all sends are blocked.

    Args:
        args: Arguments for sending a message

    Returns:
        Dict containing message information or error
    """
    global client

    try:
        if _read_only_blocked(f"send_message channel={args.channel_id}"):
            return {"error": "Discord write blocked: DISCORD_READ_ONLY=1"}
        allowed_channels_raw = os.environ.get("DISCORD_ALLOWED_SEND_CHANNELS", "")
        allowed_channels = {c.strip() for c in allowed_channels_raw.split(",") if c.strip()}
        allowed_forums_raw = os.environ.get("DISCORD_ALLOWED_SEND_FORUMS", "")
        allowed_forums = {c.strip() for c in allowed_forums_raw.split(",") if c.strip()}

        if not allowed_channels and not allowed_forums:
            return {"error": "No allowed send channels or forums configured"}

        # Ensure the client is connected
        await ensure_client_connected()

        # Convert channel_id to int
        channel_id = int(args.channel_id)

        # Get the channel
        channel = client.get_channel(channel_id)
        if not channel:
            try:
                channel = await client.fetch_channel(channel_id)
            except discord.NotFound:
                return {"error": f"Channel with ID {channel_id} not found"}
            except discord.Forbidden:
                return {
                    "error": f"Not authorized to access channel with ID {channel_id}"
                }

        # Enforce allowlist: direct channel match, thread in allowed forum, or forum itself
        is_allowed = args.channel_id in allowed_channels
        if not is_allowed and isinstance(channel, discord.Thread) and channel.parent:
            is_allowed = str(channel.parent.id) in allowed_forums
        if not is_allowed and isinstance(channel, discord.ForumChannel):
            is_allowed = args.channel_id in allowed_forums
        if not is_allowed:
            return {"error": f"Channel {args.channel_id} is not in the allowed send list"}

        # Handle forum channels: create a thread/post
        view = FeedbackView() if args.add_feedback_buttons else None

        if isinstance(channel, discord.ForumChannel):
            thread_name = args.thread_name or "Bot Report"
            thread_with_message = await channel.create_thread(
                name=thread_name,
                content=args.content,
                view=view,
            )
            thread = thread_with_message.thread
            message = thread_with_message.message
            return {
                "message_id": str(message.id),
                "thread_id": str(thread.id),
                "thread_name": thread.name,
                "channel_id": str(channel.id),
                "content": message.content,
                "timestamp": message.created_at.isoformat(),
                "url": message.jump_url,
            }

        # Send to text channel or thread
        message = await channel.send(args.content, view=view)

        # Return message data
        return {
            "message_id": str(message.id),
            "channel_id": str(message.channel.id),
            "content": message.content,
            "timestamp": message.created_at.isoformat(),
            "url": message.jump_url,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in send_message: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in send_message: {str(e)}")
        return {"error": str(e)}


def filter_message_data(message) -> dict:
    """Filter Discord message data to include only essential fields.

    Args:
        message: Raw Discord message data

    Returns:
        Filtered message data with only essential fields

    The filtering strategy:
    1. Keeps minimal core message data (content, timestamp, author name/display)
    2. Conditionally includes optional data (attachments, embeds, mentions) only if present
    3. Removes rarely used fields and identifiers
    """
    # Core message data that's always included
    guild_id = message.guild.id if message.guild else None
    channel_id = message.channel.id if message.channel else None
    filtered = {
        "id": str(message.id),
        "url": f"https://discord.com/channels/{guild_id}/{channel_id}/{message.id}" if guild_id and channel_id else None,
        "content": message.content,
        "timestamp": message.created_at.isoformat(),
        "author": {
            "name": message.author.name,
            "display_name": message.author.display_name,
            "bot": message.author.bot,
        },
    }

    # Only include attachments if present and not empty
    if message.attachments:
        filtered["attachments"] = [
            {
                "filename": attachment.filename,
                "url": attachment.url,
                "content_type": attachment.content_type,
            }
            for attachment in message.attachments
        ]

    # Only include embeds if present and not empty
    if message.embeds:
        filtered["embeds"] = []
        for embed in message.embeds:
            embed_dict = embed.to_dict()
            filtered_embed = {}

            # Only keep specific embed fields
            if "provider" in embed_dict:
                filtered_embed["provider"] = embed_dict["provider"]
            if "description" in embed_dict:
                filtered_embed["description"] = embed_dict["description"]
            if "url" in embed_dict:
                filtered_embed["url"] = embed_dict["url"]
            if "title" in embed_dict:
                filtered_embed["title"] = embed_dict["title"]

            if filtered_embed:  # Only add if we have any data
                filtered["embeds"].append(filtered_embed)

    # Only include mentions if present and not empty
    if message.mentions:
        filtered["mentions"] = [
            user.name for user in message.mentions
        ]  # Using names instead of IDs

    return filtered


async def read_messages(args: ReadMessagesArgs) -> Dict[str, Any]:
    """Read messages from a Discord channel.

    Uses REST API via OneCLI proxy when Gateway client is unavailable.
    """
    global client

    # Prefer REST API — works without Gateway token, goes through OneCLI proxy
    if not client or not hasattr(client, "is_ready") or not client.is_ready():
        logger.info("Discord Gateway not connected, using REST API via OneCLI proxy")
        return await discord_rest_read_messages(args.channel_id, args.limit or 20)

    try:
        # Ensure the client is connected
        await ensure_client_connected()

        # Convert channel_id to int
        channel_id = int(args.channel_id)

        # Get the channel
        channel = client.get_channel(channel_id)
        if not channel:
            try:
                channel = await client.fetch_channel(channel_id)
            except discord.NotFound:
                return {"error": f"Channel with ID {channel_id} not found"}
            except discord.Forbidden:
                return {
                    "error": f"Not authorized to access channel with ID {channel_id}"
                }

        # Fetch messages
        raw_messages = []
        if isinstance(channel, discord.TextChannel):
            async for message in channel.history(limit=args.limit):
                raw_messages.append(message)
        elif isinstance(channel, discord.ForumChannel):
            # Create timezone-aware datetime in UTC
            now = datetime.now(timezone.utc)
            cutoff_time = now - timedelta(hours=48)
            # Sort threads by last message time and take only first 5
            sorted_threads = sorted(
                channel.threads,
                key=lambda thread: thread.last_message.created_at
                if thread.last_message
                else thread.created_at,
                reverse=True,
            )[:5]

            for thread in sorted_threads:
                async for message in thread.history(limit=args.limit):
                    # Now both datetimes are timezone-aware
                    if message.created_at >= cutoff_time:
                        raw_messages.append(message)
        else:
            raise ValueError("Unsupported channel type")

        # Filter messages
        filtered_messages = [filter_message_data(message) for message in raw_messages]

        # Return filtered response with optional raw data
        response = {
            "filtered": {
                "channel_id": str(channel_id),
                "channel_name": channel.name,
                "messages": filtered_messages,
                "total_count": len(filtered_messages),
            },
            "raw": raw_messages if IsDebug() else None,
        }

        return response

    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in read_messages: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in read_messages: {str(e)}")
        return {"error": str(e)}


async def ensure_client_connected():
    """Ensure that the Discord client is initialized and connected.

    This helper function checks if the client needs to be initialized or
    reconnected, and handles that process. It includes additional checks
    for event loop state and client health.

    Returns:
        The connected Discord client

    Raises:
        Exception: If client initialization fails
    """
    global client

    try:
        # First check if we have a valid event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_closed():
                logger.info("Event loop was closed, creating new one")
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        except RuntimeError:
            logger.info("No event loop found, creating new one")
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        # Now check client state
        if client:
            # Check if client is closed or not properly initialized
            if hasattr(client, "is_closed") and client.is_closed():
                logger.info("Discord client is closed, will reinitialize")
                await cleanup_discord_client()
            elif hasattr(client, "is_ready") and not client.is_ready():
                logger.info("Discord client not ready, will reinitialize")
                await cleanup_discord_client()
            else:
                try:
                    # Try a simple operation to verify client health
                    # Use wait_for to prevent hanging
                    await asyncio.wait_for(
                        client.fetch_user(client.user.id), timeout=5.0
                    )
                    logger.debug("Discord client verified as healthy")
                    return client
                except asyncio.TimeoutError:
                    logger.warning("Client health check timed out, will reinitialize")
                    await cleanup_discord_client()
                except Exception as e:
                    logger.warning(
                        f"Client health check failed: {str(e)}, will reinitialize"
                    )
                    await cleanup_discord_client()

        # Initialize new client if needed
        if not client:
            logger.info("Discord client not initialized or closed, initializing...")
            await init_discord_client()

        return client

    except Exception as e:
        logger.error(f"Error in ensure_client_connected: {str(e)}")
        # Clean up if something went wrong
        if client:
            await cleanup_discord_client()
        raise


async def get_user_info(args: GetUserInfoArgs) -> Dict[str, Any]:
    """Get information about a Discord user.

    Args:
        args: Arguments for getting user info

    Returns:
        Dict containing user information or error
    """
    global client

    try:
        # Ensure client is connected
        client = await ensure_client_connected()

        # Convert user_id to int
        user_id = int(args.user_id)

        # Get the user
        user = client.get_user(user_id)
        if not user:
            try:
                user = await client.fetch_user(user_id)
            except discord.NotFound:
                return {"error": f"User with ID {user_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access user with ID {user_id}"}

        # Safely handle avatar URLs
        avatar_url = None
        if user.avatar:
            avatar_url = str(
                user.avatar.url if hasattr(user.avatar, "url") else user.avatar
            )

        # Safely handle banner URLs
        banner_url = None
        if hasattr(user, "banner") and user.banner:
            banner_url = str(
                user.banner.url if hasattr(user.banner, "url") else user.banner
            )

        # Return user data
        return {
            "id": str(user.id),
            "name": user.name,
            "display_name": user.display_name,
            "discriminator": (
                user.discriminator if hasattr(user, "discriminator") else None
            ),
            "bot": user.bot,
            "created_at": user.created_at.isoformat(),
            "avatar_url": avatar_url,
            "banner_url": banner_url,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in get_user_info: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in get_user_info: {str(e)}")
        return {"error": str(e)}


async def moderate_message(args: ModerateMessageArgs) -> Dict[str, Any]:
    """Moderate a message in a Discord channel.

    Args:
        args: Arguments for moderating a message

    Returns:
        Dict containing result or error
    """
    global client

    try:
        if _read_only_blocked(f"moderate_message channel={args.channel_id} msg={args.message_id}"):
            return {"error": "Discord write blocked: DISCORD_READ_ONLY=1"}
        # Ensure client is connected
        client = await ensure_client_connected()

        # Convert IDs to int
        channel_id = int(args.channel_id)
        message_id = int(args.message_id)

        # Get the channel
        channel = client.get_channel(channel_id)
        if not channel:
            try:
                channel = await client.fetch_channel(channel_id)
            except discord.NotFound:
                return {"error": f"Channel with ID {channel_id} not found"}
            except discord.Forbidden:
                return {
                    "error": f"Not authorized to access channel with ID {channel_id}"
                }

        # Get the message
        try:
            message = await channel.fetch_message(message_id)
        except discord.NotFound:
            return {"error": f"Message with ID {message_id} not found"}
        except discord.Forbidden:
            return {"error": f"Not authorized to access message with ID {message_id}"}

        # Delete the message
        await message.delete(reason=args.reason)

        # If timeout specified, timeout the user
        timeout_result = None
        if args.timeout_minutes is not None and isinstance(
            channel.guild, discord.Guild
        ):
            member = channel.guild.get_member(message.author.id)
            if member:
                timeout_duration = timedelta(minutes=args.timeout_minutes)
                try:
                    # Try newer Discord.py method first
                    await member.timeout(timeout_duration, reason=args.reason)
                except AttributeError:
                    # Fall back to older method if available
                    if hasattr(member, "timeout_for"):
                        await member.timeout_for(timeout_duration, reason=args.reason)
                    else:
                        # If both methods fail, return a warning but continue
                        logger.warning(
                            f"Could not timeout user {member.id} - method not available"
                        )

                timeout_result = {
                    "user_id": str(member.id),
                    "timeout_minutes": args.timeout_minutes,
                    "expires_at": (datetime.now() + timeout_duration).isoformat(),
                }

        # Return result
        return {
            "success": True,
            "moderated_message": {
                "id": str(message.id),
                "channel_id": str(channel.id),
                "author_id": str(message.author.id),
                "content": message.content,  # Include for audit purposes
            },
            "reason": args.reason,
            "timeout": timeout_result,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in moderate_message: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in moderate_message: {str(e)}")
        return {"error": str(e)}


async def get_server_info(args: GetServerInfoArgs) -> Dict[str, Any]:
    """Get information about a Discord server.

    Args:
        args: Arguments for getting server info

    Returns:
        Dict containing server information or error
    """
    global client

    try:
        # Ensure client is connected
        client = await ensure_client_connected()

        # Convert server_id to int
        server_id = int(args.server_id)

        # Get the server
        guild = client.get_guild(server_id)
        if not guild:
            try:
                guild = await client.fetch_guild(server_id)
            except discord.NotFound:
                return {"error": f"Server with ID {server_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access server with ID {server_id}"}

        # Get role information
        roles = []
        for role in guild.roles:
            roles.append(
                {
                    "id": str(role.id),
                    "name": role.name,
                    "color": role.color.value,
                    "position": role.position,
                    "permissions": str(role.permissions.value),
                    "mentionable": role.mentionable,
                    "hoist": role.hoist,  # Shows members separately in the member list
                }
            )

        # Get channel information
        channels = []
        for channel in guild.channels:
            channel_info = {
                "id": str(channel.id),
                "name": channel.name,
                "type": str(channel.type),
                "position": channel.position,
            }

            # Add category info if applicable
            if hasattr(channel, "category") and channel.category:
                channel_info["category"] = {
                    "id": str(channel.category.id),
                    "name": channel.category.name,
                }

            # Add text channel specific info
            if isinstance(channel, discord.TextChannel):
                channel_info["topic"] = channel.topic
                channel_info["slowmode_delay"] = channel.slowmode_delay
                channel_info["nsfw"] = channel.is_nsfw()

            # Add voice channel specific info
            if isinstance(channel, discord.VoiceChannel):
                channel_info["bitrate"] = channel.bitrate
                channel_info["user_limit"] = channel.user_limit

            channels.append(channel_info)

        # Safely handle icon URL
        icon_url = None
        if guild.icon:
            icon_url = str(guild.icon.url if hasattr(guild.icon, "url") else guild.icon)

        # Safely handle banner URL
        banner_url = None
        if hasattr(guild, "banner") and guild.banner:
            banner_url = str(
                guild.banner.url if hasattr(guild.banner, "url") else guild.banner
            )

        # Return server data
        return {
            "id": str(guild.id),
            "name": guild.name,
            "description": guild.description,
            "owner_id": str(guild.owner_id),
            "icon_url": icon_url,
            "banner_url": banner_url,
            "member_count": guild.member_count,
            "created_at": guild.created_at.isoformat(),
            "premium_tier": guild.premium_tier,
            "premium_subscription_count": guild.premium_subscription_count,
            "roles": roles,
            "channels": channels,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in get_server_info: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in get_server_info: {str(e)}")
        return {"error": str(e)}


async def list_members(args: ListMembersArgs) -> Dict[str, Any]:
    """List members in a Discord server.

    Args:
        args: Arguments for listing members

    Returns:
        Dict containing members or error
    """
    global client

    try:
        # Ensure the client is connected
        await ensure_client_connected()

        # Convert server_id to int
        server_id = int(args.server_id)

        # Get the server
        guild = client.get_guild(server_id)
        if not guild:
            try:
                guild = await client.fetch_guild(server_id)
            except discord.NotFound:
                return {"error": f"Server with ID {server_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access server with ID {server_id}"}

        logger.info(f"Retrieving members for guild: {guild.name} (ID: {guild.id})")

        # Ensure members are loaded - handle different Discord.py versions
        try:
            if not guild.chunked:
                await guild.chunk()
        except AttributeError:
            # If chunked property or chunk method isn't available, continue anyway
            logger.warning(f"Could not chunk guild {server_id} - method not available")

        # Get members
        members = []
        member_list = list(guild.members)[: args.limit]
        logger.info(f"Found {len(member_list)} members in guild {guild.id}")

        for member in member_list:
            try:
                # Get roles
                roles = [
                    {
                        "id": str(role.id),
                        "name": role.name,
                        "color": role.color.value,
                        "position": role.position,
                    }
                    for role in member.roles
                    if role.id != guild.id  # Exclude @everyone
                ]

                # Safely handle avatar URL
                avatar_url = None
                if hasattr(member, "avatar") and member.avatar:
                    avatar_url = str(
                        member.avatar.url
                        if hasattr(member.avatar, "url")
                        else member.avatar
                    )

                # Safely handle timeout property which might have different names
                timeout_until = None
                # Modern Discord.py uses communication_disabled_until as a property
                if (
                    hasattr(member, "communication_disabled_until")
                    and member.communication_disabled_until
                ):
                    timeout_until = member.communication_disabled_until.isoformat()
                # Some versions use timeout as a property (check if it's not a method)
                elif (
                    hasattr(member, "timeout")
                    and member.timeout
                    and not callable(member.timeout)
                ):
                    timeout_until = member.timeout.isoformat()
                # No need to call timeout() as it's a setter method, not a getter

                # Add member data
                member_data = {
                    "id": str(member.id),
                    "name": member.name,
                    "display_name": member.display_name,
                    "discriminator": (
                        member.discriminator
                        if hasattr(member, "discriminator")
                        else None
                    ),
                    "bot": member.bot,
                    "avatar_url": avatar_url,
                    "roles": roles,
                    "status": (
                        str(member.status) if hasattr(member, "status") else "unknown"
                    ),
                    "timeout_until": timeout_until,
                }

                # Safely add joined_at
                if hasattr(member, "joined_at") and member.joined_at:
                    member_data["joined_at"] = member.joined_at.isoformat()
                else:
                    member_data["joined_at"] = None

                # Safely add premium_since
                if hasattr(member, "premium_since") and member.premium_since:
                    member_data["premium_since"] = member.premium_since.isoformat()
                else:
                    member_data["premium_since"] = None

                members.append(member_data)

            except Exception as member_error:
                logger.error(
                    f"Error processing member {getattr(member, 'id', 'unknown')}: {str(member_error)}"
                )
                # Continue with next member instead of failing completely
                continue

        # Return members
        logger.info(
            f"Successfully processed {len(members)} members for guild {guild.id}"
        )
        return {
            "server_id": str(server_id),
            "server_name": guild.name,
            "members": members,
            "member_count": len(members),
            "total_member_count": guild.member_count,
        }
    except Exception as e:
        logger.error(f"Error in list_members: {str(e)}")
        return {"error": str(e)}


async def add_role(args: AddRoleArgs) -> Dict[str, Any]:
    """Add a role to a user in a Discord server.

    Args:
        args: Arguments for adding a role

    Returns:
        Dict containing success status and user/role details, or error message
    """
    global client
    try:
        # Ensure the client is connected
        await ensure_client_connected()

        # Convert IDs to integers
        server_id = int(args.server_id)
        user_id = int(args.user_id)
        role_id = int(args.role_id)

        # Get the server
        guild = client.get_guild(server_id)
        if not guild:
            try:
                guild = await client.fetch_guild(server_id)
            except discord.NotFound:
                return {"error": f"Server with ID {server_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access server with ID {server_id}"}

        # Get the member
        member = guild.get_member(user_id)
        if not member:
            try:
                member = await guild.fetch_member(user_id)
            except discord.NotFound:
                return {"error": f"Member with ID {user_id} not found in server"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access member with ID {user_id}"}

        # Get the role
        role = guild.get_role(role_id)
        if not role:
            return {"error": f"Role with ID {role_id} not found in server"}

        # Add the role
        await member.add_roles(role, reason=args.reason)

        # Return result
        return {
            "success": True,
            "user": {
                "id": str(member.id),
                "name": member.name,
                "display_name": member.display_name,
            },
            "role": {
                "id": str(role.id),
                "name": role.name,
            },
            "server_id": str(guild.id),
            "reason": args.reason,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in add_role: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in add_role: {str(e)}")
        return {"error": str(e)}


async def remove_role(args: RemoveRoleArgs) -> Dict[str, Any]:
    """Remove a role from a user in a Discord server.

    Args:
        args: Arguments for removing a role

    Returns:
        Dict containing success status and user/role details, or error message
    """
    global client

    try:
        # Ensure the client is connected
        await ensure_client_connected()

        # Convert IDs to int
        server_id = int(args.server_id)
        user_id = int(args.user_id)
        role_id = int(args.role_id)

        # Get the server
        guild = client.get_guild(server_id)
        if not guild:
            try:
                guild = await client.fetch_guild(server_id)
            except discord.NotFound:
                return {"error": f"Server with ID {server_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access server with ID {server_id}"}

        # Get the member
        member = guild.get_member(user_id)
        if not member:
            try:
                member = await guild.fetch_member(user_id)
            except discord.NotFound:
                return {"error": f"Member with ID {user_id} not found in server"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access member with ID {user_id}"}

        # Get the role
        role = guild.get_role(role_id)
        if not role:
            return {"error": f"Role with ID {role_id} not found in server"}

        # Check if member has the role
        if role not in member.roles:
            return {"error": f"Member does not have the role with ID {role_id}"}

        # Remove the role
        await member.remove_roles(role, reason=args.reason)

        # Return result
        return {
            "success": True,
            "user": {
                "id": str(member.id),
                "name": member.name,
                "display_name": member.display_name,
            },
            "role": {
                "id": str(role.id),
                "name": role.name,
            },
            "server_id": str(guild.id),
            "reason": args.reason,
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in remove_role: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in remove_role: {str(e)}")
        return {"error": str(e)}


async def create_channel(args: CreateChannelArgs) -> Dict[str, Any]:
    """Create a channel in a Discord server.

    Args:
        args: Arguments for creating a channel

    Returns:
        Dict containing success status and channel details, or error message
    """
    global client

    try:
        if _read_only_blocked(f"create_channel server={args.server_id} name={args.name}"):
            return {"error": "Discord write blocked: DISCORD_READ_ONLY=1"}
        # Ensure the client is connected
        await ensure_client_connected()

        # Convert server_id to int
        server_id = int(args.server_id)

        # Get the server
        guild = client.get_guild(server_id)
        if not guild:
            try:
                guild = await client.fetch_guild(server_id)
            except discord.NotFound:
                return {"error": f"Server with ID {server_id} not found"}
            except discord.Forbidden:
                return {"error": f"Not authorized to access server with ID {server_id}"}

        # Get parent category if specified
        parent = None
        if args.parent_id:
            parent_id = int(args.parent_id)
            parent = guild.get_channel(parent_id)
            if not parent or not isinstance(parent, discord.CategoryChannel):
                return {"error": f"Parent category with ID {parent_id} not found"}

        # Create channel params based on type
        kwargs = {"name": args.name}
        if args.type == "text" and args.topic:
            kwargs["topic"] = args.topic
        if parent:
            kwargs["category"] = parent

        # Create the channel
        if args.type == "text":
            channel = await guild.create_text_channel(**kwargs)
        elif args.type == "voice":
            channel = await guild.create_voice_channel(**kwargs)
        elif args.type == "category":
            channel = await guild.create_category(**kwargs)
        else:
            return {"error": f"Invalid channel type: {args.type}"}

        # Return result
        return {
            "success": True,
            "channel": {
                "id": str(channel.id),
                "name": channel.name,
                "type": args.type,
                "position": channel.position,
                "parent_id": str(channel.category.id) if channel.category else None,
                "topic": channel.topic if hasattr(channel, "topic") else None,
            },
            "server_id": str(guild.id),
        }
    except asyncio.CancelledError:
        logger.error("Discord operation was cancelled")
        return {"error": "Operation cancelled"}
    except RuntimeError as e:
        if "Event loop is closed" in str(e):
            logger.error("Event loop was closed, please retry the operation")
            # Reset the client so it will be reinitialized on the next call
            if client:
                await cleanup_discord_client()
            return {"error": "Discord connection was closed, please retry"}
        logger.error(f"Runtime error in create_channel: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        logger.error(f"Error in create_channel: {str(e)}")
        return {"error": str(e)}
