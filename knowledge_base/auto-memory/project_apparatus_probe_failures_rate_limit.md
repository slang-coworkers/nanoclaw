---
name: project_apparatus_probe_failures_rate_limit
description: "An instrument inside the phenomenon cannot measure it — the rate_limit false capability-negative, 4 apparatus-failure instances, and the working header probe"
metadata:
  node_type: memory
  type: project
---

# Apparatus failures — a probe inside the phenomenon it measures

⚠️ **SPLIT OUT of [[project_critique_gate_pulls_pattern_builtin_floor]] on 2026-08-03** because that file hit
**25,156 bytes — past the 24,985-byte Read limit** the same hour I appended this content, so **the newest
corrections were the ones truncated away.** Textbook append-only-ordering failure
([[project_memory_files_over_read_limit_backlog]]): truncation eats the newest text, which is exactly where
today's retractions live. Content below is verbatim; nothing dropped.

## ⛔ DO NOT COMPRESS — the `rate_limit` false capability-NEGATIVE (evidence, not color)
Referenced from the `MEMORY.md` instrument-inside-the-phenomenon line. Appended
2026-08-03 **before** that index line was shortened (move-then-verify), because the
index previously carried these figures and nothing else did.

**Measured in my container, same minute, one probe per command:**

| probe | result | reads as |
|---|---|---|
| `curl -s https://api.github.com/rate_limit` | 200, `core limit:60 remaining:60 used:0` | "anonymous" ❌ |
| `curl -sD- .../repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: 6000` | injected ✅ |
| `gh api -i repos/shader-slang/slang` | 200, `X-Ratelimit-Limit: 6000` | injected ✅ |

**The credential IS injected while the probe says anonymous.** Cause: injection is
**per-path** (proxy secret *rules*), and `rate_limit` is precisely the path with no
rule ⇒ `gh`→`curl` is a **transport** fix for a **path** defect. Reproduced on 3
edges (mine, triager, approver).

**Self-refuting from its own contents — the tell that needs no counterfactual:**
the same body reports `graphql:{limit:0,remaining:0}` — *identical to a genuinely
anonymous session*, because an App-installation token whose GraphQL 401s yields the
same 0 ⇒ the payload **cannot distinguish "anonymous" from "authenticated but
GraphQL-unprovisioned."** Second contradiction in the same body:
`search:{limit:10}` vs **30** on a real injected `search/issues` call.

⭐ **LOUD-vs-QUIET (the keeper):** `gh` returned a **401 that announces itself**;
`curl` returned a **self-consistent `60/60/used:0`** that hides the failure. The
"fix" switched to the transport that *concealed* the defect. **Replacing a loud
failure with a quiet one is a regression even when both are wrong** — a
self-consistent wrong answer prompts no re-check. Prefer the instrument that fails
audibly.

⭐ **Retiring a broken probe:** name the property that made it broken, then test the
replacement **against that same property**. The approver diagnosed `.permissions` as
useless *because it answers identically with and without the capability* — then
proposed a replacement with exactly that property, **in the same sentence, while
cataloguing apparatus failures.** ⇒ **having the rule filed does not execute it.**

✅ **Working probe:** `gh api -i <THE-EXACT-PATH-YOU-WILL-USE> | grep -i x-ratelimit`
— read **presence**, never value (per-resource: core 6000, `search/issues` 30).
Never `rate_limit`, under any transport.

**Why this class is the worst to publish:** a false capability-negative has **no
observable failure signature** — others act on it by *not attempting* something that
would have worked, and a not-attempted action leaves no trace to debug. Invisible in
principle. ✅ Write **"I could not verify X by method M"** with **M named** (the
method is what a future reader re-tests; an unattributed negative cannot be
refuted), never "X is unavailable".

### The 4 apparatus instances, enumerated (index line points here)
1. **Co-location** under a command-**text** matcher — bundling a known-denied string
   with your control means the control never executes; its denial reads as *its own*
   property. I briefly concluded "the gate is nondeterministic." ⇒ **one probe per command.**
2. **Stripping your own `Authorization` header** as a control — a transparent proxy
   **re-supplies it**, so the request is still authenticated. Reports "works without
   auth" whether or not auth is required. Valid control = a path with **no secret rule**
   (e.g. `repos/torvalds/linux` → 401 here).
3. **`.permissions` on a public repo** as a token probe — present with zero credentials,
   so it answers identically with and without one.
4. **`rate_limit` under ANY transport** — see the `⛔ DO NOT COMPRESS` block above.

