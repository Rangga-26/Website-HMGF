"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

type Turnstile = { render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string; reset: (widgetId: string) => void };

declare global { interface Window { turnstile?: Turnstile } }

export default function CommentForm({ articleId, articleTitle }: { articleId: string; articleTitle: string }) {
  const container = useRef<HTMLDivElement>(null); const [token, setToken] = useState(""); const [status, setStatus] = useState(""); const [form, setForm] = useState({ name: "", email: "", text: "" });
  useEffect(() => { const script = document.createElement("script"); script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"; script.async = true; script.onload = () => { if (container.current && window.turnstile && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) window.turnstile.render(container.current, { sitekey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY, callback: setToken, "expired-callback": () => setToken("") }); }; document.head.appendChild(script); return () => { script.remove(); }; }, []);
  async function submit(event: FormEvent) { event.preventDefault(); if (!token) { setStatus("Selesaikan verifikasi anti-bot."); return; } setStatus("Mengirim..."); const response = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, articleId, articleTitle, turnstileToken: token }) }); const data = await response.json() as { error?: string }; setStatus(response.ok ? "Komentar berhasil dikirim." : data.error || "Komentar gagal dikirim."); if (response.ok) setForm({ name: "", email: "", text: "" }); }
  return <form className="comment-form" onSubmit={submit}><h2>Diskusi</h2><input required maxLength={100} placeholder="Nama" value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /><input type="email" placeholder="Email (opsional)" value={form.email} onChange={event => setForm({ ...form, email: event.target.value })} /><textarea required maxLength={5000} placeholder="Tulis komentar..." value={form.text} onChange={event => setForm({ ...form, text: event.target.value })} /><div ref={container} /><button type="submit">Kirim komentar</button>{status && <p role="status">{status}</p>}</form>;
}
