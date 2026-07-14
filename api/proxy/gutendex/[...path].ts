import type { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Construir la URL destino
  const path = req.url?.replace(/^\/api\/proxy\/gutendex/, "") ?? "";
  const targetUrl = `https://gutendex.com${path}`;

  console.log(`[gutendex-proxy] URL: ${targetUrl}`);

  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    console.log(`[gutendex-proxy] Status: ${response.status}`);

    const data = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") ?? "application/json";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", contentType);

    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    console.error("[gutendex-proxy] Error:", error);
    res.status(502).json({ error: "Proxy error", details: String(error) });
  }
}