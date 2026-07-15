import type { VercelRequest, VercelResponse } from "@vercel/node";
import https from "https";

// Proxy para Project Gutenberg. El frontend envia la URL destino como
// query param "url", ej: /api/gutenberg?url=/ebooks/1513.txt.utf-8
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawUrl = (req.query.url as string) ?? "";
  const targetUrl = `https://www.gutenberg.org${rawUrl}`;

  console.log(`[gutenberg-proxy] URL: ${targetUrl}`);

  doRequest(targetUrl, res, 0);
}

function doRequest(targetUrl: string, res: VercelResponse, redirects: number) {
  if (redirects > 5) {
    res.status(502).json({ error: "Too many redirects" });
    return;
  }

  const parsed = new URL(targetUrl);

  const proxyReq = https.request(
    {
      hostname: parsed.hostname,
      port: 443,
      path: parsed.pathname + parsed.search,
      method: "GET",
      headers: {
        Accept: "text/plain, text/html, */*",
        "Accept-Language": "en-US,en;q=0.9",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://www.gutenberg.org/",
        Connection: "keep-alive",
      },
    },
    (proxyRes: any) => {
      if (
        proxyRes.statusCode &&
        [301, 302, 307, 308].includes(proxyRes.statusCode) &&
        proxyRes.headers.location
      ) {
        const loc = proxyRes.headers.location.startsWith("http")
          ? proxyRes.headers.location
          : `https://${parsed.hostname}${proxyRes.headers.location}`;
        console.log(`[gutenberg-proxy] Redirect -> ${loc}`);
        doRequest(loc, res, redirects + 1);
        return;
      }

      const chunks: Buffer[] = [];
      proxyRes.on("data", (c: any) => chunks.push(Buffer.from(c)));
      proxyRes.on("end", () => {
        const data = Buffer.concat(chunks);
        const ct = proxyRes.headers["content-type"] ?? "text/plain; charset=utf-8";

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.setHeader("Content-Type", String(ct));

        res.status(proxyRes.statusCode ?? 200).send(data);
      });
    }
  );

  proxyReq.on("error", (err: any) => {
    console.error("[gutenberg-proxy] Error:", err);
    res.status(502).json({ error: "Proxy error", details: String(err) });
  });

  proxyReq.end();
}