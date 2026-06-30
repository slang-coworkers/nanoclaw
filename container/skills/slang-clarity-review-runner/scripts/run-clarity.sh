#!/usr/bin/env bash
# Reviewer C — clarity review.
#
# Top-level entry for the slang-clarity-review skill. Wraps shader-slang/slang's
# repo-local clarity-review pipeline (the seven `.claude/skills/slang-review-*`
# skills added in shader-slang/slang#11340, entry point
# `slang-review-clarity-workflow`) the same byte-equivalent way the sibling
# `slang-pr-review-runner` skill wraps `REVIEW.md` for Reviewer A.
#
# Selects the input mode (pr/branch/patch), prepares the slang/ checkout
# accordingly, then invokes the inner `claude` CLI to run the clarity pipeline
# and emit the canonical candidate file as `clarity-review.md`. It deliberately
# does NOT run `slang-review-post-github` — posting (if any) is owned by the
# wrapping /slang-pr-review workflow + slang-pr-review-runner's post-review.sh,
# COMMENT-state only.
#
# Usage:
#   run-clarity.sh --mode pr     --pr <N>        --repo <owner/repo> [--max-budget-usd $]
#   run-clarity.sh --mode branch --branch <ref>  --repo <owner/repo>
#   run-clarity.sh --mode patch  --patch <path>  [--base <ref>]
#
# Output: <run_dir>/clarity-review.md  (the canonical clarity candidates file,
#         verbatim — same lower-bar clarity feedback upstream would post).
#
# Divergences from upstream's slang-review-clarity-workflow (intentional):
#   - `gh` not `gh.exe` (we are Linux, not WSL/Windows).
#   - Skips step 11 (`slang-review-post-github`); we never post from here.

set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${REPO_ROOT:-/workspace/agent/slang}"

MODE=""
PR_NUMBER=""
BRANCH_REF=""
BRANCH_BASE="origin/master"
PATCH_FILE=""
REPO=""
MAX_BUDGET_USD="${CLARITY_MAX_BUDGET_USD:-30}"
MAX_TURNS="${CLARITY_MAX_TURNS:-500}"
MODEL="${CLARITY_MODEL:-${ANTHROPIC_DEFAULT_OPUS_MODEL:-opus}}"

while (($#)); do
  case "$1" in
    --mode) MODE="$2"; shift 2 ;;
    --pr) PR_NUMBER="$2"; shift 2 ;;
    --branch) BRANCH_REF="$2"; shift 2 ;;
    --base) BRANCH_BASE="$2"; shift 2 ;;
    --patch) PATCH_FILE="$2"; shift 2 ;;
    --repo) REPO="$2"; shift 2 ;;
    --max-budget-usd) MAX_BUDGET_USD="$2"; shift 2 ;;
    --max-turns) MAX_TURNS="$2"; shift 2 ;;
    --model) MODEL="$2"; shift 2 ;;
    -h|--help) sed -n '2,30p' "$0"; exit 0 ;;
    *) echo "error: unknown flag $1" >&2; exit 1 ;;
  esac
done

# --- Validate inputs -------------------------------------------------------

[ -n "$MODE" ] || { echo "error: --mode pr|branch|patch required" >&2; exit 1; }

case "$MODE" in
  pr)
    [ -n "$PR_NUMBER" ] || { echo "error: --pr <N> required for pr mode" >&2; exit 1; }
    [ -n "$REPO" ] || { echo "error: --repo <owner/repo> required for pr mode" >&2; exit 1; }
    ;;
  branch)
    [ -n "$BRANCH_REF" ] || { echo "error: --branch <ref> required for branch mode" >&2; exit 1; }
    [ -n "$REPO" ] || { echo "error: --repo <owner/repo> required for branch mode" >&2; exit 1; }
    ;;
  patch)
    [ -n "$PATCH_FILE" ] || { echo "error: --patch <path> required for patch mode" >&2; exit 1; }
    [ -f "$PATCH_FILE" ] || { echo "error: patch file not found: $PATCH_FILE" >&2; exit 1; }
    ;;
  *)
    echo "error: --mode must be pr | branch | patch (got: $MODE)" >&2
    exit 1
    ;;
esac

# Tooling sanity
command -v claude >/dev/null || { echo "error: claude CLI not in PATH. Run slang-pr-review-runner's install.sh." >&2; exit 1; }
command -v gh     >/dev/null || { echo "error: gh CLI missing." >&2; exit 1; }

[ -f "$REPO_ROOT/REVIEW.md" ] \
  || { echo "error: $REPO_ROOT/REVIEW.md not found. Run slang-pr-review-runner's install.sh." >&2; exit 1; }
# Reviewer C wraps the checkout's clarity skills (shader-slang/slang#11340).
# If the checkout predates that PR, fail loud rather than silently degrade.
[ -d "$REPO_ROOT/.claude/skills/slang-review-clarity-workflow" ] \
  || { echo "error: $REPO_ROOT/.claude/skills/slang-review-clarity-workflow missing — checkout predates shader-slang/slang#11340. Re-run install.sh to refresh." >&2; exit 1; }

# --- Mode-specific repo prep (mirrors slang-pr-review-runner's compose-and-run.sh) ---

cd "$REPO_ROOT"

case "$MODE" in
  pr)
    # BASE branch (master) checked out locally; the model reads the PR's
    # actual changes via `gh pr diff`.
    git fetch --depth 50 origin master >/dev/null 2>&1 || true
    git checkout -q origin/master 2>/dev/null || true
    ;;
  branch)
    BRANCH_OWNER="${REPO%%/*}"
    git remote get-url "$BRANCH_OWNER" >/dev/null 2>&1 \
      || git remote add "$BRANCH_OWNER" "https://github.com/$REPO.git"
    git fetch --depth 50 "$BRANCH_OWNER" "$BRANCH_REF" >/dev/null 2>&1
    git fetch --depth 50 origin master >/dev/null 2>&1 || true
    git checkout -q "$BRANCH_OWNER/$BRANCH_REF"
    ;;
  patch)
    git fetch --depth 50 origin master >/dev/null 2>&1 || true
    TEMP_BRANCH="clarity-review-$(date -u +%s)"
    git checkout -q -b "$TEMP_BRANCH" origin/master
    git apply --whitespace=nowarn "$PATCH_FILE" || {
      echo "error: patch did not apply cleanly" >&2
      git checkout -q origin/master
      git branch -D "$TEMP_BRANCH" >/dev/null 2>&1
      exit 1
    }
    git -c user.email=skill@nanoclaw -c user.name=skill commit -q -am "patch under clarity review (temporary)"
    REPO="(local)"
    BRANCH_REF="$TEMP_BRANCH"
    BRANCH_BASE="origin/master"
    ;;
esac

# --- Prompt label per mode -------------------------------------------------

case "$MODE" in
  pr)     PROMPT_REPO="$REPO";          PROMPT_PR="$PR_NUMBER" ;;
  branch) PROMPT_REPO="$REPO";          PROMPT_PR="(branch:$BRANCH_REF)" ;;
  patch)  PROMPT_REPO="(local-patch)";  PROMPT_PR="(patch:$(basename "$PATCH_FILE"))" ;;
esac

# --- Run -------------------------------------------------------------------

TS="$(date -u +%Y%m%dT%H%M%SZ)"
RUN_DIR="$SKILL_DIR/transcripts/${MODE}-${TS}"
mkdir -p "$RUN_DIR"

# The inner CLI applies the checkout's clarity-review pipeline. We pin the
# steps explicitly (generation → coverage audit → consolidate → scope-filter →
# resolve-judgment-calls) and forbid the posting step, so the only output is
# the canonical candidate file's content as the final assistant message.
PROMPT_FILE="$RUN_DIR/prompt.txt"
cat > "$PROMPT_FILE" <<EOF
You are running the Slang CLARITY review pipeline — NOT the correctness
bug-review in REVIEW.md. Do NOT read or follow REVIEW.md.

FIRST: Read \`.claude/skills/slang-review-clarity-workflow/SKILL.md\` and apply it
end-to-end against the change below. Use the Linux \`gh\` CLI (NOT \`gh.exe\`).

REPO: ${PROMPT_REPO}
PR NUMBER: ${PROMPT_PR}

Run the full clarity pipeline by reading and applying each repo-local skill in
order:
  1. slang-review-clarity                 (high-level clarity candidates)
  2. slang-review-fine-grained-clarity    (line-by-line candidates)
  3. (generation coverage audit per the workflow)
  4. slang-review-consolidate-candidates  (merge/dedupe into the canonical file)
  5. slang-review-scope-filter            (filter to PR-author-addressable)
  6. slang-review-resolve-judgment-calls  (resolve uncertain candidates)
  7. write the canonical file's ## Review Body section

The canonical candidate file is \`tmp/review-candidates/pr-${PROMPT_PR}-clarity-workflow.md\`
(for branch/patch modes, use a stable name like tmp/review-candidates/clarity-workflow.md).

IMPORTANT — posting is owned by the wrapping workflow, NOT you:
  - DO NOT run \`slang-review-post-github\`.
  - DO NOT call any GitHub-write tool (no \`gh api ... --method POST/PUT\`, no
    review/comment creation). You may use \`gh pr diff\`, \`gh pr view\`,
    \`gh api repos/*/pulls/*\` for READS only.
  - The PR branch is NOT checked out — read the diff via \`gh pr diff\`. Local
    files reflect BASE (master), not the PR's changes.

When the pipeline is complete, output the COMPLETE contents of the canonical
clarity-workflow candidate file as plain markdown in your final assistant
message, then end the session. The harness writes that markdown to
\`clarity-review.md\` and the calling workflow returns it to the requester.
EOF

# Tool allowlist — reads + gh reads + deepwiki, plus Write/Edit (the clarity
# skills write candidate files under tmp/). NO GitHub-write: the wrapping
# workflow owns posting. Mirrors slang-pr-review-runner/scripts/repro.sh minus
# the post path.
read -r -d '' ALLOWED <<'EOF' || true
Read,View,Glob,GlobTool,Grep,GrepTool,Agent,BatchTool,Write,Edit,
Bash(git diff*),Bash(git log*),Bash(git show*),Bash(git status*),
Bash(grep *),Bash(grep -*),
Bash(cat *),Bash(head *),Bash(tail *),
Bash(ls *),Bash(find *),Bash(wc *),Bash(mkdir *),
Bash(gh pr diff*),Bash(gh pr view*),Bash(gh pr list*),Bash(gh pr checks*),
Bash(gh api repos/*/pulls/*),Bash(gh api repos/*/issues/*),
Bash(gh api graphql*),
mcp__deepwiki__ask_question
EOF
ALLOWED="$(echo "$ALLOWED" | tr -d '\n' | tr -s ' ' | sed 's/, /,/g')"

# Reuse the sibling skill's dry-run MCP config (deepwiki only, no
# mcp-server-github) so Reviewer C sees the same MCP surface as Reviewer A.
MCP_CONFIG="$(cd "$SKILL_DIR/.." && pwd)/slang-pr-review-runner/prompt-templates/mcp.dryrun.json"
[ -f "$MCP_CONFIG" ] || { echo "error: dry-run MCP config not found at $MCP_CONFIG (is slang-pr-review-runner installed?)" >&2; exit 1; }

echo ">>> run-clarity.sh: pr=${PROMPT_PR} repo=${PROMPT_REPO} mode=${MODE}"
echo ">>> REPO_ROOT=$REPO_ROOT"
echo ">>> mcp-config=$MCP_CONFIG"
echo ">>> output → $RUN_DIR"

cd "$REPO_ROOT"

set +e
claude \
  --print \
  --model "${MODEL:-${ANTHROPIC_DEFAULT_OPUS_MODEL:-opus}}" \
  --max-turns "${MAX_TURNS:-500}" \
  --max-budget-usd "${MAX_BUDGET_USD:-30}" \
  --setting-sources project \
  --mcp-config "$MCP_CONFIG" \
  --allowed-tools "$ALLOWED" \
  --output-format stream-json \
  --verbose \
  --no-session-persistence \
  "$(cat "$PROMPT_FILE")" \
  | tee "$RUN_DIR/stream.jsonl"
RC=${PIPESTATUS[0]}
set -e

# --- Post-run extraction ---------------------------------------------------

# Final assistant text → clarity-review.md (the canonical candidate markdown).
python3 - <<PY > "$RUN_DIR/clarity-review.md"
import json
last=""
with open("$RUN_DIR/stream.jsonl") as f:
    for line in f:
        line=line.strip()
        if not line.startswith("{"): continue
        try: rec=json.loads(line)
        except: continue
        if rec.get("type")=="assistant":
            for b in rec.get("message",{}).get("content",[]):
                if b.get("type")=="text": last=b.get("text") or last
print(last)
PY

# Tool-uses flat list → tool-uses.jsonl (lets the workflow/summarizer assert
# no GitHub-write tool was attempted).
python3 - <<PY > "$RUN_DIR/tool-uses.jsonl"
import json
with open("$RUN_DIR/stream.jsonl") as f:
    for line in f:
        line=line.strip()
        if not line.startswith("{"): continue
        try: rec=json.loads(line)
        except: continue
        if rec.get("type")!="assistant": continue
        for b in rec.get("message",{}).get("content",[]):
            if b.get("type")=="tool_use":
                print(json.dumps({"name": b.get("name"), "input": b.get("input")}))
PY

# Patch-mode cleanup: roll back the temp branch.
if [ "$MODE" = "patch" ] && [ -n "${TEMP_BRANCH:-}" ]; then
  cd "$REPO_ROOT"
  git checkout -q origin/master >/dev/null 2>&1 || true
  git branch -D "$TEMP_BRANCH" >/dev/null 2>&1 || true
fi

echo
echo ">>> run-clarity.sh: done (rc=$RC)"
echo ">>> stream:         $RUN_DIR/stream.jsonl"
echo ">>> clarity review: $RUN_DIR/clarity-review.md"
echo ">>> tool calls:     $RUN_DIR/tool-uses.jsonl"

exit "$RC"
