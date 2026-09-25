function initNavbarScroll() {
    // Membaca selector wrapper navbar secara fleksibel (.navbar-wrapper atau #main-navbar)
    const navbar = document.querySelector('.navbar-wrapper') || document.getElementById('main-navbar');
    if (!navbar) return;

    let lastScrollY = window.scrollY;
    const threshold = 15; // Jarak minimal scroll untuk trigger animasi

    window.addEventListener('scroll', () => {
        const currentScrollY = window.scrollY;

        // Jika berada di bagian paling atas halaman, selalu tampilkan navbar
        if (currentScrollY <= 40) {
            navbar.classList.remove('nav-hidden');
            return;
        }

        // Scroll ke bawah (Scroll Down) -> Sembunyikan Navbar
        if (currentScrollY > lastScrollY + threshold) {
            navbar.classList.add('nav-hidden');
        } 
        // Scroll ke atas (Scroll Up) -> Tampilkan Navbar Kembali
        else if (currentScrollY < lastScrollY - threshold) {
            navbar.classList.remove('nav-hidden');
        }

        lastScrollY = currentScrollY;
    });

    // Mobile Navigation Toggle Logic
    const mobileBtn = document.querySelector('.mobile-toggle') || document.getElementById('mobile-toggle');
    const navMenu = document.querySelector('.nav-menu');

    if (mobileBtn && navMenu) {
        // Menambahkan parameter 'e' (event)
        mobileBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Mencegah pindah halaman
            e.stopPropagation(); // Mencegah klik bocor ke elemen bawahnya
            navMenu.classList.toggle('active');
        });
    }
}