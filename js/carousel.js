// ==========================================================================
// KONFIGURASI N8N WEBHOOK API URL & STEINHQ / SHEETDB API
// ==========================================================================
const BASE_STEIN_URL = "https://sheetdb.io/api/v1/h8t8pf39u16ad";
const GOOGLE_SHEET_ID = "1Ax_Dlms14qXoxsZgTklFBE1mOuH5DJmb3OJiO6kSnng";

const SHEET_HMGF = "Seputar HMGF";
const SHEET_SEG = "SEG News";

const GOOGLE_SHEET_GIDS = {
    [SHEET_HMGF]: "1262503653",
    [SHEET_SEG]: "840471671"
};
const DATA_FETCH_TIMEOUT_MS = 15000;

// ==========================================================================
// HELPER FUNCTIONS: NORMALISASI DATA & FORMATTING
// ==========================================================================
function normalizeArticleData(item, sourceSheet = '') {
    if (!item) return null;

    const getCell = (...keys) => {
        for (const key of keys) {
            if (item[key] !== undefined && item[key] !== null) {
                return String(item[key]).trim();
            }
        }
        return '';
    };

    const extractedTitle = getCell('Judul Konten / Berkas', 'Judul Berita', 'Judul', 'judul', 'title');
    const generatedId = String(getCell('ID', 'Id', 'id') || extractedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    return {
        id: generatedId,
        judul: extractedTitle,
        kategoriUtama: getCell('Kategori Utama', 'Kategori', 'kategori') || 'Geofisika',
        jenisKonten: getCell('Jenis Konten'),
        tanggal: getCell('Tanggal Upload', 'Tanggal', 'tanggal') || '-',
        penulis: getCell('Penulis', 'penulis') || 'Redaksi HMGF',
        gambar_hero: getCell('Gambar Link', 'gambar_hero', 'Gambar'),
        isi_1: getCell('Isi Paragraf / Gambar', 'isi_1', 'Isi 1'),
        published: item.Published ?? item.published ?? true,
        sourceSheet: sourceSheet
    };
}

function formatDriveUrl(rawUrl) {
    if (!rawUrl || typeof rawUrl !== 'string') return '';
    let cleanUrl = rawUrl.split('|')[0].trim();
    if (!cleanUrl || cleanUrl === '#' || /^#(ref|n\/a|value)!?$/i.test(cleanUrl)) return '';

    const match = cleanUrl.match(/(?:file\/d\/|id=|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return cleanUrl;
}

function isPublished(val) {
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        return lower === 'true' || lower === '1';
    }
    return true;
}

// ==========================================================================
// FETCHING DATA (STEIN API + GOOGLE SHEETS CSV FALLBACK)
// ==========================================================================
async function fetchWithTimeout(url, options = {}, timeoutMs = DATA_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

function getGoogleSheetCsvUrl(sheetName) {
    const baseUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv`;
    const gid = GOOGLE_SHEET_GIDS[sheetName];
    if (gid) return `${baseUrl}&gid=${encodeURIComponent(gid)}`;
    return `${baseUrl}&sheet=${encodeURIComponent(sheetName)}`;
}

function parseGoogleSheetCsv(csvText) {
    const rows = [];
    let row = [], field = '', inQuotes = false;

    for (let i = 0; i < csvText.length; i++) {
        const char = csvText[i], nextChar = csvText[i + 1];
        if (char === '"') {
            if (inQuotes && nextChar === '"') { field += '"'; i++; } 
            else { inQuotes = !inQuotes; }
            continue;
        }
        if (char === ',' && !inQuotes) { row.push(field); field = ''; continue; }
        if ((char === '\n' || char === '\r') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            row.push(field); rows.push(row); row = []; field = ''; continue;
        }
        field += char;
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

    const headers = (rows.shift() || []).map(header => header.trim());
    return rows
        .filter(cells => cells.some(cell => String(cell || '').trim() !== ''))
        .map(cells => {
            const item = {};
            headers.forEach((header, index) => { if (header) item[header] = cells[index] || ''; });
            return item;
        });
}

async function fetchFromStein(sheetName) {
    const response = await fetchWithTimeout(`${BASE_STEIN_URL}/${encodeURIComponent(sheetName)}`, { mode: 'cors' });
    if (!response.ok) throw new Error(`API Error ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`Format data tidak valid.`);
    return data;
}

async function fetchFromGoogleSheet(sheetName) {
    const response = await fetchWithTimeout(getGoogleSheetCsvUrl(sheetName), { mode: 'cors' });
    if (!response.ok) throw new Error(`Google Sheets CSV Error ${response.status}`);
    return parseGoogleSheetCsv(await response.text());
}

async function fetchSheetData(sheetName) {
    try {
        return await fetchFromStein(sheetName);
    } catch (apiError) {
        console.warn(`Gagal memuat API untuk sheet "${sheetName}", mencoba CSV Google Sheets...`, apiError);
        return fetchFromGoogleSheet(sheetName);
    }
}

// ==========================================================================
// 1. CAROUSEL PRESTASI DAN KEGIATAN TERBARU
// ==========================================================================
async function initLatestNewsCarousel() {
    const track = document.getElementById('carouselTrackHMGF');
    if (!track) return;
    try {
        const [rawHMGF, rawSEG] = await Promise.all([
            fetchSheetData(SHEET_HMGF).catch(() => []),
            fetchSheetData(SHEET_SEG).catch(() => [])
        ]);
        const articles = [
            ...rawHMGF.map(i => normalizeArticleData(i, SHEET_HMGF)),
            ...rawSEG.map(i => normalizeArticleData(i, SHEET_SEG))
        ].filter(i => isPublished(i.published));
        
        const allowed = ["geofisiana", "metode geofisika", "penelitian", "seg news"];
        const excluded = ["majalah spektral", "geolibrary"];
        
        const filtered = articles.filter(i => {
            const catStr = ((i.kategoriUtama || '') + ' ' + (i.jenisKonten || '')).toLowerCase();
            const isAllowed = allowed.some(keyword => catStr.includes(keyword));
            const isExcluded = excluded.some(keyword => catStr.includes(keyword));
            return isAllowed && !isExcluded;
        });
        
        if (filtered.length === 0) return;
        track.innerHTML = '';
        filtered.slice(0, 8).forEach(item => {
            const title = item.judul || 'Kegiatan Terbaru';
            const category = item.sourceSheet === SHEET_SEG 
                ? 'SEG News' 
                : (item.jenisKonten || (item.kategoriUtama && item.kategoriUtama !== 'Geofisika' ? item.kategoriUtama : 'Seputar HMGF'));
            const imgUrl = formatDriveUrl(item.gambar_hero) || 'assets/earth-day.jpg';
            const cleanExcerpt = (item.isi_1 || '').replace(/#+\s*/g, '').substring(0, 90) + '...';
            
            track.innerHTML += `
                <div class="carousel-card" onclick="window.location.href='berita-insight.html?judul=${encodeURIComponent(title)}'" style="cursor: pointer;">
                    <div class="card-image-box"><img src="${imgUrl}" alt="${title}" onerror="this.onerror=null; this.src='assets/earth-day.jpg';"></div>
                    <div class="card-content"><span class="card-tag">${category}</span><h3>${title}</h3><p>${cleanExcerpt}</p></div>
                </div>`;
        });
    } catch (err) { console.warn("Gagal memuat carousel kegiatan terbaru:", err); }
}

// ==========================================================================
// 2. CAROUSEL PROGRAM KERJA & PRESTASI
// ==========================================================================
async function initProkerCarousel() {
    const track = document.getElementById('carouselTrackProker');
    if (!track) return;
    try {
        const [rawHMGF, rawSEG] = await Promise.all([
            fetchSheetData(SHEET_HMGF).catch(() => []),
            fetchSheetData(SHEET_SEG).catch(() => [])
        ]);
        const articles = [
            ...rawHMGF.map(i => normalizeArticleData(i, SHEET_HMGF)),
            ...rawSEG.map(i => normalizeArticleData(i, SHEET_SEG))
        ].filter(i => isPublished(i.published));
        
        const allowed = ["majalah spektral", "geolibrary"];
        const filtered = articles.filter(i => {
            const catStr = ((i.kategoriUtama || '') + ' ' + (i.jenisKonten || '')).toLowerCase();
            return allowed.some(keyword => catStr.includes(keyword));
        });
        
        if (filtered.length === 0) return;
        track.innerHTML = '';
        filtered.slice(0, 8).forEach(item => {
            const title = item.judul || 'Program Kerja & Prestasi';
            const category = item.sourceSheet === SHEET_SEG 
                ? 'SEG News' 
                : (item.jenisKonten || (item.kategoriUtama && item.kategoriUtama !== 'Geofisika' ? item.kategoriUtama : 'Seputar HMGF'));
            const imgUrl = formatDriveUrl(item.gambar_hero) || 'assets/earth-day.jpg';
            const cleanExcerpt = (item.isi_1 || '').replace(/#+\s*/g, '').substring(0, 90) + '...';

            track.innerHTML += `
                <div class="carousel-card" onclick="window.location.href='berita-insight.html?judul=${encodeURIComponent(title)}'" style="cursor: pointer;">
                    <div class="card-image-box"><img src="${imgUrl}" alt="${title}" onerror="this.onerror=null; this.src='assets/earth-day.jpg';"></div>
                    <div class="card-content"><span class="card-tag">${category}</span><h3>${title}</h3><p>${cleanExcerpt}</p></div>
                </div>`;
        });
    } catch (err) { console.warn("Gagal memuat carousel proker:", err); }
}

// ==========================================================================
// INISIALISASI AUTOMATIS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById('carouselTrackHMGF')) initLatestNewsCarousel();
    if (document.getElementById('carouselTrackProker')) initProkerCarousel();
});