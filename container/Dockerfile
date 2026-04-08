# NanoClaw Agent Container
# Runs Claude Agent SDK in isolated Linux VM with browser automation
# Pass --build-arg ENABLE_GPU=1 for CUDA/Vulkan GPU support

FROM node:22-slim

ARG ENABLE_GPU=0

# Conditionally add NVIDIA CUDA repository (Debian bookworm)
RUN if [ "$ENABLE_GPU" = "1" ]; then \
      apt-get update && apt-get install -y wget gnupg \
      && wget -q https://developer.download.nvidia.com/compute/cuda/repos/debian12/x86_64/cuda-keyring_1.1-1_all.deb \
      && dpkg -i cuda-keyring_1.1-1_all.deb \
      && rm cuda-keyring_1.1-1_all.deb \
      && apt-get update; \
    fi

# Install system dependencies: browser, build tools, and optionally GPU libraries
RUN apt-get update && apt-get install -y \
    # Chromium and display deps
    chromium \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libgbm1 \
    libnss3 \
    libatk-bridge2.0-0 \
    libgtk-3-0 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libasound2 \
    libpangocairo-1.0-0 \
    libcups2 \
    libdrm2 \
    libxshmfence1 \
    # Build tools
    g++ \
    clang \
    cmake \
    ninja-build \
    pkg-config \
    zip \
    # Python (for codegen, coverage, scripting)
    python3 \
    python3-venv \
    python3-pip \
    # Test/coverage
    lcov \
    # Utilities
    curl \
    jq \
    git \
    socat \
    sudo \
    tmux \
    && rm -rf /var/lib/apt/lists/*

# GPU packages: CUDA toolkit, Vulkan, X11/GL (only when ENABLE_GPU=1)
RUN if [ "$ENABLE_GPU" = "1" ]; then \
      apt-get update && apt-get install -y \
        cuda-toolkit-12-6 \
        libvulkan1 \
        libvulkan-dev \
        libx11-dev \
        libxrandr-dev \
        libgl1-mesa-dev \
      && rm -rf /var/lib/apt/lists/*; \
    fi

# CUDA environment (harmless no-op when GPU not installed)
ENV PATH="/usr/local/cuda-12.6/bin:${PATH}"
ENV LD_LIBRARY_PATH="/usr/local/cuda-12.6/lib64:${LD_LIBRARY_PATH}"

# Allow node user to install packages without password (apt-get only, not dpkg)
RUN echo "node ALL=(ALL) NOPASSWD: /usr/bin/apt-get, /usr/bin/apt" > /etc/sudoers.d/node-apt \
    && chmod 0440 /etc/sudoers.d/node-apt

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
    | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
    | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Set Chromium path for agent-browser
ENV AGENT_BROWSER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Install uv (Python package manager) and claude-code-transcripts
RUN curl -LsSf https://astral.sh/uv/install.sh | env UV_INSTALL_DIR=/usr/local/bin sh \
    && uv tool install --python-preference system claude-code-transcripts \
    && chmod -R a+rX /root /root/.local \
    && ln -sf /root/.local/bin/claude-code-transcripts /usr/local/bin/claude-code-transcripts

# Install agent-browser and claude-code globally
RUN npm install -g agent-browser @anthropic-ai/claude-code

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY agent-runner/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY agent-runner/ ./

# Build TypeScript
RUN npm run build

# Create workspace directories
RUN mkdir -p /workspace/group /workspace/global /workspace/extra /workspace/ipc/messages /workspace/ipc/tasks /workspace/ipc/input

# Create entrypoint script
# Container input (prompt, group info) is passed via stdin JSON.
# Credentials are injected by the host's credential proxy — never passed here.
# Follow-up messages arrive via IPC files in /workspace/ipc/input/
RUN printf '#!/bin/bash\nset -e\n# socat proxy: 127.0.0.1:PORT → host gateway (Claude Code blocks private IPs for HTTP hooks)\nif [ -n "$NANOCLAW_DASHBOARD_PORT" ] && [ -n "$NANOCLAW_HOST_GATEWAY" ]; then\n  socat TCP-LISTEN:${NANOCLAW_DASHBOARD_PORT},fork,reuseaddr,bind=127.0.0.1 TCP:${NANOCLAW_HOST_GATEWAY}:${NANOCLAW_DASHBOARD_PORT} &\nfi\n# Start tmux server so Agent Teams can spawn workers as separate panes\ntmux new-session -d -s nanoclaw 2>/dev/null || true\ncd /app && npx tsc --outDir /tmp/dist 2>&1 >&2\nln -s /app/node_modules /tmp/dist/node_modules\nchmod -R a-w /tmp/dist\ncat > /tmp/input.json\nnode /tmp/dist/index.js < /tmp/input.json\n' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

# Set ownership to node user (non-root) for writable directories
RUN chown -R node:node /workspace && chmod 777 /home/node

# Switch to non-root user (required for --dangerously-skip-permissions)
USER node

# Set working directory to group workspace
WORKDIR /workspace/group

# Entry point reads JSON from stdin, outputs JSON to stdout
ENTRYPOINT ["/app/entrypoint.sh"]
