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

# Print the absolute path of each file an apply_patch command touches, one per
# line. With a third argument `written`, deleted files are left out: the plan
# tracker credits a plan only for a file the patch adds or updates.
apply_patch_files() {
  local cmd="$1" cwd="${2:-/workspace/agent}" mode="${3:-all}" line p
  while IFS= read -r line; do
    if [[ $line =~ ^\*\*\*[[:space:]](Add|Update|Delete)[[:space:]]File:[[:space:]]*(.+)$ ]]; then
      [ "$mode" = written ] && [ "${BASH_REMATCH[1]}" = Delete ] && continue
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

# Print what an apply_patch command runs besides its patch: every line outside
# the `*** Begin Patch` .. `*** End Patch` body, its `apply_patch <<'EOF'` opener
# and the heredoc's closing marker. Empty for a pure patch. Consider
# `apply_patch <<'EOF'` with a notes patch, then `python3 -c "open('src/x.py','w')"`
# on the next line: the gate cannot judge that write from the patch's file list.
apply_patch_remainder() {
  local cmd="$1" line in_patch=0 opened=0 marker=""
  while IFS= read -r line; do
    if [ "$opened" = 0 ] && [[ $line =~ ^[[:space:]]*(apply_patch|applypatch)([[:space:]]|$) ]]; then
      opened=1
      if [[ $line =~ \<\<-?[[:space:]]*[\'\"]?([A-Za-z_][A-Za-z0-9_]*)[\'\"]?[[:space:]]*$ ]]; then
        marker="${BASH_REMATCH[1]}"
      elif [[ $line =~ \*\*\*[[:space:]]Begin[[:space:]]Patch ]]; then
        in_patch=1
      fi
      continue
    fi
    if [ "$in_patch" = 1 ]; then
      [[ $line =~ ^[[:space:]]*\*\*\*[[:space:]]End[[:space:]]Patch ]] && in_patch=0
      continue
    fi
    if [[ $line =~ ^[[:space:]]*\*\*\*[[:space:]]Begin[[:space:]]Patch ]]; then
      in_patch=1
      continue
    fi
    if [ -n "$marker" ] && [ "${line//[[:space:]]/}" = "$marker" ]; then
      marker=""
      continue
    fi
    # The closing quote of the quoted-argument form: apply_patch '*** Begin Patch … *** End Patch'
    [[ $line =~ ^[[:space:]]*[\'\"][[:space:]]*$ ]] && continue
    [ -n "${line//[[:space:]]/}" ] && printf '%s\n' "$line"
  done <<< "$cmd"
  return 0
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
