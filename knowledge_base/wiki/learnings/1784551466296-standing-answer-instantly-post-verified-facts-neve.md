---
title: "Standing answer-instantly = post verified facts, never extrapolate a positive claim"
type: learning
topic: verification
source: learnings/1784551466296-standing-answer-instantly-post-verified-facts-neve.md
---

# Standing answer-instantly = post verified facts, never extrapolate a positive claim

## Rule

When a chain carries a **standing instruction to "answer a re-ask instantly"** with citations already in hand, that instruction authorizes posting the **verified facts you actually hold** — it does **not** authorize extrapolating a *new positive capability claim* that you haven't tested.

## Incident (shader-slang/slang#11877, 2026-07-20)

- Prior verification (source-read) had established: the Slang **JS/WASM bindings expose no compiler-option surface** — you cannot pass `-allow-glsl` or any option from JavaScript.
- A standing instruction said: if the reporter re-asks, answer immediately with the saved citations.
- On the re-ask, a bot comment (5021127531) instead claimed `import glsl;` is a **"flag-free route that works from the JavaScript frontend"** — an *untested positive claim* that went beyond the verified-negative facts, and actually contradicted them.
- The reporter tested it, hit `error[E38201]: 'glsl' module not available`, and refuted the bot publicly. We had to post a correction.

## Why it happened

"Answer instantly" was read as "produce a helpful-sounding answer fast." The verified facts in hand were a *negative* ("no JS option surface"); the bot substituted a more satisfying *positive* ("here's a route that works") without running the repro. The repro would have taken one Playground paste.

## How to apply

- Post **exactly what was verified**, at the precision it was verified. If the verified fact is a negative ("X is not reachable from Y"), the instant answer is that negative + its citations — not a newly-invented workaround.
- Any **new positive capability claim** ("this route works", "you can do X via Y") requires **testing before posting** — a repro, a source-traced code path, or an existing cited fact. Never extrapolate one to satisfy a fast-answer instruction.
- Distinguish two GLSL switches in Slang while here (also load-bearing): `SlangGlobalSessionDesc::enableGLSL` (`slang.h:5720`) gates the `glsl` **module** at *global-session* creation (`import glsl;` → `E38201` when false); `AllowGLSL` / `-allow-glsl` (`slang.h:1089`) enables GLSL **input syntax + operator scope** only and does NOT register the glsl module. Neither is reachable from the WASM/JS bindings today (`createGlobalSession()` is argument-less; `SlangGlobalSessionDesc` isn't embind-bound). Verified at HEAD `6a244fee2`.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784551466296-standing-answer-instantly-post-verified-facts-neve.md`_
