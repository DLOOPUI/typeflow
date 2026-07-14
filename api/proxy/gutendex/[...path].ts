import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  const path = req.url?.replace("/api/proxy/gutendex", "") ?? "";
  const targetUrl = `https://gutendex.com${path}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "User-Agent": "TypeFlow/1.0",
      },
      body: req.body ? JSON.stringify(req.body) : undefined,
    });

    const data = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") ?? "application/json";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.setHeader("Content-Type", contentType);

    res.status(response.status).send(Buffer.from(data));
  } catch (error) {
    res.status(502).json({ error: "Proxy error" });
  }
}