---
name: project_12203_slang_test_vulkan_sdk_path
description: "slang#12203 — explicit VulkanSDK path arg for slang-test; enhancement P3, PARKED (jkwak self-filed)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 1f922760-864f-4715-beee-2fa95837d5f5
---

# slang#12203 — set VulkanSDK path explicitly for slang-test

Enhancement (test-harness ergonomics), P3/low, component CI/test-harness (`tools/slang-test`). Self-filed + self-assigned by maintainer **jkwak-work** → standing directive [[feedback_...]] no-autofixer-jkwak-self-filed applies: triage + posted 5-bullet verdict is the TERMINAL deliverable. NO fixer dispatch. PARKED for owner.

**Ask (3 behaviors):** (1) print which VulkanSDK slang-test uses at startup; (2) add CLI arg for explicit VulkanSDK path; (3) if no explicit path AND >1 VulkanSDK on PATH → error + stop.

**Confirmed mechanism:** no runtime option today; Vulkan probed by bare-name load `_canLoadSharedLibrary("vulkan-1")` at `source/core/slang-render-api-util.cpp:280` → OS lib search (PATH/LD_LIBRARY_PATH) + VULKAN_SDK/VK_LAYER_PATH. Ordering decides winner silently.

**Recommended (Approach A):** `-vulkan-sdk-path <dir>` mirroring `-bindir` (parse arm `tools/slang-test/options.cpp:226`, member `options.h:59`). Precedence: explicit arg > VULKAN_SDK env > PATH-scan→ambiguity-error. Non-trivial part = path-INJECTION mechanism (which env vars, where, inherited by render-test child). Phase-1 fallback (Approach C): print + ambiguity-error diagnostics only, defer override arg.

Not a dup; closest prior art #8131 (CLOSED, slang.dll shadowing family). Verdict posted cmt 5061368961 (07-23). Triage memo: /workspace/inbox/a2a-1784827594541-nadwd9/triage-12203.md.

**Re-engage triggers:** jkwak's explicit "make a PR"/go, a linked PR, or a substantive human comment.
