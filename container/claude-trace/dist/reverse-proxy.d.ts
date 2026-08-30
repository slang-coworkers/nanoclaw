export interface ReverseProxyConfig {
    port?: number;
    logDirectory?: string;
    logBaseName?: string;
    includeAllRequests?: boolean;
    openBrowser?: boolean;
    logSensitiveHeaders?: boolean;
}
export declare class ReverseProxyServer {
    private server;
    private config;
    private pairs;
    private logFile;
    private htmlFile;
    private htmlGenerator;
    private targetHost;
    private targetPort;
    private targetProtocol;
    private upstreamProxy;
    constructor(config?: ReverseProxyConfig);
    private processHeaders;
    private writePairToLog;
    private generateHTML;
    start(): Promise<{
        port: number;
        url: string;
    }>;
    private handleRequest;
    stop(): void;
}
//# sourceMappingURL=reverse-proxy.d.ts.map