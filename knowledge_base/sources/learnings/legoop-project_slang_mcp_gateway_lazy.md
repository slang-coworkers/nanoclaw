# slang-mcp's Discord Gateway connection is LAZY — init_discord_client() only fires when a Discord tool is invoked. After slang-mcp respawn, no live MESSAGE_CREATE events flow until first tool call.

`container/mcp-servers/slang-mcp/src/discord/discord.py:338` defines `init_discord_client()` which connects to Discord Gateway and registers `on_message` / `on_thread_create` handlers. **This is never called at server startup** — it's invoked only via `ensure_client_connected()` which itself is called from inside MCP tool bodies (`send_message`, `read_messages`, `moderate_message`, etc.).

`server.py` imports `init_discord_client` (line 22) but doesn't call it. There's no FastAPI/MCP `lifespan` / `on_startup` hook that triggers it.

**Implication:** When slang-mcp respawns (after `pkill`, after `systemctl restart`, after a build), `DISCORD_BOT_TOKEN` is in env but **the Gateway WebSocket is not connected**. Live `MESSAGE_CREATE` events from Discord won't fire `on_message` → `_post_to_dashboard` until something invokes a Discord tool to trigger `ensure_client_connected → init_discord_client → client.start(token)`. After that first call, the connection stays open for the lifetime of the slang-mcp process.

**Why:** Discovered 2026-05-14 during lego live-read deploy. Empirical confirmation: sending a chat to slang-discord-support that called `discord_read_messages` → agent reported "Call succeeded — Discord Gateway connection working" → from then on, push events flowed. Before that first invocation, no events.

**How to apply:**
- After lego's slang-mcp restarts, **manually trigger Gateway** by sending a chat to `slang-discord-support` asking it to call `mcp__slang-mcp__discord_read_messages` once. Verify via dashboard outbound. Then live events flow normally.
- "Lego stopped receiving Discord push events" debugging — first check if slang-mcp restarted recently (`ps -o etime= -p <pid>`). If yes and uptime < first-tool-invocation, Gateway hasn't initialized.
- Prod doesn't have this issue because prod runs `feedback_collector.py` as a separate daemon that calls `client.start(token)` directly at line 215 — Gateway always alive on prod.
- Cleanest fix (small follow-up PR): add `await init_discord_client()` to `server.py` startup so Gateway connects at boot. ~1 line; would make lego's behavior match prod's reliability without needing the trigger trick.
- See [[project-lego-discord-readonly]] for the broader read-only context this lazy behavior interacts with.
