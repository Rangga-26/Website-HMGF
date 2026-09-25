import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  try {
    const body = await request.json() as { message?: string; context?: unknown };
    const message = body.message?.trim();
    if (!message || message.length > 4000) return NextResponse.json({ error: "Pesan tidak valid." }, { status: 400 });

    const webhook = process.env.N8N_WEBHOOK_URL;
    if (!webhook) return NextResponse.json({ error: "Chat belum dikonfigurasi." }, { status: 503 });
    const upstream = await fetch(webhook, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ message, context: body.context, timestamp: new Date().toISOString() }),
    });
    if (!upstream.ok) return NextResponse.json({ error: "Server AI tidak tersedia." }, { status: 502 });
    const data = await upstream.json() as { reply?: string; output?: string; message?: string };
    return NextResponse.json({ reply: data.reply || data.output || data.message || "Maaf, tidak ada respons." });
  } catch {
    return NextResponse.json({ error: "Permintaan chat gagal." }, { status: 400 });
  }
}
