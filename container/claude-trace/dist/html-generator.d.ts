import { RawPair } from "./types";
export declare class HTMLGenerator {
    private frontendDir;
    private templatePath;
    private bundlePath;
    constructor();
    private ensureFrontendBuilt;
    private loadTemplateFiles;
    private filterClaudeAPIPairs;
    private filterShortConversations;
    private prepareDataForInjection;
    private escapeHtml;
    generateHTML(pairs: RawPair[], outputFile: string, options?: {
        title?: string;
        timestamp?: string;
        includeAllRequests?: boolean;
    }): Promise<void>;
    generateHTMLFromJSONL(jsonlFile: string, outputFile?: string, includeAllRequests?: boolean): Promise<string>;
    getTemplatePaths(): {
        templatePath: string;
        bundlePath: string;
    };
}
//# sourceMappingURL=html-generator.d.ts.map