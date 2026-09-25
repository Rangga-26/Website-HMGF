import type { APIRoute } from "astro";
import { escapeHtml } from "../../lib/data";

export const prerender = false;
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const form = await request.formData();
    const message = String(form.get("message") || "").trim();
    if (!message || message.length > 4000) return new Response("Pesan tidak valid.", { status: 400 });
    const env = locals.runtime.env as Record<string, string | undefined>;
    if (!env.N8N_WEBHOOK_URL) return new Response("Chat belum dikonfigurasi.", { status: 503 });
    const upstream = await fetch(env.N8N_WEBHOOK_URL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message, timestamp: new Date().toISOString() }) });
    if (!upstream.ok) return new Response("Server AI tidak tersedia.", { status: 502 });
    const data = await upstream.json() as { reply?: string; output?: string; message?: string };
    const reply = data.reply || data.output || data.message || "Tidak ada respons.";
    return new Response(`<main><h1>GeoBot AI</h1><p>${escapeHtml(reply)}</p><p><a href="/">Kembali</a></p></main>`, { headers: { "content-type": "text/html; charset=utf-8" } });
  } catch { return new Response("Permintaan chat gagal.", { status: 400 }); }
};
