"use client";

import { useState } from "react";
import { MessageCircle, Mic, Send, X } from "lucide-react";

type SpeechResultEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type SpeechRecognitionLike = { lang: string; onresult: (event: SpeechResultEvent) => void; start: () => void };
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function GeoBot() {
  const [open, setOpen] = useState(false); const [input, setInput] = useState(""); const [messages, setMessages] = useState<{ role: "user" | "bot"; text: string }[]>([]); const [busy, setBusy] = useState(false);
  async function send() {
    const message = input.trim(); if (!message || busy) return;
    setInput(""); setMessages(current => [...current, { role: "user", text: message }]); setBusy(true);
    try { const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) }); const data = await response.json() as { reply?: string; error?: string }; setMessages(current => [...current, { role: "bot", text: data.reply || data.error || "Maaf, terjadi kesalahan." }]); }
    catch { setMessages(current => [...current, { role: "bot", text: "Maaf, server AI tidak dapat dihubungi." }]); } finally { setBusy(false); }
  }
  function listen() { const speechWindow = window as Window & { SpeechRecognition?: SpeechRecognitionConstructor; webkitSpeechRecognition?: SpeechRecognitionConstructor }; const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition; if (!Recognition) return; const recognition = new Recognition(); recognition.lang = "id-ID"; recognition.onresult = event => setInput(event.results[0][0].transcript); recognition.start(); }
  return <div className="geobot"><button className="icon-button geobot-toggle" aria-label={open ? "Tutup GeoBot" : "Buka GeoBot"} onClick={() => setOpen(!open)}>{open ? <X /> : <MessageCircle />}</button>{open && <section className="chat-panel" aria-label="GeoBot AI"><header><strong>GeoBot AI</strong><button className="icon-button" aria-label="Tutup" onClick={() => setOpen(false)}><X size={18} /></button></header><div className="messages">{messages.map((message, index) => <p className={message.role} key={`${message.role}-${index}`}>{message.text}</p>)}{busy && <p className="bot">Memproses...</p>}</div><div className="chat-input"><button className="icon-button" aria-label="Input suara" onClick={listen}><Mic size={18} /></button><input value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === "Enter") send(); }} placeholder="Tanyakan sesuatu..." /><button className="icon-button" aria-label="Kirim" onClick={send}><Send size={18} /></button></div></section>}</div>;
}
