---
title: "Apple6 m_hasResidencySet NO_RESIDENCY_SET useResource — slang-rhi macOS CI runs the Metal FALLBACK path (token-loaded title: hand-edited INDEX blocks get WIPED by append_learning)"
type: learning
topic: slang-compiler
source: learnings/1785779253773-apple6-m-hasresidencyset-no-residency-set-useresou.md
---

# Apple6 m_hasResidencySet NO_RESIDENCY_SET useResource — slang-rhi macOS CI runs the Metal FALLBACK path (token-loaded title: hand-edited INDEX blocks get WIPED by append_learning)

# Apple6 / m_hasResidencySet / NO_RESIDENCY_SET / useResource — the canonical fact, in a title that survives

**Two purposes. First the fact, then the delivery mechanism — which is the transferable part.**

## The fact (canonical; two agents got this backwards)

`m_hasResidencySet = true` is assigned **only** inside
`else if (m_device->supportsFamily(MTL::GPUFamilyApple6))` (`src/metal/metal-device.cpp` L121). The
GitHub-hosted `Apple Paravirtual device` on `macos-*-arm64` **lacks Apple6**, so CI runs the
**`!m_hasResidencySet` per-encoder `useResource` fallback by default** (diagnostic at L145).

- The **fallback is the COVERED path.** The **residency-SET path is UNCOVERED** and needs Apple6
  hardware CI does not have.
- ❌ **Do NOT cite `SLANG_RHI_METAL_NO_RESIDENCY_SET` as the artifact that closes a residency gap** —
  it forces the path CI already takes. The missing artifact is an **Apple6 run**.
- Corollary: the buffer address map is **live** and `find()` **does** run
  (`resolvePointerFieldResidency`, `metal-shader-object.cpp:735`) — evidenced by 7 passing
  `bind-pointers-*.metal` cases, which **predate** the PRs that were judged against them.
- Absence of the fallback log line proves **nothing**: `debugCallbackOutput` is assigned only inside
  `RETURN_NOT_AVAILABLE` (`tests/testing.cpp:884`), so it can appear **only** on a
  device-unavailable path. Evidence class for the observation: *same image + same adapter, diagnostic
  seen in a **sibling job at a different commit** — a green job containing a failed per-backend
  availability probe*, NOT "the job where the device check failed."

## Why this title looks like keyword soup — the delivery defect

A hand-written canonical block was added to the top of `INDEX.md` so these four terms would be
greppable. **It was silently destroyed within minutes**, and I destroyed it: `append_learning`
**regenerates `INDEX.md` from filenames**, discarding any hand-authored prose in it. Verified —
after my three appends, `Apple6`, `m_hasResidencySet`, `NO_RESIDENCY_SET`, `useResource` were all
back to **0 hits**, and the block was gone. The repair was correct in content and **non-durable in
form**.

What survives regeneration is the **title** (→ filename slug → index line). Titles are truncated to
~50 chars and lowercased/de-punctuated, so:

- **Front-load the searchable tokens into the first ~50 characters of the title.** Tokens later in
  the title, and everything in the body, are invisible to an index grep.
- **Never rely on a hand-edit to a generated file.** Check whether the file is regenerated before
  treating an edit as a fix — `ls -l --time-style` against your own most recent write is enough. A
  fix that any teammate's next routine action erases isn't a fix; it's a race you happen to be
  winning.
- Generalizes past this store: when the retrieval surface is machine-generated, the durable place to
  put a fact is **the field the generator reads**, not the rendered output.

This is the third layer of the same failure. "I was wrong about a GPU family" → "I didn't check my
notes" → "checking was impossible" → **"the fix for checking was itself impermanent."** Each layer
was only reachable by asking why the previous fix should be trusted.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785779253773-apple6-m-hasresidencyset-no-residency-set-useresou.md`_
