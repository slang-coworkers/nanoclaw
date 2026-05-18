"""Discord feedback collector and summon button service.

Standalone process that:
1. Auto-posts a "Get Bot Help" button on new forum threads
2. Handles summon button clicks — POSTs to dashboard ingress, saves request log
3. Continues conversation: forwards human follow-up replies in summoned threads
   to the agent, capped at MAX_BOT_REPLIES_PER_THREAD (default 15) bot replies.
4. Handles feedback button clicks (Resolved/Helpful/Not Helpful). Resolved ends
   the conversation early.
5. Captures human replies in watched forum threads to thread_replies.jsonl.
"""

import asyncio
import json
import logging
import os
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone

import aiohttp
import discord

logging.basicConfig(level=logging.INFO, format="[feedback-collector] %(message)s")
logger = logging.getLogger(__name__)

FEEDBACK_DIR = os.environ.get("DISCORD_FEEDBACK_DIR", "/tmp/discord-feedback")
WATCHED_FORUM_IDS = set(
    f.strip() for f in os.environ.get("DISCORD_WATCHED_FORUMS", "1494023079666647200").split(",") if f.strip()
)

DASHBOARD_INGRESS_URL = os.environ.get(
    "DASHBOARD_INGRESS_URL",
    f"http://127.0.0.1:{os.environ.get('DASHBOARD_INGRESS_PORT', '3736')}/api/dashboard/inbound",
)
DASHBOARD_SECRET = os.environ.get("DASHBOARD_SECRET", "").strip()
SUMMON_TARGET_GROUP = os.environ.get("SUMMON_TARGET_GROUP", "slang-discord-support")
MAX_BOT_REPLIES_PER_THREAD = int(os.environ.get("MAX_BOT_REPLIES_PER_THREAD", "15"))
THREAD_STATE_FILE = os.path.join(FEEDBACK_DIR, "thread_state.jsonl")


# ── Per-thread state ────────────────────────────────────────────────────────

@dataclass
class ThreadState:
    summoned: bool = False
    resolved: bool = False
    bot_reply_count: int = 0


thread_state: dict[str, ThreadState] = defaultdict(ThreadState)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record_thread_event(thread_id: str, event: str) -> None:
    """Append an event to the audit log and mutate in-memory state."""
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    with open(THREAD_STATE_FILE, "a") as f:
        f.write(json.dumps({"thread_id": thread_id, "event": event, "ts": _now_iso()}) + "\n")
    state = thread_state[thread_id]
    if event == "summoned":
        state.summoned = True
    elif event == "bot_reply":
        state.bot_reply_count += 1
    elif event == "resolved":
        state.resolved = True
    elif event == "unresolved":
        state.resolved = False


def _load_thread_state() -> None:
    """Replay the audit log on startup to reconstruct state."""
    if not os.path.exists(THREAD_STATE_FILE):
        return
    with open(THREAD_STATE_FILE) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except Exception:
                continue
            tid = row.get("thread_id")
            event = row.get("event")
            if not (tid and event):
                continue
            state = thread_state[tid]
            if event == "summoned":
                state.summoned = True
            elif event == "bot_reply":
                state.bot_reply_count += 1
            elif event == "resolved":
                state.resolved = True
            elif event == "unresolved":
                state.resolved = False
    summoned = sum(1 for s in thread_state.values() if s.summoned)
    capped = sum(1 for s in thread_state.values() if s.bot_reply_count >= MAX_BOT_REPLIES_PER_THREAD)
    logger.info(
        f"Replayed thread state: {len(thread_state)} threads, {summoned} summoned, {capped} at cap"
    )


# ── Dashboard ingress POST ──────────────────────────────────────────────────

async def _post_to_dashboard(content: str) -> bool:
    headers = {"Content-Type": "application/json"}
    if DASHBOARD_SECRET:
        headers["Authorization"] = f"Bearer {DASHBOARD_SECRET}"
    body = {"group": SUMMON_TARGET_GROUP, "content": content}
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
    """Button posted on every new forum thread. OP clicks to summon the bot."""

    def __init__(self):
        super().__init__(timeout=None)

    @discord.ui.button(
        label="Get Bot Help",
        style=discord.ButtonStyle.blurple,
        custom_id="summon:get_help",
        emoji="🤖",
    )
    async def get_help(self, interaction: discord.Interaction, button: discord.ui.Button):
        channel = interaction.channel
        if isinstance(channel, discord.Thread) and channel.owner_id:
            if interaction.user.id != channel.owner_id:
                await interaction.response.send_message(
                    "Only the thread author can summon the bot.", ephemeral=True
                )
                return

        thread_id = str(interaction.channel_id)
        thread_name = getattr(interaction.channel, "name", "?")

        os.makedirs(FEEDBACK_DIR, exist_ok=True)
        entry = json.dumps({
            "type": "summon",
            "thread_id": thread_id,
            "thread_name": thread_name,
            "parent_id": str(channel.parent_id) if isinstance(channel, discord.Thread) and channel.parent_id else None,
            "message_id": str(interaction.message.id) if interaction.message else None,
            "timestamp": _now_iso(),
        })
        with open(os.path.join(FEEDBACK_DIR, "summon_requests.jsonl"), "a") as f:
            f.write(entry + "\n")
        logger.info(f"Summon request saved for thread: {thread_name}")

        _record_thread_event(thread_id, "summoned")

        thread_url = (
            f"https://discord.com/channels/{interaction.guild_id}/{interaction.channel_id}"
            if interaction.guild_id else ""
        )
        prompt = (
            f"A user has summoned you to answer a question.\n"
            f"Thread: {thread_name}\n"
            f"Thread ID: {thread_id}\n"
            f"Link: {thread_url}\n"
            f"Read the thread messages via mcp__slang-mcp__discord_read_messages "
            f"and post your answer with mcp__slang-mcp__discord_post_message.\n"
            f"\n"
            f"This is your FIRST reply in this thread. After your answer, append the "
            f"following italicized footer on its own line, exactly as written:\n"
            f"\n"
            f"  *Keep asking follow-ups in this thread (up to {MAX_BOT_REPLIES_PER_THREAD} replies). "
            f"Click **Resolved** on any of my messages to pause me; click again to resume.*\n"
            f"\n"
            f"Use this exact phrasing — users see it on every first reply."
        )
        posted = await _post_to_dashboard(prompt)

        if posted:
            logger.info(f"Dashboard ingress accepted summon for thread: {thread_name}")
            button.label = "Bot summoned!"
            button.style = discord.ButtonStyle.green
            button.disabled = True
        else:
            button.label = "Couldn't reach bot — try again"
            button.style = discord.ButtonStyle.red
            button.disabled = False

        try:
            await interaction.response.edit_message(view=self)
        except discord.NotFound:
            # Interaction token expired (Discord 3-second window). The POST already
            # went through; we just can't update the button visually. Not fatal.
            logger.warning(
                f"Could not update summon button for thread {thread_name} "
                f"(interaction expired); summon was processed regardless."
            )


# ── Feedback View ───────────────────────────────────────────────────────────

_active_selections: dict[str, set[str]] = {}


class FeedbackView(discord.ui.View):
    """Toggle buttons for rating bot replies: Resolved / Helpful / Not Helpful."""

    def __init__(self):
        super().__init__(timeout=None)

    async def _check_op(self, interaction):
        channel = interaction.channel
        if isinstance(channel, discord.Thread) and channel.owner_id:
            if interaction.user.id != channel.owner_id:
                await interaction.response.send_message(
                    "Only the thread author can provide feedback.", ephemeral=True
                )
                return False
        return True

    def _save_feedback(self, label, action, interaction):
        os.makedirs(FEEDBACK_DIR, exist_ok=True)
        entry = json.dumps({
            "label": label,
            "action": action,
            "message_id": str(interaction.message.id) if interaction.message else None,
            "channel_id": str(interaction.channel_id),
            "timestamp": _now_iso(),
        })
        with open(os.path.join(FEEDBACK_DIR, "feedback.jsonl"), "a") as f:
            f.write(entry + "\n")
        logger.info(f"Feedback {action}: {label}")

    async def _toggle(self, label, interaction):
        if not await self._check_op(interaction):
            return
        msg_id = str(interaction.message.id) if interaction.message else ""
        selections = _active_selections.setdefault(msg_id, set())
        if label in selections:
            selections.discard(label)
            self._save_feedback(label, "removed", interaction)
            if label == "resolved":
                _record_thread_event(str(interaction.channel_id), "unresolved")
        else:
            selections.add(label)
            self._save_feedback(label, "added", interaction)
            if label == "resolved":
                _record_thread_event(str(interaction.channel_id), "resolved")
        try:
            await interaction.response.edit_message(view=self._updated_view(selections))
        except discord.NotFound:
            logger.warning(
                f"Could not update feedback buttons for thread {interaction.channel_id} "
                f"(interaction expired); feedback was recorded regardless."
            )

    @discord.ui.button(label="Resolved", style=discord.ButtonStyle.grey, custom_id="feedback:resolved")
    async def resolved(self, interaction, button):
        await self._toggle("resolved", interaction)

    @discord.ui.button(label="Helpful", style=discord.ButtonStyle.grey, custom_id="feedback:helpful")
    async def helpful(self, interaction, button):
        await self._toggle("helpful", interaction)

    @discord.ui.button(label="Not Helpful", style=discord.ButtonStyle.grey, custom_id="feedback:not_helpful")
    async def not_helpful(self, interaction, button):
        await self._toggle("not_helpful", interaction)

    @staticmethod
    def _updated_view(selections):
        view = FeedbackView()
        for item in view.children:
            label = {
                "feedback:resolved": "resolved",
                "feedback:helpful": "helpful",
                "feedback:not_helpful": "not_helpful",
            }.get(item.custom_id, "")
            if label in selections:
                item.style = (
                    discord.ButtonStyle.green if label == "resolved"
                    else discord.ButtonStyle.blurple if label == "helpful"
                    else discord.ButtonStyle.red
                )
            else:
                item.style = discord.ButtonStyle.grey
        return view


# ── Thread reply capture ────────────────────────────────────────────────────

def _save_thread_reply(message: discord.Message):
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    entry = json.dumps({
        "type": "thread_reply",
        "message_id": str(message.id),
        "thread_id": str(message.channel.id),
        "thread_name": getattr(message.channel, "name", ""),
        "parent_id": str(message.channel.parent_id) if hasattr(message.channel, "parent_id") else None,
        "content": message.content,
        "timestamp": message.created_at.isoformat(),
    })
    with open(os.path.join(FEEDBACK_DIR, "thread_replies.jsonl"), "a") as f:
        f.write(entry + "\n")
    logger.info(f"Thread reply saved in {getattr(message.channel, 'name', '?')}")


# ── Main ────────────────────────────────────────────────────────────────────

async def main():
    token = os.environ.get("DISCORD_BOT_TOKEN", "")
    if not token:
        logger.error("DISCORD_BOT_TOKEN not set")
        return

    _load_thread_state()

    intents = discord.Intents.default()
    intents.message_content = True
    client = discord.Client(intents=intents)

    @client.event
    async def on_ready():
        client.add_view(SummonView())
        client.add_view(FeedbackView())
        logger.info(f"Connected as {client.user}")
        logger.info(f"Watching forums: {WATCHED_FORUM_IDS}")
        logger.info(
            f"Continuation cap: {MAX_BOT_REPLIES_PER_THREAD} bot replies/thread; "
            f"target group: {SUMMON_TARGET_GROUP}"
        )

    # Architecture note:
    #   - on_thread_create lives HERE, not in slang-mcp/discord.py. Slang-mcp's
    #     Discord client is lazy-initialized (only on first MCP tool call), so
    #     it cannot reliably catch thread-create events before an agent has
    #     touched it. feedback_collector is an always-on daemon, so summon
    #     buttons get posted reliably for every new forum thread.
    #   - Continuation forwarding (on_message → POST to dashboard) lives in
    #     slang-mcp/discord.py with the summoned/resolved/cap gates. This
    #     service only does audit logging in on_message.

    @client.event
    async def on_thread_create(thread: discord.Thread):
        """Auto-post summon button on new forum threads."""
        if not thread.parent_id or str(thread.parent_id) not in WATCHED_FORUM_IDS:
            return
        # Wait briefly for the thread to be fully created before posting
        await asyncio.sleep(2)
        prompt_text = (
            "🤖 *Need help? Click below for a bot answer.*\n"
            f"*After the first reply, I'll keep responding to **your** follow-ups in this thread "
            f"(up to {MAX_BOT_REPLIES_PER_THREAD} messages total). "
            f"Click **Resolved** on any of my replies to pause me; click again to resume.*"
        )
        try:
            await thread.send(prompt_text, view=SummonView())
            logger.info(f"Summon button posted in new thread: {thread.name}")
        except Exception as e:
            logger.error(f"Failed to post summon button in {thread.name}: {e}")

    @client.event
    async def on_message(message: discord.Message):
        # Audit-only: capture human replies in watched threads to thread_replies.jsonl.
        # Do NOT forward — slang-mcp's discord.py handles forwarding (with gates).
        if message.author.bot:
            return
        if not isinstance(message.channel, discord.Thread):
            return
        if message.channel.parent_id and str(message.channel.parent_id) in WATCHED_FORUM_IDS:
            _save_thread_reply(message)

    await client.start(token)


if __name__ == "__main__":
    asyncio.run(main())
