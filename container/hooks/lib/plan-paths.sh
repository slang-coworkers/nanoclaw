# shellcheck shell=bash
# Shared by gate-plan.sh and plan-tracker.sh: which files a tool call writes,
# and which of them need no plan.
#
# Codex edits files with `apply_patch`, and reports that to hooks as a Bash
# call whose command carries the whole patch (measured with codex 0.160):
#
#   apply_patch <<'EOF'
#   *** Begin Patch
#   *** Add File: reports/plan.md
#   *** Update File: src/foo.ts
#   *** End Patch
#   EOF
#
# so the files of such a call come from its `*** Add/Update/Delete File:` and
# `*** Move to:` lines, relative to the hook's cwd.

# True when the Bash command is an apply_patch call.
is_apply_patch() {
  [[ $1 =~ ^[[:space:]]*(apply_patch|applypatch)([[:space:]]|$) ]]
}

# Print the absolute path of each file an apply_patch command writes, one per line.
apply_patch_files() {
  local cmd="$1" cwd="${2:-/workspace/agent}" line p
  while IFS= read -r line; do
    if [[ $line =~ ^\*\*\*[[:space:]](Add|Update|Delete)[[:space:]]File:[[:space:]]*(.+)$ ]]; then
      p="${BASH_REMATCH[2]}"
    elif [[ $line =~ ^\*\*\*[[:space:]]Move[[:space:]]to:[[:space:]]*(.+)$ ]]; then
      p="${BASH_REMATCH[1]}"
    else
      continue
    fi
    p="${p%"${p##*[![:space:]]}"}"
    case "$p" in /*) ;; *) p="${cwd%/}/$p" ;; esac
    realpath -m "$p" 2>/dev/null || printf '%s\n' "$p"
  done <<< "$cmd"
}

# True when writing this file needs no plan: plans, reports and the other
# workspace notes, and top-level .md/.json files of the agent directory.
plan_free_path() {
  case "$1" in
    /workspace/agent/plans/* | /workspace/agent/reports/* | /workspace/agent/memory/* | \
      /workspace/agent/conversations/* | /workspace/agent/fixes/* | /workspace/agent/reviews/* | \
      /workspace/agent/critiques/* | /workspace/agent/CLAUDE.local.md | /workspace/.claude/*)
      return 0
      ;;
  esac
  local dir ext
  dir=$(dirname "$1")
  ext="${1##*.}"
  [ "$dir" = "/workspace/agent" ] && { [ "$ext" = "md" ] || [ "$ext" = "json" ]; }
}
