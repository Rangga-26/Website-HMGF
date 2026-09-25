import NewsBrowser from "@/components/NewsBrowser";
import { getArticles } from "@/lib/sheets";

export const runtime = "edge";

export default async function Home() {
  const articles = await getArticles();
  return <main><section className="hero"><p className="eyebrow">Himpunan Mahasiswa</p><h1>GEOFISIKA<br /><span>UGM</span></h1><p>Tinggi Prestasi Tampak Membumi</p></section><section id="arsip" className="content"><div className="section-heading"><p className="eyebrow">Kabar terbaru</p><h2>Arsip HMGF UGM</h2></div><NewsBrowser articles={articles} /></section></main>;
}
