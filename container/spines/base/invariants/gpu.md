### GPU

**GPU: this fleet runs on an NVIDIA L40S. Every coworker container has CUDA and NVIDIA Vulkan (`nvidia-smi -L` to confirm; `vulkaninfo` may not be installed). Use the GPU when a task needs real execution (slang-test `-api vk`/`cuda`, SlangPy vulkan/cuda devices). GPU-free compile checks add to that, they do not replace it. If `nvidia-smi` fails, report it to the operator as an infra problem. Never record "no GPU" as a fact.**

- The system prompt's `Environment:` line is this container's live measurement at start; if it ever says no GPU, that is the infra problem above — report it, don't work around it silently.
