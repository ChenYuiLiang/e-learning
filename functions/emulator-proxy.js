const http = require("http");

function isEmulatorRuntime() {
    return process.env.FUNCTIONS_EMULATOR === "true" || !!process.env.FIREBASE_EMULATOR_HUB;
}

/**
 * Proxy HTTP requests from Hosting (ngrok) to a local Firebase emulator port.
 * Only active during emulator runs; returns 404 in production.
 */
function proxyHttpRequest(targetPort, stripPrefix, req, res) {
    if (!isEmulatorRuntime()) {
        res.status(404).send("Emulator proxy is only available in local development.");
        return;
    }

    let targetPath = req.originalUrl || req.url || "/";
    if (stripPrefix && targetPath.startsWith(stripPrefix)) {
        targetPath = targetPath.slice(stripPrefix.length) || "/";
    }

    const headers = { ...req.headers };
    headers.host = `127.0.0.1:${targetPort}`;
    delete headers["content-length"];

    const options = {
        hostname: "127.0.0.1",
        port: targetPort,
        path: targetPath,
        method: req.method,
        headers,
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.status(proxyRes.statusCode || 502);
        Object.keys(proxyRes.headers).forEach((key) => {
            if (key.toLowerCase() === "transfer-encoding") return;
            res.setHeader(key, proxyRes.headers[key]);
        });
        proxyRes.pipe(res);
    });

    proxyReq.on("error", (err) => {
        console.error(`[emulator-proxy] ${targetPort} ${targetPath}:`, err.message);
        if (!res.headersSent) {
            res.status(502).send(`Emulator proxy error (port ${targetPort}): ${err.message}`);
        }
    });

    const body = req.rawBody;
    if (body && body.length) {
        proxyReq.write(body);
        proxyReq.end();
    } else if (req.method === "GET" || req.method === "HEAD") {
        proxyReq.end();
    } else {
        req.pipe(proxyReq);
    }
}

module.exports = { proxyHttpRequest, isEmulatorRuntime };
