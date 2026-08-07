---
name: feedback_execute_the_template_a_diff_read_cannot_see_a_refusing_regex
description: "For a template-string renderer, RENDER it — a correct-looking markdown/HTML line can be silently refused by a downstream regex; and run the same probe on the OLD branches before charging a defect to the new one"
metadata:
  node_type: memory
  type: feedback
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1095
---

Measured on slang-coworkers/nanoclaw#1095 ([[project_nanoclaw_1095_critique_card_render]]).

**The line that hid the bug read as obviously correct:**
```js
const sessionLink = item.sessionId ? ` · [session](?session=${encodeURIComponent(item.sessionId)})` : '';
```
A markdown link, a real id, properly encoded. It **never renders as a link** — the `md()` it flows
into requires a scheme (`/\[([^\]]+)\]\((https?:\/\/[^)"]+)\)/g`), so a relative `?session=` URL is
silently passed through as literal `[session](?session=…)` text. The PR's own headline claim was
*"Both ends link."*

⇒ ⭐⭐⭐**When a change builds a string that some OTHER function will interpret (markdown renderer,
template engine, sanitizer, query builder, shell), reading the change tells you what was WRITTEN,
never what the interpreter ACCEPTS. Execute it.** The failure mode is silent-and-plausible: no error,
no warning, output that looks like output. A regex that declines to match produces no signal at all.

**How to apply — harvest the real functions, don't reimplement them.** Brace-match the named
functions out of the head artifact and run them in a sandbox with the *producer's* actual payload
shape (look the producer up; don't invent fields):
```js
const grab = (n) => { const i=src.indexOf(`function ${n}(`); let d=0,j=src.indexOf('{',i);
  for(let k=j;k<src.length;k++){ if(src[k]==='{')d++; else if(src[k]==='}'){d--; if(d===0)return src.slice(i,k+1);} } };
new Function([...helpers, grab('renderX')].join('\n\n') + '\nreturn {renderX};')()
```
⚠️Expect 2–4 `ReferenceError`s for closure globals (module consts, timezone vars, sibling helpers) —
stub them. **These are LOUD failures, which is what makes this harness safe**: contrast
[[project_nanoclaw_1092_critique_gate_resolved_wedge]], where three harness bugs returned clean
exit-0 results that *read as findings*. A harness that crashes when wrong beats one that lies.

## Companion rule — probe the OLD branches before charging a defect to the new one

The same render turned up double-escaping in the new branch (`esc()` inside a string later passed to
`md()` ⇒ `&` → `&amp;amp;`, `<` → `&amp;lt;`). Tempting second finding. **I re-ran the identical
probe against two PRE-EXISTING branches (`request_rebuild`, the generic fallback) and they do it
byte-identically** — an inherited house pattern, not this PR's regression. Reported as "flagging only
so it isn't mistaken for new."

⇒ ⭐⭐**A defect found in changed code is not thereby CAUSED by the change.** The cheap discriminator
is one extra call of the same probe against an unchanged sibling. Skipping it manufactures false
findings that cost the author's trust — and the check is seconds once the harness exists.

Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]] (the negative-control half: I also stripped
the PR's plumbing to confirm its new test genuinely fails without it) and the standing rule that base
and head must be measured on **both** sides before attributing a test failure (base 5-failed/80-passed
vs head 5-failed/83-passed proved the 5 were mine, not the PR's).
