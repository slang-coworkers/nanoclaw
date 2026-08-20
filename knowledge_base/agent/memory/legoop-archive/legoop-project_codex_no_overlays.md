---
type: project
title: "Codex CLI ignores settings.json hooks → disable_overlays=1 for codex agents"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

# Codex CLI ignores settings.json hooks → disable_overlays=1 for codex agents

The Codex CLI does not execute Claude Code's settings.json hooks at all, so overlay enforcement (plan-gate, critique-gate, edit-counter) is inoperative for a codex-provider agent. Set `disable_overlays=1` for any codex agent so the composer doesn't render gate markers the agent can't honor (and create AGENTS.md→CLAUDE.md / .agents→.claude symlinks so codex natively discovers the skills). Note: on prod all agent groups already run disable_overlays=1 by standing policy.
