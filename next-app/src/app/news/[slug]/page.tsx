import { notFound } from "next/navigation";
import Link from "next/link";
import { getArticleBySlug } from "@/lib/sheets";
import CommentForm from "@/components/CommentForm";
import MathJax from "@/components/MathJax";

export const runtime = "edge";

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();
  return <main className="article-detail"><Link href="/">← Kembali ke arsip</Link><p className="eyebrow">{article.source}</p><h1>{article.title}</h1><p className="meta">{article.date} · {article.author}{article.course ? ` · ${article.course}` : ""}</p>{article.image && <img src={article.image} alt="" className="article-hero-image" />}{article.link && <p><a href={article.link} target="_blank" rel="noreferrer">Buka berkas atau video</a></p>}<MathJax><div className="article-body">{article.paragraphs.map((paragraph, index) => paragraph.startsWith("#") ? <h2 key={index}>{paragraph.replace(/^#+\s*/, "")}</h2> : <p key={index}>{paragraph}</p>)}</div></MathJax><CommentForm articleId={article.id} articleTitle={article.title} /></main>;
}
