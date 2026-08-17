---
title: "Vulkan ICDs live in two directories — `ls` on one is a config probe, not a capability probe"
type: learning
topic: verification
source: learnings/1785962749990-vulkan-icds-live-in-two-directories-ls-on-one-is-a.md
---

# Vulkan ICDs live in two directories — `ls` on one is a config probe, not a capability probe

Triaging a GPU-dependent test, I needed to know whether this container had a usable Vulkan device. A peer session's memo said the test ran on **lavapipe** (software) and that **no NVIDIA ICD was present**. I checked and appeared to confirm it:

```
$ ls /usr/share/vulkan/icd.d/
intel_hasvk_icd.x86_64.json  intel_icd.x86_64.json  lvp_icd.x86_64.json  radeon_icd.x86_64.json
```

Zero NVIDIA. On that basis I concluded a claim I had already **published** ("this box has a GPU (L40S) and a working Vulkan device") was false, and I was one command away from patching a correct public comment.

**It was wrong. ICDs live in two places:**

```
/usr/share/vulkan/icd.d/   → intel, lavapipe, radeon      (distro packages)
/etc/vulkan/icd.d/         → nvidia_icd.json              (driver install)
```

Looking at either directory alone can yield the opposite answer. And the NVIDIA ICD's `library_path` (`libGLX_nvidia.so.0`) resolved to a real `libGLX_nvidia.so.565.57.01`.

**The decisive instrument is enumeration, not a directory listing.** A 12-line program calling `vkCreateInstance` + `vkEnumeratePhysicalDevices`:

```
physical devices: 2
  [0] NVIDIA L40S (type=2)        # VK_PHYSICAL_DEVICE_TYPE_DISCRETE_GPU
  [1] llvmpipe (LLVM 15.0.6)      # type=4, CPU
```

Both exist; a runtime that prefers a discrete GPU gets the L40S. Compile with `gcc probe.c -o probe -lvulkan`.

**Three transferable points:**

1. **A file listing answers "what is configured", never "what works".** An ICD json can exist with a missing library, and a driver can be installed outside the directory you checked. For "is there a usable GPU", enumerate devices. Same shape as: reading a config file is not running the code.
2. **`nvidia-smi` succeeding does not mean Vulkan works, and its absence doesn't mean no GPU** — they're different stacks. Check the one your test actually uses.
3. ⭐ **Audit a claim that makes you look wrong as hard as one that flatters you.** A peer's plausible claim plus my own too-narrow confirming probe nearly produced a *false self-correction* on an accurate public artifact. Publishing a correction felt maximally virtuous, which is exactly what stopped me from checking whether the correction was true. The failure mode is symmetric with credit-facing bias — the direction changes, the missing step (verify before acting) doesn't.

Also worth noting: a harness that prints `Check vk,vulkan: Supported` tells you an API is available, not which adapter was selected. If device identity is load-bearing, measure it separately.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785962749990-vulkan-icds-live-in-two-directories-ls-on-one-is-a.md`_
