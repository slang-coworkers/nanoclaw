---
type: project
title: "Repo-level webhook id 626464745 (slang-coworkers/nanoclaw → lego) was deleted 2026-05-28. Delivery now goes through prod via INSTANCE_FORW"
description: "ported lego-operator-memory archive; project note"
tags: [legoop-archive, ported]
---

> **[dev-context]** Ported from the dev (lego) instance; this is historical/dev-vault detail. For current prod facts see the prod-accurate learnings (no szihs PAT; vault :10254; nanoclaw.service; groups on real disk).

# Repo-level webhook id 626464745 (slang-coworkers/nanoclaw → lego) was deleted 2026-05-28. Delivery now goes through prod via INSTANCE_FORWARD_TARGETS.

**Status (2026-05-28): deleted.** The repo-level webhook on `slang-coworkers/nanoclaw` (hook id `626464745`, target `https://lego-webhook-yjdzmdo7h.brevlab.com/webhook/github`) was deleted via the GitHub UI after PRs #491/#493/#495/#496 made it redundant.

**Why deleted:** Prod is now the canonical webhook router. `INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github` on prod forwards events for lego-owned PRs to lego over localhost. The repo-level hook duplicated that path (App webhook → prod + repo-level → lego = same comment delivered twice; the second one fell through to lego's orchestrator since the inbox PK on `gh-${comment_id}` wasn't shared between sessions).

**Symptom while it was active:** `@nv-slang-bot` comments on slang-coworkers/nanoclaw PRs would show up TWICE in lego's logs — once `delivered via PR mapping` (forwarded by prod) and once `delivered to orchestrator` (direct from GitHub via repo hook). One reaction posted but two wake-ups, polluted Test 7 (lego-silence-during-prod-owned-events) results.

**How to apply:**
- Don't recreate this webhook unless prod's forward path is intentionally disabled. The whole point of [[project_chain_wiring]]'s rework was to eliminate broadcast/dual-delivery.
- If you need to verify lego receives webhooks for slang-coworkers/nanoclaw events: comment `@nv-slang-bot ...` on a lego-owned PR, expect prod log `forwarded to foreign owner`, lego log `delivered via PR mapping`. No direct repo→lego path anymore.
- Cloudflared tunnel `e5bb8094-48db-4bbe-9984-8c72611b4eef` (`lego-webhook-yjdzmdo7h.brevlab.com` → `localhost:3843`) is **still up** in case external delivery is needed for some other repo/use case in the future. The tunnel is fine to keep.

See [[project_chain_wiring]], [[reference_pat_repository_hooks]], [[project_szihs_pat_path_routing]].

