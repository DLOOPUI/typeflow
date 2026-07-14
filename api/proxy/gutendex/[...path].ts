export const config = {
  runtime: "edge",
};

export default async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/proxy\/gutendex/, "");
  const queryString = url.search;
  const targetUrl = `https://gutendex.com${path}${queryString}`;

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Host": "gutendex.com",
      },
    });

    const data = await response.arrayBuffer();
    const contentType = response.headers.get("Content-Type") ?? "application/json";

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: "Proxy error", details: String(error) }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }
}