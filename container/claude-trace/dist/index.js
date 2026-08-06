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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HTMLGenerator = exports.getLogger = exports.initializeInterceptor = exports.ClaudeTrafficLogger = void 0;
// Main exports for the package
var interceptor_1 = require("./interceptor");
Object.defineProperty(exports, "ClaudeTrafficLogger", { enumerable: true, get: function () { return interceptor_1.ClaudeTrafficLogger; } });
Object.defineProperty(exports, "initializeInterceptor", { enumerable: true, get: function () { return interceptor_1.initializeInterceptor; } });
Object.defineProperty(exports, "getLogger", { enumerable: true, get: function () { return interceptor_1.getLogger; } });
var html_generator_1 = require("./html-generator");
Object.defineProperty(exports, "HTMLGenerator", { enumerable: true, get: function () { return html_generator_1.HTMLGenerator; } });
// Re-export everything for convenience
__exportStar(require("./interceptor"), exports);
__exportStar(require("./html-generator"), exports);
__exportStar(require("./types"), exports);
//# sourceMappingURL=index.js.map