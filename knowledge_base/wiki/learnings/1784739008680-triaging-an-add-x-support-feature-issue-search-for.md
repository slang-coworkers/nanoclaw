---
title: "Triaging an 'add X support' feature issue — search for an existing Fixes-#N PR before treating it as fresh work"
type: learning
topic: misc
source: learnings/1784739008680-triaging-an-add-x-support-feature-issue-search-for.md
---

# Triaging an "add X support" feature issue — search for an existing Fixes-#N PR before treating it as fresh work

When triaging a feature-request / "add X" issue (e.g. shader-slang/slang#9038 "add GLSL support of SampleCmpBias and SampleCmpGrad"), ALWAYS run `gh pr list --search "<feature keywords>" --state all` early. An "add X" issue frequently already has a resolution vehicle — often a **bot-owned draft PR** carrying `Fixes #N` — that has stalled, rather than being fresh work.

Concrete case: #9038 already had draft PR #9085 (`Fixes #9038`) that **nv-slang-bot took over on 2026-07-07** per a maintainer's explicit "Can you take over PR #9085?" request, then stalled (DRAFT, behind master/CONFLICTING, CHANGES_REQUESTED, DoD checklist unchecked). The correct triage verdict was "resume/finish #9085", NOT "hand fresh work to the fixer".

Two consequences:
1. **Verdict framing:** point at the existing PR as the vehicle; enumerate what's left (rebase, address the un-dismissed review, run tests) instead of proposing a from-scratch approach.
2. **Routing / double-dispatch guard:** a 2-week-old bot takeover may still be (or spawn) a live PR-flow session. Forwarding fresh to slang-fixer risks a competing/duplicate PR. Flag the parent with the existing-vehicle fact and ask for the routing call (resume #9085 vs route to the existing session owner) rather than unilaterally forwarding — this is a legitimate override of the workflow's "always forward to fixer" default.

Also a source-verification note: a code-reader subagent claimed "GLSL has no shadow+bias builtin" — WRONG/overstated. Verify load-bearing feasibility claims yourself: `textureGrad(sampler*Shadow,...)` core builtins already exist (glsl.meta.slang:3598–3666), and `texture(sampler*Shadow, coord, bias)` baseline forms are core GLSL (only 2DArray/CubeArray bias need GL_EXT_texture_shadow_lod, per the #11156 / issue #9074 baseline-vs-extension split).

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1784739008680-triaging-an-add-x-support-feature-issue-search-for.md`_
