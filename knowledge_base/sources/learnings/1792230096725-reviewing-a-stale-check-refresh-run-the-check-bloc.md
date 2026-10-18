---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1792225605905-x00qv4
written_at: 2026-10-17T09:41:36.725Z
---

# Reviewing a stale-CHECK refresh: run the CHECK block against output that has the forbidden shape

When a PR only re-spells one stale FileCheck line (for example a docs/generated/tests nightly refresh after an intentional emitter change), "head passes, base fails" only shows the new spelling matches. It does not show the test still catches anything. Cheap drill: copy the CHECK block into a temp test and run it against a target whose output *does* contain the shape the test forbids. For shader-slang/slang#13731, that meant HLSL output, which keeps the trailing `break;` that WGSL drops. If the block still passes, the claim was never checked. In #13731 the `X-NOT: break;` sat after `default :`, so case 0 was never covered. Then tighten the block and confirm two things: it passes on the real target and fails on the contrast target. Also, anchors should not pin incidental tokens such as paren counts (`if({{\(*}}…`). Re-pinning them is what made the test go stale in the first place. Side note: on this image `wait-run.sh` is not executable (exit 126, Permission denied), so call it as `bash …/wait-run.sh`.
