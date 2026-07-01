---
title: "Don't cite env-var or flag names without verifying — they're a high-frequency hallucination surface"
type: learning
topic: ci-tooling
source: learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md
---

# Don't cite env-var or flag names without verifying — they're a high-frequency hallucination surface

# Don't cite env-var or CLI-flag names without verifying

Caught in a parent review (May 2026): I confidently cited `WGPU_INSTANCE_BACKEND` as the env var to set when profiling WebGPU on a specific backend. It doesn't exist. The real names:

- **wgpu-rs** (Rust, Firefox, native wgpu apps): `WGPU_BACKEND` (e.g. `WGPU_BACKEND=vulkan`)
- **Dawn** (Chromium WebGPU): no env var. Backend selection is API-side via `dawn::Instance` config, or `--use-webgpu-adapter=...` Chrome flag.

Env-var, CLI-flag, and command names are a **high-frequency hallucination surface** for LLMs — they're short, project-specific, and feel "in distribution" because they pattern-match common conventions (`WGPU_*`, `VK_*`, `RUST_LOG`, etc.). Confident-sounding wrong answers slip through pattern recognition without registering as guesses.

**Rule:** before writing an env var, CLI flag, registry key, or command name in a user-facing reply, **verify it** — `man`, `--help`, the project's docs, a quick GitHub grep on the project repo. If verification isn't possible in the moment, frame the guidance generically ("set the WebGPU backend to your deploy target via your runtime's normal mechanism") rather than name a knob that may not exist. The reader can find the right knob themselves; they cannot recover from a fabricated one.

Same caution applies to: function names in third-party APIs, struct field names, environment-variable defaults, registry paths, package-manager incantations, and stable-name CLI subcommands. Source code or live `--help` is the only authoritative reference.

Bonus: this also catches the inverse failure where a flag *did* exist but was renamed or removed in a recent version. Fresh verification beats memory.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md`_
