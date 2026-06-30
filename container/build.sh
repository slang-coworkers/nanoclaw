#!/bin/bash
# Build the NanoClaw agent container image.
#
# Reads optional build flags from ../.env:
#   INSTALL_CJK_FONTS=true   — add Chinese/Japanese/Korean fonts (~200MB)
#   ENABLE_GPU=1             — add CUDA toolkit + Vulkan loader + GLVND (~multi-GB)
# setup/container.ts reads the same file, so both build paths stay in sync.
# Callers can also override by exporting either var directly.

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR"

# Derive the image name from the project root so two NanoClaw installs on the
# same host don't overwrite each other's `nanoclaw-agent:latest` tag. Matches
# setup/lib/install-slug.sh + src/install-slug.ts.
# shellcheck source=../setup/lib/install-slug.sh
source "$PROJECT_ROOT/setup/lib/install-slug.sh"
IMAGE_NAME="$(container_image_base)"
TAG="${1:-latest}"
CONTAINER_RUNTIME="${CONTAINER_RUNTIME:-docker}"

# Caller's env takes precedence; fall back to .env.
if [ -z "${INSTALL_CJK_FONTS:-}" ] && [ -f "../.env" ]; then
    INSTALL_CJK_FONTS="$(grep '^INSTALL_CJK_FONTS=' ../.env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')"
fi
if [ -z "${ENABLE_GPU:-}" ] && [ -f "../.env" ]; then
    ENABLE_GPU="$(grep '^ENABLE_GPU=' ../.env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'" | tr -d '[:space:]')"
fi

BUILD_ARGS=()
if [ "${INSTALL_CJK_FONTS:-false}" = "true" ]; then
    echo "CJK fonts: enabled (adds ~200MB)"
    BUILD_ARGS+=(--build-arg INSTALL_CJK_FONTS=true)
fi

# GPU build path: enabled via explicit env var. Previously this auto-flipped on
# any host that had `nvidia-smi` in PATH (RC-L1), which silently opted hosts
# into a ~multi-GB CUDA/Vulkan/X11 rebuild they didn't ask for. Opt-in only.
if [ "${ENABLE_GPU:-}" = "1" ] || [ "${ENABLE_GPU:-}" = "true" ]; then
    echo "GPU build requested via ENABLE_GPU — building with CUDA, Vulkan, X11"
    BUILD_ARGS+=(--build-arg ENABLE_GPU=1)
fi

# Fetch external skills declared in coworker-types.yaml
if [ -x "$PROJECT_ROOT/scripts/fetch-skills.sh" ]; then
    echo "Fetching external skills..."
    bash "$PROJECT_ROOT/scripts/fetch-skills.sh" || echo "⚠ External skill fetch failed — using cached"
fi

echo "Building NanoClaw agent container image..."
echo "Image: ${IMAGE_NAME}:${TAG}"

${CONTAINER_RUNTIME} build "${BUILD_ARGS[@]}" -t "${IMAGE_NAME}:${TAG}" .

echo ""
echo "Build complete!"
echo "Image: ${IMAGE_NAME}:${TAG}"
echo ""
echo "Test with:"
echo "  echo '{\"prompt\":\"What is 2+2?\",\"groupFolder\":\"test\",\"chatJid\":\"test@g.us\",\"isMain\":false}' | ${CONTAINER_RUNTIME} run -i ${IMAGE_NAME}:${TAG}"
