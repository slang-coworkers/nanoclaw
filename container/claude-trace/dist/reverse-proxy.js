"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReverseProxyServer = void 0;
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const net = __importStar(require("net"));
const tls = __importStar(require("tls"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const html_generator_1 = require("./html-generator");
// Decode HTTP/1.1 chunked transfer-encoding into the raw body, for the LOGGED
// copy only (the client receives the original framed bytes verbatim). Best
// effort: on any malformed framing, fall back to the input so we never lose data.
function dechunkHttpBody(buf) {
    try {
        let offset = 0;
        const out = [];
        while (offset < buf.length) {
            const lineEnd = buf.indexOf("\r\n", offset);
            if (lineEnd === -1)
                break;
            const sizeStr = buf.subarray(offset, lineEnd).toString("latin1").trim().split(";")[0];
            const size = parseInt(sizeStr, 16);
            if (Number.isNaN(size))
                return buf;
            if (size === 0)
                break;
            const dataStart = lineEnd + 2;
            out.push(buf.subarray(dataStart, dataStart + size));
            offset = dataStart + size + 2; // skip data + trailing CRLF
        }
        return out.length ? Buffer.concat(out) : buf;
    }
    catch {
        return buf;
    }
}
class ReverseProxyServer {
    constructor(config = {}) {
        this.server = null;
        this.pairs = [];
        this.config = {
            port: config.port || 0, // 0 = auto-assign
            logDirectory: config.logDirectory || ".claude-trace",
            logBaseName: config.logBaseName || "",
            includeAllRequests: config.includeAllRequests || false,
            openBrowser: config.openBrowser || false,
            logSensitiveHeaders: config.logSensitiveHeaders || false,
        };
        // Resolve the real upstream from the caller's environment. Default to
        // Anthropic if unset, but honor ANTHROPIC_BASE_URL so this works against
        // NVIDIA inference (https://inference-api.nvidia.com), Bedrock, etc.
        const rawBase = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
        let baseUrl;
        try {
            baseUrl = new URL(rawBase);
        }
        catch {
            baseUrl = new URL("https://api.anthropic.com");
        }
        this.targetProtocol = baseUrl.protocol; // "https:" | "http:"
        this.targetHost = baseUrl.hostname;
        this.targetPort = baseUrl.port ? parseInt(baseUrl.port, 10) : baseUrl.protocol === "http:" ? 80 : 443;
        // Honor an outbound proxy (the OneCLI credential-injecting MITM proxy in
        // nanoclaw containers). We tunnel upstream HTTPS through it via CONNECT so
        // the same auth injection the container relies on still happens.
        const proxyEnv = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy || "";
        const noProxy = process.env.NO_PROXY || process.env.no_proxy || "";
        const bypass = noProxy
            .split(",")
            .map((s) => s.trim().toLowerCase())
            .filter(Boolean)
            .some((entry) => this.targetHost.toLowerCase() === entry || this.targetHost.toLowerCase().endsWith(entry));
        if (proxyEnv && !bypass) {
            try {
                const pu = new URL(proxyEnv);
                this.upstreamProxy = {
                    host: pu.hostname,
                    port: pu.port ? parseInt(pu.port, 10) : 80,
                    auth: pu.username ? `${decodeURIComponent(pu.username)}:${decodeURIComponent(pu.password)}` : undefined,
                };
            }
            catch {
                this.upstreamProxy = null;
            }
        }
        else {
            this.upstreamProxy = null;
        }
        // Create log directory if needed
        if (!fs.existsSync(this.config.logDirectory)) {
            fs.mkdirSync(this.config.logDirectory, { recursive: true });
        }
        // Generate filenames
        const fileBaseName = this.config.logBaseName ||
            `log-${new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5)}`;
        this.logFile = path.join(this.config.logDirectory, `${fileBaseName}.jsonl`);
        this.htmlFile = path.join(this.config.logDirectory, `${fileBaseName}.html`);
        // Clear log file
        fs.writeFileSync(this.logFile, "");
        this.htmlGenerator = new html_generator_1.HTMLGenerator();
    }
    processHeaders(headers) {
        const result = {};
        const sensitiveKeys = ["authorization", "x-api-key", "x-auth-token", "cookie", "set-cookie"];
        for (const [key, value] of Object.entries(headers)) {
            if (value === undefined)
                continue;
            const strValue = Array.isArray(value) ? value.join(", ") : value;
            if (this.config.logSensitiveHeaders) {
                result[key] = strValue;
            }
            else {
                const lowerKey = key.toLowerCase();
                if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
                    if (strValue.length > 14) {
                        result[key] = `${strValue.substring(0, 10)}...${strValue.slice(-4)}`;
                    }
                    else if (strValue.length > 4) {
                        result[key] = `${strValue.substring(0, 2)}...${strValue.slice(-2)}`;
                    }
                    else {
                        result[key] = "[REDACTED]";
                    }
                }
                else {
                    result[key] = strValue;
                }
            }
        }
        return result;
    }
    async writePairToLog(pair) {
        try {
            const jsonLine = JSON.stringify(pair) + "\n";
            fs.appendFileSync(this.logFile, jsonLine);
        }
        catch (err) {
            console.error(`Failed to write log: ${err}`);
        }
    }
    async generateHTML() {
        try {
            await this.htmlGenerator.generateHTML(this.pairs, this.htmlFile, {
                title: `${this.pairs.length} API Calls`,
                timestamp: new Date().toISOString().replace("T", " ").slice(0, -5),
                includeAllRequests: this.config.includeAllRequests,
            });
        }
        catch (err) {
            console.error(`Failed to generate HTML: ${err}`);
        }
    }
    async start() {
        // Use plain HTTP to avoid TLS certificate issues with Bun binaries
        // The proxy receives HTTP from Claude, forwards as HTTPS to Anthropic
        return new Promise((resolve, reject) => {
            const httpServer = http.createServer((req, res) => {
                this.handleRequest(req, res);
            });
            this.server = httpServer;
            httpServer.on("error", (err) => {
                reject(err);
            });
            httpServer.listen(this.config.port, "127.0.0.1", () => {
                const address = httpServer.address();
                if (address && typeof address === "object") {
                    const port = address.port;
                    const url = `http://127.0.0.1:${port}`;
                    // stderr, not stdout — the wrapped claude's stdout carries the
                    // SDK stream-json protocol and must stay uncorrupted.
                    console.error(`Forwarding upstream to ${this.targetProtocol}//${this.targetHost}:${this.targetPort}` +
                        (this.upstreamProxy ? ` via proxy ${this.upstreamProxy.host}:${this.upstreamProxy.port}` : ""));
                    console.error(`Logs will be written to:`);
                    console.error(`  JSONL: ${path.resolve(this.logFile)}`);
                    console.error(`  HTML:  ${path.resolve(this.htmlFile)}`);
                    resolve({ port, url });
                }
                else {
                    reject(new Error("Failed to get server address"));
                }
            });
        });
    }
    async recordPair(req, requestTimestamp, responseTimestamp, requestBody, statusCode, responseHeaders, responseBody) {
        const portSuffix = (this.targetProtocol === "https:" && this.targetPort === 443) ||
            (this.targetProtocol === "http:" && this.targetPort === 80)
            ? ""
            : `:${this.targetPort}`;
        const url = `${this.targetProtocol}//${this.targetHost}${portSuffix}${req.url}`;
        const shouldLog = this.config.includeAllRequests || (req.url && req.url.includes("/v1/messages"));
        if (!shouldLog)
            return;
        let parsedRequestBody = null;
        try {
            parsedRequestBody = requestBody ? JSON.parse(requestBody) : null;
        }
        catch {
            parsedRequestBody = requestBody || null;
        }
        if (!this.config.includeAllRequests && parsedRequestBody?.messages) {
            if (parsedRequestBody.messages.length <= 2) {
                return;
            }
        }
        let parsedResponseBody = {};
        const contentType = responseHeaders["content-type"] || "";
        try {
            if (String(contentType).includes("application/json")) {
                parsedResponseBody = { body: JSON.parse(responseBody) };
            }
            else {
                parsedResponseBody = { body_raw: responseBody };
            }
        }
        catch {
            parsedResponseBody = { body_raw: responseBody };
        }
        const pair = {
            request: {
                timestamp: requestTimestamp / 1000,
                method: req.method || "GET",
                url,
                headers: this.processHeaders(req.headers),
                body: parsedRequestBody,
            },
            response: {
                timestamp: responseTimestamp / 1000,
                status_code: statusCode || 0,
                headers: this.processHeaders(responseHeaders),
                ...parsedResponseBody,
            },
            logged_at: new Date().toISOString(),
        };
        this.pairs.push(pair);
        await this.writePairToLog(pair);
        await this.generateHTML();
    }
    forwardViaManualProxy(req, res, requestBody, requestTimestamp) {
        const proxy = this.upstreamProxy;
        const fail = (err) => {
            console.error(`Proxy request error: ${err.message}`);
            if (!res.headersSent) {
                res.writeHead(502);
                res.end(`Proxy error: ${err.message}`);
            }
            else {
                res.destroy(err);
            }
        };
        const socket = net.connect(proxy.port, proxy.host, () => {
            const connectHeaders = [
                `CONNECT ${this.targetHost}:${this.targetPort} HTTP/1.1`,
                `Host: ${this.targetHost}:${this.targetPort}`,
            ];
            if (proxy.auth) {
                connectHeaders.push(`Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString("base64")}`);
            }
            socket.write(connectHeaders.join("\r\n") + "\r\n\r\n");
        });
        let connectBuffer = Buffer.alloc(0);
        let connected = false;
        let tlsSocket = null;
        const onConnectData = (chunk) => {
            connectBuffer = Buffer.concat([connectBuffer, chunk]);
            const idx = connectBuffer.indexOf("\r\n\r\n");
            if (idx === -1)
                return;
            socket.removeListener("data", onConnectData);
            const headerText = connectBuffer.subarray(0, idx).toString("latin1");
            const statusLine = headerText.split("\r\n")[0] || "";
            if (!/ 200 /.test(statusLine)) {
                socket.destroy();
                fail(new Error(`Upstream proxy CONNECT failed: ${statusLine}`));
                return;
            }
            connected = true;
            tlsSocket = tls.connect({ socket, servername: this.targetHost, ALPNProtocols: ["http/1.1"] }, () => {
                const hostHeader = (this.targetProtocol === "https:" && this.targetPort === 443) ||
                    (this.targetProtocol === "http:" && this.targetPort === 80)
                    ? this.targetHost
                    : `${this.targetHost}:${this.targetPort}`;
                const lines = [`${req.method || "GET"} ${req.url || "/"} HTTP/1.1`, `Host: ${hostHeader}`, "Connection: close"];
                const seen = new Set(["host", "connection", "proxy-connection"]);
                for (const [key, value] of Object.entries(req.headers)) {
                    const lower = key.toLowerCase();
                    if (seen.has(lower) || value === undefined)
                        continue;
                    seen.add(lower);
                    if (Array.isArray(value)) {
                        for (const item of value)
                            lines.push(`${key}: ${item}`);
                    }
                    else {
                        lines.push(`${key}: ${value}`);
                    }
                }
                if (requestBody && !seen.has("content-length")) {
                    lines.push(`Content-Length: ${Buffer.byteLength(requestBody)}`);
                }
                tlsSocket.write(lines.join("\r\n") + "\r\n\r\n");
                if (requestBody)
                    tlsSocket.write(requestBody);
            });
            // Relay the upstream response to the client VERBATIM at the socket
            // level. Do NOT re-emit through res.writeHead/res.write: streaming
            // SDK calls return `transfer-encoding: chunked` text/event-stream,
            // and Node's ServerResponse would re-apply chunk framing to the
            // already-framed bytes (double-chunked → the SDK fails with
            // "JSON Parse error"). Writing raw preserves upstream framing exactly.
            const clientSocket = res.socket;
            let rawResponse = Buffer.alloc(0);
            let headerParsed = false;
            let headerEndIdx = -1;
            let responseTimestamp = Date.now();
            let statusCode = 0;
            const responseHeaders = {};
            tlsSocket.on("data", (data) => {
                if (clientSocket && !clientSocket.destroyed)
                    clientSocket.write(data);
                rawResponse = Buffer.concat([rawResponse, data]);
                if (!headerParsed) {
                    const he = rawResponse.indexOf("\r\n\r\n");
                    if (he === -1)
                        return;
                    headerParsed = true;
                    headerEndIdx = he + 4;
                    responseTimestamp = Date.now();
                    const rawHeaders = rawResponse.subarray(0, he).toString("latin1").split("\r\n");
                    const statusLine = rawHeaders.shift() || "";
                    statusCode = Number(statusLine.split(/\s+/)[1]) || 0;
                    for (const line of rawHeaders) {
                        const colon = line.indexOf(":");
                        if (colon <= 0)
                            continue;
                        const key = line.slice(0, colon).trim().toLowerCase();
                        const value = line.slice(colon + 1).trim();
                        if (responseHeaders[key] === undefined) {
                            responseHeaders[key] = value;
                        }
                        else if (Array.isArray(responseHeaders[key])) {
                            responseHeaders[key].push(value);
                        }
                        else {
                            responseHeaders[key] = [responseHeaders[key], value];
                        }
                    }
                }
            });
            tlsSocket.on("end", () => {
                if (clientSocket && !clientSocket.destroyed)
                    clientSocket.end();
                let bodyBuf = headerEndIdx >= 0 ? rawResponse.subarray(headerEndIdx) : Buffer.alloc(0);
                const te = responseHeaders["transfer-encoding"];
                if (te && String(te).toLowerCase().includes("chunked"))
                    bodyBuf = dechunkHttpBody(bodyBuf);
                void this.recordPair(req, requestTimestamp, responseTimestamp, requestBody, statusCode, responseHeaders, bodyBuf.toString("utf8"));
            });
            tlsSocket.on("error", fail);
        };
        socket.on("data", onConnectData);
        socket.on("error", (err) => {
            if (!connected)
                fail(err);
        });
    }
    handleRequest(req, res) {
        const requestTimestamp = Date.now();
        // FIX (2026-08-24): was `let requestBody = ""; req.on("data", chunk =>
        // requestBody += chunk)` — each Buffer chunk got implicitly .toString()'d
        // in isolation, so a multi-byte UTF-8 character straddling a TCP chunk
        // boundary silently dropped bytes. Accumulate raw Buffers and convert
        // ONCE on the complete body instead (matches this file's own convention
        // elsewhere, e.g. rawResponse/connectBuffer below).
        const requestBodyChunks = [];
        req.on("data", (chunk) => {
            requestBodyChunks.push(chunk);
        });
        req.on("end", () => {
            const requestBodyBuffer = Buffer.concat(requestBodyChunks);
            const requestBody = requestBodyBuffer.toString("utf8");
            if (this.upstreamProxy) {
                this.forwardViaManualProxy(req, res, requestBody, requestTimestamp);
                return;
            }
            // Forward the request to the real upstream (Anthropic / NVIDIA /
            // Bedrock — whatever ANTHROPIC_BASE_URL pointed at).
            const options = {
                hostname: this.targetHost,
                port: this.targetPort,
                path: req.url,
                method: req.method,
                headers: {
                    ...req.headers,
                    host: this.targetHost,
                },
            };
            // Stopgap: assert the body we're about to forward actually matches
            // the Content-Length we're forwarding (copied from the original
            // request headers above). A mismatch here means something upstream
            // of this point corrupted the body — better to fail loudly than
            // silently send a request the far end will reject anyway.
            const declaredLength = Number(req.headers["content-length"]);
            const actualLength = Buffer.byteLength(requestBody, "utf8");
            if (Number.isFinite(declaredLength) && declaredLength !== actualLength) {
                console.error(`Body length mismatch: Content-Length=${declaredLength} actual=${actualLength} — rejecting rather than forwarding a corrupt request`);
                res.writeHead(502);
                res.end("Proxy error: body length mismatch before forwarding");
                return;
            }
            // When an outbound proxy is configured (OneCLI), open a CONNECT
            // tunnel to it and run TLS to the real host over that socket, so the
            // proxy performs its usual credential injection. Otherwise connect
            // to the upstream directly.
            if (this.upstreamProxy) {
                options.agent = false;
                options.createConnection = ((_opts, cb) => {
                    const proxy = this.upstreamProxy;
                    const connectHeaders = [
                        `CONNECT ${this.targetHost}:${this.targetPort} HTTP/1.1`,
                        `Host: ${this.targetHost}:${this.targetPort}`,
                    ];
                    if (proxy.auth) {
                        connectHeaders.push(`Proxy-Authorization: Basic ${Buffer.from(proxy.auth).toString("base64")}`);
                    }
                    const socket = net.connect(proxy.port, proxy.host, () => {
                        socket.write(connectHeaders.join("\r\n") + "\r\n\r\n");
                    });
                    let established = false;
                    let banner = "";
                    const onData = (chunk) => {
                        banner += chunk.toString("binary");
                        const idx = banner.indexOf("\r\n\r\n");
                        if (idx === -1)
                            return;
                        socket.removeListener("data", onData);
                        const statusLine = banner.slice(0, banner.indexOf("\r\n"));
                        if (!/ 200 /.test(statusLine)) {
                            cb(new Error(`Upstream proxy CONNECT failed: ${statusLine}`));
                            socket.destroy();
                            return;
                        }
                        established = true;
                        const tlsSocket = tls.connect({ socket, servername: this.targetHost }, () => cb(null, tlsSocket));
                        tlsSocket.on("error", (e) => {
                            if (!established)
                                cb(e);
                        });
                    };
                    socket.on("data", onData);
                    socket.on("error", (e) => {
                        if (!established)
                            cb(e);
                    });
                });
            }
            const proxyReq = https.request(options, (proxyRes) => {
                const responseTimestamp = Date.now();
                let responseBody = "";
                proxyRes.on("data", (chunk) => {
                    responseBody += chunk;
                    res.write(chunk);
                });
                proxyRes.on("end", async () => {
                    res.end();
                    // Check if this is a request we should log
                    const portSuffix = (this.targetProtocol === "https:" && this.targetPort === 443) ||
                        (this.targetProtocol === "http:" && this.targetPort === 80)
                        ? ""
                        : `:${this.targetPort}`;
                    const url = `${this.targetProtocol}//${this.targetHost}${portSuffix}${req.url}`;
                    const shouldLog = this.config.includeAllRequests || (req.url && req.url.includes("/v1/messages"));
                    if (shouldLog) {
                        // Parse request body
                        let parsedRequestBody = null;
                        try {
                            parsedRequestBody = requestBody ? JSON.parse(requestBody) : null;
                        }
                        catch {
                            parsedRequestBody = requestBody || null;
                        }
                        // Check message count filter (only log if > 2 messages)
                        if (!this.config.includeAllRequests && parsedRequestBody?.messages) {
                            if (parsedRequestBody.messages.length <= 2) {
                                return;
                            }
                        }
                        // Parse response body
                        let parsedResponseBody = {};
                        const contentType = proxyRes.headers["content-type"] || "";
                        try {
                            if (contentType.includes("application/json")) {
                                parsedResponseBody = { body: JSON.parse(responseBody) };
                            }
                            else {
                                parsedResponseBody = { body_raw: responseBody };
                            }
                        }
                        catch {
                            parsedResponseBody = { body_raw: responseBody };
                        }
                        const pair = {
                            request: {
                                timestamp: requestTimestamp / 1000,
                                method: req.method || "GET",
                                url: url,
                                headers: this.processHeaders(req.headers),
                                body: parsedRequestBody,
                            },
                            response: {
                                timestamp: responseTimestamp / 1000,
                                status_code: proxyRes.statusCode || 0,
                                headers: this.processHeaders(proxyRes.headers),
                                ...parsedResponseBody,
                            },
                            logged_at: new Date().toISOString(),
                        };
                        this.pairs.push(pair);
                        await this.writePairToLog(pair);
                        await this.generateHTML();
                    }
                });
                // Forward response headers
                res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            });
            proxyReq.on("error", (err) => {
                console.error(`Proxy request error: ${err.message}`);
                res.writeHead(502);
                res.end(`Proxy error: ${err.message}`);
            });
            // Forward request body
            if (requestBody) {
                proxyReq.write(requestBody);
            }
            proxyReq.end();
        });
    }
    stop() {
        if (this.server) {
            console.error(`Logged ${this.pairs.length} request/response pairs`);
            // Open browser if requested
            if (this.config.openBrowser && fs.existsSync(this.htmlFile)) {
                try {
                    const { spawn } = require("child_process");
                    const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
                    spawn(cmd, [this.htmlFile], { detached: true, stdio: "ignore" }).unref();
                    console.error(`Opening ${this.htmlFile} in browser`);
                }
                catch (err) {
                    console.error(`Failed to open browser: ${err}`);
                }
            }
            this.server.close();
            this.server = null;
        }
    }
}
exports.ReverseProxyServer = ReverseProxyServer;
//# sourceMappingURL=reverse-proxy.js.map
