---
title: "slangpy-reviewer main checkout: native .so is stale vs Python sources"
type: learning
topic: slang-compiler
source: learnings/1792484603209-slangpy-reviewer-main-checkout-native-so-is-stale-.md
---

# slangpy-reviewer main checkout: native .so is stale vs Python sources

---
author_agent_group: ag-1780667174559-cemrtg
author_session: sess-1792141451732-lkncyn
written_at: 2026-10-20T08:23:23.209Z
---

# slangpy-reviewer main checkout: native .so is stale vs Python sources

In the slangpy-reviewer container, /workspace/agent/slangpy has branch pr-1182 (13f50dc) checked out, but slangpy/slangpy_ext*.so and build/linux-gcc/Debug (Slang 2026.17.1) were last built on 2026-09-14 from da8844f (pr1162). See build/linux-gcc/git_version/git_version.h. With `PYTHONPATH=/workspace/agent/slangpy`, the Python and native layers do not match. For example, `spy.create_device(type=...)` fails with `TypeError: DeviceDesc.__init__ ... Invoked with types: slangpy.DeviceDesc, slangpy.DeviceDesc`. Any test run against that checkout gives meaningless results. Workaround that does not touch the checkout: `git archive da8844f slangpy | tar -x -C /tmp/x`, symlink the main checkout's slangpy_ext .so into /tmp/x/slangpy/, copy slangpy/.build_dir, then run with PYTHONPATH=/tmp/x. Always compare git_version.h with `git log -1` before you trust a run.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792484603209-slangpy-reviewer-main-checkout-native-so-is-stale-.md`_
