/**
 * GEOBOT-AI & BERITA INSIGHT INTEGRATION JS
 * Logika Integrasi SteinHQ Database API & n8n Webhook Payload Engine
 * Mendukung Sheet: Seputar HMGF (Ditambah Navbar & AuthorProfile dari versi Geolibrary)
 */

'use strict';

// ==========================================================================
// 1. KONFIGURASI N8N WEBHOOK API URL & STEINHQ ENDPOINT
// ==========================================================================
const N8N_WEBHOOK_URL = "https://n8nn.gama-geofisika.web.id/webhook/geobot"; 
const BASE_STEIN_URL = "https://api.steinhq.com/v1/storages/6a87a0e892b1163e97337b0d";
const SHEET_BERITA = "Seputar HMGF"; 
const SHEET_COMMENTS = "Comments";
const SHEET_PENULIS = "Penulis";

// Batas waktu (ms)
const WEBHOOK_TIMEOUT_MS = 45000;
const STEIN_TIMEOUT_MS = 15000;

// Parsing Parameter URL
const urlParams = new URLSearchParams(window.location.search);
let rawJudul = urlParams.get('judul') || urlParams.get('title');
if (!rawJudul && window.location.search) {
    const searchStr = window.location.search.substring(1);
    if (!searchStr.includes('=')) {
        rawJudul = searchStr;
    }
}
const TARGET_JUDUL = rawJudul ? decodeURIComponent(rawJudul).trim() : "";

// Global Variables
let currentArticleId = "";
let currentArticleTitle = "";
let commentsArray = [];
let currentFontSizeRem = 1.1;
let isWidgetSending = false;
let isInpageSending = false;

// Web Speech API Voice Recognition & Synthesis
let syntheticVoice = window.speechSynthesis || null;
let recognition = null;
let isRecording = false;
let activeMicTarget = null; // 'inpage' atau 'widget'

if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.lang = 'id-ID';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = function() {
        isRecording = true;
        updateMicButtonUI(activeMicTarget, true);
    };

    recognition.onresult = function(event) {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }

        const inputEl = activeMicTarget === 'inpage' ? $id('inpage-ai-input') : $id('geobot-input');
        if (inputEl) inputEl.value = transcript;
    };

    recognition.onerror = function() { stopVoiceInput(); };
    recognition.onend = function() { stopVoiceInput(); };
}

// ==========================================================================
// 2. HELPER UMUM & UI
// ==========================================================================
function $id(id) { return document.getElementById(id); }

function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timer);
    }
}

// Normalisasi Judul untuk Pencarian
function normalizeTitle(str) {
    return String(str || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function isPublished(val) {
    return val === true || val === 'TRUE' || val === 'true' || val === 1 || val === '1';
}

function adjustFontSize(delta) {
    const body = $id('newsBody');
    if (!body) return;
    currentFontSizeRem = Math.min(Math.max(currentFontSizeRem + delta, 0.85), 1.6);
    body.style.fontSize = `${currentFontSizeRem}rem`;
}

function resetFontSize() {
    const body = $id('newsBody');
    if (!body) return;
    currentFontSizeRem = 1.1;
    body.style.fontSize = `1.1rem`;
}

// Pengaturan Suara (Mic)
function toggleVoiceInput(target) {
    if (!recognition) {
        alert("Fitur perekam suara tidak didukung oleh browser Anda.");
        return;
    }
    if (isRecording && activeMicTarget === target) {
        recognition.stop();
    } else {
        if (isRecording) recognition.stop();
        activeMicTarget = target;
        try { recognition.start(); } catch (e) { console.error(e); }
    }
}

function stopVoiceInput() {
    isRecording = false;
    updateMicButtonUI('inpage', false);
    updateMicButtonUI('widget', false);
    activeMicTarget = null;
}

function updateMicButtonUI(target, isActive) {
    let btnId = target === 'inpage' ? 'inpage-mic-btn' : 'geobot-mic-btn';
    const btn = $id(btnId);
    if (btn) {
        if (isActive) btn.classList.add('mic-active');
        else btn.classList.remove('mic-active');
    }
}

// ==========================================================================
// 3. PARSING DATA (Disesuaikan dengan format Spreadsheet Seputar HMGF)
// ==========================================================================
function normalizeBeritaData(item) {
    if (!item) return null;
    return {
        id: item["Id"] || item["ID"] || "",
        judul: (item["Judul Berita"] || "").trim(),
        gambar_hero: item["Gambar Link"] || "",
        penulis: item["Penulis"] || "Redaksi HMGF",
        tanggal: item["Tanggal"] || "-",
        kategori: item["Kategori"] || "Berita",
        isi: [
            item["Isi 1"] || "",
            item["Isi 2"] || "",
            item["Isi 3"] || "",
            item["Isi 4"] || "",
            item["Isi 5"] || ""
        ],
        published: item["Published"]
    };
}

function formatDriveUrl(rawUrl) {
    if (!rawUrl || rawUrl.trim() === '') return '';
    let str = rawUrl.trim();
    const match = str.match(/(?:file\/d\/|id=|lh3\.googleusercontent\.com\/d\/)([a-zA-Z0-9_-]+)/);
    if (match && match[1]) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return str;
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
    const isDriveOrImage = rawUrl.includes('googleusercontent.com') || rawUrl.includes('drive.google.com') || /\.(jpeg|jpg|gif|png|webp)$/i.test(rawUrl);

    if (isImageUrl && isDriveOrImage) {
        const imgDirectUrl = formatDriveUrl(rawUrl);
        return `
            <figure style="margin: 30px 0; text-align: center;">
                <img src="${escapeHtml(imgDirectUrl)}" alt="${escapeHtml(captionText)}" style="max-width: 100%; border-radius: 10px;" onerror="this.parentElement.style.display='none';">
                ${captionText ? `<figcaption style="margin-top: 8px; font-size: 0.88rem; color: #64748b; font-style: italic;">${escapeHtml(captionText)}</figcaption>` : ''}
            </figure>
        `;
    } else {
        const lines = trimmed.split(/\r?\n/).map(p => p.trim()).filter(p => p.length > 0);
        return lines.map(line => {
            const safeLine = escapeHtml(line);
            if (line.startsWith('## ') || line.startsWith('# ')) {
                return `<h2>${escapeHtml(line.replace(/#+\s*/, ''))}</h2>`;
            }
            return `<p>${safeLine}</p>`;
        }).join('');
    }
}

// ==========================================================================
// 4. FETCH DATA UTAMA (LOAD KONTEN)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    fetchNavbarAndFooter(); // Mempertahankan fitur Navbar dari kodingan Geolibrary
    loadBeritaUtama();
    setupEventListeners();
});

// FUNGSI NAVBAR (Dipertahankan dari kodingan sebelumnya)
function fetchNavbarAndFooter() {
    const navPlaceholder = $id('navbar-placeholder');
    const footPlaceholder = $id('footer-placeholder');

    if (navPlaceholder) {
        fetch('navbar.html', { mode: 'cors' })
            .then(res => res.ok ? res.text() : Promise.reject(res.status))
            .then(data => {
                navPlaceholder.innerHTML = data;
                if (typeof initNavbarScroll === 'function') initNavbarScroll();
            }).catch(err => console.warn('Navbar tidak dimuat:', err));
    }

    if (footPlaceholder) {
        fetch('footer.html', { mode: 'cors' })
            .then(res => res.ok ? res.text() : Promise.reject(res.status))
            .then(data => { footPlaceholder.innerHTML = data; })
            .catch(err => console.warn('Footer tidak dimuat:', err));
    }
}

async function loadBeritaUtama() {
    try {
        const [resBerita, resPenulis] = await Promise.all([
            fetchWithTimeout(`${BASE_STEIN_URL}/${encodeURIComponent(SHEET_BERITA)}`, { mode: 'cors' }, STEIN_TIMEOUT_MS),
            fetchWithTimeout(`${BASE_STEIN_URL}/${encodeURIComponent(SHEET_PENULIS)}`, { mode: 'cors' }, STEIN_TIMEOUT_MS).catch(() => ({ ok: false }))
        ]);

        if (!resBerita.ok) throw new Error("Gagal mengambil data dari Seputar HMGF");
        
        const rawBerita = await resBerita.json();
        const allAuthors = resPenulis.ok ? await resPenulis.json() : [];

        let articles = [];
        if (Array.isArray(rawBerita)) {
            articles = rawBerita.map(normalizeBeritaData);
        }

        const publishedArticles = articles.filter(item => isPublished(item.published));
        let currentArticle = null;

        if (TARGET_JUDUL) {
            const normalizedTarget = normalizeTitle(TARGET_JUDUL);
            currentArticle = publishedArticles.find(item => normalizeTitle(item.judul) === normalizedTarget);
        } else if (publishedArticles.length > 0) {
            currentArticle = publishedArticles[0]; // Load artikel pertama jika tidak ada query
        }

        if (!currentArticle) {
            if ($id('newsTitle')) $id('newsTitle').innerText = "Artikel tidak ditemukan";
            if ($id('newsBody')) $id('newsBody').innerHTML = `<p>Maaf, konten yang Anda cari tidak tersedia atau belum dipublikasikan.</p>`;
            return;
        }

        // Terapkan Data ke UI
        currentArticleId = String(currentArticle.id);
        currentArticleTitle = currentArticle.judul;
        
        document.title = `${currentArticleTitle} - HMGF UGM`;
        if ($id('newsTitle')) $id('newsTitle').innerText = currentArticleTitle;

        const heroHeader = $id('heroHeader');
        if (currentArticle.gambar_hero && heroHeader) {
            heroHeader.style.backgroundImage = `url('${formatDriveUrl(currentArticle.gambar_hero)}')`;
        }

        if ($id('heroNewsAuthor')) $id('heroNewsAuthor').innerText = `— ${currentArticle.penulis}`;
        if ($id('newsAuthor')) $id('newsAuthor').innerText = currentArticle.penulis;
        if ($id('newsDate')) $id('newsDate').innerText = currentArticle.tanggal;
        if ($id('newsCategory')) $id('newsCategory').innerText = currentArticle.kategori;
        
        const bodyContainer = $id('newsBody');
        if (bodyContainer) {
            bodyContainer.innerHTML = '';
            currentArticle.isi.forEach(paragraf => {
                if (paragraf) bodyContainer.innerHTML += renderContentBlock(paragraf);
            });
            generateTableOfContents();
            if (window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise([bodyContainer]);
        }

        renderAuthorProfile(currentArticle.penulis, allAuthors);
        renderRelatedArticles(publishedArticles, currentArticleTitle);
        loadComments();

    } catch (error) {
        console.error("Error loading berita:", error);
        if ($id('newsBody')) $id('newsBody').innerHTML = `<p style="color:#b91c1c;">Terjadi kesalahan saat memuat konten.</p>`;
    }
}

// Generate TOC
function generateTableOfContents() {
    const bodyContainer = $id('newsBody');
    const tocContainer = $id('tocContainer');
    const tocList = $id('tocList');
    if (!bodyContainer || !tocContainer || !tocList) return;

    const headings = bodyContainer.querySelectorAll('h2, h3');
    if (headings.length === 0) {
        tocContainer.style.display = 'none';
        return;
    }
    tocList.innerHTML = '';
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
        tocList.appendChild(li);
    });
    tocContainer.style.display = 'block';
}

// FUNGSI AUTHOR PROFILE (Dipertahankan dari kodingan Geolibrary)
function renderAuthorProfile(penulis, authorsList) {
    const authorNameEl = $id('authorName');
    const authorBioEl = $id('authorBio');
    if (authorNameEl) authorNameEl.innerText = penulis;
    
    const matchedAuthor = Array.isArray(authorsList) ? authorsList.find(a => 
        a.nama_penulis && a.nama_penulis.trim().toLowerCase() === penulis.toLowerCase()
    ) : null;
    
    if (authorBioEl) authorBioEl.innerText = matchedAuthor ? matchedAuthor.deskripsi_penulis : 'Redaksi Akademik HMGF UGM.';
}

function renderRelatedArticles(publishedArticles, currentJudul) {
    const container = $id('relatedArticlesContainer');
    if (!container) return;
    container.innerHTML = '';
    
    const normalizedCurrent = normalizeTitle(currentJudul);
    const otherArticles = publishedArticles.filter(item => normalizeTitle(item.judul) !== normalizedCurrent);
    
    otherArticles.slice(0, 3).forEach(item => {
        const cardImg = formatDriveUrl(item.gambar_hero) || 'assets/SEG_News/pantai.png';
        container.innerHTML += `
            <a href="?judul=${encodeURIComponent(item.judul)}" class="related-card">
                <img src="${escapeHtml(cardImg)}" alt="${escapeHtml(item.judul)}">
                <div class="related-card-overlay"><h4 class="related-card-title">${escapeHtml(item.judul)}</h4></div>
            </a>`;
    });
}

// ==========================================================================
// 5. KOMENTAR 
// ==========================================================================
async function loadComments() {
    if (!currentArticleId) return;
    try {
        const res = await fetchWithTimeout(
            `${BASE_STEIN_URL}/${SHEET_COMMENTS}?search=${encodeURIComponent(JSON.stringify({ news_id: currentArticleId }))}`,
            { mode: 'cors' }, STEIN_TIMEOUT_MS
        );
        commentsArray = res.ok ? await res.json() : [];
        if (!Array.isArray(commentsArray)) commentsArray = [];
        renderComments();
    } catch (e) {
        console.error("Gagal memuat komentar:", e);
    }
}

function renderComments() {
    const container = $id('commentsList');
    const total = commentsArray.length;
    if ($id('commentsCountTitle')) $id('commentsCountTitle').innerText = total;
    if ($id('commentsCountMeta')) $id('commentsCountMeta').innerText = total === 0 ? "Belum ada Komentar" : `${total} Komentar`;
    
    if (!container) return;
    if (total > 0) {
        container.innerHTML = commentsArray.map(c => {
            const name = escapeHtml(c.name || 'Anonim');
            const text = escapeHtml(c.text || '');
            const initial = escapeHtml((c.name || 'A').charAt(0).toUpperCase());
            return `
                <div class="comment-card">
                    <div class="comment-avatar-circle">${initial}</div>
                    <div class="comment-content">
                        <div class="comment-top-info"><span class="comment-author-name">${name}</span></div>
                        <p class="comment-body-text">${text}</p>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        container.innerHTML = `<p style="color:#64748b;font-style:italic;">Belum ada komentar. Jadilah yang pertama!</p>`;
    }
}

async function submitComment(e) {
    if (e) e.preventDefault();
    const nameEl = $id('commentName');
    const textEl = $id('commentText');
    const emailEl = $id('commentEmail');
    
    const name = (nameEl?.value || '').trim();
    const text = (textEl?.value || '').trim();
    if (!name || !text) return;

    const btnSubmit = $id('btnSubmitComment');
    if (btnSubmit) { btnSubmit.disabled = true; btnSubmit.innerText = "Mengirim..."; }

    const newComment = {
        news_id: currentArticleId,
        judul_berita: currentArticleTitle,
        name, 
        email: emailEl?.value || '', 
        text,
        date: new Date().toLocaleDateString('id-ID')
    };

    try {
        await fetchWithTimeout(`${BASE_STEIN_URL}/${SHEET_COMMENTS}`, {
            method: 'POST', mode: 'cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([newComment])
        }, STEIN_TIMEOUT_MS);

        commentsArray.push(newComment);
        renderComments();
        if (textEl) textEl.value = '';
    } catch (err) {
        alert("Gagal mengirim komentar. Silakan coba lagi.");
    } finally {
        if (btnSubmit) { btnSubmit.disabled = false; btnSubmit.innerText = "Kirim Komentar"; }
    }
}

// ==========================================================================
// 6. INTEGRASI PAYLOAD N8N WEBHOOK ENGINE
// ==========================================================================
function getPageContextData() {
    return {
        title: $id("newsTitle")?.innerText || "",
        author: $id("newsAuthor")?.innerText || "",
        category: $id("newsCategory")?.innerText || "",
        bodyContent: ($id("newsBody")?.innerText || "").slice(0, 6000)
    };
}

async function fetchAIResponseFromN8N(userQuery) {
    const payload = { 
        message: userQuery, 
        context: getPageContextData(), 
        timestamp: new Date().toISOString() 
    };
    
    try {
        const response = await fetch(N8N_WEBHOOK_URL, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        
        // Tambahkan data.text di urutan pertama
        return data.text || data.reply || data.output || data.message || "Maaf, tidak mengembalikan respon teks.";
    } catch (error) {
        console.error("Webhook Error:", error);
        return "Maaf, gagal terhubung ke server AI.";
    }
}

async function handleInpageAISend() {
    if (isInpageSending) return;
    const inputEl = $id('inpage-ai-input');
    const query = (inputEl?.value || '').trim();
    if (!query) return;

    isInpageSending = true;
    if ($id('inpage-send-btn')) $id('inpage-send-btn').disabled = true;

    appendInpageBubble('user', escapeHtml(query));
    if (inputEl) inputEl.value = '';

    const loadingId = appendInpageBubble('bot', '<i>GeoBot sedang memproses...</i>');
    const aiResponseText = await fetchAIResponseFromN8N(query);

    const botMsgElement = $id(loadingId);
    if (botMsgElement) botMsgElement.innerHTML = formatMarkdown(aiResponseText);
    speakText(stripMarkdown(aiResponseText));

    isInpageSending = false;
    if ($id('inpage-send-btn')) $id('inpage-send-btn').disabled = false;
}

function appendInpageBubble(sender, safeText) {
    const thread = $id('inpage-ai-thread');
    if (!thread) return '';
    const msgId = 'inpage-msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const isUser = sender === 'user';
    const html = `
        <div class="ai-chat-bubble ${isUser ? 'user' : 'bot'}">
            <div class="ai-avatar"><i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i></div>
            <div class="ai-message-content" id="${msgId}">${safeText}</div>
        </div>
    `;
    thread.insertAdjacentHTML('beforeend', html);
    thread.scrollTop = thread.scrollHeight;
    return msgId;
}

async function handleWidgetSend() {
    if (isWidgetSending) return;
    const inputEl = $id("geobot-input");
    const query = (inputEl?.value || '').trim();
    if (!query) return;

    isWidgetSending = true;
    if ($id("geobot-send-btn")) $id("geobot-send-btn").disabled = true;

    appendWidgetMessage("user", escapeHtml(query));
    if (inputEl) inputEl.value = "";

    const loadingId = appendWidgetMessage("bot", "<i>GeoBot sedang memproses via n8n...</i>");
    const responseText = await fetchAIResponseFromN8N(query);

    updateWidgetMessage(loadingId, formatMarkdown(responseText));
    speakText(stripMarkdown(responseText));

    isWidgetSending = false;
    if ($id("geobot-send-btn")) $id("geobot-send-btn").disabled = false;
}

function appendWidgetMessage(sender, safeText) {
    const container = $id("geobot-messages");
    if (!container) return '';
    const msgId = "msg-" + Date.now() + '-' + Math.floor(Math.random() * 1000);
    const isUser = sender === "user";
    
    const msgHTML = `
        <div id="${msgId}" class="geobot-msg ${isUser ? 'user-msg' : 'bot-msg'}" 
             style="background: ${isUser ? '#0f172a' : '#ffffff'}; 
                    color: ${isUser ? '#ffffff' : '#1e293b'}; 
                    border: ${isUser ? 'none' : '1px solid #e2e8f0'}; 
                    padding: 10px 14px; 
                    border-radius: 12px; 
                    max-width: 85%; 
                    align-self: flex-end; /* Dipaksa ke kanan untuk user maupun bot */
                    margin-left: auto;   /* Memastikan elemen terdorong ke kanan */
                    line-height: 1.4;">
            ${safeText}
        </div>
    `;
    container.insertAdjacentHTML("beforeend", msgHTML);
    container.scrollTop = container.scrollHeight;
    return msgId;
}

// ==========================================================================
// 7. SETUP EVENT LISTENERS & FORMATTING AI
// ==========================================================================
function setupEventListeners() {
    $id('btn-font-shrink')?.addEventListener('click', () => adjustFontSize(-0.1));
    $id('btn-font-reset')?.addEventListener('click', () => resetFontSize());
    $id('btn-font-grow')?.addEventListener('click', () => adjustFontSize(0.1));
    
    $id('commentForm')?.addEventListener('submit', submitComment);

    const inpageInput = $id('inpage-ai-input');
    $id('inpage-send-btn')?.addEventListener('click', handleInpageAISend);
    inpageInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleInpageAISend();
    });
    $id('inpage-mic-btn')?.addEventListener('click', () => toggleVoiceInput('inpage'));

    const toggleBtn = $id("geobot-toggle-btn");
    const closeBtn = $id("geobot-close-btn");
    const chatWindow = $id("geobot-chat-window");
    const widgetInput = $id("geobot-input");

    if (toggleBtn && chatWindow) {
        toggleBtn.addEventListener("click", () => {
            const isHidden = chatWindow.style.display === "none" || chatWindow.style.display === "";
            chatWindow.style.display = isHidden ? "flex" : "none";
            if (isHidden) widgetInput?.focus();
        });
    }
    if (closeBtn && chatWindow) {
        closeBtn.addEventListener("click", () => { chatWindow.style.display = "none"; });
    }
    $id("geobot-send-btn")?.addEventListener("click", handleWidgetSend);
    widgetInput?.addEventListener("keypress", (e) => {
        if (e.key === 'Enter') handleWidgetSend();
    });
    $id("geobot-mic-btn")?.addEventListener("click", () => toggleVoiceInput('widget'));
}

function formatMarkdown(text) {
    let safe = escapeHtml(text);
    safe = safe.replace(/```([\s\S]*?)```/g, (m, code) => `<pre style="background:#f1f5f9;padding:10px;border-radius:8px;overflow-x:auto;"><code>${code}</code></pre>`);
    safe = safe.replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;">$1</code>');
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    safe = safe.replace(/\*(.*?)\*/g, '<em>$1</em>');
    safe = safe.replace(/^\s*#{1,6}\s*(.+)$/gm, '<strong>$1</strong>');
    safe = safe.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    safe = safe.replace(/^\s*[-*]\s+(.+)$/gm, '&bull; $1');
    safe = safe.replace(/\n/g, '<br>');
    return safe;
}

function stripMarkdown(text) {
    return String(text || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[`*#_>]/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

function speakText(text) {
    if (!syntheticVoice) return;
    try {
        syntheticVoice.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        syntheticVoice.speak(utterance);
    } catch (e) {
        console.warn("Text-to-Speech tidak tersedia:", e);
    }
}