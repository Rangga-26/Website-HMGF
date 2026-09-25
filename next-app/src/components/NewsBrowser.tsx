"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { Article } from "@/lib/types";

const PAGE_SIZE = 5;

export default function NewsBrowser({ articles }: { articles: Article[] }) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("ALL");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => articles.filter(article => {
    const text = `${article.title} ${article.author} ${article.category}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (source === "ALL" || article.source === source);
  }), [articles, query, source]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function changeSource(value: string) { setSource(value); setPage(1); }
  function changeQuery(value: string) { setQuery(value); setPage(1); }

  return <section className="browser" aria-label="Arsip artikel">
    <div className="browser-tools">
      <input aria-label="Cari artikel" placeholder="Cari artikel..." value={query} onChange={event => changeQuery(event.target.value)} />
      <select aria-label="Filter sumber" value={source} onChange={event => changeSource(event.target.value)}>
        <option value="ALL">Semua sumber</option><option value="Seputar HMGF">Seputar HMGF</option><option value="SEG News">SEG News</option><option value="Geolibrary">Geolibrary</option>
      </select>
    </div>
    <div className="article-grid">{visible.map(article => <article className="article-card" key={`${article.source}-${article.id}`}>
      {article.image && <img src={article.image} alt="" loading="lazy" />}
      <div className="article-card-body"><small>{article.source} · {article.date}</small><h2>{article.title}</h2><p>{article.paragraphs[0]?.slice(0, 180) || "Baca informasi lengkap dari HMGF UGM."}</p><Link href={`/news/${article.slug}`}>Baca selengkapnya <span aria-hidden="true">→</span></Link></div>
    </article>)}</div>
    {visible.length === 0 && <p className="empty">Tidak ada artikel yang cocok.</p>}
    <nav className="pagination" aria-label="Pagination">{Array.from({ length: pages }, (_, index) => index + 1).map(number => <button key={number} className={number === page ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}</nav>
  </section>;
}
