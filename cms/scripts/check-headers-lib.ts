import http from "node:http";
import https from "node:https";

export type Res = { status: number; headers: http.IncomingHttpHeaders; body: string };

export function request(base: string, path: string, host: string, extra: Record<string, string> = {}): Promise<Res> {
  const url = new URL(path, base);
  const lib = url.protocol === "https:" ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      { hostname: url.hostname, port: url.port, path: url.pathname + url.search, method: "GET", headers: { Host: host, "User-Agent": "Mozilla/5.0 (check-headers) Chrome/126.0 Safari/537.36", Accept: "text/html,*/*", ...extra }, timeout: 15000 },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (body += c));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
    req.end();
  });
}

