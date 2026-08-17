---
name: costliest-session-digest
license: MIT
description: Daily "costliest session + why" digest for ONE agent group. Finds the group's most expensive session of the day from its own SDK transcripts (the same raw per-message usage the dashboard prices from), explains WHY it was costly (peak context, cache-write churn, model tier, oversized tool outputs, redundant loops), and DMs the owner a tight few-bullet summary. Self-correcting: a daily cron gate stays silent on cheap days. Triggers on "costliest session", "cost digest", "why was that session expensive", "daily cost report".
---

# costliest-session-digest

> **Scope:** this skill reports on **one agent group's own sessions** — the SDK
> transcripts under this group's `/home/node/.claude/projects/`. It never reads
> another group's data (a container is mounted with only its own group's state),
> and it does not change anything: the embedded `costliest_session.py` is
> **read-only**. Its whole job is one daily DM: *the day's most expensive session,
> and why.*

It is the reporting counterpart to the LEAN cost cap (`session_state.cost_cap`)
and the dashboard's Sessions-tab cost column. The cost cap and dashboard tell you
*that* spend happened; this tells the owner *which session* drove the day and
*why*, in a few bullets they can act on — start a fresh session, trim a bloated
prompt, page an oversized tool output.

## The data path (why it lives here, and why it's group-scoped)

**The constraint.** A group container is mounted with only its OWN session DBs
(`/workspace/inbound.db`, `/workspace/outbound.db`) — it cannot see the group's
*other* sessions on the filesystem, and it cannot see any *other group* at all.
So "rank this group's sessions by cost" can't come from the two session DBs.

**What it CAN reach.** `src/container-runner.ts` mounts the **per-group**
`.claude-shared` directory at `/home/node/.claude` (read-write, every session of
the group shares it). The Claude SDK writes each session's transcript there as
`/home/node/.claude/projects/-workspace-agent/<sdk-session-id>.jsonl`, one file
per session, carrying the **raw per-message `usage`** (input / output / cache-read
/ cache-creation with the 5m·1h TTL split, plus the model). This is the *exact
same source* the dashboard's `dashboard/session-costs.ts` prices from — so a group
container can rank **all of its own sessions** by cost, and reconstruct every
driver, without ever crossing a group boundary. Isolation holds by construction.

**Why not the dashboard `/api/sessions?sort=cost` HTTP API.** It's reachable from
a container (`host.docker.internal:3737`) and it's the already-priced ranking, but
(1) it returns only `cost` + total `tokens` per session — not the driver breakdown
this digest needs to answer *why*; (2) it returns **every group's** sessions, an
over-share for a per-group task; (3) it's an optional skill-installed feature, not
present on every deployment. So this skill reads the **same underlying JSONL** the
dashboard reads and prices it with a **verbatim copy of the dashboard's
`MODEL_PRICING`** (the sanctioned "copied, not imported" pattern that
`container/agent-runner/src/pricing.ts` already follows) — the figure reconciles
with the dashboard column to the cent, with no cross-group read and no dependency
on the dashboard being installed. If `TRANSCRIPTS_BASE_URL` is set, the digest can
also name the archive link.

**Why not a host-side job or the orchestrator.** A host job would need new
plumbing to DM an owner; the orchestrator container is *also* mounted with only
its own group's `.claude-shared`, so it can't read another group's transcripts
either. A per-group container task has the data, respects isolation, and delivers
natively via `mcp__nanoclaw__send_message`. Per-group crons also give per-owner
delivery.

## The digest (what the owner gets)

A few bullets — **not** a transcript. When the gate says the day was cheap,
**send nothing.** When it fires, DM the owner something like:

```
Daily cost digest — <group> — <YYYY-MM-DD>
Costliest session: $4.12  (68% of the group's $6.05 today)
  claude-opus-5 · 1.8M tokens / 42 turns · peak context ~610k tokens
Why:
  • Cache-read was 74% of cost — a long-lived session re-read a ~600k-token
    context on every turn (the 1M-context bloat pattern).
  • Cache-write churn 18% (1h-writes ~240k tok) — the prompt prefix kept changing.
Fix: start a fresh session / `/clear` between unrelated tasks so each turn stops
  re-reading a huge prompt; that alone would have saved most of the cache-read spend.
Trace: /workspace/agent/.claude-trace/  (SDK id <uuid>)
```

Keep it to: the session ($ + share of the day), the top 2–3 drivers, one concrete
fix, and the trace pointer. The numbers come straight from `report` (below) — don't
invent any.

## Build / run (deterministic base — always first)

**Step 0 — write the tool.** Write the embedded `costliest_session.py` below
verbatim to `/workspace/agent/tools/costliest_session.py` (idempotent; overwrite
each run so SKILL.md stays the source of truth).

**Step 1 — gate / rank / report.** From the container:

```bash
mkdir -p /workspace/agent/tools
# ranking + a one-line human summary of every session's cost today:
python3 /workspace/agent/tools/costliest_session.py rank
# full driver breakdown of the day's top session (text + a JSON block after ---JSON---):
python3 /workspace/agent/tools/costliest_session.py report
```

`report` prints a human summary and, after a `---JSON---` marker, a compact JSON
object (`day_cost_usd`, `share_of_group_day`, `peak_context_tokens`,
`token_mix_pct`, `cache_write_1h_share_pct`, `cost_drivers`, `suggestions`, …).
Turn that into the digest above — the `suggestions` are grounded heuristics you
can quote or sharpen. Default day is **today** (UTC); pass `--day yesterday` (or
`--day YYYY-MM-DD`) for a morning-after digest, and `--session <sdk-id>` to force
a specific session.

## DM the owner (the delivery step)

Send the digest to the owner via `send_message` (to the owner, or your escalation
destination). If you have a single destination, `to` can be omitted. **If the gate
said the day was cheap, send nothing** — a quiet day costs the owner no attention.

## Run autonomously — the daily cron (COST GUARD)

Registered as a per-group recurring task with a **pre-task gate script** so cheap
days cost nothing: the gate wakes the agent **only** when the day's top session
cleared the `COSTLIEST_MIN_USD` floor (default $1). Same shape as `/okf-synthesis`
and `/learnings-wiki`.

> **CODE-ONLY NOTE.** The `ncl tasks create …` below is **documentation** — an
> operator applies it **per group, after approval**. This skill does not create
> live tasks and this repo change runs no migration. `costliest_session.py` is
> read-only; even so, first registration is an operator action.

**The gate** (`--script`): runs the ranker and emits the one-line
`{"wakeAgent": …}` the task loop reads
(`container/agent-runner/src/scheduling/task-script.ts`). It stays asleep on a
cheap day and — like the prod `memcheck` gate — **wakes loudly on scanner failure**
(a crashed probe must never read as "clean"):

```bash
python3 /workspace/agent/tools/costliest_session.py gate \
  || echo '{"wakeAgent":true,"data":{"SCANNER_FAILED":"costliest_session.py did not run - investigate, do NOT assume clean"}}'
```

**The exact command an operator runs, once per group** (fill `<agent-group-id>`;
from the host, or inside that group's container where `--group` auto-fills). The
gate first writes the tool, so the series is self-contained:

```
ncl tasks create \
  --group <agent-group-id> \
  --name "costliest-session-digest" \
  --recurrence "30 13 * * *" \
  --script 'python3 /workspace/agent/tools/costliest_session.py gate || echo {"wakeAgent":true,"data":{"SCANNER_FAILED":"costliest_session.py did not run - investigate, do NOT assume clean"}}' \
  --prompt 'DAILY COST DIGEST — the gate fired, so today has a session worth reporting (data has the top session + group day total). Load the /costliest-session-digest skill and follow it: write /workspace/agent/tools/costliest_session.py, run `costliest_session.py report`, and DM the owner a FEW-bullet digest — the costliest session ($ + share of the day), its top 2-3 drivers (peak context, cache-read vs cache-write churn, model tier, oversized tool outputs, redundant loops), and ONE concrete fix. Numbers must come from `report`; do not invent any. If the gate ever reports SCANNER_FAILED, say so plainly instead of a digest. Keep it tight — this is a heads-up, not a transcript.'
```

Cron uses the install timezone. `30 13 * * *` fires early afternoon; for a
"yesterday, first thing" digest use `--day yesterday` in the prompt and an early
cron (`0 8 * * *`). The gate makes cheap days free, so a daily cadence is fine.
Tune the floor per group with `COSTLIEST_MIN_USD` in the task env if $1 is noisy.

This skill is **provider-agnostic in shape** but **Claude-specific in data**: only
Claude sessions write the SDK `usage` JSONL this reads, so a non-Claude group has
nothing to price and the gate simply stays asleep. It is **idempotent** (read-only;
re-running never changes state) and **complementary** to the cost cap (that one
*stops* runaway spend; this one *explains* the day's spend after the fact).

## Embedded tool

Write this verbatim to `/workspace/agent/tools/costliest_session.py`:

```python
#!/usr/bin/env python3
"""costliest_session.py -- deterministic per-group "costliest session of the day".

Scoped to ONE agent group. Walks that group's own SDK transcript JSONL under
/home/node/.claude/projects/ (the per-group .claude-shared mount) -- the SAME raw
per-message `usage` the dashboard's session-costs.ts prices from -- ranks that
group's sessions by a chosen day's cost, and explains WHY the top one was
expensive. The pricing here is a VERBATIM port of dashboard/session-costs.ts and
container/agent-runner/src/pricing.ts (LiteLLM rates, TTL-split cache writes), so
the dollar figure reconciles with the dashboard's Sessions-tab cost column.

A container is mounted with only its OWN group's session DBs and .claude-shared,
so this sees this group's sessions and NO other group's -- isolation holds by
construction; there is no cross-group read.

NO RAG, NO embeddings, NO MCP, NO network. Pure filesystem, stdlib only.

Usage:
  costliest_session.py gate     # ONE line of JSON for the cron pre-task gate:
                                #   {"wakeAgent": false} when the day's top session
                                #   is below COSTLIEST_MIN_USD, else
                                #   {"wakeAgent": true, "data": {...top summary...}}
  costliest_session.py rank     # human table: sessions ranked by the day's cost
  costliest_session.py report   # full driver breakdown of the day's top session
                                #   (or --session <uuid>): text + a JSON block

Options:
  --day today|yesterday|YYYY-MM-DD   day to score (default today, UTC calendar day)
  --session <sdk-uuid>               force a specific session for `report`/`rank`

Env:
  COSTLIEST_JSONL_DIR   default /home/node/.claude/projects/-workspace-agent
                        (falls back to every /home/node/.claude/projects/*/)
  COSTLIEST_MIN_USD     gate wake floor in USD, default 1.00
"""
import glob
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone

DEFAULT_JSONL_DIR = "/home/node/.claude/projects/-workspace-agent"
PROJECTS_GLOB = "/home/node/.claude/projects/*"
DEFAULT_MIN_USD = 1.00

# --- Pricing core: VERBATIM port of dashboard/session-costs.ts MODEL_PRICING.
# Keyed by BASE model id (no provider prefix, no `[1m]`/`-v1`/date suffix).
MODEL_PRICING = {
    "claude-opus-5": {"input": 5e-6, "output": 25e-6, "cacheCreate": 6.25e-6, "cacheRead": 5e-7},
    "claude-opus-4-8": {"input": 5e-6, "output": 25e-6, "cacheCreate": 6.25e-6, "cacheRead": 5e-7},
    "claude-opus-4-7": {"input": 5e-6, "output": 25e-6, "cacheCreate": 6.25e-6, "cacheRead": 5e-7},
    "claude-opus-4-6": {"input": 5e-6, "output": 25e-6, "cacheCreate": 6.25e-6, "cacheRead": 5e-7},
    "claude-sonnet-5": {"input": 2e-6, "output": 10e-6, "cacheCreate": 2.5e-6, "cacheRead": 2e-7},
    "claude-sonnet-4-6": {"input": 3e-6, "output": 15e-6, "cacheCreate": 3.75e-6, "cacheRead": 3e-7},
    "claude-haiku-4-5": {"input": 1e-6, "output": 5e-6, "cacheCreate": 1.25e-6, "cacheRead": 1e-7},
}


def normalize_model(model):
    """Reduce a wire model id to its base pricing key, else '' (unpriced)."""
    if not model:
        return ""
    m = model.strip().lower()
    m = re.sub(r"\[1m\]$", "", m)
    m = re.sub(r"^aws/anthropic/bedrock-", "", m)
    m = re.sub(r"^aws/anthropic/", "", m)
    m = re.sub(r"^anthropic/", "", m)
    m = re.sub(r"-v\d+$", "", m)
    if m in MODEL_PRICING:
        return m
    undated = re.sub(r"-\d{8}$", "", m)
    if undated in MODEL_PRICING:
        return undated
    return ""


def price_usage(model, u):
    """Dollar cost of one message's usage. Unknown model -> 0 (unpriced)."""
    rate = MODEL_PRICING.get(normalize_model(model))
    if not rate:
        return 0.0
    cost = (
        (u.get("input_tokens") or 0) * rate["input"]
        + (u.get("output_tokens") or 0) * rate["output"]
        + (u.get("cache_read_input_tokens") or 0) * rate["cacheRead"]
    )
    split = u.get("cache_creation")
    if isinstance(split, dict) and (
        split.get("ephemeral_5m_input_tokens") is not None
        or split.get("ephemeral_1h_input_tokens") is not None
    ):
        cost += (split.get("ephemeral_5m_input_tokens") or 0) * rate["cacheCreate"]
        cost += (split.get("ephemeral_1h_input_tokens") or 0) * (rate["input"] * 2)  # 1h write = 2x input
    else:
        cost += (u.get("cache_creation_input_tokens") or 0) * rate["cacheCreate"]
    return cost


def iso_day_key(ts):
    """'2026-08-13T04:05:06.789Z' -> '20260813' (UTC). None when unparseable."""
    if not ts or not isinstance(ts, str) or len(ts) < 10:
        return None
    head = ts[:10]
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", head):
        return None
    return head.replace("-", "")


def resolve_day(arg):
    """--day today|yesterday|YYYY-MM-DD -> 'YYYYMMDD' (UTC)."""
    today = datetime.now(timezone.utc).date()
    if arg in (None, "", "today"):
        d = today
    elif arg == "yesterday":
        d = today - timedelta(days=1)
    else:
        d = datetime.strptime(arg, "%Y-%m-%d").replace(tzinfo=timezone.utc).date()
    return d.strftime("%Y%m%d")


def jsonl_files():
    """Every SDK transcript jsonl reachable from this group's container."""
    d = os.environ.get("COSTLIEST_JSONL_DIR", DEFAULT_JSONL_DIR)
    files = sorted(glob.glob(os.path.join(d, "*.jsonl")))
    if not files:
        # Fall back to every project slug under the per-group .claude-shared mount.
        files = sorted(glob.glob(os.path.join(PROJECTS_GLOB, "*.jsonl")))
    return files


def tool_input_sig(block):
    """Stable, bounded signature of a tool_use input for duplicate detection."""
    try:
        return json.dumps(block.get("input"), sort_keys=True)[:512]
    except (TypeError, ValueError):
        return repr(block.get("input"))[:512]


def new_agg(path):
    session = os.path.basename(path).removesuffix(".jsonl")
    return {
        "session": session,
        "cost": 0.0,
        "tokens": 0,
        "input": 0,
        "output": 0,
        "cache_read": 0,
        "cache_create": 0,
        "cache_create_1h": 0,
        "cache_create_5m": 0,
        "turns": 0,
        "peak_context": 0,
        "models": set(),
        "unpriced": False,
        "tool_calls": 0,
        "dup_tool_calls": 0,
        "tool_output_chars": 0,
        "max_tool_output_chars": 0,
        "top_tools": {},
    }


def scan_file(path, day_key):
    """Aggregate one session file's cost + drivers for a single UTC day.

    Dedupes assistant messages by `message.id` exactly as the dashboard's
    scanFileCost does (a resumed/rewound session replays the same message id),
    so the summed cost reconciles with the dashboard column.
    """
    agg = new_agg(path)
    seen_msg = set()
    seen_tool_result = set()
    tool_sig_counts = {}
    tool_name_counts = {}
    try:
        with open(path, encoding="utf-8") as fh:
            lines = fh.readlines()
    except OSError:
        return agg

    for line in lines:
        if '"usage"' not in line and '"tool_result"' not in line and '"tool_use"' not in line:
            continue
        try:
            r = json.loads(line)
        except (ValueError, TypeError):
            continue
        if not isinstance(r, dict):
            continue
        key = iso_day_key(r.get("timestamp"))
        rtype = r.get("type")
        msg = r.get("message")
        if not isinstance(msg, dict):
            continue

        if rtype == "assistant" and isinstance(msg.get("usage"), dict):
            mid = msg.get("id")
            if mid:
                if mid in seen_msg:
                    continue
                seen_msg.add(mid)
            if key != day_key:
                continue
            u = msg["usage"]
            model = msg.get("model")
            cost = price_usage(model, u)
            inp = u.get("input_tokens") or 0
            out = u.get("output_tokens") or 0
            cr = u.get("cache_read_input_tokens") or 0
            split = u.get("cache_creation")
            if isinstance(split, dict) and (
                split.get("ephemeral_5m_input_tokens") is not None
                or split.get("ephemeral_1h_input_tokens") is not None
            ):
                cc5 = split.get("ephemeral_5m_input_tokens") or 0
                cc1 = split.get("ephemeral_1h_input_tokens") or 0
            else:
                cc5 = u.get("cache_creation_input_tokens") or 0
                cc1 = 0
            cc = cc5 + cc1
            tokens = inp + out + cr + cc
            agg["cost"] += cost
            agg["tokens"] += tokens
            agg["input"] += inp
            agg["output"] += out
            agg["cache_read"] += cr
            agg["cache_create"] += cc
            agg["cache_create_1h"] += cc1
            agg["cache_create_5m"] += cc5
            agg["turns"] += 1
            agg["peak_context"] = max(agg["peak_context"], inp + cr + cc)
            if model:
                agg["models"].add(model)
            if cost == 0 and tokens > 0 and model and not normalize_model(model):
                agg["unpriced"] = True
            content = msg.get("content")
            if isinstance(content, list):
                for block in content:
                    if isinstance(block, dict) and block.get("type") == "tool_use":
                        name = block.get("name") or "?"
                        agg["tool_calls"] += 1
                        tool_name_counts[name] = tool_name_counts.get(name, 0) + 1
                        sig = (name, tool_input_sig(block))
                        tool_sig_counts[sig] = tool_sig_counts.get(sig, 0) + 1
        elif rtype == "user" and key == day_key:
            content = msg.get("content")
            if isinstance(content, list):
                for block in content:
                    if not (isinstance(block, dict) and block.get("type") == "tool_result"):
                        continue
                    tid = block.get("tool_use_id")
                    if tid:
                        if tid in seen_tool_result:
                            continue
                        seen_tool_result.add(tid)
                    size = len(json.dumps(block.get("content"), default=str))
                    agg["tool_output_chars"] += size
                    agg["max_tool_output_chars"] = max(agg["max_tool_output_chars"], size)

    agg["dup_tool_calls"] = sum(c - 1 for c in tool_sig_counts.values() if c > 1)
    agg["top_tools"] = dict(sorted(tool_name_counts.items(), key=lambda kv: -kv[1])[:5])
    return agg


def rank_sessions(day_key):
    rows = []
    for path in jsonl_files():
        a = scan_file(path, day_key)
        if a["cost"] > 0 or a["tokens"] > 0:
            rows.append(a)
    rows.sort(key=lambda a: (-a["cost"], -a["tokens"]))
    return rows


def pct(part, whole):
    return round(100.0 * part / whole, 1) if whole else 0.0


def drivers(agg, day_total_cost):
    """Rank the cost drivers for one session's day + a suggested optimization."""
    cost = agg["cost"] or 1e-9
    rate = MODEL_PRICING.get(normalize_model(next(iter(agg["models"]), ""))) or MODEL_PRICING["claude-opus-5"]
    cache_read_cost = agg["cache_read"] * rate["cacheRead"]
    output_cost = agg["output"] * rate["output"]
    input_cost = agg["input"] * rate["input"]
    cc1_cost = agg["cache_create_1h"] * rate["input"] * 2
    cc5_cost = agg["cache_create_5m"] * rate["cacheCreate"]
    cache_write_cost = cc1_cost + cc5_cost
    parts = [
        ("cache-read (context re-read each turn)", cache_read_cost),
        ("cache-write (context churn)", cache_write_cost),
        ("output generation", output_cost),
        ("fresh input", input_cost),
    ]
    parts.sort(key=lambda kv: -kv[1])
    ranked = [{"driver": n, "usd": round(v, 4), "pct_of_cost": pct(v, cost)} for n, v in parts if v > 0]

    hints = []
    if pct(cache_read_cost, cost) >= 60 and agg["peak_context"] >= 200_000:
        hints.append(
            f"Long-lived, bloated context: peak turn read ~{agg['peak_context']:,} tokens and "
            f"{pct(cache_read_cost, cost)}% of spend was cache-read. Start a fresh session / `/clear` "
            f"between unrelated tasks so each turn stops re-reading a huge prompt."
        )
    if pct(cache_write_cost, cost) >= 35:
        hints.append(
            f"High cache-write churn ({pct(cache_write_cost, cost)}% of cost, 1h-writes "
            f"~{agg['cache_create_1h']:,} tokens): the prompt prefix keeps changing, so the cache is "
            f"rebuilt instead of reused. Keep early context stable; avoid rewriting system/memory mid-session."
        )
    if pct(output_cost, cost) >= 35:
        hints.append(
            f"Output-heavy ({pct(output_cost, cost)}% of cost, {agg['output']:,} output tokens): very long "
            f"generations. Ask for tighter answers / stream to files instead of chat."
        )
    if agg["max_tool_output_chars"] >= 100_000 or agg["tool_output_chars"] >= 500_000:
        hints.append(
            f"Oversized tool outputs (~{agg['tool_output_chars']:,} chars total, largest "
            f"~{agg['max_tool_output_chars']:,}): a tool dumped a wall of text into context. Page/limit outputs "
            f"(head, --json fields, grep) so they don't inflate every later turn."
        )
    if agg["dup_tool_calls"] >= 8:
        hints.append(
            f"Redundant tool loops (~{agg['dup_tool_calls']} duplicate tool calls): the agent repeated "
            f"identical calls. Cache/remember results within the turn."
        )
    if not hints:
        hints.append(
            f"No single dominant driver -- cost tracks raw volume ({agg['turns']} turns, {agg['tokens']:,} "
            f"tokens). Consider whether the task needed this session length or a cheaper model tier."
        )

    return {
        "session": agg["session"],
        "day_cost_usd": round(agg["cost"], 2),
        "share_of_group_day": pct(agg["cost"], day_total_cost),
        "tokens": agg["tokens"],
        "turns": agg["turns"],
        "peak_context_tokens": agg["peak_context"],
        "models": sorted(agg["models"]),
        "unpriced": agg["unpriced"],
        "token_mix_pct": {
            "cache_read": pct(agg["cache_read"], agg["tokens"]),
            "cache_write": pct(agg["cache_create"], agg["tokens"]),
            "input": pct(agg["input"], agg["tokens"]),
            "output": pct(agg["output"], agg["tokens"]),
        },
        "cache_write_1h_share_pct": pct(agg["cache_create_1h"], agg["cache_create"]),
        "top_tools": agg["top_tools"],
        "dup_tool_calls": agg["dup_tool_calls"],
        "tool_output_chars": agg["tool_output_chars"],
        "max_tool_output_chars": agg["max_tool_output_chars"],
        "cost_drivers": ranked[:3],
        "suggestions": hints[:2],
    }


def parse_args(argv):
    cmd = argv[0] if argv else "gate"
    day = None
    session = None
    i = 1
    while i < len(argv):
        if argv[i] == "--day" and i + 1 < len(argv):
            day = argv[i + 1]
            i += 2
        elif argv[i] == "--session" and i + 1 < len(argv):
            session = argv[i + 1]
            i += 2
        else:
            i += 1
    return cmd, day, session


def pick_top(rows, session):
    if session:
        for a in rows:
            if a["session"] == session:
                return a
        return None
    return rows[0] if rows else None


def cmd_gate(rows, day_total, day_key, session, min_usd):
    top = pick_top(rows, session)
    wake = bool(top and top["cost"] >= min_usd)
    out = {"wakeAgent": wake}
    if wake:
        out["data"] = {
            "day": day_key,
            "top_session": top["session"],
            "top_cost_usd": round(top["cost"], 2),
            "group_day_total_usd": round(day_total, 2),
            "sessions_scored": len(rows),
            "min_usd": min_usd,
        }
    print(json.dumps(out))
    return 0


def cmd_rank(rows, day_total, day_key):
    if not rows:
        print(f"no priced session activity for day {day_key}")
        return 0
    print(f"Sessions by cost for {day_key} (group day total ${day_total:.2f}):")
    for a in rows[:20]:
        flag = " *unpriced" if a["unpriced"] else ""
        print(
            f"  ${a['cost']:>8.2f}  {a['tokens']:>10,} tok  {a['turns']:>3} turns  "
            f"peak~{a['peak_context']:>9,}  {a['session']}{flag}"
        )
    return 0


def cmd_report(rows, day_total, day_key, session):
    top = pick_top(rows, session)
    if not top:
        print(f"no priced session activity for day {day_key}")
        print("---JSON---")
        print(json.dumps({"day": day_key, "top_session": None}))
        return 0
    d = drivers(top, day_total)
    mix = d["token_mix_pct"]
    print(f"COSTLIEST SESSION -- {day_key}")
    print(f"  session:  {d['session']}")
    print(f"  cost:     ${d['day_cost_usd']:.2f}  ({d['share_of_group_day']}% of the group's ${day_total:.2f} that day)")
    print(f"  volume:   {d['tokens']:,} tokens over {d['turns']} turns; peak turn read ~{d['peak_context_tokens']:,} tokens")
    print(f"  models:   {', '.join(d['models']) or '?'}{' (UNPRICED)' if d['unpriced'] else ''}")
    print(
        f"  tokenmix: cache_read {mix['cache_read']}% / cache_write {mix['cache_write']}% "
        f"(1h-write {d['cache_write_1h_share_pct']}% of writes) / input {mix['input']}% / output {mix['output']}%"
    )
    if d["tool_output_chars"]:
        print(
            f"  tools:    {d['top_tools']} ; ~{d['tool_output_chars']:,} chars of tool output "
            f"(largest ~{d['max_tool_output_chars']:,}); ~{d['dup_tool_calls']} duplicate calls"
        )
    print("  drivers:")
    for cd in d["cost_drivers"]:
        print(f"    - {cd['driver']}: ${cd['usd']:.2f} ({cd['pct_of_cost']}%)")
    print("  suggest:")
    for s in d["suggestions"]:
        print(f"    - {s}")
    print(f"  trace:    /workspace/agent/.claude-trace/  (match SDK id {d['session']})")
    print("---JSON---")
    print(json.dumps(d))
    return 0


def main(argv):
    cmd, day_arg, session = parse_args(argv)
    day_key = resolve_day(day_arg)
    min_usd = float(os.environ.get("COSTLIEST_MIN_USD", DEFAULT_MIN_USD))
    rows = rank_sessions(day_key)
    day_total = sum(a["cost"] for a in rows)

    if cmd == "gate":
        return cmd_gate(rows, day_total, day_key, session, min_usd)
    if cmd == "rank":
        return cmd_rank(rows, day_total, day_key)
    if cmd == "report":
        return cmd_report(rows, day_total, day_key, session)
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
```

## Notes / limits

- **Claude-only data.** Only Claude sessions write the SDK `usage` JSONL. A group
  on another provider has nothing to price; the gate stays asleep (correct — no
  spend signal to report).
- **UTC calendar day.** Cost is bucketed by the message timestamp's UTC day, to
  match the dashboard's `isoDayKey`. The digest prose renders whatever `--day` you
  pass; for an install-timezone "yesterday" digest, run the cron early and pass
  `--day yesterday`.
- **Dedup by `message.id`.** A resumed/rewound session replays the same assistant
  message under a new top-level `uuid`; counting every row double-counts cost.
  This dedupes by `message.id` exactly as the dashboard does, so the figure
  reconciles.
- **Reconciliation contract.** `MODEL_PRICING` here is a verbatim copy of
  `dashboard/session-costs.ts` / `container/agent-runner/src/pricing.ts`. If a rate
  changes there, change it here too (and vice-versa) — the digest's dollar figure
  is only trustworthy while the three agree.
