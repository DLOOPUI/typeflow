import type { VercelRequest, VercelResponse } from "@vercel/node";
import https from "https";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = req.url?.replace(/^\/api\/proxy\/gutenberg/, "") ?? "";
  const targetUrl = `https://www.gutenberg.org${path}`;

  console.log(`[gutenberg-proxy] URL: ${targetUrl}`);

  proxyRequest(targetUrl, res, 0);
}

function proxyRequest(targetUrl: string, res: VercelResponse, redirectCount: number) {
  if (redirectCount > 5) {
    res.status(502).json({ error: "Too many redirects" });
    return;
  }

  const parsed = new URL(targetUrl);

  const options: https.RequestOptions = {
    hostname: parsed.hostname,
    port: 443,
    path: parsed.pathname + parsed.search,
    method: "GET",
    headers: {
      "Accept": "text/plain, text/html, */*",
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "identity",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Referer": "https://www.gutenberg.org/",
      "Connection": "keep-alive",
    },
  };

  const proxyReq = https.request(options, (proxyRes: any) => {
    if (proxyRes.statusCode && [301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
      const redirectUrl = proxyRes.headers.location.startsWith("http")
        ? proxyRes.headers.location
        : `https://${parsed.hostname}${proxyRes.headers.location}`;
      console.log(`[gutenberg-proxy] Redirect -> ${redirectUrl}`);
      proxyRequest(redirectUrl, res, redirectCount + 1);
      return;
    }

    const chunks: Buffer[] = [];
    proxyRes.on("data", (chunk: any) => chunks.push(Buffer.from(chunk)));
    proxyRes.on("end", () => {
      const data = Buffer.concat(chunks);
      const contentType = proxyRes.headers["content-type"] ?? "text/plain; charset=utf-8";

      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Content-Type", contentType);

      res.status(proxyRes.statusCode ?? 200).send(data);
    });
  });

  proxyReq.on("error", (error: any) => {
    console.error("[gutenberg-proxy] Error:", error);
    res.status(502).json({ error: "Proxy error", details: String(error) });
  });

  proxyReq.end();
}