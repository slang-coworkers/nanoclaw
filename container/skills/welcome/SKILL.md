---
name: welcome
license: MIT
description: Introduce yourself to a newly connected channel. Triggered automatically when a channel is first wired. Send a friendly greeting and brief overview of what you can do.
---

# /welcome — Channel Onboarding

You've just been connected to a new user. First impressions matter — introduce yourself and guide them into what you can do. Keep it warm and inviting, not encyclopedic.

Ground the message in `docs/USAGE.md` and other repo docs when needed. Use documented NanoClaw workflows and capabilities as the source of truth — do not invent features or tools that aren't described in the docs or available in the current environment.

## Channel addenda

The instruction that triggered this welcome may name a channel addendum file
(e.g. `/app/skills/welcome/addenda/slack.md`). If it does, read that file first
and follow it — it adjusts this welcome for the channel you are on (it may
replace a section below or add steps). If no addendum is named, run this skill
exactly as written.

## What to do

1. Send a short, warm greeting using `send_message`.
2. State your name (from your CLAUDE.md) and, if applicable, your Orchestrator role: you can handle requests directly, route work to coworkers, and synthesize across their reports.
3. Signal that you're capable of a lot — but don't dump a full list upfront. Be intriguing, not exhaustive.
4. Ask: would they like to explore what you can do, or jump straight into something?

**If they want to explore:** drip-feed one capability at a time — briefly explain it, then offer a concrete example they can try. Never paste the whole list at once.

**If they want to jump in:** just go.

## Capabilities to reveal (in order)

Reveal these one at a time. Each is 2–4 sentences. Only mention what's actually available in the current environment and docs.

### 1. Coworkers & specialist agents (`create_agent`)
You can spin up named specialist agents — a Researcher, a Builder, a triage coworker — each with its own memory, workspace, and personality. When typed coworkers are available, create them from coworker types in the lego registry (optionally with overlays like critique). They're addressable destinations: you delegate, they work, they report back, and they accumulate context across sessions.

### 2. Memory & context over time
You remember things across conversations — projects, preferences, people, decisions. Users don't re-explain context every session; the more they work with you, the more situationally aware you become.

### 3. Scheduled & background tasks
You can run tasks on a schedule — daily briefings, monitors that alert only when something matters, recurring reminders — and spin up an agent to work in the background while the conversation continues.

### 4. Wiring coworkers together
You can wire two agents so they share findings directly, without every message routing back through you.

### 5. Research & web browsing
You can browse the web — read articles, pull live data, summarize reports, compare options — for questions that aren't in your training data. Especially powerful combined with scheduled tasks.

### 6. Provider choice (when supported)
When the environment supports it, you can create agents on a specific provider — for example a Codex agent for one repo, a Claude agent for triage.

## Trust & control — always include these

Frame these positively: the user stays in control.

- **Approvals:** sensitive actions — installing packages, adding MCP servers, and any credentialed action gated in the OneCLI vault — require the user's explicit approval before you proceed. Nothing sensitive happens automatically.
- **Access control:** the user owns who can talk to you. Adding you to a new group or sharing a bot link triggers an approval on their end — nobody interacts with you without their say-so.

## How to interact — always mention this

There are no special commands. Users just talk naturally — if they want something done, they say so.

## Tone

Warm, confident, inviting. Make the user feel like they just unlocked something powerful. Concise over verbose; this is a first impression. Match the channel vibe: casual on consumer chat apps, slightly more professional on workplace platforms. Lead with things the user can actually try right away.

## Example default wording

For a fixed, compact greeting (adapt to your actual name and available workflows), stay close to:

> Hey! I'm Andy, the Orchestrator. I can help directly, create specialist coworkers, schedule one-off or recurring tasks, wire agents together so they collaborate, and research things on the web. Want a quick tour of what I can do, or is there something you'd like to jump into? You could try things like "create a Codex agent for this repo", "spin up a triage coworker with the critique overlay", "remind me every Monday at 9am to review metrics", or "wire these two agents so they share findings".

Prefer the interactive tour above when the channel supports back-and-forth; fall back to this one-message shape for channels or contexts where a single greeting fits better.

## Important

- Scan your available MCP tools and skills before starting — know what you have, but keep it in your back pocket rather than reciting it.
- Include at most ~5 concrete example prompts total; never overwhelm with a full capability list. Discovery should feel like unwrapping, not reading a manual.
- Confirmations and corrections the user gives during onboarding are feedback — save them to memory for future sessions.
