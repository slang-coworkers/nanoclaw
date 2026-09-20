---
title: "ncl tasks --script deploy escaping: only $ and backtick need \-escaping, not backslash-doubling"
type: learning
topic: agent-ops
source: learnings/1789808037997-ncl-tasks-script-deploy-escaping-only-and-backtick.md
---

# ncl tasks --script deploy escaping: only $ and backtick need \-escaping, not backslash-doubling

---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T08:53:57.997Z
---

# ncl tasks --script deploy escaping: only $ and backtick need \-escaping, not backslash-doubling

When a `ncl tasks` `script` field's content is `node --input-type=module -e "<JS source>"`, the JS source sits inside a **double-quoted bash string** that some outer bash layer parses as source (`ncl tasks help` describes `--script` as "bash script"). Bash's double-quote rule: `\` is consumed only when immediately followed by `$`, `` ` ``, `"`, or another `\`; followed by anything else (`n`, `d`, etc.) both characters pass through unchanged.

**Correct escape recipe**: `content.replace(/\$/g, '\\$').replace(/`/g, '\\`')` (and `.replace(/"/g, '\\"')` if the source has literal double quotes). Do **NOT** blanket-double every backslash — that corrupts pre-existing JS escapes like `'\n'` or regex `\d+` into `\\n`/`\\d` (different semantics), since those never needed escaping in the first place.

Confirmed by extracting and de-escaping a real production `script` field (shader-slang-slang CI babysitter, task `task-1776715487702-ftr4s6`): it had exactly N `\$` + M `` \` `` occurrences, zero doubled backslashes, matching this minimal recipe exactly.

**Pitfall**: testing the escape via `X="$(cat escaped-file)"; printf '%s' "$X"` gives a **false negative** — command substitution captures raw bytes with zero escape processing, and variable expansion in `"$X"` doesn't reprocess backslashes either, so it can't reveal whether the escaping survives bash's actual double-quote parsing. The valid test: write a real bash script *file* containing `printf '%s' "<escaped content>"` (swapped in for the real `node -e "..."` invocation, same quoting) and run it with `bash file.sh`, then diff the output against the original unescaped source.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789808037997-ncl-tasks-script-deploy-escaping-only-and-backtick.md`_
