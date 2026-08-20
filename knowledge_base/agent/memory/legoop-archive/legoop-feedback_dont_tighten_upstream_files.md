---
type: feedback
title: "Never hand-edit (tighten/reword) container files that originate from upstream — they conflict on every /update-nanoclaw sync. Check agains"
description: "ported lego-operator-memory archive; feedback note"
tags: [legoop-archive, ported]
---

# Never hand-edit (tighten/reword) container files that originate from upstream — they conflict on every /update-nanoclaw sync. Check against origin/main + upstream/main + nanocoai/main before editing.

When doing prose work (tightening, rewording) on `container/skills/`, `container/spines/`, etc., **first check whether each file originates upstream**. If it exists on `origin/main` (slang-coworkers fork default), `upstream/main` (qwibitai), or `nanocoai/main`, it is upstream-tracking — **do not edit its prose on nv-***.

**Why:** every `/update-nanoclaw` pulls upstream skill branches; a locally-diverged upstream file conflicts on every sync, creating recurring manual merge work. The whole point of the nv-* overlay model is that upstream files stay pristine and NV-specific content lives in NV-only files (spines/base/*, overlays/*, buddy, codex-critique, the generic implement/plan/base workflows — none of which exist upstream).

**How to apply — before any sweep/tightening, classify each file:**
```bash
git fetch upstream nanocoai origin -q
for f in <files>; do
  for r in origin/main upstream/main nanocoai/main; do
    git cat-file -e $r:"$f" 2>/dev/null && echo "$f UPSTREAM ($r) — SKIP" && break
  done
done
```
Only tighten files that match on **none** of the three.

**What happened (2026-06-01):** the tighten sweep PR #526 edited 32 base files; 6 were upstream-originated (agent-browser, self-customize, slack-formatting, welcome, whatsapp-formatting SKILL+instructions). The 2 whatsapp files had been byte-identical to upstream; tightening broke that. Reverted in PR #532 — whatsapp restored to upstream, the other 4 restored to their pre-#526 (already-NV-diverged) state. The 26 NV-only files were kept.

**Allowlist note:** `.github/nv-path-guard/nv-main.txt` allowlists these upstream skills (agent-browser, self-customize, slack-formatting, welcome, whatsapp-formatting) **only so upstream-sync PRs can update them** — not as license to hand-edit. The comment there says do-not-hand-edit.

Related: the sweep's own rubric said "no project-specific content" but didn't guard "no upstream-originated files" — add that guard to any future content-sweep. [[feedback_overlays_project_generic]], [[project_update_nanoclaw_merge_drift]].

