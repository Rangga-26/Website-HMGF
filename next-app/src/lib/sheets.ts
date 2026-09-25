import "server-only";
import type { Article, ArticleSource } from "./types";

const SHEET_IDS: Record<ArticleSource, string> = {
  "Seputar HMGF": "1262503653",
  "SEG News": "840471671",
  Geolibrary: "5080467",
};

const MONTHS: Record<string, string> = {
  januari: "Januari", februari: "Februari", maret: "Maret", april: "April",
  mei: "Mei", juni: "Juni", juli: "Juli", agustus: "Agustus",
  september: "September", oktober: "Oktober", november: "November", desember: "Desember",
};

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function isPublished(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "true" || normalized === "1";
}

function formatDate(value: unknown): string {
  const text = String(value ?? "").trim();
  const monthFirst = text.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
  if (monthFirst && MONTHS[monthFirst[1].toLowerCase()]) {
    return `${monthFirst[2]} ${MONTHS[monthFirst[1].toLowerCase()]} ${monthFirst[3]}`;
  }
  const dayFirst = text.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
  if (dayFirst && MONTHS[dayFirst[2].toLowerCase()]) {
    return `${dayFirst[1]} ${MONTHS[dayFirst[2].toLowerCase()]} ${dayFirst[3]}`;
  }
  return text || "-";
}

function slugify(value: string): string {
  return value.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function first(record: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    if (record[key] !== undefined && record[key] !== null && String(record[key]).trim()) return String(record[key]).trim();
  }
  return "";
}

function blankColumn(record: Record<string, unknown>, predicate: (value: string) => boolean): string {
  return Object.entries(record).find(([key, value]) => key.startsWith("_column_") && predicate(String(value).trim()))?.[1] as string || "";
}

function normalize(record: Record<string, unknown>, source: ArticleSource): Article | null {
  const title = first(record, ["Judul Konten / Berkas", "Judul Berita", "Judul", "judul", "title"]);
  if (!title) return null;
  const published = first(record, ["Published", "published", "Published (TRUE/FALSE)", "Status"]) || blankColumn(record, value => /^(true|false)$/i.test(value));
  const date = first(record, ["Tanggal Upload", "Tanggal", "tanggal", "date"]) || blankColumn(record, value => /(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{1,2},?\s+\d{4}/i.test(value));
  const id = first(record, ["ID", "Id", "id"]) || title;
  const paragraphs = Array.from({ length: 13 }, (_, index) => first(record, [`Isi ${index + 1}`, `isi_${index + 1}`, index === 0 ? "Isi Paragraf / Gambar" : ""])).filter(Boolean);
  return {
    id, slug: slugify(title), title,
    image: first(record, ["Gambar Link", "gambar_hero", "Gambar"]),
    author: first(record, ["Penulis", "penulis"]) || "Redaksi HMGF",
    date: formatDate(date), category: first(record, ["Kategori Utama", "Kategori", "kategori"]) || "Geofisika",
    contentType: first(record, ["Jenis Konten"]), semester: first(record, ["Semester"]),
    examType: first(record, ["Kategori Ujian"]), courseType: first(record, ["Sifat MK"]),
    course: first(record, ["Mata Kuliah"]), link: first(record, ["Link Berkas / Video", "Link Video"]),
    paragraphs, published: isPublished(published), source,
  };
}

function parseCsv(csv: string): Record<string, unknown>[] {
  const rows: string[][] = []; let row: string[] = [], field = "", quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index], next = csv[index + 1];
    if (char === '"') { if (quoted && next === '"') { field += '"'; index += 1; } else quoted = !quoted; }
    else if (char === "," && !quoted) { row.push(field); field = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(field); rows.push(row); row = []; field = ""; }
    else field += char;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  const headers = (rows.shift() || []).map(header => header.trim());
  return rows.filter(cells => cells.some(Boolean)).map(cells => Object.fromEntries(headers.map((header, index) => [header || `_column_${index}`, cells[index] || ""])));
}

async function getJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Upstream error ${response.status}`);
  return response.json();
}

async function loadRaw(source: ArticleSource): Promise<Record<string, unknown>[]> {
  try {
    const data = await getJson(`${env("BASE_STEIN_URL")}/${encodeURIComponent(source)}`);
    if (Array.isArray(data)) return data as Record<string, unknown>[];
  } catch { /* CSV fallback below */ }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${env("GOOGLE_SHEET_ID")}/gviz/tq?tqx=out:csv&gid=${SHEET_IDS[source]}`;
  const response = await fetch(csvUrl, { cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Google Sheets error ${response.status}`);
  return parseCsv(await response.text());
}

export async function getArticles(source?: ArticleSource): Promise<Article[]> {
  const sources = source ? [source] : (Object.keys(SHEET_IDS) as ArticleSource[]);
  const grouped = await Promise.all(sources.map(async currentSource => {
    const raw = await loadRaw(currentSource);
    return raw.map(record => normalize(record, currentSource));
  }));
  return grouped.flat().filter((article): article is Article => Boolean(article?.published));
}

export async function getArticleBySlug(slug: string): Promise<Article | undefined> {
  return (await getArticles()).find(article => article.slug === slug);
}
