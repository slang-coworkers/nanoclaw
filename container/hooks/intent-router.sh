#!/bin/bash
# UserPromptSubmit hook: classify user intent and recommend a workflow.
# Uses a small/fast LLM call to read the user's message and the available
# workflows, then outputs additionalContext with a routing recommendation the
# agent sees at the top of its turn.
#
# Claude groups classify with Claude Haiku via $ANTHROPIC_BASE_URL. Non-Claude
# groups (AGENT_PROVIDER=codex, opencode, ...) classify with an OpenAI model
# ($INTENT_ROUTER_OPENAI_MODEL, default the luna model) via the same
# OpenAI-compatible endpoint and gateway credential path the Codex provider
# uses, so a group that runs off Claude makes no Claude call here either.
# The default model id and the /chat/completions call assume the NVIDIA
# inference endpoint (CODEX_BASE_URL's default). Another endpoint needs
# INTENT_ROUTER_OPENAI_MODEL set to a model it serves and must accept chat
# completions (a Responses-only endpoint is not supported); otherwise
# routing is skipped, never broken.
#
# Falls back gracefully (no-op) if the API call fails.
set -euo pipefail

INPUT=$(cat)
PROMPT=$(echo "$INPUT" | jq -r '.prompt // empty')
[ -z "$PROMPT" ] && exit 0

# Skip slash commands (already routed) and pure-system context injections.
# Dashboard/A2A user messages are wrapped as `<context ...><message>...</message>`,
# so only skip when the payload has `<context>` but NO `<message>` — those are
# system-only injections (e.g. session restore, timezone bump) with no user text.
echo "$PROMPT" | grep -qP '^\s*/' && exit 0
if echo "$PROMPT" | grep -q '<context' && ! echo "$PROMPT" | grep -q '<message'; then
  exit 0
fi

# Strip the wrapping tags so the LLM classifies the actual user text, not the
# envelope. Multi-line safe via Perl. Falls back to raw prompt if no <message>.
UNWRAPPED=$(echo "$PROMPT" | perl -0777 -ne 'print $1 if /<message[^>]*>(.*?)<\/message>/s')
[ -n "$UNWRAPPED" ] && PROMPT="$UNWRAPPED"

# Available workflows are injected by container-runner.ts as an env var.
# Format: "plan:Any text deliverable;implement:Code/doc change;slang-implement:..."
WORKFLOWS="${OVERLAY_WORKFLOWS:-}"
[ -z "$WORKFLOWS" ] && exit 0

# Build the classification prompt
CLASSIFY_PROMPT="You are a workflow router. Given the user's message and the available workflows, output ONLY a JSON object with two fields:
- \"workflow\": the workflow name to invoke (or \"none\" if it's a simple chat/question)
- \"reason\": one sentence explaining why

Available workflows:
$(echo "$WORKFLOWS" | tr ';' '\n' | while IFS=: read -r name desc; do
  echo "- /$name: $desc"
done)

Rules:
- If the user asks to investigate, triage, review a PR, research a topic, write a plan, or just understand something → the /plan workflow (output is text: a report, review, or plan).
- If the user asks to fix, implement, change code, update docs, or ship a PR → the implement workflow (or its project-specific variant like /slang-implement if available). Output is file changes.
- If the task requires understanding BEFORE making a change, route to /plan first — the agent will then invoke implement after the plan is approved.
- If the user asks a simple question, chats, or requests a one-liner that doesn't warrant a structured workflow → \"none\".

User message:
$PROMPT

Respond with ONLY the JSON object, no markdown, no explanation."

PROVIDER="${AGENT_PROVIDER:-claude}"

if [ "$PROVIDER" = "claude" ]; then
  # Use Haiku for speed — this should complete in <2s
  MODEL="${ANTHROPIC_DEFAULT_HAIKU_MODEL:-claude-haiku-5-5}"
  API_URL="${ANTHROPIC_BASE_URL:-https://api.anthropic.com}"
  API_KEY="${ANTHROPIC_API_KEY:-}"

  [ -z "$API_KEY" ] && exit 0

  RESPONSE=$(curl -sf --max-time 5 \
    "$API_URL/v1/messages" \
    -H "Content-Type: application/json" \
    -H "x-api-key: $API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -d "$(jq -n \
      --arg model "$MODEL" \
      --arg prompt "$CLASSIFY_PROMPT" \
      '{model: $model, max_tokens: 100, messages: [{role: "user", content: $prompt}]}')" \
    2>/dev/null) || exit 0

  TEXT=$(echo "$RESPONSE" | jq -r '.content[0].text // empty' 2>/dev/null || true)
else
  # NVIDIA_API_KEY is the gateway sentinel the Codex provider also sends; the
  # OneCLI proxy swaps in the real credential on the wire.
  MODEL="${INTENT_ROUTER_OPENAI_MODEL:-openai/openai/gpt-6-luna}"
  API_URL="${CODEX_BASE_URL:-https://inference-api.nvidia.com/v1}"
  API_KEY="${NVIDIA_API_KEY:-}"

  [ -z "$API_KEY" ] && exit 0

  # Classification needs no reasoning, and reasoning only adds latency. A slow
  # gateway call can still take about 7 s; 7.5 s keeps the hook under the
  # bridge's 8 s for non-Claude groups (intent-router-bridge.ts), so it exits
  # cleanly. max_completion_tokens leaves room for a model that reasons anyway.
  RESPONSE=$(curl -sf --max-time 7.5 \
    "${API_URL%/}/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$(jq -n \
      --arg model "$MODEL" \
      --arg prompt "$CLASSIFY_PROMPT" \
      '{model: $model, max_completion_tokens: 300, reasoning_effort: "none", messages: [{role: "user", content: $prompt}]}')" \
    2>/dev/null) || exit 0

  TEXT=$(echo "$RESPONSE" | jq -r '.choices[0].message.content // empty' 2>/dev/null || true)
fi

[ -z "$TEXT" ] && exit 0

# The model sometimes wraps the JSON in ```json ... ``` markdown fences. Strip them
# (and any leading/trailing whitespace) before parsing, so jq doesn't choke.
TEXT=$(echo "$TEXT" | sed -E 's/^[[:space:]]*```(json)?[[:space:]]*//; s/```[[:space:]]*$//')

# Parse the JSON from the response. `|| true` so set -e doesn't kill us when
# the response wasn't valid JSON — we'll exit cleanly via the empty-check below.
WORKFLOW=$(echo "$TEXT" | jq -r '.workflow // "none"' 2>/dev/null || true)
REASON=$(echo "$TEXT" | jq -r '.reason // empty' 2>/dev/null || true)

# Strip a leading slash if the model returned `/plan` instead of `plan`,
# so the AUTO-ROUTE template doesn't end up with `Start with //plan`.
WORKFLOW="${WORKFLOW#/}"

[ "$WORKFLOW" = "none" ] && exit 0
[ -z "$WORKFLOW" ] && exit 0

# Output the routing recommendation as additionalContext
jq -n \
  --arg wf "$WORKFLOW" \
  --arg reason "$REASON" \
  '{
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: ("AUTO-ROUTE: Follow the /" + $wf + " workflow (already embedded in your CLAUDE.md). Reason: " + $reason + ". Walk its Steps in order before using Edit/Write/Bash on source files.")
    }
  }'

exit 0
