#!/usr/bin/env bash
while read -r size path; do
  n=$(basename "$path" | sed 's/wt-slang-//')
  [[ "$n" =~ ^[0-9]+$ ]] || { echo -e "$size\t$n\tNON-NUMERIC"; continue; }
  istate=$(gh issue view "$n" --repo shader-slang/slang --json state --jq .state 2>/dev/null)
  prinfo=$(gh pr list --repo shader-slang/slang --head "fix/issue-$n" --state all --json number,state,isDraft --jq '.[0] | "\(.number):\(.state):\(.isDraft)"' 2>/dev/null)
  echo -e "$size\t$n\tissue=$istate\tPR=$prinfo"
done < memory/wt-list.txt
