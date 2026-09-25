/**
 * Dynamic Background Generator & 3D Stardust Engine
 * Style: SEG UGM-SC (Giant Organic Glow + Three.js Twinkling Stars)
 * Update: Perbaikan Bug innerHTML, Z-Index, & Penyesuaian Ukuran Gambar
 */

(function () {
    // -----------------------------------------------------------------
    // 1. DYNAMIC ORGANIC GLOW GENERATOR (HTML DOM)
    // -----------------------------------------------------------------
    function generateDynamicBackground() {
        const container = document.getElementById('dynamic-bg-container');
        if (!container) return;

        const documentHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight,
            window.innerHeight
        );

        const IMAGE_SRC = 'assets/background.svg';
        const stepDistance = 900;
        const totalAssets = Math.max(3, Math.floor(documentHeight / stepDistance));

        // Hapus HANYA elemen gambar (glow) lama
        const oldGlows = container.querySelectorAll('.bg-asset-item');
        oldGlows.forEach(el => el.remove());

        for (let i = 0; i < totalAssets; i++) {
            const img = document.createElement('img');
            img.src = IMAGE_SRC;
            img.classList.add('bg-asset-item');

            // ALGORITMA UKURAN BARU: Sedikit lebih besar (1350px s/d 2000px)
            const size = Math.floor(Math.random() * 650) + 1350;

            const baseTop = i * stepDistance + 100;
            const randomOffset = Math.floor(Math.random() * 300 - 150);
            const topPx = Math.max(0, baseTop + randomOffset);

            let leftPercent = (i % 2 === 0) 
                ? Math.floor(Math.random() * 25 - 35) 
                : Math.floor(Math.random() * 25 + 40);

            const rotation = Math.floor(Math.random() * 360);
            const opacity = (Math.random() * 0.3 + 0.65).toFixed(2);

            img.style.position = 'absolute';
            img.style.top = `${topPx}px`;
            img.style.left = `${leftPercent}%`;
            img.style.width = `${size}px`;
            img.style.transform = `rotate(${rotation}deg)`;
            img.style.opacity = opacity;
            
            img.style.mixBlendMode = 'screen';
            img.style.filter = 'brightness(1.3) contrast(1.1) drop-shadow(0 0 45px rgba(225, 48, 98, 0.5))';
            img.style.pointerEvents = 'none';
            img.style.zIndex = '0';

            img.onerror = function () {
                this.src = '../assets/background.svg';
            };

            container.appendChild(img);
        }
    }

    // -----------------------------------------------------------------
    // 2. THREE.JS TWINKLING STARS ENGINE
    // -----------------------------------------------------------------
    let scene, camera, renderer, stars; 

    function initStarfield() {
        let existingCanvas = document.getElementById('bg-starfield-canvas');
        if (existingCanvas) existingCanvas.remove();

        const container = document.getElementById('dynamic-bg-container') || document.body;

        scene = new THREE.Scene();
        
        camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
        camera.position.z = 0; 

        renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.domElement.id = 'bg-starfield-canvas';
        renderer.setPixelRatio(window.devicePixelRatio);

        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.pointerEvents = 'none';
        renderer.domElement.style.zIndex = '0';

        container.appendChild(renderer.domElement);

        stars = createStarfield();

        resizeStarfield();
        animateStars();
    }

    let starGeometry, starMaterial, starField;
    
    function createStarfield() {
        const starCount = 2000; 
        starGeometry = new THREE.BufferGeometry();
        const positions = new Float32Array(starCount * 3);
        const scales = new Float32Array(starCount);
        const colors = new Float32Array(starCount * 3);

        const colorOptions = [
            new THREE.Color(0xffffff), 
            new THREE.Color(0xadd8e6), 
            new THREE.Color(0xffe4b5), 
            new THREE.Color(0xE13062)
        ];

        for (let i = 0; i < starCount; i++) {
            const u = Math.random();
            const v = Math.random();
            const theta = u * 2.0 * Math.PI;
            const phi = Math.acos(2.0 * v - 1.0);
            
            const r = 300 + Math.random() * 200; 

            positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = r * Math.cos(phi);

            scales[i] = 1.0 + Math.random() * 2.5;

            const chosenColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
            colors[i * 3]     = chosenColor.r;
            colors[i * 3 + 1] = chosenColor.g;
            colors[i * 3 + 2] = chosenColor.b;
        }

        starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        starGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
        starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.25, 'rgba(230,210,240,0.8)');
        grad.addColorStop(0.6, 'rgba(225,48,98,0.2)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 64, 64);

        const starTexture = new THREE.CanvasTexture(canvas);
        starMaterial = new THREE.PointsMaterial({
            size: 2.0, 
            map: starTexture,
            vertexColors: true,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        starField = new THREE.Points(starGeometry, starMaterial);
        scene.add(starField);
        
        return starField;
    }

    function resizeStarfield() {
        if (!renderer) return;
        
        const computedHeight = Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            window.innerHeight
        );
        
        camera.aspect = window.innerWidth / computedHeight;
        camera.updateProjectionMatrix();
        
        renderer.setSize(window.innerWidth, computedHeight);
    }

    function animateStars() {
        requestAnimationFrame(animateStars);

        if (stars) {
            stars.rotation.y -= 0.00005; 
            stars.rotation.x -= 0.00002; 
        }

        renderer.render(scene, camera);
    }

    // -----------------------------------------------------------------
    // 3. INITIALIZATION & RE-RENDER HANDLERS
    // -----------------------------------------------------------------
    function initAll() {
        generateDynamicBackground();
        initStarfield();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initAll);
    } else {
        initAll();
    }

    window.addEventListener('load', () => {
        setTimeout(() => {
            generateDynamicBackground();
            resizeStarfield();
        }, 150);
    });

    window.addEventListener('resize', () => {
        clearTimeout(window.bgResizeTimer);
        window.bgResizeTimer = setTimeout(() => {
            generateDynamicBackground();
            resizeStarfield();
        }, 300);
    });
})();