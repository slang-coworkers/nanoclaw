"""Discord feedback collector and summon button service.

Standalone always-on daemon that:
1. Auto-posts a "Get Bot Help" button on new forum threads
2. Handles summon button clicks — POSTs to dashboard ingress, saves request log
3. Continues conversation: forwards OP follow-up replies in summoned threads to
   the agent (when this daemon owns forwarding — see _forward_followups_here),
   capped at MAX_BOT_REPLIES_PER_THREAD (default 15) bot replies.
4. Handles feedback button clicks (Resolved/Helpful/Not Helpful). Resolved ends
   the conversation early.
5. Captures human replies in watched forum threads to thread_replies.jsonl.

On prod this daemon is the canonical follow-up forwarder because slang-mcp's
Discord Gateway is per-MCP-session and reaped after ~10 min idle by supergateway
--stateful; this daemon holds a permanent Gateway. slang-mcp/discord.py keeps
the same forwarding on_message for lego / no-daemon installs (DISCORD_POST_SUMMON=1).
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

from .reply_capacity import (
    EVENT_ACCEPTED,
    EVENT_FAILED,
    EVENT_PENDING,
    ReplyCapacity,
    apply_event,
    new_reservation_id,
)

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


def _forward_followups_here() -> bool:
    """Return True when THIS daemon should forward OP follow-ups to the agent.

    Prod runs this always-on daemon alongside slang-mcp; slang-mcp's Discord
    Gateway is per-MCP-session and gets reaped after ~10 min idle, so its
    forwarding on_message is unreliable for unsolicited follow-ups. This daemon
    holds a permanent Gateway, so it owns forwarding on prod.

    To avoid BOTH processes forwarding the same message (a duplicate wake while
    slang-mcp's Gateway happens to be warm), forwarding follows the same
    prod-vs-lego ownership axis as summon-button posting: when
    DISCORD_POST_SUMMON=1 the install has no daemon canonicalized (lego /
    hot-failover) and slang-mcp owns both posting and forwarding, so this daemon
    stays audit-only. Default (unset/0) = prod → this daemon forwards.
    DISCORD_READ_ONLY=1 (lego) hard-disables forwarding regardless.
    """
    if os.environ.get("DISCORD_READ_ONLY") == "1":
        return False
    return os.environ.get("DISCORD_POST_SUMMON", "0") != "1"


# ── Per-thread state ────────────────────────────────────────────────────────

@dataclass
class ThreadState:
    summoned: bool = False
    resolved: bool = False
    capacity: ReplyCapacity = field(default_factory=ReplyCapacity)

    @property
    def bot_reply_count(self) -> int:
        """Quota consumed: delivered replies + reservations still in flight.

        A failed ingress POST no longer counts — see reply_capacity.py. Kept
        under the original name so every gate that reads it is unchanged.
        """
        return self.capacity.charged()

    @property
    def failed_reply_count(self) -> int:
        return self.capacity.failed

    @property
    def unresolved_reply_count(self) -> int:
        """Charges held by reservations that never settled and are past the TTL.

        These consume quota and will keep consuming it until someone settles
        them — their true outcome is unknown and age does not reveal it. Surfaced
        so a thread that has gone quiet can be explained rather than guessed at.
        Clear with `python -m src.discord.reply_capacity_admin`.
        """
        return len(self.capacity.unresolved_ids())


thread_state: dict[str, ThreadState] = defaultdict(ThreadState)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _record_thread_event(thread_id: str, event: str, reservation_id: str | None = None) -> None:
    """Append an event to the audit log and mutate in-memory state."""
    os.makedirs(FEEDBACK_DIR, exist_ok=True)
    row = {"thread_id": thread_id, "event": event, "ts": _now_iso()}
    if reservation_id:
        row["reservation_id"] = reservation_id
    with open(THREAD_STATE_FILE, "a") as f:
        f.write(json.dumps(row) + "\n")
    state = thread_state[thread_id]
    if event == "summoned":
        state.summoned = True
    elif event == "resolved":
        state.resolved = True
    elif event == "unresolved":
        state.resolved = False
    else:
        apply_event(state.capacity, event, reservation_id, row["ts"])


def _reserve_reply(thread_id: str) -> str:
    """Charge one reply to this thread BEFORE POSTing, and return its id.

    Reserving up front is what keeps admission atomic: the cap check and this
    write happen with no `await` between them, so two near-simultaneous OP
    messages cannot both read the same pre-increment count. The reservation is
    released again by _settle_reply if the POST does not land.
    """
    rid = new_reservation_id()
    _record_thread_event(thread_id, EVENT_PENDING, rid)
    return rid


def _settle_reply(thread_id: str, reservation_id: str, delivered: bool) -> None:
    """Close out a reservation: delivered keeps the charge, failure refunds it.

    The failure row is the point. Without it a transient ingress outage spent
    quota permanently and left no trace, so a thread that had gone silent was
    indistinguishable from one that had simply used its 15 replies.
    """
    _record_thread_event(
        thread_id, EVENT_ACCEPTED if delivered else EVENT_FAILED, reservation_id
    )


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
            elif event == "resolved":
                state.resolved = True
            elif event == "unresolved":
                state.resolved = False
            else:
                apply_event(state.capacity, event, row.get("reservation_id"), row.get("ts"))
    summoned = sum(1 for s in thread_state.values() if s.summoned)
    capped = sum(1 for s in thread_state.values() if s.bot_reply_count >= MAX_BOT_REPLIES_PER_THREAD)
    # Failed forwards are reported explicitly: they are the signal that a
    # thread went quiet because ingress was down, not because the bot answered
    # 15 times. Previously they left no trace at all.
    failed = sum(s.failed_reply_count for s in thread_state.values())
    logger.info(
        f"Replayed thread state: {len(thread_state)} threads, {summoned} summoned, "
        f"{capped} at cap, {failed} failed forward(s) refunded"
    )


# ── Dashboard ingress POST ──────────────────────────────────────────────────

async def _post_to_dashboard(
    content: str, thread_id: str | None = None, reservation_id: str | None = None
) -> bool:
    headers = {"Content-Type": "application/json"}
    if DASHBOARD_SECRET:
        headers["Authorization"] = f"Bearer {DASHBOARD_SECRET}"
    body = {"group": SUMMON_TARGET_GROUP, "content": content}
    # thread_id routes each Discord thread to its own per-thread agent session
    # (the wiring is session_mode=per-thread). Without it every thread collapses
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
        # Reserve the summon's own reply against the cap, matching slang-mcp's
        # SummonView. Both processes fold the same thread_state.jsonl through
        # reply_capacity.py, so the accounting cannot drift. The reservation is
        # settled below: a failed ingress POST refunds it, so a user clicking
        # "try again" after an outage no longer burns quota per click.
        reservation = _reserve_reply(thread_id)

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
            logger.info(f"Dashboard ingress accepted summon for thread: {thread_name}")
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
    #   - Continuation forwarding (on_message → POST to dashboard) ALSO lives
    #     here on prod (gated by _forward_followups_here()). slang-mcp's Gateway
    #     is per-MCP-session and reaped after ~10 min idle by supergateway
    #     --stateful, so its forwarding on_message misses follow-ups that land
    #     during a quiet window. This daemon holds a permanent Gateway, so it is
    #     the reliable forwarder. slang-mcp's on_message stays as the lego /
    #     no-daemon path (DISCORD_POST_SUMMON=1); the gate keeps exactly one
    #     process forwarding so a warm slang-mcp Gateway can't double-forward.

    @client.event
    async def on_thread_create(thread: discord.Thread):
        """Auto-post summon button on new forum threads."""
        if not thread.parent_id or str(thread.parent_id) not in WATCHED_FORUM_IDS:
            return
        # Defense-in-depth for read-only installs (lego). If feedback_collector
        # is ever started on a read-only install by mistake, this prevents it
        # from posting buttons. Prod has DISCORD_READ_ONLY unset → no effect.
        if os.environ.get("DISCORD_READ_ONLY") == "1":
            logger.warning(
                f"DISCORD_READ_ONLY=1 — feedback_collector: blocked summon-button post on thread={thread.id}"
            )
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
        # Two jobs: (1) forward OP follow-ups to the agent when this daemon owns
        # forwarding (prod), and (2) always audit-log human replies to
        # thread_replies.jsonl.
        if message.author.bot:
            return
        channel = message.channel
        if not isinstance(channel, discord.Thread):
            return
        if not channel.parent_id or str(channel.parent_id) not in WATCHED_FORUM_IDS:
            return

        # Audit every human reply first — this must happen regardless of the
        # forwarding gates below, so the drop-analysis record stays complete.
        _save_thread_reply(message)

        if not _forward_followups_here():
            return  # slang-mcp owns forwarding on this install (lego / read-only)

        thread_id = str(channel.id)

        # Continuation gates — silent skips, not errors. Mirror slang-mcp's
        # on_message so behavior is identical whichever process forwards.
        #
        # OP-only: only the thread author's follow-ups wake the bot. A
        # knowledgeable bystander can't rack up the OP's reply cap or steer the
        # bot off-topic.
        if channel.owner_id and message.author.id != channel.owner_id:
            return
        state = thread_state[thread_id]
        if not state.summoned:
            return  # bot was never summoned in this thread; do not auto-engage
        if state.resolved:
            return  # OP marked the thread resolved; conversation ended
        if state.bot_reply_count >= MAX_BOT_REPLIES_PER_THREAD:
            return  # cap reached; bot has tapped out

        # Reserve BEFORE building the prompt so `is_final` is read off the
        # post-reservation charge — the same number the next admission will
        # see. Reserving first is also what makes the cap check atomic; see
        # reply_capacity.py.
        reservation = _reserve_reply(thread_id)
        is_final = state.bot_reply_count >= MAX_BOT_REPLIES_PER_THREAD
        final_clause = (
            "\n\nThis will be your FINAL allowed reply in this thread. End your "
            "message with a polite single-line note telling the user that further "
            "questions should be opened in a new thread."
            if is_final else ""
        )
        prompt = (
            f"New message in Discord thread.\n"
            f"Thread: {channel.name} (ID: {thread_id})\n"
            f"Author: {message.author.name}\n"
            f"Content: {message.content[:500]}\n"
            f"\n"
            f"Read the full thread via mcp__slang-mcp__discord_read_messages "
            f"(thread ID {thread_id}) and reply with mcp__slang-mcp__discord_send_message "
            f"(set add_feedback_buttons: true).\n"
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
                f"Forwarded follow-up for thread {channel.name} "
                f"(replies charged: {state.bot_reply_count}/{MAX_BOT_REPLIES_PER_THREAD}, final={is_final})"
            )
        else:
            # Refunded, not absorbed: retrying costs nothing, and the
            # reply_failed row makes the outage visible in the audit log.
            logger.error(
                f"Failed to forward follow-up for thread {channel.name}; "
                f"reservation {reservation} refunded "
                f"(replies charged: {state.bot_reply_count}/{MAX_BOT_REPLIES_PER_THREAD})"
            )

    await client.start(token)


if __name__ == "__main__":
    asyncio.run(main())
