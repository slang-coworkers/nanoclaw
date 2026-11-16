#!/usr/bin/env bash
# Tests for the inner-CLI choice of run-clarity.sh (Reviewer C).
#
# Usage: bash scripts/run-clarity.test.sh [path/to/slang-pr-review-runner]
#
# run-clarity.sh takes its engine choice, OpenCode runner and MCP config from
# the sibling skill slang-pr-review-runner (fetched from shader-slang/slang-skills,
# not tracked here). The test finds it beside this skill, or at the path given
# as the first argument, and copies both skills into a throwaway skills
# directory. Each case runs run-clarity.sh in patch mode against a throwaway
# checkout with stub `claude`, `opencode` and `gh` commands, so no model, no
# network and no GitHub access is involved. Exit 0 = all passed.
set -u

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$HERE/.." && pwd)"
RUNNER="${1:-$(cd "$SKILL_DIR/.." && pwd)/slang-pr-review-runner}"
if [ ! -f "$RUNNER/scripts/review-engine.sh" ]; then
  echo "error: slang-pr-review-runner with scripts/review-engine.sh not found at $RUNNER (pass its path as the first argument)" >&2
  exit 2
fi

PASS=0
FAIL=0
ok() { PASS=$((PASS + 1)); echo "  ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "  FAIL $1"; }
# check <description> <command...>: passes when the command succeeds.
check() { local name="$1"; shift; if "$@"; then ok "$name"; else bad "$name"; fi; }
absent() { [ ! -e "$1" ]; }
has() { grep -q -- "$1" "$2"; }
is() { [ "$1" = "$2" ]; }

T="$(mktemp -d "${TMPDIR:-/tmp}/run-clarity-test.XXXXXX")"
trap 'rm -rf "$T"' EXIT
mkdir -p "$T/skills" "$T/stub" "$T/home" "$T/wt"
cp -R "$SKILL_DIR" "$T/skills/slang-clarity-review-runner"
cp -R "$RUNNER" "$T/skills/slang-pr-review-runner"
SCRIPT="$T/skills/slang-clarity-review-runner/scripts/run-clarity.sh"

git init -q --bare "$T/origin.git"
git init -q "$T/slang"
(
  cd "$T/slang"
  mkdir -p .claude/skills/slang-review-clarity-workflow
  printf '# Review protocol\n' > REVIEW.md
  printf -- '---\nname: slang-review-clarity-workflow\ndescription: clarity\n---\nRun the pipeline.\n' \
    > .claude/skills/slang-review-clarity-workflow/SKILL.md
  printf '# Rules\n- @AGENTS.md\n' > CLAUDE.md
  printf 'agents\n' > AGENTS.md
  printf 'one\n' > file.txt
  git add -A
  git -c user.email=t@t -c user.name=t commit -q -m init
  git branch -M master
  git remote add origin "$T/origin.git"
  git push -q origin master
  git fetch -q origin
)
printf -- '--- a/file.txt\n+++ b/file.txt\n@@ -1 +1,2 @@\n one\n+two\n' > "$T/change.patch"

cat > "$T/stub/gh" <<'EOF'
#!/usr/bin/env bash
exit 0
EOF
cat > "$T/stub/claude" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$STUB_LOG/claude.args"
body="$(printf 'x%.0s' $(seq 1 600))"
echo "{\"type\":\"assistant\",\"message\":{\"content\":[{\"type\":\"text\",\"text\":\"## Claude clarity\\n$body\"}]}}"
EOF
cat > "$T/stub/opencode" <<'EOF'
#!/usr/bin/env bash
printf '%s\n' "$@" > "$STUB_LOG/opencode.args"
printf '%s' "$OPENCODE_CONFIG_CONTENT" > "$STUB_LOG/opencode.config.json"
body="$(printf 'y%.0s' $(seq 1 600))"
echo '{"type":"tool_use","part":{"type":"tool","tool":"bash","callID":"c1","state":{"status":"completed","input":{"command":"gh pr diff 1"},"output":""}}}'
echo "{\"type\":\"text\",\"part\":{\"type\":\"text\",\"text\":\"## OpenCode clarity\\n$body\"}}"
EOF
chmod +x "$T/stub"/*

# run_case <name> [VAR=value ...] -- [run-clarity flags ...]
run_case() {
  local name="$1"; shift
  local dir="$T/$name"
  mkdir -p "$dir"
  local vars=()
  while [ $# -gt 0 ] && [ "$1" != "--" ]; do vars+=("$1"); shift; done
  [ "${1:-}" = "--" ] && shift
  env -i HOME="$T/home" PATH="${CASE_PATH:-$T/stub:/usr/bin:/bin}" STUB_LOG="$dir" \
    REPO_ROOT="$T/slang" CLARITY_RUN_DIR="$dir/run" CLARITY_WORKTREE_ROOT="$T/wt" \
    ${vars[@]+"${vars[@]}"} \
    bash "$SCRIPT" --mode patch --patch "$T/change.patch" "$@" > "$dir/out.log" 2>&1
  echo $? > "$dir/rc"
}
rc_is() { [ "$(cat "$T/$1/rc")" = "$2" ]; }
cfg() {
  python3 - "$T/$1/opencode.config.json" "$2" <<'PY'
import json, sys
c = json.load(open(sys.argv[1]))
sys.exit(0 if eval(sys.argv[2]) else 1)
PY
}
arg_after() { grep -A1 -x -- "$2" "$T/$1/opencode.args" | tail -1; }

OPEN_ENV="NANOCLAW_MODEL_WEIGHTS=open OPENCODE_PROVIDER=openai OPENCODE_MODEL=openai/nvidia/zai-org/glm-5.3 OPENCODE_BASE_URL=https://inference.example/v1"

echo "closed group:"
run_case closed ANTHROPIC_DEFAULT_OPUS_MODEL=claude-test-opus --
check "exit 0" rc_is closed 0
check "claude ran" test -f "$T/closed/claude.args"
check "opencode did not run" absent "$T/closed/opencode.args"
check "claude got the Opus model" grep -qx claude-test-opus "$T/closed/claude.args"
check "clarity-review.md is the claude text" has "Claude clarity" "$T/closed/run/clarity-review.md"

echo "open-weights group:"
# shellcheck disable=SC2086
run_case open $OPEN_ENV ANTHROPIC_DEFAULT_OPUS_MODEL=claude-test-opus --
check "exit 0" rc_is open 0
check "opencode ran" test -f "$T/open/opencode.args"
check "claude did not run" absent "$T/open/claude.args"
check "model is OPENCODE_MODEL" is "$(arg_after open --model)" openai/nvidia/zai-org/glm-5.3
check "runs in the private worktree" has "$T/wt/wt-clarity-" "$T/open/opencode.args"
check "no Claude model in the config" cfg open "'claude-test-opus' not in json.dumps(c)"
check "Write/Edit allowed anywhere, as on the Claude path" cfg open "c['permission']['edit'] == 'allow'"
check "bash: mkdir allowed, other commands denied" cfg open "c['permission']['bash']['mkdir *'] == 'allow' and c['permission']['bash']['*'] == 'deny'"
check "instructions: CLAUDE.md, AGENTS.md, engine notes" cfg open "[p.split('/')[-1] for p in c['instructions']] == ['CLAUDE.md', 'AGENTS.md', 'opencode-engine-notes.md']"
check "skills: the checkout's .claude/skills" cfg open "c['skills']['paths'][0].endswith('/.claude/skills')"
check "clarity-review.md is the opencode text" has "OpenCode clarity" "$T/open/run/clarity-review.md"
check "tool-uses.jsonl lists the bash call" has '"command": "gh pr diff 1"' "$T/open/run/tool-uses.jsonl"
check "the private worktree is removed" is "$(ls "$T/wt")" ""

echo "open-weights group, refused inputs:"
# shellcheck disable=SC2086
run_case model-flag $OPEN_ENV -- --model opus
check "--model is refused" rc_is model-flag 1
check "--model: no CLI ran" absent "$T/model-flag/opencode.args"
if [ -z "$(PATH=/usr/bin:/bin command -v opencode)" ]; then
  mkdir -p "$T/stub-noopencode"
  cp "$T/stub/gh" "$T/stub/claude" "$T/stub-noopencode/"
  # shellcheck disable=SC2086
  CASE_PATH="$T/stub-noopencode:/usr/bin:/bin" run_case no-opencode $OPEN_ENV --
  check "missing opencode fails" rc_is no-opencode 1
  check "missing opencode: claude is not used instead" absent "$T/no-opencode/claude.args"
fi

echo
echo "run-clarity.test.sh: $PASS passed, $FAIL failed"
if [ "$FAIL" -ne 0 ]; then
  for f in "$T"/*/out.log; do echo "--- $f"; tail -15 "$f"; done
  exit 1
fi
