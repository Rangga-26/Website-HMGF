// ==========================================================================
// KONFIGURASI ENDPOINT & CONSTANTS TABEL TIMELINE
// ==========================================================================
// Menggunakan SheetDB sesuai dengan halaman lain
const BASE_API_URL = "https://sheetdb.io/api/v1/h8t8pf39u16ad";
const GOOGLE_SHEET_ID = "1Ax_Dlms14qXoxsZgTklFBE1mOuH5DJmb3OJiO6kSnng";
const SHEET_TIMELINE = "Timeline";
// Menggunakan GID spesifik untuk fallback yang lebih stabil
const SHEET_TIMELINE_GID = "763924079"; 
const DATA_FETCH_TIMEOUT_MS = 15000;

// Pemetaan Warna Sesuai Kategori / Divisi
const DIVISI_COLORS = {
    "PENGURUS INTI": "#eab308",
    "DEPARTEMEN PSDM": "#22c55e",
    "DEPARTEMEN MINKAT": "#d946ef",
    "DEPARTEMEN HUMAS": "#06b6d4",
    "DEPARTEMEN INTERNAL": "#3b82f6",
    "DEPARTEMEN MEDINFO": "#a855f7",
    "DEPARTEMEN AKADEMIK": "#8b5cf6",
    "DEPARTEMEN KEWIRAUSAHAAN": "#64748b",
    "DEPARTEMEN SOSMAS": "#00d5ff",
    "SEG UGM-SC": "#4f46e5"
};
const DEFAULT_COLOR = "#3b82f6";

// Global State Kalender & Timeline
const calendarState = {
    currentDate: new Date(2026, 3, 1), // April 2026
    allEvents: [],
    filteredEvents: []
};

// ==========================================================================
// HELPER FUNCTIONS: PARSING TANGGAL & NORMALISASI DATA SPREADSHEET
// ==========================================================================

/**
 * Mengubah format tanggal acak dari Spreadsheet (misal: DD/MM/YYYY) 
 * menjadi format standar ISO YYYY-MM-DD
 */
function normalizeDateStr(dateStr) {
    if (!dateStr) return '';
    const cleanStr = String(dateStr).trim();
    
    // Sudah berformat YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) return cleanStr;
    
    // Format DD/MM/YYYY atau DD-MM-YYYY
    const ddmmyyyy = cleanStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
    }

    return cleanStr;
}

/**
 * Pemetaan kolom dari Google Spreadsheet ke Objek Standar JavaScript
 * Memetakan: id, nama_kegiatan, divisi_departemen, tanggal_mulai, 
 * tanggal_selesai, deskripsi, lokasi, link_kegiatan, HMGF_SEG
 */
function normalizeTimelineData(item) {
    if (!item) return null;

    const getCell = (...keys) => {
        for (const key of keys) {
            if (item[key] !== undefined && item[key] !== null) {
                return String(item[key]).trim();
            }
        }
        return '';
    };

    const namaKegiatan = getCell('nama_kegiatan', 'Nama Kegiatan', 'nama', 'judul', 'Nama');
    const generatedId = String(getCell('id', 'ID', 'Id') || namaKegiatan.toLowerCase().replace(/[^a-z0-9]+/g, '-'));

    const tglMulai = normalizeDateStr(getCell('tanggal_mulai', 'Tanggal Mulai', 'mulai'));
    let tglSelesai = normalizeDateStr(getCell('tanggal_selesai', 'Tanggal Selesai', 'selesai'));
    if (!tglSelesai) tglSelesai = tglMulai;

    return {
        id: generatedId,
        nama_kegiatan: namaKegiatan,
        divisi_departemen: getCell('divisi_departemen', 'Divisi', 'Departemen', 'divisi'),
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        deskripsi: getCell('deskripsi', 'Deskripsi', 'desc'),
        lokasi: getCell('lokasi', 'Lokasi', 'tempat'),
        link_kegiatan: getCell('link_kegiatan', 'Link Kegiatan', 'link'),
        HMGF_SEG: getCell('HMGF_SEG', 'hmgf_seg', 'Entitas', 'SEG') || 'HMGF'
    };
}

// Normalisasi Penamaan Divisi / Departemen
function normalizeDivisi(divisiStr) {
    if (!divisiStr) return 'PENGURUS INTI';
    const clean = divisiStr.trim().toUpperCase();
    
    if (['KAHIM', 'SEKJEN', 'SEKRETARIS', 'BENDAHARA', 'PENGURUS INTI', 'PRESIDENT', 'SECRETARY', 'TREASURER'].includes(clean)) {
        return 'PENGURUS INTI';
    }
    if (clean.includes('PSDM')) return 'DEPARTEMEN PSDM';
    if (clean.includes('MINKAT')) return 'DEPARTEMEN MINKAT';
    if (clean.includes('HUMAS')) return 'DEPARTEMEN HUMAS';
    if (clean.includes('INTERNAL')) return 'DEPARTEMEN INTERNAL';
    if (clean.includes('MEDINFO')) return 'DEPARTEMEN MEDINFO';
    if (clean.includes('AKADEMIK')) return 'DEPARTEMEN AKADEMIK';
    if (clean.includes('KEWIRUS') || clean.includes('KEWIRAUSAHAAN')) return 'DEPARTEMEN KEWIRAUSAHAAN';
    if (clean.includes('SOSMAS')) return 'DEPARTEMEN SOSMAS';
    if (clean.includes('SEG')) return 'SEG UGM-SC';

    return clean;
}

// Helper Fetch dengan Timeout
async function fetchWithTimeout(url, options = {}, timeoutMs = DATA_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// Parser CSV dari Google Sheets Export
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

// ==========================================================================
// INTEGRASI FETCH DATA SPREADSHEET (SHEETDB & GOOGLE SHEETS CSV FALLBACK)
// ==========================================================================

async function fetchTimelineFromAPI() {
    // Menggunakan parameter ?sheet= untuk memanggil tab spesifik dari SheetDB
    const response = await fetchWithTimeout(`${BASE_API_URL}?sheet=${encodeURIComponent(SHEET_TIMELINE)}`, { mode: 'cors' });
    if (!response.ok) throw new Error(`API SheetDB Error ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error("Format data API tidak valid.");
    return data;
}

async function fetchTimelineFromGoogleSheet() {
    // Memanggil CSV menggunakan GID spesifik
    const csvUrl = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID}/gviz/tq?tqx=out:csv&gid=${SHEET_TIMELINE_GID}`;
    const response = await fetchWithTimeout(csvUrl, { mode: 'cors' });
    if (!response.ok) throw new Error(`Google Sheets CSV Error ${response.status}`);
    return parseGoogleSheetCsv(await response.text());
}

async function initTimelineData() {
    try {
        const rawData = await fetchTimelineFromAPI();
        calendarState.allEvents = rawData.map(normalizeTimelineData).filter(Boolean);
    } catch (err) {
        console.warn("Gagal memuat API SheetDB, mencoba fallback CSV Google Sheets...", err);
        try {
            const rawCsv = await fetchTimelineFromGoogleSheet();
            calendarState.allEvents = rawCsv.map(normalizeTimelineData).filter(Boolean);
        } catch (csvErr) {
            console.error("Gagal memuat data dari seluruh sumber, menggunakan data fallback:", csvErr);
            calendarState.allEvents = [
                {
                    id: "7",
                    nama_kegiatan: "SFID #1",
                    divisi_departemen: "SEG UGM-SC",
                    tanggal_mulai: "2026-04-18",
                    tanggal_selesai: "2026-04-18",
                    deskripsi: "Program kerja SEG (Society of Exploration Geophysicists) Student Chapter edisi pertama.",
                    lokasi: "Kampus / Online",
                    link_kegiatan: "-",
                    HMGF_SEG: "SEG"
                }
            ];
        }
    }

    renderLegend();
    renderCalendar();
}

// ==========================================================================
// RENDER UI KALENDER & LEGEND
// ==========================================================================

function renderLegend() {
    const legendContainer = document.getElementById('legendContainer');
    if (!legendContainer) return;
    
    legendContainer.innerHTML = '';

    const listDivisi = [
        "PENGURUS INTI", "DEPARTEMEN PSDM", "DEPARTEMEN MINKAT", 
        "DEPARTEMEN HUMAS", "DEPARTEMEN INTERNAL", "DEPARTEMEN MEDINFO", 
        "DEPARTEMEN AKADEMIK", "DEPARTEMEN KEWIRAUSAHAAN", "DEPARTEMEN SOSMAS", "SEG UGM-SC"
    ];

    listDivisi.forEach(divisi => {
        const color = DIVISI_COLORS[divisi] || DEFAULT_COLOR;
        legendContainer.innerHTML += `
            <div class="legend-item">
                <div class="legend-color-box" style="background-color: ${color};"></div>
                <span class="legend-text">${divisi}</span>
            </div>
        `;
    });
}

function renderCalendar() {
    const calendarBody = document.getElementById('calendarBody');
    const monthDisplay = document.getElementById('monthDisplay');
    const divisiFilterEl = document.getElementById('divisiFilter');
    const selectedDivisi = divisiFilterEl ? divisiFilterEl.value : 'ALL';

    if (!calendarBody || !monthDisplay) return;

    const year = calendarState.currentDate.getFullYear();
    const month = calendarState.currentDate.getMonth();

    const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    monthDisplay.innerText = `${monthNames[month]} ${year}`;

    calendarBody.innerHTML = '';

    const firstDayOfMonth = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Sel Hari Bulan Sebelumnya
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const dayNum = daysInPrevMonth - i;
        calendarBody.innerHTML += `<div class="calendar-day-cell other-month"><span class="day-number">${dayNum}</span></div>`;
    }

    // Sel Hari Bulan Berjalan
    const today = new Date();
    for (let day = 1; day <= daysInMonth; day++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateString = `${year}-${monthStr}-${dayStr}`;
        
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
        const todayClass = isToday ? 'today' : '';

        // Filter event sesuai tanggal & kriteria divisi
        const dayEvents = calendarState.allEvents.filter(event => {
            if (!event.tanggal_mulai) return false;

            const mappedDivisi = normalizeDivisi(event.divisi_departemen);
            const matchesDivisi = selectedDivisi === 'ALL' || mappedDivisi === selectedDivisi;

            const isSingleDate = event.tanggal_mulai === dateString;
            const isRangeDate = event.tanggal_selesai && (dateString >= event.tanggal_mulai && dateString <= event.tanggal_selesai);

            return matchesDivisi && (isSingleDate || isRangeDate);
        });

        let eventsHtml = '';
        dayEvents.forEach(e => {
            const divisiKey = normalizeDivisi(e.divisi_departemen);
            const bgColor = DIVISI_COLORS[divisiKey] || DEFAULT_COLOR;
            const isLight = ['PENGURUS INTI', 'DEPARTEMEN SOSMAS'].includes(divisiKey);
            const textColor = isLight ? '#0f172a' : '#ffffff';

            const safeEventJson = JSON.stringify(e).replace(/'/g, "&apos;");

            eventsHtml += `
                <div class="event-badge" 
                     style="background-color: ${bgColor}; color: ${textColor};" 
                     onclick='openModal(${safeEventJson})' 
                     title="${e.nama_kegiatan}">
                    <span class="badge-entity">[${e.HMGF_SEG || 'HMGF'}]</span> ${e.nama_kegiatan}
                </div>
            `;
        });

        calendarBody.innerHTML += `
            <div class="calendar-day-cell ${todayClass}">
                <span class="day-number">${day}</span>
                <div class="events-list">${eventsHtml}</div>
            </div>
        `;
    }

    // Sel Hari Bulan Berikutnya
    const totalCells = firstDayOfMonth + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let j = 1; j <= remainingCells; j++) {
        calendarBody.innerHTML += `<div class="calendar-day-cell other-month"><span class="day-number">${j}</span></div>`;
    }
}

function changeMonth(delta) {
    calendarState.currentDate.setMonth(calendarState.currentDate.getMonth() + delta);
    renderCalendar();
}

// ==========================================================================
// HANDLER MODAL DETAIL EVENT
// ==========================================================================

function openModal(eventObj) {
    const modal = document.getElementById('eventModal');
    if (!modal) return;

    const divisiKey = normalizeDivisi(eventObj.divisi_departemen);
    const entityKey = eventObj.HMGF_SEG ? eventObj.HMGF_SEG.toUpperCase() : 'HMGF';
    
    const bgColor = DIVISI_COLORS[divisiKey] || DEFAULT_COLOR;
    const isLight = ['PENGURUS INTI', 'DEPARTEMEN SOSMAS'].includes(divisiKey);
    const textColor = isLight ? '#0f172a' : '#ffffff';

    const entityTag = document.getElementById('modalEntityTag');
    if (entityTag) {
        entityTag.innerText = entityKey;
        entityTag.className = `modal-entity-tag tag-${entityKey.toLowerCase()}`;
    }

    const tagEl = document.getElementById('modalDivisiTag');
    if (tagEl) {
        tagEl.innerText = divisiKey;
        tagEl.style.backgroundColor = bgColor;
        tagEl.style.color = textColor;
    }

    if (document.getElementById('modalTitle')) {
        document.getElementById('modalTitle').innerText = eventObj.nama_kegiatan || 'Agenda Kegiatan';
    }
    
    let dateText = eventObj.tanggal_mulai || '-';
    if (eventObj.tanggal_selesai && eventObj.tanggal_selesai !== eventObj.tanggal_mulai) {
        dateText += ` s/d ${eventObj.tanggal_selesai}`;
    }
    if (document.getElementById('modalDate')) {
        document.getElementById('modalDate').innerText = dateText;
    }

    const locBox = document.getElementById('modalLocationBox');
    if (locBox) {
        if (eventObj.lokasi && eventObj.lokasi !== '-') {
            locBox.style.display = 'flex';
            if (document.getElementById('modalLocation')) {
                document.getElementById('modalLocation').innerText = eventObj.lokasi;
            }
        } else {
            locBox.style.display = 'none';
        }
    }

    if (document.getElementById('modalDescription')) {
        document.getElementById('modalDescription').innerText = eventObj.deskripsi || 'Tidak ada deskripsi tambahan untuk agenda ini.';
    }

    const actionBox = document.getElementById('modalActionBox');
    const linkBtn = document.getElementById('modalLinkBtn');
    if (actionBox && linkBtn) {
        if (eventObj.link_kegiatan && eventObj.link_kegiatan.trim() !== '' && eventObj.link_kegiatan !== '-') {
            actionBox.style.display = 'block';
            linkBtn.href = eventObj.link_kegiatan.startsWith('http') ? eventObj.link_kegiatan : `https://${eventObj.link_kegiatan}`;
        } else {
            actionBox.style.display = 'none';
        }
    }

    modal.style.display = 'flex';
}

function closeModal(e) {
    if (!e || e.target.id === 'eventModal' || e.target.closest('.modal-close-btn')) {
        const modal = document.getElementById('eventModal');
        if (modal) modal.style.display = 'none';
    }
}

// Inisialisasi Aplikasi Saat DOM Selesai Dimuat
document.addEventListener('DOMContentLoaded', () => {
    initTimelineData();
});