// ==========================================================================
// KONFIGURASI N8N WEBHOOK API URL & SHEETDB API
// ==========================================================================
const N8N_WEBHOOK_URL = "https://n8nn.gama-geofisika.web.id/webhook/geobot";

// Endpoint API & Nama Sheets
const BASE_STEIN_URL = "https://sheetdb.io/api/v1/h8t8pf39u16ad";
const GOOGLE_SHEET_ID = "1Ax_Dlms14qXoxsZgTklFBE1mOuH5DJmb3OJiO6kSnng";

const SHEET_GEOLIBRARY = "Geolibrary";
const SHEET_HMGF = "Seputar HMGF";
const SHEET_SEG = "SEG News";
const SHEET_COMMENTS = "Comments";
const SHEET_PENULIS = "Penulis";

const GOOGLE_SHEET_GIDS = {
    [SHEET_GEOLIBRARY]: "5080467",
    [SHEET_HMGF]: "1262503653",
    [SHEET_SEG]: "840471671"
};
const DATA_FETCH_TIMEOUT_MS = 15000;

// Helper Normalisasi Teks Judul untuk Pencocokan Akurat
function normalizeTitle(str) {
    if (!str) return '';
    try {
        return decodeURIComponent(str).toLowerCase().replace(/\s+/g, ' ').trim();
    } catch (e) {
        return String(str).toLowerCase().replace(/\s+/g, ' ').trim();
    }
}

function getPublishedValue(item) {
    if (!item || typeof item !== 'object') return false;

    const publishedKey = Object.keys(item).find(key =>
        ['published', 'publishedtruefalse', 'status'].includes(
            String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
        )
    );

    if (publishedKey) return item[publishedKey];

    const booleanValue = Object.entries(item).find(([key, value]) => {
        if (key !== '' && !key.startsWith('_column_')) return false;
        const normalized = String(value ?? '').trim().toLowerCase();
        return normalized === 'true' || normalized === 'false';
    })?.[1];

    return booleanValue ?? false;
}

function getDateValue(item) {
    if (!item || typeof item !== 'object') return '';

    const dateKey = Object.keys(item).find(key =>
        ['tanggal', 'tanggalupload', 'date'].includes(
            String(key).toLowerCase().replace(/[^a-z0-9]/g, '')
        )
    );
    const namedDate = dateKey ? String(item[dateKey] ?? '').trim() : '';
    const dateValue = namedDate || Object.entries(item).find(([key, value]) => {
        if (key !== '' && !key.startsWith('_column_')) return false;
        return isDateValue(value);
    })?.[1] || '';

    return formatIndonesianDate(dateValue);
}

function isDateValue(value) {
    return /(?:\d{1,2}\s+(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{4}|(?:januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+\d{1,2},?\s+\d{4}|\d{1,2}[\/-]\d{1,2}[\/-]\d{4})/i.test(String(value ?? '').trim());
}

function formatIndonesianDate(value) {
    const text = String(value ?? '').trim();
    if (!text) return '';

    const months = {
        januari: 'Januari', februari: 'Februari', maret: 'Maret', april: 'April',
        mei: 'Mei', juni: 'Juni', juli: 'Juli', agustus: 'Agustus',
        september: 'September', oktober: 'Oktober', november: 'November', desember: 'Desember'
    };
    let match = text.match(/^(\w+)\s+(\d{1,2}),?\s+(\d{4})$/i);
    if (match && months[match[1].toLowerCase()]) {
        return `${match[2]} ${months[match[1].toLowerCase()]} ${match[3]}`;
    }

    match = text.match(/^(\d{1,2})\s+(\w+)\s+(\d{4})$/i);
    if (match && months[match[2].toLowerCase()]) {
        return `${match[1]} ${months[match[2].toLowerCase()]} ${match[3]}`;
    }

    return text;
}

// Dynamic Routing via Judul Berita / Berkas
const urlParams = new URLSearchParams(window.location.search);
let rawJudul = urlParams.get('judul') || urlParams.get('title');

if (!rawJudul && window.location.search) {
    const searchStr = window.location.search.substring(1);
    if (!searchStr.includes('=')) {
        rawJudul = searchStr;
    }
}

const TARGET_JUDUL = rawJudul ? rawJudul.trim() : "";
let currentArticleId = "";
let currentArticleTitle = ""; 
let commentsArray = [];
let currentFontSizeRem = 1.1;
const defaultFontSizeRem = 1.1;

// ==========================================================================
// INIT WEB SPEECH API (MICROPHONE & TEXT-TO-SPEECH)
// ==========================================================================
let syntheticVoice = window.speechSynthesis;
let recognition = null;
let isRecording = false;
let activeMicTarget = null;

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = function() {
        isRecording = true;
        if (activeMicTarget === 'inpage') {
            document.getElementById('inpage-mic-btn')?.classList.add('mic-active');
        } else if (activeMicTarget === 'widget') {
            document.getElementById('geobot-mic-btn')?.classList.add('mic-active');
        }
    };

    recognition.onresult = function(event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }

        if (activeMicTarget === 'inpage') {
            const inputEl = document.getElementById('inpage-ai-input');
            if (inputEl) inputEl.value = transcript;
        } else if (activeMicTarget === 'widget') {
            const inputEl = document.getElementById('geobot-input');
            if (inputEl) inputEl.value = transcript;
        }
    };

    recognition.onerror = function(event) {
        console.error("Speech recognition error:", event.error);
        stopVoiceInput();
    };

    recognition.onend = function() { stopVoiceInput(); };
} else {
    console.warn("Browser ini tidak mendukung Speech Recognition API.");
}

function toggleVoiceInput(target) {
    if (!recognition) {
        alert("Fitur perekam suara tidak didukung oleh browser Anda. Gunakan Chrome/Edge.");
        return;
    }
    if (isRecording && activeMicTarget === target) {
        recognition.stop();
    } else {
        if (isRecording) recognition.stop();
        activeMicTarget = target;
        try { recognition.start(); } catch (e) { console.error("Gagal memulai recognition:", e); }
    }
}

function stopVoiceInput() {
    isRecording = false;
    activeMicTarget = null;
    document.getElementById('inpage-mic-btn')?.classList.remove('mic-active');
    document.getElementById('geobot-mic-btn')?.classList.remove('mic-active');
}

// ==========================================================================
// HELPER FUNCTIONS: NORMALISASI DATA & FORMATTING
// ==========================================================================
function isPublished(val) {
    if (val === undefined || val === null) return false;
    if (typeof val === 'boolean') return val;
    if (typeof val === 'number') return val === 1;
    if (typeof val === 'string') {
        const lower = val.trim().toLowerCase();
        if (lower === 'true' || lower === '1') return true;
        if (lower === 'false' || lower === '0') return false;
    }
    return false;
}

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
    
    const publishedVal = getPublishedValue(item);

    return {
        id: generatedId,
        judul: extractedTitle,
        kategoriUtama: getCell('Kategori Utama', 'Kategori', 'kategori') || 'Geofisika',
        jenisKonten: getCell('Jenis Konten'),
        semester: getCell('Semester'),
        kategoriUjian: getCell('Kategori Ujian'),
        sifatMK: getCell('Sifat MK'),
        mataKuliah: getCell('Mata Kuliah'),
        tanggal: getDateValue(item) || getCell('Tanggal Upload', 'Tanggal', 'tanggal') || '-',
        penulis: getCell('Penulis', 'penulis') || 'Redaksi HMGF',
        gambar_hero: getCell('Gambar Link', 'Link Video', 'Link Berkas / Video', 'gambar_hero', 'Gambar'),
        link_berkas: getCell('Link Berkas / Video'),
        isi_1: getCell('Isi Paragraf / Gambar', 'isi_1', 'Isi 1'),
        isi_2: getCell('isi_2', 'Isi 2'),
        isi_3: getCell('isi_3', 'Isi 3'),
        isi_4: getCell('isi_4', 'Isi 4'),
        isi_5: getCell('isi_5', 'Isi 5'),
        isi_6: getCell('isi_6', 'Isi 6'),
        isi_7: getCell('isi_7', 'Isi 7'),
        isi_8: getCell('isi_8', 'Isi 8'),
        isi_9: getCell('isi_9', 'Isi 9'),
        isi_10: getCell('isi_10', 'Isi 10'),
        published: publishedVal,
        jumlah: getCell('Jumlah', 'jumlah') || 0,
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

// ==========================================================================
// FETCHING DATA (SHEETDB API + GOOGLE SHEETS CSV FALLBACK)
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
            headers.forEach((header, index) => {
                const key = header || `_column_${index}`;
                item[key] = cells[index] || '';
            });
            return item;
        });
}

async function fetchFromStein(sheetName) {
    const response = await fetchWithTimeout(`${BASE_STEIN_URL}?sheet=${encodeURIComponent(sheetName)}`, { mode: 'cors' });
    if (!response.ok) {
        let message = `API Error ${response.status}`;
        try {
            const errorData = await response.json();
            if (errorData && errorData.message) message = errorData.message;
        } catch (error) {}
        throw new Error(message);
    }
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
// MEDIA & UI HANDLERS
// ==========================================================================
function getVideoData(url) {
    if (!url || typeof url !== 'string') return null;
    const str = url.split('|')[0].trim();
    if (!str) return null;

    const ytMatch = str.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch && ytMatch[1]) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0&enablejsapi=1` };

    const driveMatch = str.match(/(?:file\/d\/|id=|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) return { type: 'drive', embedUrl: `https://drive.google.com/file/d/${driveMatch[1]}/preview` };

    if (/\.(mp4|webm|ogg|m4v)(\?.*)?$/i.test(str)) return { type: 'html5', embedUrl: str };

    return null;
}

function adjustFontSize(delta) {
    const newsBody = document.getElementById('newsBody');
    if (!newsBody) return;
    currentFontSizeRem = Math.min(Math.max(currentFontSizeRem + delta, 0.85), 1.6);
    newsBody.style.fontSize = `${currentFontSizeRem}rem`;
}

function resetFontSize() {
    currentFontSizeRem = defaultFontSizeRem;
    const newsBody = document.getElementById('newsBody');
    if (newsBody) newsBody.style.fontSize = `${defaultFontSizeRem}rem`;
}

function changeLanguage(langCode) {
    const selectElem = document.querySelector('.goog-te-combo');
    if (selectElem) {
        selectElem.value = langCode;
        selectElem.dispatchEvent(new Event('change'));
    }
    document.getElementById('btn-lang-id')?.classList.remove('active');
    document.getElementById('btn-lang-en')?.classList.remove('active');
    if (langCode === 'en') document.getElementById('btn-lang-en')?.classList.add('active');
    else document.getElementById('btn-lang-id')?.classList.add('active');
}

function renderContentBlock(contentStr) {
    if (!contentStr || contentStr.trim() === '') return '';
    const trimmed = contentStr.trim();
    let rawUrl = trimmed;
    let captionText = '';

    if (trimmed.includes('|')) {
        const parts = trimmed.split('|');
        rawUrl = parts[0].trim();
        captionText = parts.slice(1).join('|').trim();
    }

    const isImageUrl = rawUrl.startsWith('http://') || rawUrl.startsWith('https://');
    const isDriveOrImage = rawUrl.includes('googleusercontent.com') ||  
                           rawUrl.includes('drive.google.com') || 
                           /\.(jpeg|jpg|gif|png|webp)$/i.test(rawUrl);

    if (isImageUrl && isDriveOrImage) {
        const imgDirectUrl = formatDriveUrl(rawUrl);
        let captionHtml = captionText ? `<figcaption style="margin-top: 8px; font-size: 0.88rem; color: #64748b; font-style: italic; text-align: center;">${captionText}</figcaption>` : '';

        return `
            <figure style="margin: 30px 0; text-align: center;">
                <img src="${imgDirectUrl}" alt="${captionText || 'Gambar Visual'}" 
                     style="max-width: 100%; height: auto; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08);"
                     onerror="this.onerror=null; this.parentElement.style.display='none';">
                ${captionHtml}
            </figure>
        `;
    } else {
        const lines = trimmed.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        return lines.map(line => {
            if (line.startsWith('## ') || line.startsWith('# ')) return `<h2>${line.replace(/#+\s*/, '')}</h2>`;
            return `<p>${line}</p>`;
        }).join('');
    }
}

function generateTableOfContents() {
    const bodyContainer = document.getElementById('newsBody');
    if (!bodyContainer) return;

    const headings = bodyContainer.querySelectorAll('h2, h3');
    const tocContainer = document.getElementById('tocContainer');
    const tocList = document.getElementById('tocList');
    
    if (headings.length === 0) {
        if (tocContainer) tocContainer.style.display = 'none';
        return;
    }
    
    if (tocList) tocList.innerHTML = '';
    headings.forEach((heading, index) => {
        const headingId = `section-heading-${index + 1}`;
        heading.setAttribute('id', headingId);
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.setAttribute('href', `#${headingId}`);
        a.innerText = heading.innerText;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        li.appendChild(a);
        if (tocList) tocList.appendChild(li);
    });
    if (tocContainer) tocContainer.style.display = 'block';
}

function getPageContextData() {
    return {
        title: document.getElementById("newsTitle")?.innerText || "",
        author: document.getElementById("newsAuthor")?.innerText || "",
        category: document.getElementById("newsCategory")?.innerText || "",
        bodyContent: document.getElementById("newsBody")?.innerText || "",
        actionBtnUrl: document.getElementById("actionBoxBtn")?.href || "",
        videoUrl: document.querySelector(".video-container iframe, .video-container video")?.src || ""
    };
}

// ==========================================================================
// CAROUSEL HANDLERS (SEPUTAR HMGF & PROKER/PRESTASI)
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
        ].filter(i => i && isPublished(i.published));
        
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
            const cleanExcerpt = (item.isi_1 || '').replace(/#+\s*/g, '').substring(0, 250) + '...';
            
            track.innerHTML += `
                <div class="carousel-card" onclick="window.location.href='berita-insight.html?judul=${encodeURIComponent(title)}'" style="cursor: pointer;">
                    <div class="card-image-box"><img src="${imgUrl}" alt="${title}" onerror="this.onerror=null; this.src='assets/earth-day.jpg';"></div>
                    <div class="card-content"><span class="card-tag">${category}</span><h3>${title}</h3><p>${cleanExcerpt}</p></div>
                </div>`;
        });
    } catch (err) { console.warn("Gagal memuat carousel kegiatan terbaru:", err); }
}

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
        ].filter(i => i && isPublished(i.published));
        
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
            const cleanExcerpt = (item.isi_1 || '').replace(/#+\s*/g, '').substring(0, 250) + '...';

            track.innerHTML += `
                <div class="carousel-card" onclick="window.location.href='berita-insight.html?judul=${encodeURIComponent(title)}'" style="cursor: pointer;">
                    <div class="card-image-box"><img src="${imgUrl}" alt="${title}" onerror="this.onerror=null; this.src='assets/earth-day.jpg';"></div>
                    <div class="card-content"><span class="card-tag">${category}</span><h3>${title}</h3><p>${cleanExcerpt}</p></div>
                </div>`;
        });
    } catch (err) { console.warn("Gagal memuat carousel proker:", err); }
}

// ==========================================================================
// RENDER HALAMAN UTAMA (GEOLIBRARY / INSIGHT)
// ==========================================================================
async function loadBeritaUtama() {
    try {
        const [rawGeolibrary, rawHMGF, rawSEG, allAuthors] = await Promise.all([
            fetchSheetData(SHEET_GEOLIBRARY).catch(err => { console.error(err); return []; }),
            fetchSheetData(SHEET_HMGF).catch(err => { console.error(err); return []; }),
            fetchSheetData(SHEET_SEG).catch(err => { console.error(err); return []; }),
            fetchSheetData(SHEET_PENULIS).catch(err => { console.error(err); return []; })
        ]);

        const articlesGeo = (Array.isArray(rawGeolibrary) ? rawGeolibrary : []).map(item => normalizeArticleData(item, SHEET_GEOLIBRARY));
        const articlesHMGF = (Array.isArray(rawHMGF) ? rawHMGF : []).map(item => normalizeArticleData(item, SHEET_HMGF));
        const articlesSEG = (Array.isArray(rawSEG) ? rawSEG : []).map(item => normalizeArticleData(item, SHEET_SEG));

        const articles = [...articlesGeo, ...articlesHMGF, ...articlesSEG].filter(Boolean);
        const publishedArticles = articles.filter(item => isPublished(item.published));

        let currentArticle = null;
        
        if (TARGET_JUDUL) {
            const normalizedTarget = normalizeTitle(TARGET_JUDUL);
            const found = articles.find(item => item && normalizeTitle(item.judul) === normalizedTarget);
            
            if (found && isPublished(found.published)) {
                currentArticle = found;
            } else {
                currentArticle = null;
            }
        } else if (publishedArticles.length > 0) {
            currentArticle = publishedArticles[0];
        }

        if (currentArticle) {
            currentArticleId = String(currentArticle.id);
            currentArticleTitle = currentArticle.judul;

            document.title = `${currentArticle.judul} - HMGF UGM`;
            if (document.getElementById('newsTitle')) document.getElementById('newsTitle').innerText = currentArticle.judul;
            
            const heroHeader = document.getElementById('heroHeader');
            if (currentArticle.gambar_hero && heroHeader) {
                heroHeader.style.backgroundImage = `url('${formatDriveUrl(currentArticle.gambar_hero)}')`;
            }

            const namaPenulis = currentArticle.penulis || 'Redaksi HMGF';
            if (document.getElementById('heroNewsAuthor')) document.getElementById('heroNewsAuthor').innerText = `— ${namaPenulis}`;
            if (document.getElementById('newsAuthor')) document.getElementById('newsAuthor').innerText = namaPenulis;
            if (document.getElementById('newsDate')) document.getElementById('newsDate').innerText = currentArticle.tanggal || '-';
            
            const kategoriText = currentArticle.mataKuliah || currentArticle.kategoriUtama || 'HMGF Update';
            if (document.getElementById('newsCategory')) document.getElementById('newsCategory').innerText = kategoriText;
            if (document.getElementById('badgeCategoryText')) document.getElementById('badgeCategoryText').innerText = kategoriText;

            const geolibraryBadges = document.getElementById('geolibraryBadges');
            if (currentArticle.sourceSheet === SHEET_GEOLIBRARY) {
                if (geolibraryBadges) geolibraryBadges.style.display = 'flex';
                if (document.getElementById('geoMataKuliah')) document.getElementById('geoMataKuliah').innerText = currentArticle.mataKuliah || '-';
                if (document.getElementById('geoSemester')) document.getElementById('geoSemester').innerText = currentArticle.semester || '-';
                if (document.getElementById('geoKategoriUjian')) document.getElementById('geoKategoriUjian').innerText = currentArticle.kategoriUjian || '-';
                if (document.getElementById('geoSifatMK')) document.getElementById('geoSifatMK').innerText = currentArticle.sifatMK || '-';
                if (document.getElementById('geoJenisKonten')) document.getElementById('geoJenisKonten').innerText = currentArticle.jenisKonten || '-';
            } else {
                if (geolibraryBadges) geolibraryBadges.style.display = 'none'; 
            }

            const actionBox = document.getElementById('actionBox');
            const actionBoxBtn = document.getElementById('actionBoxBtn');
            const videoPlayerSection = document.getElementById('videoPlayerSection');
            const videoContainer = document.getElementById('videoContainer');
            const linkBerkas = currentArticle.link_berkas || "";
            
            if (videoPlayerSection) videoPlayerSection.style.display = 'none';
            if (actionBox) actionBox.style.display = 'none';

            const videoData = getVideoData(linkBerkas);

            if (videoData && videoPlayerSection) {
                videoPlayerSection.style.display = 'block';
                const targetContainer = videoContainer || videoPlayerSection;
                if (videoData.type === 'youtube' || videoData.type === 'drive') {
                    targetContainer.innerHTML = `<iframe src="${videoData.embedUrl}" title="${currentArticle.judul}" style="position: absolute; top:0; left:0; width:100%; height:100%; border:0; pointer-events: auto;" allow="autoplay; accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
                } else if (videoData.type === 'html5') {
                    targetContainer.innerHTML = `<video controls autoplay muted style="position: absolute; top:0; left:0; width:100%; height:100%; pointer-events: auto;"><source src="${videoData.embedUrl}" type="video/mp4">Browser Anda tidak mendukung pemutar video HTML5.</video>`;
                }
            }

            if (linkBerkas && linkBerkas.trim() !== '' && linkBerkas !== '#' && !videoData) {
                if (actionBox) actionBox.style.display = 'block';
                if (actionBoxBtn) actionBoxBtn.href = linkBerkas;
            }

            const bodyContainer = document.getElementById('newsBody');
            if (bodyContainer) {
                bodyContainer.innerHTML = '';
                for (let i = 1; i <= 13; i++) {
                    const key = `isi_${i}`;
                    if (currentArticle[key]) bodyContainer.innerHTML += renderContentBlock(currentArticle[key]);
                }
                bodyContainer.innerHTML += `<p class="berita-author-credit" style="font-style: italic; color: #64748b; margin-top: 1.5rem; text-align: right; font-weight: 500;">— ${namaPenulis}</p>`;
            }

            generateTableOfContents();

            if (window.MathJax && window.MathJax.typesetPromise && bodyContainer) {
                window.MathJax.typesetPromise([bodyContainer]).catch(err => console.error("MathJax error:", err));
            }
            
            renderAuthorProfile(namaPenulis, allAuthors);
            renderRelatedArticles(publishedArticles, currentArticle.judul);
            loadComments();
        } else {
            document.title = "404 Tidak Ditemukan - HMGF UGM";
            if (document.getElementById('newsTitle')) document.getElementById('newsTitle').innerText = "404 - Konten Tidak Ditemukan";
            if (document.getElementById('heroNewsAuthor')) document.getElementById('heroNewsAuthor').innerText = "";
            if (document.getElementById('newsBody')) document.getElementById('newsBody').innerHTML = `<p style='text-align:center; text-indent:0;'>Maaf, dokumen atau berita ini belum dipublikasikan atau tidak ditemukan.</p>`;
            if (document.getElementById('relatedArticlesContainer')) document.getElementById('relatedArticlesContainer').innerHTML = '<p style="color:#64748b;">Tidak ada artikel terkait.</p>';
            
            if (document.getElementById('authorProfileBox')) document.getElementById('authorProfileBox').style.display = 'none';
            if (document.getElementById('commentsSection')) document.getElementById('commentsSection').style.display = 'none';
            if (document.getElementById('geolibraryBadges')) document.getElementById('geolibraryBadges').style.display = 'none';
            if (document.getElementById('aiDiscussionContainer')) document.getElementById('aiDiscussionContainer').style.display = 'none';
        }
    } catch (error) {
        console.error("Gagal memuat dokumen:", error);
        if (document.getElementById('newsTitle')) document.getElementById('newsTitle').innerText = "Gagal Memuat Berita";
        if (document.getElementById('heroNewsAuthor')) document.getElementById('heroNewsAuthor').innerText = "";
    }
}

function renderAuthorProfile(namaPenulis, authorsList) {
    const authorImgEl = document.getElementById('authorImage');
    const fallbackEl = document.getElementById('authorAvatarFallback');
    const nameEl = document.getElementById('authorName');
    const bioEl = document.getElementById('authorBio');

    if (nameEl) nameEl.innerText = namaPenulis;

    const matchedAuthor = Array.isArray(authorsList) ? authorsList.find(a => 
        (a.nama_penulis || a.Nama || a['Nama Penulis'] || a.Penulis || '').trim().toLowerCase() === namaPenulis.toLowerCase()
    ) : null;

    if (matchedAuthor) {
        if (bioEl) bioEl.innerText = matchedAuthor.deskripsi_penulis || matchedAuthor.Deskripsi || matchedAuthor['Deskripsi Penulis'] || 'Penulis aktif di HMGF UGM.';
        const photoUrl = matchedAuthor.foto_penulis || matchedAuthor.url_foto || matchedAuthor.Foto || matchedAuthor['Foto Penulis'];
        if (photoUrl && authorImgEl && fallbackEl) {
            authorImgEl.src = formatDriveUrl(photoUrl);
            authorImgEl.style.display = 'block';
            fallbackEl.style.display = 'none';
            authorImgEl.onerror = () => { authorImgEl.style.display = 'none'; fallbackEl.style.display = 'flex'; };
        } else {
            if (authorImgEl) authorImgEl.style.display = 'none';
            if (fallbackEl) fallbackEl.style.display = 'flex';
        }
    } else {
        if (bioEl) bioEl.innerText = 'Tim Redaksi HMGF UGM yang berfokus menyajikan informasi akademik & geofisika.';
        if (authorImgEl) authorImgEl.style.display = 'none';
        if (fallbackEl) fallbackEl.style.display = 'flex';
    }
}

function renderRelatedArticles(publishedArticles, currentJudul) {
    const container = document.getElementById('relatedArticlesContainer');
    if (!container) return;
    container.innerHTML = '';

    const normalizedCurrent = normalizeTitle(currentJudul);
    const otherArticles = publishedArticles.filter(item => item.judul && normalizeTitle(item.judul) !== normalizedCurrent);

    if (otherArticles.length === 0) {
        container.innerHTML = '<p style="color:#64748b;">Belum ada arsip terkait lainnya.</p>';
        return;
    }

    const shuffled = [...otherArticles].sort(() => 0.5 - Math.random());
    shuffled.slice(0, 3).forEach(item => {
        const targetPage = item.sourceSheet === SHEET_GEOLIBRARY ? 'geolibrary.html' : 'berita-insight.html';
        const cardImg = formatDriveUrl(item.gambar_hero) || 'assets/SEG_News/pantai.png';

        container.innerHTML += `
            <a href="${targetPage}?judul=${encodeURIComponent(item.judul)}" class="related-card">
                <img src="${cardImg}" alt="${item.judul}" onerror="this.onerror=null;this.src='assets/SEG_News/pantai.png';">
                <div class="related-card-overlay">
                    <h4 class="related-card-title">${item.judul}</h4>
                </div>
            </a>
        `;
    });
}

// ==========================================================================
// COMMENTS SECTION (DENGAN SINKRONISASI PENGIRIMAN SHEETDB KONSISTEN)
// ==========================================================================
async function loadComments() {
    if (!currentArticleId && !currentArticleTitle) return;
    try {
        const rawComments = await fetchSheetData(SHEET_COMMENTS);
        commentsArray = (Array.isArray(rawComments) ? rawComments : []).filter(comment => {
            const cId = String(comment.id || comment.news_id || comment.News_ID || comment.newsId || '').trim();
            const cLink = String(comment.judul_berita || comment.link_berita || '').trim();
            return cId === currentArticleId || cLink === currentArticleTitle || cLink === window.location.href;
        });
        renderComments();
    } catch (error) {
        console.error("Gagal memuat komentar:", error);
    }
}

function renderComments() {
    const commentsList = document.getElementById('commentsList');
    if (!commentsList) return;

    const total = Array.isArray(commentsArray) ? commentsArray.length : 0;
    if (document.getElementById('commentsCountTitle')) document.getElementById('commentsCountTitle').innerText = total;
    if (document.getElementById('commentsCountMeta')) document.getElementById('commentsCountMeta').innerText = total === 0 ? "No comments" : `${total} Komentar`;

    if (total === 0) {
        commentsList.innerHTML = `<div id="noCommentsBox" style="padding: 30px; text-align: center; background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 12px; color: #64748b;"><i class="fa-regular fa-comments" style="font-size: 2rem; margin-bottom: 10px; display: block; color: #000000;"></i>Belum ada komentar. Jadilah yang pertama memberikan tanggapan!</div>`;
        return;
    }

    commentsList.innerHTML = commentsArray.map(c => {
        const nameVal = c.name || c.Nama || 'Anonim';
        const initial = nameVal.charAt(0).toUpperCase();
        const textVal = c.text || c.Pesan || '';
        const dateVal = c.date || c.Tanggal || '';

        return `
            <div class="comment-card" style="display: flex; gap: 16px; background: #f8fafc; padding: 18px; border-radius: 12px; margin-bottom: 16px; border: 1px solid #e2e8f0;">
                <div class="comment-avatar-circle" style="width: 42px; height: 42px; border-radius: 50%; background: #0f172a; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">${initial}</div>
                <div class="comment-content" style="flex: 1;">
                    <div class="comment-top-info" style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                        <span class="comment-author-name" style="font-weight: 700; color: #0f172a;">${nameVal}</span>
                        <span style="font-size: 0.8rem; color: #94a3b8;">${dateVal}</span>
                    </div>
                    <p class="comment-body-text" style="margin: 0; color: #334155; font-size: 0.95rem; line-height: 1.5; text-indent: 0 !important;">${textVal}</p>
                </div>
            </div>
        `;
    }).join('');
}

async function submitComment(e) {
    if (e && e.preventDefault) e.preventDefault();

    const btn = document.getElementById('btnSubmitComment');
    const nameEl = document.getElementById('commentName');
    const emailEl = document.getElementById('commentEmail');
    const textEl = document.getElementById('commentText');

    const nameVal = nameEl ? nameEl.value.trim() : '';
    const emailVal = emailEl ? emailEl.value.trim() : '';
    const textVal = textEl ? textEl.value.trim() : '';

    if (!nameVal || !emailVal || !textVal) {
        alert("Nama, Email, dan Komentar wajib diisi.");
        return;
    }

    const originalBtnText = btn ? btn.innerHTML : "Kirim Komentar";
    if (btn) { 
        btn.disabled = true; 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Mengirim...'; 
    }

    // Objek komentar sesuai struktur SheetDB
    const commentRecord = {
        id: currentArticleId || "INSIGHT_COMMENT",
        judul_berita: currentArticleTitle || window.location.href,
        name: nameVal,
        email: emailVal,
        text: textVal,
        date: new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric' })
    };

    // Payload disesuaikan dengan standar SheetDB (?sheet=Comments & data: [...])
    const payload = {
        data: [commentRecord]
    };

    try {
        const response = await fetch(`${BASE_STEIN_URL}?sheet=${encodeURIComponent(SHEET_COMMENTS)}`, {
            method: 'POST',
            headers: { 
                'Accept': 'application/json',
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`API Error: ${response.status}`);

        commentsArray.push(commentRecord);
        renderComments();
        document.getElementById('commentForm')?.reset();
        alert("Komentar Anda berhasil terkirim!");
    } catch (err) {
        console.error("Gagal mengirim komentar:", err);
        alert("Maaf, terjadi kesalahan saat mengirim komentar. Silakan coba beberapa saat lagi.");
    } finally {
        if (btn) { 
            btn.disabled = false; 
            btn.innerHTML = originalBtnText; 
        }
    }
}

// ==========================================================================
// N8N AI INTEGRATION (IN-PAGE & WIDGET)
// ==========================================================================
async function fetchAIResponseFromN8N(userQuery) {
    const payload = { message: userQuery, context: getPageContextData(), timestamp: new Date().toISOString() };
    try {
        const response = await fetch(N8N_WEBHOOK_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        const data = await response.json();
        return data.reply || data.output || data.message || "Maaf, tidak mengembalikan respon teks.";
    } catch (error) {
        console.error("Webhook Error:", error);
        return "Maaf, gagal terhubung ke server AI.";
    }
}

async function handleInpageAISend() {
    const inputEl = document.getElementById('inpage-ai-input');
    if (!inputEl) return;
    const query = inputEl.value.trim();
    if (!query) return;

    appendInpageBubble('user', query);
    inputEl.value = '';

    const loadingId = appendInpageBubble('bot', '<i>GeoBot sedang memproses...</i>');
    const aiResponseText = await fetchAIResponseFromN8N(query);
    
    const botMsgElement = document.getElementById(loadingId);
    if (botMsgElement) botMsgElement.innerHTML = formatMarkdown(aiResponseText);
    speakText(aiResponseText.replace(/[\*#_]/g, ''));
}

function appendInpageBubble(sender, text) {
    const thread = document.getElementById('inpage-ai-thread');
    if (!thread) return '';
    const msgId = 'inpage-msg-' + Date.now();
    const isUser = sender === 'user';
    const html = `<div class="ai-chat-bubble ${isUser ? 'user' : 'bot'}"><div class="ai-avatar"><i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i></div><div class="ai-message-content" id="${msgId}">${text}</div></div>`;
    thread.insertAdjacentHTML('beforeend', html);
    thread.scrollTop = thread.scrollHeight;
    return msgId;
}

async function handleWidgetSend() {
    const inputEl = document.getElementById("geobot-input");
    if (!inputEl) return;
    const query = inputEl.value.trim();
    if (!query) return;

    appendWidgetMessage("user", query);
    inputEl.value = "";

    const loadingId = appendWidgetMessage("bot", "<i>GeoBot sedang memproses via n8n...</i>");
    const responseText = await fetchAIResponseFromN8N(query);

    updateWidgetMessage(loadingId, formatMarkdown(responseText));
    speakText(responseText.replace(/[\*#_]/g, ''));
}

function appendWidgetMessage(sender, text) {
    const container = document.getElementById("geobot-messages");
    if (!container) return '';
    const msgId = "msg-" + Date.now();
    const isUser = sender === "user";
    const msgHTML = `<div id="${msgId}" class="geobot-msg ${isUser ? 'user-msg' : 'bot-msg'}" style="background: ${isUser ? '#0f172a' : '#ffffff'}; color: ${isUser ? '#ffffff' : '#1e293b'}; border: ${isUser ? 'none' : '1px solid #e2e8f0'}; padding: 10px 14px; border-radius: 12px; max-width: 85%; align-self: ${isUser ? 'flex-end' : 'flex-start'}; line-height: 1.4;">${text}</div>`;
    container.insertAdjacentHTML("beforeend", msgHTML);
    container.scrollTop = container.scrollHeight;
    return msgId;
}

function updateWidgetMessage(msgId, text) {
    const msgElem = document.getElementById(msgId);
    if (msgElem) {
        msgElem.innerHTML = text;
        const container = document.getElementById("geobot-messages");
        if (container) container.scrollTop = container.scrollHeight;
    }
}

function formatMarkdown(text) {
    if (!text) return '';
    return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
}

function speakText(text) {
    if (!syntheticVoice) return;
    try {
        syntheticVoice.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        syntheticVoice.speak(utterance);
    } catch (e) { console.error("Speech synthesis error:", e); }
}

// ==========================================================================
// INISIALISASI & GLOBAL WINDOW BINDS
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    if (typeof fetchNavbarAndFooter === 'function') fetchNavbarAndFooter();
    if (document.getElementById('newsTitle') || document.getElementById('newsBody')) loadBeritaUtama();
    if (document.getElementById('carouselTrackHMGF')) initLatestNewsCarousel();
    if (document.getElementById('carouselTrackProker')) initProkerCarousel();

    const toggleBtn = document.getElementById("geobot-toggle-btn");
    const closeBtn = document.getElementById("geobot-close-btn");
    const chatWindow = document.getElementById("geobot-chat-window");

    if (toggleBtn && chatWindow) {
        toggleBtn.addEventListener("click", () => {
            const isHidden = window.getComputedStyle(chatWindow).display === "none";
            chatWindow.style.display = isHidden ? "flex" : "none";
            if (isHidden) document.getElementById("geobot-input")?.focus();
        });
    }
    if (closeBtn && chatWindow) closeBtn.addEventListener("click", () => chatWindow.style.display = "none");

    document.getElementById("geobot-send-btn")?.addEventListener("click", handleWidgetSend);
    document.getElementById("geobot-input")?.addEventListener("keypress", (e) => { if (e.key === 'Enter') handleWidgetSend(); });
    document.getElementById("geobot-mic-btn")?.addEventListener("click", () => toggleVoiceInput('widget'));
});

window.submitComment = submitComment;
window.adjustFontSize = adjustFontSize;
window.resetFontSize = resetFontSize;
window.changeLanguage = changeLanguage;
window.toggleVoiceInput = toggleVoiceInput;
window.handleInpageAISend = handleInpageAISend;
window.handleWidgetSend = handleWidgetSend;