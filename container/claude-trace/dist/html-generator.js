"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLGenerator = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class HTMLGenerator {
    constructor() {
        this.frontendDir = path_1.default.join(__dirname, "..", "frontend");
        this.templatePath = path_1.default.join(this.frontendDir, "template.html");
        this.bundlePath = path_1.default.join(this.frontendDir, "dist", "index.global.js");
    }
    ensureFrontendBuilt() {
        if (!fs_1.default.existsSync(this.bundlePath)) {
            throw new Error(`Frontend bundle not found at ${this.bundlePath}. ` + `Run 'npm run build' in frontend directory first.`);
        }
    }
    loadTemplateFiles() {
        this.ensureFrontendBuilt();
        const htmlTemplate = fs_1.default.readFileSync(this.templatePath, "utf-8");
        const jsBundle = fs_1.default.readFileSync(this.bundlePath, "utf-8");
        return { htmlTemplate, jsBundle };
    }
    filterClaudeAPIPairs(pairs) {
        return pairs.filter((pair) => {
            const url = pair.request.url;
            // Include both Anthropic API and Bedrock API calls
            return url.includes("/v1/messages") || url.includes("bedrock-runtime.amazonaws.com");
        });
    }
    filterShortConversations(pairs) {
        return pairs.filter((pair) => {
            const messages = pair.request?.body?.messages;
            if (!Array.isArray(messages))
                return true;
            return messages.length > 2;
        });
    }
    prepareDataForInjection(data) {
        const claudeData = {
            rawPairs: data.rawPairs,
            timestamp: data.timestamp,
            metadata: {
                includeAllRequests: data.includeAllRequests || false,
            },
        };
        // Convert to JSON with minimal whitespace
        const dataJson = JSON.stringify(claudeData, null, 0);
        // Base64 encode to avoid all escaping issues
        return Buffer.from(dataJson, "utf-8").toString("base64");
    }
    escapeHtml(text) {
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    async generateHTML(pairs, outputFile, options = {}) {
        try {
            let filteredPairs = pairs;
            // Remove filtering entirely - show all data
            // Previously filtered to only include v1/messages pairs with messages.length >= 2
            // but this was too aggressive and excluded valid data
            // Load template and bundle files
            const { htmlTemplate, jsBundle } = this.loadTemplateFiles();
            // Prepare data for injection
            const htmlData = {
                rawPairs: filteredPairs,
                timestamp: options.timestamp || new Date().toISOString().replace("T", " ").slice(0, -5),
                includeAllRequests: options.includeAllRequests || false,
            };
            const dataJsonEscaped = this.prepareDataForInjection(htmlData);
            // BIZARRE BUT NECESSARY: Use split() instead of replace() for bundle injection
            //
            // Why this weird approach? Using replace instead of split() for some reason duplicates
            // the htmlTemplate itself inside the new string! Maybe a bug in Node's String.replace?
            const templateParts = htmlTemplate.split("__CLAUDE_LOGGER_BUNDLE_REPLACEMENT_UNIQUE_9487__");
            if (templateParts.length !== 2) {
                throw new Error("Template bundle replacement marker not found or found multiple times");
            }
            // Reconstruct the template with the bundle injected between the split parts
            let htmlContent = templateParts[0] + jsBundle + templateParts[1];
            htmlContent = htmlContent
                .replace("__CLAUDE_LOGGER_DATA_REPLACEMENT_UNIQUE_9487__", dataJsonEscaped)
                .replace("__CLAUDE_LOGGER_TITLE_REPLACEMENT_UNIQUE_9487__", this.escapeHtml(options.title || `${filteredPairs.length} API Calls`));
            // Ensure output directory exists
            const outputDir = path_1.default.dirname(outputFile);
            if (!fs_1.default.existsSync(outputDir)) {
                fs_1.default.mkdirSync(outputDir, { recursive: true });
            }
            // Write HTML file
            fs_1.default.writeFileSync(outputFile, htmlContent, "utf-8");
        }
        catch (error) {
            console.error(`Error generating HTML: ${error}`);
            throw error;
        }
    }
    async generateHTMLFromJSONL(jsonlFile, outputFile, includeAllRequests = true) {
        if (!fs_1.default.existsSync(jsonlFile)) {
            throw new Error(`File '${jsonlFile}' not found.`);
        }
        // Load all pairs from the JSONL file
        const pairs = [];
        const fileContent = fs_1.default.readFileSync(jsonlFile, "utf-8");
        const lines = fileContent.split("\n");
        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum].trim();
            if (line) {
                try {
                    const pair = JSON.parse(line);
                    pairs.push(pair);
                }
                catch (error) {
                    console.warn(`Warning: Skipping invalid JSON on line ${lineNum + 1}: ${line.slice(0, 100)}...`);
                    continue;
                }
            }
        }
        if (pairs.length === 0) {
            throw new Error(`No valid data found in '${jsonlFile}'.`);
        }
        // Determine output file
        if (!outputFile) {
            outputFile = jsonlFile.replace(/\.jsonl$/, ".html");
        }
        await this.generateHTML(pairs, outputFile, { includeAllRequests });
        return outputFile;
    }
    getTemplatePaths() {
        return {
            templatePath: this.templatePath,
            bundlePath: this.bundlePath,
        };
    }
}
exports.HTMLGenerator = HTMLGenerator;
//# sourceMappingURL=html-generator.js.map