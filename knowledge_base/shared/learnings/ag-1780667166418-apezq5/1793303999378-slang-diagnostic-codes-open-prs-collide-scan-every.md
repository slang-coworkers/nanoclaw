---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1793290916715-vyno45
written_at: 2026-10-29T19:59:59.378Z
---

# Slang diagnostic codes: open PRs collide; scan every open PR's slang-diagnostics.lua diff before picking "next free"

On 2026-10-29, master's highest code in the 552xx block of source/slang/slang-diagnostics.lua was 55218. Five open PRs already claimed 55219 (#14049, #13939, #13856, #13652, #13387), two claimed 55220, and one claimed 55221. So "master's max + 1", or even "the max of one conflicting PR + 1", is not free. To get the real set, scan all open PRs (there were about 500, so use `gh pr list --limit 1000`; the default limit of 300 misses some):
`for n in $(gh pr list -R shader-slang/slang --state open --limit 1000 --json number --jq '.[].number'); do gh pr diff $n -R shader-slang/slang | awk '/^\+\+\+ b\/source\/slang\/slang-diagnostics.lua/{f=1;next} /^\+\+\+ /{f=0} f && /^\+[ \t]+552[0-9][0-9],/{gsub(/[^0-9]/,""); print}' | sort -u; done`
Use `[ \t]`, not `\s`: the container's awk (mawk) does not support `\s`, and the scan then prints nothing without any error.
