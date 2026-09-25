import type { APIRoute } from "astro";

export const prerender = false;
export const POST: APIRoute = async ({ request, locals, redirect }) => {
  const form = await request.formData(); const name = String(form.get("name") || "").trim(); const text = String(form.get("text") || "").trim(); const token = String(form.get("cf-turnstile-response") || "");
  if (!name || !text || name.length > 100 || text.length > 5000) return new Response("Nama atau komentar tidak valid.", { status: 400 });
  const env = locals.runtime.env as Record<string, string | undefined>;
  if (!env.TURNSTILE_SECRET_KEY || !token) return new Response("Verifikasi anti-bot diperlukan.", { status: 400 });
  const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ secret: env.TURNSTILE_SECRET_KEY, response: token }) });
  const result = await verification.json() as { success?: boolean }; if (!verification.ok || !result.success) return new Response("Verifikasi anti-bot gagal.", { status: 403 });
  if (!env.BASE_STEIN_URL) return new Response("Komentar belum dikonfigurasi.", { status: 503 });
  const upstream = await fetch(`${env.BASE_STEIN_URL}/Comments`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify([{ id: String(form.get("articleId") || "INSIGHT_COMMENT"), name, email: String(form.get("email") || "").trim(), text, date: new Date().toISOString(), judul_berita: String(form.get("articleTitle") || "") }]) });
  if (!upstream.ok) return new Response("Komentar gagal disimpan.", { status: 502 }); return redirect("/", 303);
};
