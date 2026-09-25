import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; email?: string; text?: string; articleId?: string; articleTitle?: string; turnstileToken?: string };
    const name = body.name?.trim();
    const text = body.text?.trim();
    if (!name || !text || name.length > 100 || text.length > 5000) return NextResponse.json({ error: "Nama atau komentar tidak valid." }, { status: 400 });

    const turnstileSecret = process.env.TURNSTILE_SECRET_KEY;
    if (!turnstileSecret || !body.turnstileToken) return NextResponse.json({ error: "Verifikasi anti-bot diperlukan." }, { status: 400 });
    const verification = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ secret: turnstileSecret, response: body.turnstileToken }),
    });
    const result = await verification.json() as { success?: boolean };
    if (!verification.ok || !result.success) return NextResponse.json({ error: "Verifikasi anti-bot gagal." }, { status: 403 });

    const apiUrl = process.env.BASE_STEIN_URL;
    if (!apiUrl) return NextResponse.json({ error: "Komentar belum dikonfigurasi." }, { status: 503 });
    const upstream = await fetch(`${apiUrl}/Comments`, {
      method: "POST", headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify([{ id: body.articleId || "INSIGHT_COMMENT", name, email: body.email?.trim() || "", text, date: new Date().toISOString(), judul_berita: body.articleTitle || "" }]),
    });
    if (!upstream.ok) return NextResponse.json({ error: "Komentar gagal disimpan." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Permintaan komentar gagal." }, { status: 400 });
  }
}
