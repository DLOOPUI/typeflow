import type { VercelRequest, VercelResponse } from "@vercel/node";
import https from "https";
import http from "http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/api\/proxy\/gutendex/, "") ?? "";
  const targetUrl = `https://gutendex.com${path}`;

  console.log(`[gutendex-proxy] URL: ${targetUrl}`);

  proxyRequest(targetUrl, res);
}

function proxyRequest(targetUrl: string, res: VercelResponse) {
  const parsed = new URL(targetUrl);
  const lib = parsed.protocol === "https:" ? https : http;

  const options: https.RequestOptions = {
    hostname: parsed.hostname,
    port: parsed.port || (parsed.protocol === "https:" ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: "GET",
    headers: {
      "Accept": "application/json, text/plain, */*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    // Seguir redirects (301, 302, 307, 308)
    if (
      proxyRes.statusCode &&
      [301, 302, 307, 308].includes(proxyRes.statusCode) &&
      proxyRes.headers.location
    ) {
      const redirectUrl = proxyRes.headers.location.startsWith("http")
        ? proxyRes.headers.location
        : `${parsed.protocol}//${parsed.hostname}${proxyRes.headers.location}`;
      console.log(`[gutendex-proxy] Redirect -> ${redirectUrl}`);
      proxyRequest(redirectUrl, res);
      return;
    }

    const chunks: Buffer[] = [];
    proxyRes.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    proxyRes.on("end", () => {
      const data = Buffer.concat(chunks);
      const contentType = proxyRes.headers["content-type"] ?? "application/json";

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Cache-Control", "public, max-age=300");
      res.setHeader("Content-Type", contentType);

      res.status(proxyRes.statusCode ?? 200).send(data);
    });
  });

  proxyReq.on("error", (error) => {
    console.error("[gutendex-proxy] Error:", error);
    res.status(502).json({ error: "Proxy error", details: String(error) });
  });

  proxyReq.end();
}