"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiServer = void 0;
class ApiServer {
    options;
    constructor(options) {
        this.options = options;
    }
    async start() {
        console.log(`Starting API server on ${this.options.host}:${this.options.port}`);
        // Will use Express.js
        return true;
    }
    async stop() {
        console.log('Stopping API server');
        return true;
    }
}
exports.ApiServer = ApiServer;
//# sourceMappingURL=index.js.map