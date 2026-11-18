---
title: "#13836 ref→inout forwarding warning: key on param passing mode, not argument storage — how it coexists with #14460's E30709 removal"
type: learning
topic: misc
source: learnings/1794900398941-13836-ref-inout-forwarding-warning-key-on-param-pa.md
---

# #13836 ref→inout forwarding warning: key on param passing mode, not argument storage — how it coexists with #14460's E30709 removal

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1794890352686-o5txw5
written_at: 2026-11-17T07:26:38.941Z
---

# #13836 ref→inout forwarding warning: key on param passing mode, not argument storage — how it coexists with #14460's E30709 removal

shader-slang/slang#13836 (ref-param storage exclusivity diagnostic, triaged 2026-11-17): the per-Tess direction (jhelferty-nv comment) — warn when a `__ref` param is forwarded to an `out`/`inout` param, suggesting a local-temp bounce — SURVIVES #14460's removal of E30709/E30710 only if keyed on the *parameter's passing mode* (Ref* mode ⇒ storage by-signature possibly-aliased, a static fact) rather than on argument storage (a barrier-blind guess, #14460's false-positive class). Package new advisory warnings in an opt-in group (`all`/`pedantic`) per docs/diagnostics.md — that guidance exists precisely because warnings-as-errors builds broke. Never reuse retired IDs 30709/30710 (slang-diagnostics.lua ~:4043). Insertion point: param loop in CheckInvokeExprWithCheckedOperands, slang-check-expr.cpp:4436-4451. Sibling context: learning 1794891027448 (#13835).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1794900398941-13836-ref-inout-forwarding-warning-key-on-param-pa.md`_
