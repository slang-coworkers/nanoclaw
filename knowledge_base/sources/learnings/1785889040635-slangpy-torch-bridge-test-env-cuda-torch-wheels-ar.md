# SlangPy torch-bridge test env: CUDA torch wheels are reachable through the container proxy

## TL;DR
`download.pytorch.org/whl/cu126` **is** reachable from inside the agent container through the onecli HTTPS proxy — you do NOT have to settle for a CPU-only wheel when a test calls `.cuda()`.

## Setup that works (verified 2026-08-05, L40S, driver 565.57.01 / CUDA 12.7)
```bash
python3 -m venv /workspace/agent/wt-<n>/.venv     # ~2s, venv+ensurepip present on /usr/bin/python3.11
./.venv/bin/python -m pip install --upgrade pip setuptools wheel
./.venv/bin/python -m pip install -r requirements-dev.txt -r requirements.txt   # ~8s
./.venv/bin/python -m pip install torch --index-url https://download.pytorch.org/whl/cu126  # ~74s, 6.3G total
```
Result: `torch 2.13.0+cu126`, `cuda.is_available() == True`, real allocation + matmul on `cuda:0` confirmed.

## Non-obvious details
- `PIP_CERT=/tmp/onecli-combined-ca.pem` and `HTTPS_PROXY=...host.docker.internal:10255` are pre-set in env; pip picks them up with no config file needed. Both PyPI and the pytorch index return 200.
- **Always positive-control `cuda.is_available()`** — it can be True on a wheel that still can't allocate. Verify with an actual `.cuda()` tensor + a matmul, and `get_device_name(0)`.
- torch ships its own CUDA userspace (`nvidia-*-cu12` wheels, 3.6G) so a cu126 wheel runs fine against a 12.7 driver (minor-version compatibility); no system CUDA toolkit needed for runtime.
- **CI pins `torch==2.8.0` with `--index-url .../cu128`** (`.github/workflows/ci.yml`, `ci-gcp.yml`, `ci-benchmark.yml`) — a locally installed newer torch diverges from CI. `src/slangpy_torch` pins no torch version and compiles against whatever is installed (`--no-build-isolation`), so a local/CI ABI mismatch is invisible until `test_native_bridge_version_matches` runs.
- `slangpy/tests/utils/test_torch_bridge.py` collection needs the built `libsgl.so` + `libslang-compiler.so.*`; a stale `slangpy_ext.cpython-311-*.so` can sit in `slangpy/` with both deps missing, and the failure surfaces as `ImportError: Error importing plugin "slangpy.testing.plugin": libsgl.so: cannot open shared object file` — that's an unbuilt repo, not a broken venv.
- `libgl1`/`libglx` are NOT in ldconfig (may matter for the build/device init); `libvulkan.so.1`, `libcuda.so.1`, gcc/g++ 12.2, and `nvcc` at `/usr/local/cuda-12.6/bin/nvcc` all are present.
- The `torch_bridge_mode` fixture (params: `native`, `fallback`) lives in `slangpy/testing/plugin.py`, wired via `pytest_plugins` in `slangpy/tests/conftest.py` — a non-root conftest, which still works under pytest 9.1.1.
