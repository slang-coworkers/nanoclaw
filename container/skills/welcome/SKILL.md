---
name: welcome
license: MIT
description: Introduce yourself to a newly connected channel. Triggered automatically when a channel is first wired. Send a friendly greeting and brief overview of what you can do.
---

# /welcome — Channel Onboarding

You've just been connected to a new messaging channel. Introduce yourself to the user.

Ground the message in `docs/USAGE.md` and other repo docs. Use documented NanoClaw workflows as the source of truth — do not invent features or tools.

## What to do

Send a greeting with `send_message`. Use a mostly fixed onboarding shape, not a fresh structure each time:

1. Greeting + your name (from CLAUDE.md) + Orchestrator role if applicable: you handle requests directly, route to coworkers, and synthesize across coworker reports.
2. Up to 5 short, concrete examples in natural language (not raw API docs), covering a compact mix of: creating a specialist coworker/agent, scheduling a one-time or recurring task, wiring agents together to share findings directly, messaging a coworker with `@CoworkerName`, and specifying the agent provider (Codex vs Claude) when that workflow is available.
3. Keep it to 3-5 sentences.

## Tone

Warm but concise — a first impression. Match the channel's vibe (casual for Telegram/Discord, more professional for Slack/Teams/email). Use docs language: Orchestrator, coworkers, agents, direct `@` routing, reports, scheduling, wiring, provider selection. Lead with actions the user can try right away.

If typed coworkers are available, mention new agents can be created from coworker types in the lego registry (e.g. "create a coworker of type `<type>`", "create a `<type>` coworker with the critique overlay", "spin up a triage agent using the right type").

Never exceed 5 examples total.

## Default output pattern

- Sentence 1: greeting + name + Orchestrator role
- Sentence 2: core capabilities: create agents from templates, schedule tasks, wire agents, route to coworkers
- Sentence 3: 3-5 example prompts to try immediately

Preferred default wording (stay close unless the channel or docs make part of it inaccurate):

> Hey! I'm Andy, the Orchestrator. I can help directly, route work to a coworker, create specialists from coworker types, schedule one-off or recurring tasks, and wire agents together so they can collaborate directly. You can try things like "create a Codex agent for this repo", "create a specialist coworker with the critique overlay", "remind me every Monday at 9am to review metrics", or "wire these two agents so they can share findings".

Adapt to your actual name and the documented workflow. Prioritize examples about creating agents, scheduling tasks, wiring agents, and choosing Codex vs Claude when available. Don't list every capability — pick the most useful for first-run onboarding.
