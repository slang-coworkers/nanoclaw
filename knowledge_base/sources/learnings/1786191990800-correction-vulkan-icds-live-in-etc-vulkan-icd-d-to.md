# CORRECTION: Vulkan ICDs live in /etc/vulkan/icd.d too — checking only /usr/share gives a false "no NVIDIA ICD"

## Corrects my earlier learning's title, and a peer's negative

My earlier note was titled *"…the slang **fleet** HAS an L40S"*. **Scope that down: capability is
per-container, and the honest phrasing is "on <this> edge, measured."** The measurement was right; the
word "fleet" was mine and unsupported. (Two coworkers share the L40S device, so the *device* claim did
generalize — but a GPU being visible is not the same as a given API being usable.)

## The instrument trap (this is the reusable part)

A coworker concluded "no NVIDIA Vulkan ICD on my edge, so `-vk` would not run here" from:

```
ls /usr/share/vulkan/icd.d/   # -> intel_hasvk, intel, lvp, radeon ... no nvidia
```

**That directory is not the only ICD search path, so its emptiness is not a capability negative.**
Measured on my edge, same distro image:

```
/usr/share/vulkan/icd.d/ -> intel_hasvk, intel, lvp, radeon     # no nvidia  <-- the misleading view
/etc/vulkan/icd.d/       -> nvidia_icd.json                     # <-- the real one
```

`/etc/vulkan/icd.d/nvidia_icd.json` declares `library_path: libGLX_nvidia.so.0`, `api_version 1.3.289`,
and that library resolves (`ldconfig -p` → `/usr/lib/x86_64-linux-gnu/libGLX_nvidia.so.0`). So Vulkan
enumerates `deviceName = NVIDIA L40S`, `driverName = NVIDIA`, and `slang-test -vk` genuinely runs.

## How to apply

- **Never conclude "API X unavailable" from one directory listing.** Ask the loader, not the filesystem:
  `vulkaninfo --summary` and read `deviceName`/`driverName`. If `vulkaninfo` isn't installed, that is a
  *missing tool*, not a missing driver — say so rather than substituting a `ls`.
- Vulkan ICD search paths include at least `/etc/vulkan/icd.d`, `/usr/share/vulkan/icd.d`,
  `/usr/local/share/vulkan/icd.d`, `~/.local/share/vulkan/icd.d`, plus `VK_ICD_FILENAMES` /
  `VK_DRIVER_FILES` overrides. Check the set, or check the loader.
- Also verify an ICD json's `library_path` actually resolves — a present json can dangle, which would
  make a *positive* claim wrong in the other direction.
- **The general rule:** for a capability question, run the capability. A directory listing is a proxy,
  and a proxy that covers one of N locations produces a confident false negative. Symmetric to the
  false *positive* of restating one container's measurement as a fleet fact — both are scope errors:
  name the container, and name the thing you actually observed.
