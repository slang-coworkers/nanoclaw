"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClaudeTrafficLogger = void 0;
exports.initializeInterceptor = initializeInterceptor;
exports.getLogger = getLogger;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const html_generator_1 = require("./html-generator");
// Target domains to intercept
const TARGET_DOMAINS = ["anthropic.com", "nvidia.com", "aws.com"];
class ClaudeTrafficLogger {
    constructor(config = {}) {
        this.pendingRequests = new Map();
        this.pairs = [];
        this.config = {
            logDirectory: ".claude-trace",
            enableRealTimeHTML: true,
            logLevel: "info",
            ...config,
        };
        // Create log directory if it doesn't exist
        this.logDir = this.config.logDirectory;
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
        // Generate filenames based on custom name or timestamp
        const logBaseName = config?.logBaseName || process.env.CLAUDE_TRACE_LOG_NAME;
        const fileBaseName = logBaseName || `log-${new Date().toISOString().replace(/[:.]/g, "-").replace("T", "-").slice(0, -5)}`; // Remove milliseconds and Z
        this.logFile = path_1.default.join(this.logDir, `${fileBaseName}.jsonl`);
        this.htmlFile = path_1.default.join(this.logDir, `${fileBaseName}.html`);
        // Initialize HTML generator
        this.htmlGenerator = new html_generator_1.HTMLGenerator();
        // Clear log file
        fs_1.default.writeFileSync(this.logFile, "");
        // Output the actual filenames with absolute paths
        console.log(`Logs will be written to:`);
        console.log(`  JSONL: ${path_1.default.resolve(this.logFile)}`);
        console.log(`  HTML:  ${path_1.default.resolve(this.htmlFile)}`);
    }
    isTargetAPI(url) {
        const urlString = typeof url === "string" ? url : url.toString();
        const includeAllRequests = process.env.CLAUDE_TRACE_INCLUDE_ALL_REQUESTS === "true";
        // Check if URL matches any target domain
        const matchesTargetDomain = TARGET_DOMAINS.some((domain) => urlString.includes(domain));
        if (!matchesTargetDomain) {
            return false;
        }
        if (includeAllRequests) {
            return true; // Capture all requests to target domains
        }
        // For filtered mode, check for API endpoints on any target domain
        const hasAPIEndpoint = urlString.includes("/v1/messages") || // Anthropic direct API
            urlString.includes("/model/") || // AWS Bedrock
            urlString.includes("/llm/"); // NVIDIA API
        return matchesTargetDomain && hasAPIEndpoint;
    }
    generateRequestId() {
        return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }
    redactSensitiveHeaders(headers) {
        const redactedHeaders = { ...headers };
        const sensitiveKeys = [
            "authorization",
            "x-api-key",
            "x-auth-token",
            "cookie",
            "set-cookie",
            "x-session-token",
            "x-access-token",
            "bearer",
            "proxy-authorization",
        ];
        for (const key of Object.keys(redactedHeaders)) {
            const lowerKey = key.toLowerCase();
            if (sensitiveKeys.some((sensitive) => lowerKey.includes(sensitive))) {
                // Keep first 10 chars and last 4 chars, redact middle
                const value = redactedHeaders[key];
                if (value && value.length > 14) {
                    redactedHeaders[key] = `${value.substring(0, 10)}...${value.slice(-4)}`;
                }
                else if (value && value.length > 4) {
                    redactedHeaders[key] = `${value.substring(0, 2)}...${value.slice(-2)}`;
                }
                else {
                    redactedHeaders[key] = "[REDACTED]";
                }
            }
        }
        return redactedHeaders;
    }
    async cloneResponse(response) {
        // Clone the response to avoid consuming the body
        return response.clone();
    }
    parseEventStreamBinary(bodyRaw) {
        const events = [];
        try {
            // Convert string back to binary data
            const binaryData = new Uint8Array(bodyRaw.length);
            for (let i = 0; i < bodyRaw.length; i++) {
                binaryData[i] = bodyRaw.charCodeAt(i);
            }
            let offset = 0;
            while (offset < binaryData.length) {
                // AWS EventStream message format:
                // [total_length:4][headers_length:4][prelude_crc:4][headers][payload][message_crc:4]
                if (offset + 12 > binaryData.length)
                    break;
                const totalLength = new DataView(binaryData.buffer, offset, 4).getUint32(0);
                const headersLength = new DataView(binaryData.buffer, offset + 4, 4).getUint32(0);
                // Validate message boundaries
                if (offset + totalLength > binaryData.length || totalLength < 16) {
                    throw new Error(`Invalid message boundaries at offset ${offset}`);
                }
                // Skip prelude CRC (4 bytes)
                const headersStart = offset + 12;
                const payloadStart = headersStart + headersLength;
                const payloadLength = totalLength - headersLength - 16; // 12 byte prelude + 4 byte message CRC
                if (payloadLength > 0 && payloadStart + payloadLength <= binaryData.length) {
                    const payloadBytes = binaryData.slice(payloadStart, payloadStart + payloadLength);
                    const payloadText = new TextDecoder("utf-8").decode(payloadBytes);
                    try {
                        const payload = JSON.parse(payloadText);
                        if (payload.bytes) {
                            // Decode the base64 bytes to get actual event
                            const eventJson = Buffer.from(payload.bytes, "base64").toString("utf-8");
                            const event = JSON.parse(eventJson);
                            events.push(event);
                        }
                    }
                    catch (e) {
                        // Skip malformed payloads but continue parsing
                    }
                }
                offset += totalLength;
            }
            return events;
        }
        catch (error) {
            // Binary parsing failed, will fall back to regex
            throw new Error(`Binary parsing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    parseBedrockStreamingResponse(bodyRaw) {
        try {
            let events = [];
            let parsingMethod = "";
            // Try binary parsing first
            try {
                events = this.parseEventStreamBinary(bodyRaw);
                parsingMethod = "binary";
                if (process.env.CLAUDE_TRACE_DEBUG) {
                    console.log(`✅ Binary parsing succeeded: ${events.length} events`);
                }
            }
            catch (binaryError) {
                if (process.env.CLAUDE_TRACE_DEBUG) {
                    console.log(`❌ Binary parsing failed: ${binaryError instanceof Error ? binaryError.message : String(binaryError)}`);
                    console.log(`🔄 Falling back to regex parsing...`);
                }
                // Fallback to regex parsing
                try {
                    events = this.parseEventStreamRegex(bodyRaw);
                    parsingMethod = "regex";
                    if (process.env.CLAUDE_TRACE_DEBUG) {
                        console.log(`✅ Regex parsing succeeded: ${events.length} events`);
                    }
                }
                catch (regexError) {
                    if (process.env.CLAUDE_TRACE_DEBUG) {
                        console.log(`❌ Both parsing methods failed`);
                    }
                    return null;
                }
            }
            // ... rest of the method remains the same
            if (events.length === 0) {
                return null;
            }
            // Add parsing method to logs for analysis
            if (process.env.CLAUDE_TRACE_DEBUG) {
                console.log(`🎯 Using ${parsingMethod} parsing for ${events.length} events`);
            }
            // Process events to build response (same logic as before)
            let messageStart = null;
            let usage = null;
            let toolBlocks = [];
            let textBlocks = [];
            // Track partial JSON for tool use
            const toolInputBuilders = new Map();
            for (const event of events) {
                switch (event.type) {
                    case "message_start":
                        messageStart = event.message;
                        break;
                    case "message_delta":
                        if (event.usage) {
                            usage = { ...usage, ...event.usage };
                        }
                        break;
                    case "content_block_start":
                        if (event.content_block?.type === "tool_use") {
                            toolBlocks[event.index] = {
                                id: event.content_block.id,
                                name: event.content_block.name,
                                input: {},
                            };
                            toolInputBuilders.set(event.index, "");
                        }
                        else if (event.content_block?.type === "text") {
                            textBlocks[event.index] = { text: "" };
                        }
                        break;
                    case "content_block_delta":
                        const index = event.index || 0;
                        if (event.delta?.type === "input_json_delta") {
                            const currentJson = toolInputBuilders.get(index) || "";
                            const newJson = currentJson + (event.delta.partial_json || "");
                            toolInputBuilders.set(index, newJson);
                        }
                        else if (event.delta?.text) {
                            if (!textBlocks[index]) {
                                textBlocks[index] = { text: "" };
                            }
                            textBlocks[index].text += event.delta.text;
                        }
                        break;
                    case "content_block_stop":
                        const stopIndex = event.index || 0;
                        if (toolInputBuilders.has(stopIndex)) {
                            const jsonString = toolInputBuilders.get(stopIndex);
                            try {
                                if (toolBlocks[stopIndex] && jsonString) {
                                    toolBlocks[stopIndex].input = JSON.parse(jsonString);
                                }
                            }
                            catch (e) {
                                if (toolBlocks[stopIndex]) {
                                    toolBlocks[stopIndex].input = {};
                                }
                            }
                            toolInputBuilders.delete(stopIndex);
                        }
                        break;
                }
            }
            // Build final content array
            const content = [];
            textBlocks.forEach((block) => {
                if (block && block.text) {
                    content.push({
                        type: "text",
                        text: block.text,
                    });
                }
            });
            toolBlocks.forEach((block) => {
                if (block && block.id) {
                    content.push({
                        type: "tool_use",
                        id: block.id,
                        name: block.name,
                        input: block.input,
                    });
                }
            });
            const response = {
                id: messageStart?.id || "",
                type: "message",
                role: "assistant",
                model: messageStart?.model || "",
                content: content,
                stop_reason: "end_turn",
                stop_sequence: null,
                usage: usage || messageStart?.usage || null,
            };
            // Add parsing method metadata for analysis
            if (process.env.CLAUDE_TRACE_DEBUG) {
                response._parsing_method = parsingMethod;
            }
            return response;
        }
        catch (error) {
            if (process.env.CLAUDE_TRACE_DEBUG) {
                console.log(`[INTERCEPTOR] Bedrock parsing failed: ${error instanceof Error ? error.message : String(error)}`);
            }
            return null;
        }
    }
    /**
     * Parse EventStream using regex to extract base64-encoded events (fallback)
     */
    parseEventStreamRegex(bodyRaw) {
        const events = [];
        const base64Pattern = /"bytes"\s*:\s*"([^"]+)"/g;
        let match;
        while ((match = base64Pattern.exec(bodyRaw)) !== null) {
            try {
                const base64Data = match[1];
                const decoded = Buffer.from(base64Data, "base64").toString("utf-8");
                const event = JSON.parse(decoded);
                events.push(event);
            }
            catch (e) {
                continue;
            }
        }
        return events;
    }
    async parseRequestBody(body) {
        if (!body)
            return null;
        if (typeof body === "string") {
            try {
                return JSON.parse(body);
            }
            catch {
                return body;
            }
        }
        if (body instanceof FormData) {
            const formObject = {};
            for (const [key, value] of body.entries()) {
                formObject[key] = value;
            }
            return formObject;
        }
        return body;
    }
    async parseResponseBody(response) {
        const contentType = response.headers.get("content-type") || "";
        try {
            if (contentType.includes("application/json")) {
                const body = await response.json();
                return { body };
            }
            else if (contentType.includes("text/event-stream")) {
                const body_raw = await response.text();
                return { body_raw };
            }
            else if (contentType.includes("application/vnd.amazon.eventstream")) {
                // Amazon Event Stream - parse immediately in interceptor
                const body_raw = await response.text();
                const parsedMessage = this.parseBedrockStreamingResponse(body_raw);
                if (parsedMessage) {
                    // Return clean JSON instead of raw binary
                    return { body: parsedMessage };
                }
                else {
                    // Fallback: keep raw data for frontend parsing
                    return { body_raw };
                }
            }
            else if (contentType.includes("text/")) {
                const body_raw = await response.text();
                return { body_raw };
            }
            else {
                // For other types, try to read as text
                const body_raw = await response.text();
                return { body_raw };
            }
        }
        catch (error) {
            // Silent error handling during runtime
            return {};
        }
    }
    instrumentAll() {
        this.instrumentFetch();
        this.instrumentNodeHTTP();
    }
    instrumentFetch() {
        if (!global.fetch) {
            // Silent - fetch not available
            return;
        }
        // Check if already instrumented by checking for our marker
        if (global.fetch.__claudeTraceInstrumented) {
            return;
        }
        const originalFetch = global.fetch;
        const logger = this;
        global.fetch = async function (input, init = {}) {
            // Convert input to URL for consistency
            const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
            // Only intercept target API calls
            if (!logger.isTargetAPI(url)) {
                return originalFetch(input, init);
            }
            const requestId = logger.generateRequestId();
            const requestTimestamp = Date.now();
            // Capture request details
            const requestData = {
                timestamp: requestTimestamp / 1000, // Convert to seconds (like Python version)
                method: init.method || "GET",
                url: url,
                headers: logger.redactSensitiveHeaders(Object.fromEntries(new Headers(init.headers || {}).entries())),
                body: await logger.parseRequestBody(init.body),
            };
            // Store pending request
            logger.pendingRequests.set(requestId, requestData);
            try {
                // Make the actual request
                const response = await originalFetch(input, init);
                const responseTimestamp = Date.now();
                // Clone response to avoid consuming the body
                const clonedResponse = await logger.cloneResponse(response);
                // Parse response body
                const responseBodyData = await logger.parseResponseBody(clonedResponse);
                // Create response data
                const responseData = {
                    timestamp: responseTimestamp / 1000,
                    status_code: response.status,
                    headers: logger.redactSensitiveHeaders(Object.fromEntries(response.headers.entries())),
                    ...responseBodyData,
                };
                // Create paired request-response object
                const pair = {
                    request: requestData,
                    response: responseData,
                    logged_at: new Date().toISOString(),
                };
                // Remove from pending and add to pairs
                logger.pendingRequests.delete(requestId);
                logger.pairs.push(pair);
                // Write to log file
                await logger.writePairToLog(pair);
                // Generate HTML if enabled
                if (logger.config.enableRealTimeHTML) {
                    await logger.generateHTML();
                }
                return response;
            }
            catch (error) {
                // Remove from pending requests on error
                logger.pendingRequests.delete(requestId);
                throw error;
            }
        };
        // Mark fetch as instrumented
        global.fetch.__claudeTraceInstrumented = true;
        // Silent initialization
    }
    instrumentNodeHTTP() {
        try {
            const http = require("http");
            const https = require("https");
            const logger = this;
            // Instrument http.request
            if (http.request && !http.request.__claudeTraceInstrumented) {
                const originalHttpRequest = http.request;
                http.request = function (options, callback) {
                    return logger.interceptNodeRequest(originalHttpRequest, options, callback, false);
                };
                http.request.__claudeTraceInstrumented = true;
            }
            // Instrument http.get
            if (http.get && !http.get.__claudeTraceInstrumented) {
                const originalHttpGet = http.get;
                http.get = function (options, callback) {
                    return logger.interceptNodeRequest(originalHttpGet, options, callback, false);
                };
                http.get.__claudeTraceInstrumented = true;
            }
            // Instrument https.request
            if (https.request && !https.request.__claudeTraceInstrumented) {
                const originalHttpsRequest = https.request;
                https.request = function (options, callback) {
                    return logger.interceptNodeRequest(originalHttpsRequest, options, callback, true);
                };
                https.request.__claudeTraceInstrumented = true;
            }
            // Instrument https.get
            if (https.get && !https.get.__claudeTraceInstrumented) {
                const originalHttpsGet = https.get;
                https.get = function (options, callback) {
                    return logger.interceptNodeRequest(originalHttpsGet, options, callback, true);
                };
                https.get.__claudeTraceInstrumented = true;
            }
        }
        catch (error) {
            // Silent error handling
        }
    }
    interceptNodeRequest(originalRequest, options, callback, isHttps) {
        // Parse URL from options
        const url = this.parseNodeRequestURL(options, isHttps);
        if (!this.isTargetAPI(url)) {
            return originalRequest.call(this, options, callback);
        }
        const requestId = this.generateRequestId();
        const requestTimestamp = Date.now();
        let requestBody = "";
        // Create the request
        const req = originalRequest.call(this, options, (res) => {
            const responseTimestamp = Date.now();
            let responseBody = "";
            // Capture response data
            res.on("data", (chunk) => {
                responseBody += chunk;
            });
            res.on("end", async () => {
                // Process the captured request/response
                const requestData = {
                    timestamp: requestTimestamp / 1000,
                    method: options.method || "GET",
                    url: url,
                    headers: this.redactSensitiveHeaders(options.headers || {}),
                    body: requestBody ? await this.parseRequestBody(requestBody) : null,
                };
                const responseData = {
                    timestamp: responseTimestamp / 1000,
                    status_code: res.statusCode,
                    headers: this.redactSensitiveHeaders(res.headers || {}),
                    ...(await this.parseResponseBodyFromString(responseBody, res.headers["content-type"])),
                };
                const pair = {
                    request: requestData,
                    response: responseData,
                    logged_at: new Date().toISOString(),
                };
                this.pairs.push(pair);
                await this.writePairToLog(pair);
                if (this.config.enableRealTimeHTML) {
                    await this.generateHTML();
                }
            });
            // Call original callback if provided
            if (callback) {
                callback(res);
            }
        });
        // Capture request body
        const originalWrite = req.write;
        req.write = function (chunk) {
            if (chunk) {
                requestBody += chunk;
            }
            return originalWrite.call(this, chunk);
        };
        return req;
    }
    parseNodeRequestURL(options, isHttps) {
        if (typeof options === "string") {
            return options;
        }
        const protocol = isHttps ? "https:" : "http:";
        const hostname = options.hostname || options.host || "localhost";
        const port = options.port ? `:${options.port}` : "";
        const path = options.path || "/";
        return `${protocol}//${hostname}${port}${path}`;
    }
    async parseResponseBodyFromString(body, contentType) {
        try {
            if (contentType && contentType.includes("application/json")) {
                return { body: JSON.parse(body) };
            }
            else if (contentType && contentType.includes("text/event-stream")) {
                return { body_raw: body };
            }
            else {
                return { body_raw: body };
            }
        }
        catch (error) {
            return { body_raw: body };
        }
    }
    async writePairToLog(pair) {
        try {
            const jsonLine = JSON.stringify(pair) + "\n";
            fs_1.default.appendFileSync(this.logFile, jsonLine);
        }
        catch (error) {
            // Silent error handling during runtime
        }
    }
    async generateHTML() {
        try {
            const includeAllRequests = process.env.CLAUDE_TRACE_INCLUDE_ALL_REQUESTS === "true";
            await this.htmlGenerator.generateHTML(this.pairs, this.htmlFile, {
                title: `${this.pairs.length} API Calls`,
                timestamp: new Date().toISOString().replace("T", " ").slice(0, -5),
                includeAllRequests,
            });
            // Silent HTML generation
        }
        catch (error) {
            // Silent error handling during runtime
        }
    }
    cleanup() {
        console.log("Cleaning up orphaned requests...");
        for (const [, requestData] of this.pendingRequests.entries()) {
            const orphanedPair = {
                request: requestData,
                response: null,
                note: "ORPHANED_REQUEST - No matching response received",
                logged_at: new Date().toISOString(),
            };
            try {
                const jsonLine = JSON.stringify(orphanedPair) + "\n";
                fs_1.default.appendFileSync(this.logFile, jsonLine);
            }
            catch (error) {
                console.log(`Error writing orphaned request: ${error}`);
            }
        }
        this.pendingRequests.clear();
        console.log(`Cleanup complete. Logged ${this.pairs.length} pairs`);
        // Open browser if requested
        const shouldOpenBrowser = process.env.CLAUDE_TRACE_OPEN_BROWSER === "true";
        if (shouldOpenBrowser && fs_1.default.existsSync(this.htmlFile)) {
            try {
                (0, child_process_1.spawn)("open", [this.htmlFile], { detached: true, stdio: "ignore" }).unref();
                console.log(`Opening ${this.htmlFile} in browser`);
            }
            catch (error) {
                console.log(`Failed to open browser: ${error}`);
            }
        }
    }
    getStats() {
        return {
            totalPairs: this.pairs.length,
            pendingRequests: this.pendingRequests.size,
            logFile: this.logFile,
            htmlFile: this.htmlFile,
        };
    }
}
exports.ClaudeTrafficLogger = ClaudeTrafficLogger;
// Global logger instance
let globalLogger = null;
// Track if event listeners have been set up
let eventListenersSetup = false;
function initializeInterceptor(config) {
    if (globalLogger) {
        console.warn("Interceptor already initialized");
        return globalLogger;
    }
    globalLogger = new ClaudeTrafficLogger(config);
    globalLogger.instrumentAll();
    // Setup cleanup on process exit only once
    if (!eventListenersSetup) {
        const cleanup = () => {
            if (globalLogger) {
                globalLogger.cleanup();
            }
        };
        process.on("exit", cleanup);
        process.on("SIGINT", cleanup);
        process.on("SIGTERM", cleanup);
        process.on("uncaughtException", (error) => {
            console.error("Uncaught exception:", error);
            cleanup();
            process.exit(1);
        });
        eventListenersSetup = true;
    }
    return globalLogger;
}
function getLogger() {
    return globalLogger;
}
//# sourceMappingURL=interceptor.js.map