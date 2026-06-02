---
name: show-transcript
description: Render every NanoClaw agent group's Claude Code + Codex session transcripts as a hierarchical HTML archive (groups → NanoClaw sessions → transcripts) and serve it at http://<host>:8080. Use when the user asks to "show transcript", "view session as HTML", or "expose transcript on 8080".
---

# show-transcript

Walks every agent group + NanoClaw session in the central DB, renders Claude Code + Codex JSONLs through a forked-and-merged `claude-code-transcripts` (Codex support from PR #39 + single-page UX from PR #81), and serves the result on port 8080 via Python's stdlib http server.

## Hierarchy

```
index.html                              ← all agent groups
└── <group-folder>/index.html           ← NanoClaw sessions for this group
    └── <sess-id>/index.html            ← Claude + Codex transcripts in that session
        ├── claude/<sdk-uuid>/          ← rendered transcript
        └── codex/<rollout-id>/         ← rendered transcript
```

The mapping from Claude Code SDK session uuid → NanoClaw session id comes from `sdk_session_routes` in `data/v2.db`. Codex rollouts live under `data/v2-sessions/<group-id>/<sess-id>/codex/sessions/YYYY/MM/DD/*.jsonl`.

## Prerequisites (one-time)

The merged `claude-code-transcripts` venv lives at:
`/home/ubuntu/.local/share/claude-code-transcripts-merged/.venv`

If the venv is missing, recreate it:

```bash
cd /home/ubuntu/.local/share/claude-code-transcripts-merged 2>/dev/null || {
  git clone https://github.com/simonw/claude-code-transcripts.git /home/ubuntu/.local/share/claude-code-transcripts-merged
  cd /home/ubuntu/.local/share/claude-code-transcripts-merged
  git remote add codex https://github.com/skinner84/claude-code-transcripts.git
  git remote add singlepage https://github.com/kanihal/claude-code-transcripts.git
  git fetch codex codex-cli-support-upstream
  git fetch singlepage main
  git checkout -b merged
  git -c user.email=show-transcript@local -c user.name=show-transcript merge --no-edit codex/codex-cli-support-upstream
  git -c user.email=show-transcript@local -c user.name=show-transcript merge --no-edit singlepage/main
}
cd /home/ubuntu/.local/share/claude-code-transcripts-merged
uv venv .venv
uv pip install -e . --python .venv/bin/python
.venv/bin/claude-code-transcripts --version   # smoke test
```

## Procedure

### 1. Stop any prior server on the port

```bash
pkill -f "http.server 8080" 2>/dev/null
sleep 1
ss -tln | grep ":8080" || echo "port free"
```

### 2. Build the archive

```bash
pnpm exec tsx scripts/build-transcripts-archive.ts \
  --output /tmp/all-transcripts-html \
  --since-hours 24
```

Flags:
- `--output <dir>` — output dir, default `/tmp/all-transcripts-html`. The script `rm -rf`s it first.
- `--since-hours <H>` — only sessions whose last activity is within H hours (default: no time filter). Recommended for the regular cron — keeps the archive focused on what happened today and the build fast.
- `--limit-per-group <N>` — cap to N most recent NanoClaw sessions per group (default: all). Combine with `--since-hours` if you want both bounds.

### 3. Serve

```bash
cd /tmp/all-transcripts-html && \
  python3 -m http.server 8080 --bind 0.0.0.0 > /tmp/all-transcripts-server.log 2>&1 &
echo "PID=$!"
```

Verify (note: OneCLI proxy intercepts localhost — bypass it):

```bash
env -u http_proxy -u https_proxy curl -s -o /dev/null -w "HTTP %{http_code}\n" http://127.0.0.1:8080/index.html
# expect: HTTP 200
```

### 4. Tell the user

Print the build summary (group → session → transcript counts), the URL `http://<host>:8080/`, and the server PID for later teardown.

## Cleanup

```bash
pkill -f "http.server 8080"
# rm -rf /tmp/all-transcripts-html  # optional disk reclaim
```

## Single-target variant (legacy / debug)

If the user just wants one specific JSONL rendered:

```bash
/home/ubuntu/.local/share/claude-code-transcripts-merged/.venv/bin/claude-code-transcripts \
  json <path-to.jsonl> -o /tmp/<target>-html
cd /tmp/<target>-html && python3 -m http.server 8080 --bind 0.0.0.0 &
```

This works for both Claude Code and Codex JSONLs (the merged tool auto-detects format).

## Notes / gotchas

- **Two separate JSONL stores per group:**
  - Claude: `data/v2-sessions/<group-id>/.claude-shared/projects/-workspace-agent/*.jsonl` — shared across all sessions of the group; map back via `sdk_session_routes`.
  - Codex: `data/v2-sessions/<group-id>/<sess-id>/codex/sessions/YYYY/MM/DD/*.jsonl` — naturally per-session.
- **Renderer is the merged fork**, not stock `uvx claude-code-transcripts`. Stock returns 0 prompts on Codex.
- **`--repo` auto-detect** fails for orchestrator (works across many repos); the script doesn't pass `--repo`. Commit links are disabled — acceptable.
- **OneCLI proxy interception:** `curl http://127.0.0.1:8080` returns HTTP 000 unless you `env -u http_proxy -u https_proxy`. Browser access is unaffected.
- **Network-reachable bind:** `0.0.0.0:8080`. Switch to `127.0.0.1` if the host is shared.
- **Render failures** are logged to stderr but don't abort the build — the archive completes with whatever rendered. Some older or malformed JSONLs may fail; check stderr if a session looks empty.
- **Render speed:** local venv is fast (~150ms/file, no `uvx` cold-start). 200+ files take ~30s, dominated by Python import time.
