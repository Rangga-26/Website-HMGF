// =========================================================================
// KODE JAVASCRIPT BUMI REALISTIS & NATURAL (FULL MODULAR)
// - Day/Night Terminator Shader (Lampu malam hanya muncul di sisi gelap)
// - Rayleigh & Mie Atmospheric Scattering
// - Tekstur Specular Lautan & Relief Topografi Realistis
// - Sesar Panjang (Fault Ridges), Gunung Berapi & Abu Vulkanik GPU-Shader
// - Orbit Bulan Realistis & Latar Bintang Twinkling
// =========================================================================

(function() {
    const currentScript = document.currentScript;
    const heroContainer = currentScript ? currentScript.previousElementSibling : document.getElementById('hero-container');

    if (heroContainer) {
        heroContainer.style.position = 'relative';

        // 1. SCENE, CAMERA, & RENDERER (HIGH PRECISION)
        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(42, heroContainer.clientWidth / heroContainer.clientHeight, 0.1, 1000);
        camera.position.z = 15;

        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
        renderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        
        renderer.domElement.style.position = 'absolute';
        renderer.domElement.style.top = '0';
        renderer.domElement.style.left = '0';
        renderer.domElement.style.width = '100%';
        renderer.domElement.style.height = '100%';
        renderer.domElement.style.zIndex = '-1'; 
        renderer.domElement.style.pointerEvents = 'none';

        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9; 

        heroContainer.appendChild(renderer.domElement);

        // 2. PENCAHAYAAN CINEMATIC REALISTIS
        const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.8); 
        sunLight.position.set(16, 5, 10);
        
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;  
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 50;
        
        const d = 10;
        sunLight.shadow.camera.left = -d;
        sunLight.shadow.camera.right = d;
        sunLight.shadow.camera.top = d;
        sunLight.shadow.camera.bottom = -d;
        sunLight.shadow.bias = -0.0002; 
        sunLight.shadow.radius = 1.8; 

        // Ambient light sangat redup merepresentasikan kegelapan luar angkasa
        const ambientLight = new THREE.AmbientLight(0x010206, 0.04); 
        scene.add(sunLight, ambientLight);

        // --- 2.1 BINTANG LATAR BELAKANG ---
        let starGeometry, starMaterial, starField;
        function createStarfield() {
            const starCount = 2500; 
            starGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(starCount * 3);
            const scales = new Float32Array(starCount);
            const colors = new Float32Array(starCount * 3);

            const colorOptions = [
                new THREE.Color(0xffffff), 
                new THREE.Color(0xcce6ff), 
                new THREE.Color(0xfff0dd), 
                new THREE.Color(0xffd1d1)  
            ];

            for (let i = 0; i < starCount; i++) {
                const u = Math.random();
                const v = Math.random();
                const theta = u * 2.0 * Math.PI;
                const phi = Math.acos(2.0 * v - 1.0);
                const r = 70 + Math.random() * 50; 

                positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
                positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
                positions[i * 3 + 2] = r * Math.cos(phi);

                scales[i] = 0.4 + Math.random() * 1.8;

                const chosenColor = colorOptions[Math.floor(Math.random() * colorOptions.length)];
                colors[i * 3]     = chosenColor.r;
                colors[i * 3 + 1] = chosenColor.g;
                colors[i * 3 + 2] = chosenColor.b;
            }

            starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            starGeometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
            starGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

            const canvas = document.createElement('canvas');
            canvas.width = 64; canvas.height = 64;
            const ctx = canvas.getContext('2d');
            const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
            grad.addColorStop(0, 'rgba(255,255,255,1)');
            grad.addColorStop(0.2, 'rgba(230,240,255,0.8)');
            grad.addColorStop(0.5, 'rgba(120,170,255,0.2)');
            grad.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, 64, 64);

            const starTexture = new THREE.CanvasTexture(canvas);
            starMaterial = new THREE.PointsMaterial({
                size: 1.1,
                map: starTexture,
                vertexColors: true,
                transparent: true,
                opacity: 0.85,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            starField = new THREE.Points(starGeometry, starMaterial);
            scene.add(starField);
            return starField;
        }
        const stars = createStarfield();

        // 3. TEKSTUR UTAMA NASA HIGH RESOLUTION
        const loader = new THREE.TextureLoader();
        const dayTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg');
        const nightTexture = loader.load('https://unpkg.com/three-globe/example/img/earth-night-lights.png');
        const earthBumpMap = loader.load('https://unpkg.com/three-globe/example/img/earth-topology.png');
        const earthSpecMap = loader.load('https://unpkg.com/three-globe/example/img/earth-water-specular.png');
        const moonTexture = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/moon_1024.jpg');
        const cloudTexture = loader.load('https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png');

        // 4. TEKSTUR ABU VULKANIK NATURAL
        function createNaturalAshTexture() {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');

            const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
            grad.addColorStop(0.0, 'rgba(255, 255, 255, 1.0)');
            grad.addColorStop(0.25, 'rgba(210, 210, 210, 0.7)');
            grad.addColorStop(0.55, 'rgba(110, 110, 110, 0.25)');
            grad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');

            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(64, 64, 64, 0, Math.PI * 2);
            ctx.fill();

            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        }
        const naturalAshTexture = createNaturalAshTexture();

        // SHADER ABU VULKANIK GPU
        const VolcanicAshShader = {
            uniforms: {
                uTime: { value: 0 },
                uOpacity: { value: 1.0 },
                uTexture: { value: naturalAshTexture }
            },
            vertexShader: `
                uniform float uTime;
                uniform float uOpacity;
                
                attribute float aSpeed;
                attribute float aOffset;
                attribute float aSpread;
                attribute float aSize;
                attribute vec3 aDirection;

                varying float vProgress;
                varying float vOpacity;

                void main() {
                    float progress = fract((uTime * aSpeed) + aOffset);
                    vProgress = progress;
                    vOpacity = uOpacity;

                    float expansion = pow(progress, 1.3) * aSpread * 2.0;
                    
                    vec3 turbulence = vec3(
                        sin(uTime * 2.5 + aOffset * 10.0) * 0.09 * progress,
                        cos(uTime * 2.0 + aOffset * 8.0) * 0.09 * progress,
                        sin(uTime * 1.8 + aOffset * 12.0) * 0.09 * progress
                    );

                    vec3 currentPos = position + (aDirection * progress * 0.85) + turbulence;
                    
                    vec3 sideVector = normalize(cross(aDirection, vec3(0.0, 1.0, 0.0) + aDirection * 0.1));
                    currentPos += sideVector * sin(aOffset * 20.0) * expansion;

                    vec4 mvPosition = modelViewMatrix * vec4(currentPos, 1.0);
                    gl_Position = projectionMatrix * mvPosition;

                    float dynamicSize = aSize * (1.0 + progress * 5.0);
                    gl_PointSize = dynamicSize * (320.0 / -mvPosition.z);
                }
            `,
            fragmentShader: `
                uniform sampler2D uTexture;
                varying float vProgress;
                varying float vOpacity;

                void main() {
                    vec4 texColor = texture2D(uTexture, gl_PointCoord);
                    if (texColor.a < 0.01) discard;

                    vec3 lavaColor = vec3(1.0, 0.38, 0.05);
                    vec3 ashDark   = vec3(0.12, 0.11, 0.10);
                    vec3 ashLight  = vec3(0.38, 0.36, 0.34);

                    vec3 finalColor;
                    float alphaFade = 1.0;

                    if (vProgress < 0.10) {
                        float t = vProgress / 0.10;
                        finalColor = mix(lavaColor, ashDark, t);
                    } else if (vProgress < 0.50) {
                        float t = (vProgress - 0.10) / 0.40;
                        finalColor = mix(ashDark, ashLight, t);
                    } else {
                        float t = (vProgress - 0.50) / 0.50;
                        finalColor = ashLight;
                        alphaFade = 1.0 - t;
                    }

                    gl_FragColor = vec4(finalColor, texColor.a * alphaFade * vOpacity * 0.8);
                }
            `
        };

        // 5. MESH BUMI REALISTIS (DAY/NIGHT TERMINATOR SHADER)
        const earthRadius = 4.5;
        const earthGeometry = new THREE.SphereGeometry(earthRadius, 128, 128);
        const originalPositions = earthGeometry.attributes.position.clone();

        const earthMaterial = new THREE.MeshPhongMaterial({
            map: dayTexture,
            color: 0xdddddd,
            bumpMap: earthBumpMap,
            bumpScale: 0.14,
            specularMap: earthSpecMap,
            specular: new THREE.Color(0x223344),
            emissiveMap: nightTexture,
            emissive: new THREE.Color(0xffb74d),
            emissiveIntensity: 1.0,
            shininess: 30
        });

        // SHADER PATCH: Membatasi Lampu Malam Hanya Pada Sisi Gelap Bumi (Terminator Realistis)
        earthMaterial.onBeforeCompile = (shader) => {
            shader.uniforms.uSunDirection = { value: sunLight.position };
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissiveMap_fragment>',
                `
                #ifdef USE_EMISSIVEMAP
                    vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
                    vec3 worldNormal = normalize(vNormal);
                    vec3 sunDir = normalize(uSunDirection);
                    float dotNL = dot(worldNormal, sunDir);
                    
                    // Smooth transition di garis senja/fajar (Terminator)
                    float nightMask = smoothstep(0.15, -0.25, dotNL);
                    totalEmissiveRadiance *= emissiveColor.rgb * nightMask * emissiveIntensity;
                #endif
                `
            );
        };

        const earth = new THREE.Mesh(earthGeometry, earthMaterial);
        earth.castShadow = true;
        earth.receiveShadow = true;
        scene.add(earth);

        // LAPISAN AWAN REALISTIS WITH SOFT SHADOW
        const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.009, 128, 128);
        const cloudMaterial = new THREE.MeshPhongMaterial({
            map: cloudTexture,
            transparent: true,
            opacity: 0.42,
            blending: THREE.NormalBlending,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
        clouds.receiveShadow = true;
        earth.add(clouds);

        // ATMOSFER RAYLEIGH SCATTERING (GLOW REALISTIS DENGAN MASKING SINAR MATAHARI)
        const atmosphereGeometry = new THREE.SphereGeometry(earthRadius * 1.035, 128, 128);
        const atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                uSunPosition: { value: sunLight.position }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 uSunPosition;
                varying vec3 vNormal;
                varying vec3 vWorldPosition;
                
                void main() {
                    vec3 viewDir = vec3(0.0, 0.0, 1.0);
                    float fresnel = pow(0.62 - dot(vNormal, viewDir), 2.8);
                    
                    vec3 sunDir = normalize(uSunPosition);
                    float sunDot = max(0.0, dot(vNormal, sunDir));
                    
                    vec3 dayAtmosphere = vec3(0.25, 0.55, 1.0);
                    vec3 sunsetAtmosphere = vec3(1.0, 0.45, 0.2);
                    
                    vec3 atmosphereColor = mix(dayAtmosphere, sunsetAtmosphere, pow(1.0 - sunDot, 3.0) * 0.5);
                    float intensity = fresnel * (0.3 + 0.7 * sunDot);
                    
                    gl_FragColor = vec4(atmosphereColor, intensity * 0.95);
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        earth.add(new THREE.Mesh(atmosphereGeometry, atmosphereMaterial));

        const faultRidgesGroup = new THREE.Group();
        const volcanoesGroup = new THREE.Group();
        const ashPlumesGroup = new THREE.Group();
        earth.add(faultRidgesGroup);
        earth.add(volcanoesGroup);
        earth.add(ashPlumesGroup);

        // 6. HELPER SPASIAL & GEOGRAFI
        function latLngToVector3(lat, lng, radius) {
            const phi = (90 - lat) * (Math.PI / 180);
            const theta = (lng + 180) * (Math.PI / 180);
            return new THREE.Vector3(
                -(radius * Math.sin(phi) * Math.cos(theta)),
                radius * Math.cos(phi),
                radius * Math.sin(phi) * Math.sin(theta)
            );
        }

        function latLngToUV(lat, lng) {
            return { 
                u: Math.min(Math.max((lng + 180) / 360, 0), 1), 
                v: Math.min(Math.max((lat + 90) / 180, 0), 1) 
            };
        }

        function spatialNoise(lat, lng) {
            return (Math.sin(lat * 0.12 + lng * 0.15) * 0.25) + 
                   (Math.cos(lat * 0.35 - lng * 0.28) * 0.15) + 
                   (Math.sin(lat * 0.81 + lng * 0.93) * 0.10) + 0.5;
        }

        function getNaturalTremor(phase, amplitude) {
            const x = (Math.sin(phase * 1.34) + Math.sin(phase * 3.12) * 0.5) * amplitude * 0.5;
            const y = (Math.cos(phase * 1.15) + Math.cos(phase * 2.87) * 0.4) * amplitude * 0.5;
            const z = (Math.sin(phase * 1.56) + Math.cos(phase * 3.44) * 0.6) * amplitude * 0.5;
            return new THREE.Vector3(x, y, z);
        }

        // 7. PARAMETER & SESAR / BERAPI
        const BASE_HEIGHT = 0.055;   
        const BASE_WIDTH  = 0.075;   
        
        let allFaultCoords = [];             
        const activeFaultSegments = [];     
        const MAX_ACTIVE_SEGMENTS = 6;      

        const realVolcanoCoordinates = [
            [-6.102, 105.423], [-7.540, 110.446], [-8.108, 112.922], [-8.342, 115.508], [-8.250, 117.975], 
            [2.585, 98.875], [0.800, 127.333], [1.358, 124.825], [-3.666, 128.344], [-8.520, 125.400],
            [35.360, 138.727], [31.585, 130.657], [14.002, 120.993], [15.143, 120.350], [13.257, 123.685],
            [46.191, -122.195], [19.023, -98.622], [-0.677, -78.436], [-39.281, -71.938], [19.421, -155.287],
            [63.633, -19.633], [37.751, 15.093], [40.821, 14.426], [-1.520, 29.250]
        ];

        const activeVolcanoes = [];
        const MAX_ACTIVE_VOLCANOES = 4;     
        const MIN_DISTANCE_THRESHOLD = 1.4; 

        function isFarEnoughFromExistingFeatures(candidatePos) {
            for (let i = 0; i < activeVolcanoes.length; i++) {
                if (candidatePos.distanceTo(activeVolcanoes[i].centerPos) < MIN_DISTANCE_THRESHOLD) return false;
            }
            for (let i = 0; i < activeFaultSegments.length; i++) {
                if (candidatePos.distanceTo(activeFaultSegments[i].centerPos) < MIN_DISTANCE_THRESHOLD) return false;
            }
            return true;
        }

        // 8 & 9. KONSTRUKSI GEOMETRI TEKTONIK
        function buildTexturedRidgeGeometry(pointsData, visibilityScale, tremorOffset) {
            const totalPoints = pointsData.length;
            if (totalPoints < 2) return null;
            const vertices = [], uvs = [], indices = [];
            for (let i = 0; i < totalPoints; i++) {
                const pt = pointsData[i];
                const baseCenter = pt.pos.clone().add(tremorOffset);
                let taper = 1.0;
                const fadeLength = Math.min(8, Math.floor(totalPoints / 2));
                if (i < fadeLength) taper = Math.sin((i / fadeLength) * (Math.PI / 2));
                else if (i > totalPoints - 1 - fadeLength) taper = Math.sin(((totalPoints - 1 - i) / fadeLength) * (Math.PI / 2));
                const spatialFactor = spatialNoise(pt.lat, pt.lng);
                const currentHeight = BASE_HEIGHT * (0.5 + 1.1 * spatialFactor) * taper * visibilityScale; 
                const currentWidth  = BASE_WIDTH * (0.7 + 0.6 * spatialFactor) * (0.5 + 0.5 * taper) * Math.max(0.2, visibilityScale);
                const radial = baseCenter.clone().normalize();
                const peak = baseCenter.clone().add(radial.clone().multiplyScalar(currentHeight));
                const leftBase = baseCenter.clone().add(pt.dir.clone().multiplyScalar(currentWidth));
                const rightBase = baseCenter.clone().sub(pt.dir.clone().multiplyScalar(currentWidth));
                vertices.push(peak.x, peak.y, peak.z, leftBase.x, leftBase.y, leftBase.z, rightBase.x, rightBase.y, rightBase.z);
                const uvCenter = latLngToUV(pt.lat, pt.lng);
                const uvOffset = currentWidth / 180;
                uvs.push(uvCenter.u, uvCenter.v, uvCenter.u - uvOffset, uvCenter.v, uvCenter.u + uvOffset, uvCenter.v);
                if (i < totalPoints - 1) {
                    const current = i * 3, next = (i + 1) * 3;
                    indices.push(current, next, current + 1, next, next + 1, current + 1);
                    indices.push(current, current + 2, next, next, current + 2, next + 2);
                }
            }
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            return geometry;
        }

        function buildVolcanoGeometry(lat, lng, visibilityScale, tremorOffset, baseRadius) {
            const segments = 16, vertices = [], uvs = [], indices = [];
            const centerPos = latLngToVector3(lat, lng, baseRadius).add(tremorOffset);
            const normal = centerPos.clone().normalize();
            let tangent = new THREE.Vector3(0, 1, 0).cross(normal);
            if (tangent.lengthSq() < 0.0001) tangent = new THREE.Vector3(1, 0, 0).cross(normal);
            tangent.normalize();
            const bitangent = normal.clone().cross(tangent).normalize();
            const spatialFactor = spatialNoise(lat, lng);
            const volcanoHeight = BASE_HEIGHT * (1.1 + 0.3 * spatialFactor) * visibilityScale;
            const volcanoRadius = BASE_WIDTH * (1.2 + 0.4 * spatialFactor) * Math.max(0.2, visibilityScale);
            const peakPos = centerPos.clone().add(normal.clone().multiplyScalar(volcanoHeight));
            vertices.push(peakPos.x, peakPos.y, peakPos.z);
            const centerUV = latLngToUV(lat, lng);
            uvs.push(centerUV.u, centerUV.v);
            for (let i = 0; i <= segments; i++) {
                const angle = (i / segments) * Math.PI * 2;
                const dx = Math.cos(angle) * volcanoRadius, dy = Math.sin(angle) * volcanoRadius;
                const basePt = centerPos.clone().add(tangent.clone().multiplyScalar(dx)).add(bitangent.clone().multiplyScalar(dy));
                vertices.push(basePt.x, basePt.y, basePt.z);
                uvs.push(centerUV.u + dx / 180, centerUV.v + dy / 180);
            }
            for (let i = 1; i <= segments; i++) indices.push(0, i, i + 1);
            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            return { geometry, peakPos, volcanoHeight, normal };
        }

        // 10 & 11. GENERATOR SPAWN SESAR & GUNUNG
        function spawnRandomFaultRidge() {
            if (allFaultCoords.length === 0) return;
            let selectedCoords = null, selectedCenterPos = null;
            for(let attempts = 0; attempts < 60; attempts++) {
                const fullCoords = allFaultCoords[Math.floor(Math.random() * allFaultCoords.length)];
                if (fullCoords.length < 25) continue;
                const segmentLength = Math.min(fullCoords.length, Math.floor(25 + Math.random() * 35)); 
                const startIndex = Math.floor(Math.random() * Math.max(0, fullCoords.length - segmentLength));
                const subCoords = fullCoords.slice(startIndex, startIndex + segmentLength);
                const midIdx = Math.floor(subCoords.length / 2);
                const candidatePos = latLngToVector3(subCoords[midIdx][1], subCoords[midIdx][0], earthRadius);
                if (isFarEnoughFromExistingFeatures(candidatePos)) {
                    selectedCoords = subCoords; selectedCenterPos = candidatePos; break;
                }
            }
            if (!selectedCoords) return;
            const mat = () => new THREE.MeshPhongMaterial({
                map: dayTexture, color: 0xcccccc, emissiveMap: nightTexture, emissive: new THREE.Color(0x665522),
                emissiveIntensity: 0.3, shininess: 8, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.0
            });
            const meshA = new THREE.Mesh(new THREE.BufferGeometry(), mat());
            const meshB = new THREE.Mesh(new THREE.BufferGeometry(), mat());
            meshA.castShadow = true; meshA.receiveShadow = true;
            meshB.castShadow = true; meshB.receiveShadow = true;
            faultRidgesGroup.add(meshA); faultRidgesGroup.add(meshB);
            activeFaultSegments.push({
                coords: selectedCoords, centerPos: selectedCenterPos, meshA, meshB,
                age: 0, lifespan: 600 + Math.floor(Math.random() * 400), fadeDuration: 100,
                tectonicPhaseOffset: Math.random() * Math.PI * 2, waveRadius: 0.8 + Math.random() * 0.5,
                tremorFrequency: 18 + Math.random() * 12, tremorAmplitude: 0.008 + Math.random() * 0.006
            });
        }

        function spawnRandomVolcano() {
            if (realVolcanoCoordinates.length === 0) return;
            let selectedCoord = null, selectedCenterPos = null;
            for(let attempts = 0; attempts < 30; attempts++) {
                const coord = realVolcanoCoordinates[Math.floor(Math.random() * realVolcanoCoordinates.length)];
                const candidatePos = latLngToVector3(coord[0], coord[1], earthRadius);
                if (isFarEnoughFromExistingFeatures(candidatePos)) {
                    selectedCoord = coord; selectedCenterPos = candidatePos; break;
                }
            }
            if (!selectedCoord) return;
            
            const volcanoMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhongMaterial({
                map: dayTexture, color: 0xcccccc, emissiveMap: nightTexture, emissive: new THREE.Color(0x883311),
                emissiveIntensity: 0.4, shininess: 10, flatShading: true, side: THREE.DoubleSide, transparent: true, opacity: 0.0
            }));
            volcanoMesh.castShadow = true; volcanoMesh.receiveShadow = true;
            volcanoesGroup.add(volcanoMesh);
            
            // PARTIKEL ABU GPU SHADER
            const PARTICLE_COUNT = 250; 
            const ashGeometry = new THREE.BufferGeometry();
            const positions = new Float32Array(PARTICLE_COUNT * 3);
            const aSpeed = new Float32Array(PARTICLE_COUNT);
            const aOffset = new Float32Array(PARTICLE_COUNT);
            const aSpread = new Float32Array(PARTICLE_COUNT);
            const aSize = new Float32Array(PARTICLE_COUNT);
            const aDirection = new Float32Array(PARTICLE_COUNT * 3);

            const volcanoNormal = selectedCenterPos.clone().normalize();

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                positions[i * 3]     = selectedCenterPos.x;
                positions[i * 3 + 1] = selectedCenterPos.y;
                positions[i * 3 + 2] = selectedCenterPos.z;

                aSpeed[i]  = 0.15 + Math.random() * 0.25;
                aOffset[i] = Math.random();
                aSpread[i] = 0.2 + Math.random() * 0.4;
                aSize[i]   = 0.25 + Math.random() * 0.35;

                const dir = volcanoNormal.clone().add(new THREE.Vector3(
                    (Math.random() - 0.5) * 0.35,
                    (Math.random() - 0.5) * 0.35,
                    (Math.random() - 0.5) * 0.35
                )).normalize();

                aDirection[i * 3]     = dir.x;
                aDirection[i * 3 + 1] = dir.y;
                aDirection[i * 3 + 2] = dir.z;
            }

            ashGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            ashGeometry.setAttribute('aSpeed', new THREE.BufferAttribute(aSpeed, 1));
            ashGeometry.setAttribute('aOffset', new THREE.BufferAttribute(aOffset, 1));
            ashGeometry.setAttribute('aSpread', new THREE.BufferAttribute(aSpread, 1));
            ashGeometry.setAttribute('aSize', new THREE.BufferAttribute(aSize, 1));
            ashGeometry.setAttribute('aDirection', new THREE.BufferAttribute(aDirection, 3));

            const ashMaterial = new THREE.ShaderMaterial({
                vertexShader: VolcanicAshShader.vertexShader,
                fragmentShader: VolcanicAshShader.fragmentShader,
                uniforms: THREE.UniformsUtils.clone(VolcanicAshShader.uniforms),
                transparent: true,
                depthWrite: false,
                blending: THREE.NormalBlending
            });

            const ashParticlesMesh = new THREE.Points(ashGeometry, ashMaterial);
            ashPlumesGroup.add(ashParticlesMesh);
            
            activeVolcanoes.push({
                lat: selectedCoord[0], lng: selectedCoord[1], centerPos: selectedCenterPos,
                mesh: volcanoMesh, ashMesh: ashParticlesMesh,
                age: 0, lifespan: 600 + Math.floor(Math.random() * 400), fadeDuration: 100,
                tectonicPhaseOffset: Math.random() * Math.PI * 2, waveRadius: 0.7 + Math.random() * 0.4,
                tremorFrequency: 18 + Math.random() * 12, tremorAmplitude: 0.008 + Math.random() * 0.006
            });
        }

        // 12. GELOMBANG DEFORMASI BUMI
        const vertexElevations = new Float32Array(earthGeometry.attributes.position.count);
        const WAVE_MAX_HEIGHT = 0.035; 

        function updateEarthSurfaceWave(tectonicTime) {
            const positionAttribute = earthGeometry.attributes.position;
            const vertexCount = positionAttribute.count;
            vertexElevations.fill(0);
            const processActiveFeature = (feature) => {
                const phase = tectonicTime * 1.8 + feature.tectonicPhaseOffset;
                let waveIntensity = 1.0;
                if (feature.age < feature.fadeDuration) waveIntensity = feature.age / feature.fadeDuration;
                else if (feature.age > feature.lifespan - feature.fadeDuration) waveIntensity = Math.max(0, (feature.lifespan - feature.age) / feature.fadeDuration);
                for (let i = 0; i < vertexCount; i++) {
                    const ox = originalPositions.getX(i), oy = originalPositions.getY(i), oz = originalPositions.getZ(i);
                    const dist = Math.sqrt(Math.pow(ox - feature.centerPos.x, 2) + Math.pow(oy - feature.centerPos.y, 2) + Math.pow(oz - feature.centerPos.z, 2));
                    if (dist < feature.waveRadius) {
                        const normDist = dist / feature.waveRadius;
                        const spatialAttenuation = Math.pow(Math.cos(normDist * Math.PI * 0.5), 2.5);
                        vertexElevations[i] += Math.sin(phase - normDist * Math.PI * 3.5) * WAVE_MAX_HEIGHT * waveIntensity * spatialAttenuation;
                    }
                }
            };
            activeFaultSegments.forEach(processActiveFeature);
            activeVolcanoes.forEach(processActiveFeature);
            for (let i = 0; i < vertexCount; i++) {
                const ox = originalPositions.getX(i), oy = originalPositions.getY(i), oz = originalPositions.getZ(i);
                const normal = new THREE.Vector3(ox, oy, oz).normalize();
                positionAttribute.setXYZ(i, ox + normal.x * vertexElevations[i], oy + normal.y * vertexElevations[i], oz + normal.z * vertexElevations[i]);
            }
            positionAttribute.needsUpdate = true;
            earthGeometry.computeVertexNormals();
        }

        function getDeformedEarthRadiusAt(lat, lng) {
            let waveElev = 0;
            const processActiveFeature = (feature) => {
                const phase = tectonicTime * 1.8 + feature.tectonicPhaseOffset;
                let waveIntensity = 1.0;
                if (feature.age < feature.fadeDuration) waveIntensity = feature.age / feature.fadeDuration;
                else if (feature.age > feature.lifespan - feature.fadeDuration) waveIntensity = Math.max(0, (feature.lifespan - feature.age) / feature.fadeDuration);
                const targetPos = latLngToVector3(lat, lng, earthRadius);
                const dist = targetPos.distanceTo(feature.centerPos);
                if (dist < feature.waveRadius) {
                    const normDist = dist / feature.waveRadius;
                    const spatialAttenuation = Math.pow(Math.cos(normDist * Math.PI * 0.5), 2.5);
                    waveElev += Math.sin(phase - normDist * Math.PI * 3.5) * WAVE_MAX_HEIGHT * waveIntensity * spatialAttenuation;
                }
            };
            activeFaultSegments.forEach(processActiveFeature);
            activeVolcanoes.forEach(processActiveFeature);
            return earthRadius + waveElev;
        }

        // 13 & 14. ANIMASI SESAR & GUNUNG BERAPI
        function updateAnimatedRidges(tectonicTime) {
            if (activeFaultSegments.length < MAX_ACTIVE_SEGMENTS && allFaultCoords.length > 0 && Math.random() < 0.02) spawnRandomFaultRidge();
            for (let idx = activeFaultSegments.length - 1; idx >= 0; idx--) {
                const segment = activeFaultSegments[idx];
                segment.age++;
                let opacity = 1.0, scale = 1.0;
                if (segment.age < segment.fadeDuration) {
                    opacity = segment.age / segment.fadeDuration;
                    scale = Math.sin(opacity * Math.PI / 2);
                } else if (segment.age > segment.lifespan - segment.fadeDuration) {
                    opacity = Math.max(0, (segment.lifespan - segment.age) / segment.fadeDuration);
                    scale = Math.sin(opacity * Math.PI / 2);
                }
                if (segment.age >= segment.lifespan) {
                    faultRidgesGroup.remove(segment.meshA); faultRidgesGroup.remove(segment.meshB);
                    segment.meshA.geometry.dispose(); segment.meshB.geometry.dispose();
                    segment.meshA.material.dispose(); segment.meshB.material.dispose();
                    activeFaultSegments.splice(idx, 1);
                    continue;
                }
                segment.meshA.material.opacity = opacity; segment.meshB.material.opacity = opacity;
                const tremorPhase = tectonicTime * segment.tremorFrequency;
                const currentTremorAmp = segment.tremorAmplitude * opacity;
                const tremorOffsetA = getNaturalTremor(tremorPhase, currentTremorAmp);
                const tremorOffsetB = getNaturalTremor(tremorPhase + 5.0, currentTremorAmp); 
                const pointsDataA = [], pointsDataB = [];
                for (let i = 0; i < segment.coords.length; i++) {
                    const lng = segment.coords[i][0], lat = segment.coords[i][1];
                    let prev = segment.coords[Math.max(0, i - 1)], next = segment.coords[Math.min(segment.coords.length - 1, i + 1)];
                    let len = Math.sqrt(Math.pow(next[0] - prev[0], 2) + Math.pow(next[1] - prev[1], 2)) || 1;
                    let nLng = -(next[1] - prev[1]) / len, nLat = (next[0] - prev[0]) / len;
                    const localNoise = spatialNoise(lat * 1.5, lng * 1.5);
                    const currentOffsetDeg = (0.50 + 0.40 * localNoise) + Math.sin(tectonicTime + segment.tectonicPhaseOffset + localNoise * Math.PI * 2) * (0.30 + 0.20 * localNoise);
                    let latA = lat + nLat * currentOffsetDeg, lngA = lng + nLng * currentOffsetDeg;
                    let latB = lat - nLat * currentOffsetDeg, lngB = lng - nLng * currentOffsetDeg;
                    const rA = getDeformedEarthRadiusAt(latA, lngA), rB = getDeformedEarthRadiusAt(latB, lngB);
                    const posA = latLngToVector3(latA, lngA, rA), posB = latLngToVector3(latB, lngB, rB);
                    pointsDataA.push({ pos: posA, dir: latLngToVector3(latA + nLat, lngA + nLng, rA).sub(posA).normalize(), lat: latA, lng: lngA });
                    pointsDataB.push({ pos: posB, dir: latLngToVector3(latB - nLat, lngB - nLng, rB).sub(posB).normalize(), lat: latB, lng: lngB });
                }
                const newGeomA = buildTexturedRidgeGeometry(pointsDataA, scale, tremorOffsetA);
                if (newGeomA) { segment.meshA.geometry.dispose(); segment.meshA.geometry = newGeomA; }
                const newGeomB = buildTexturedRidgeGeometry(pointsDataB, scale, tremorOffsetB);
                if (newGeomB) { segment.meshB.geometry.dispose(); segment.meshB.geometry = newGeomB; }
            }
        }

        function updateAnimatedVolcanoes(tectonicTime) {
            if (activeVolcanoes.length < MAX_ACTIVE_VOLCANOES && realVolcanoCoordinates.length > 0 && Math.random() < 0.015) spawnRandomVolcano();
            
            for (let idx = activeVolcanoes.length - 1; idx >= 0; idx--) {
                const volcano = activeVolcanoes[idx];
                volcano.age++;
                let opacity = 1.0, scale = 1.0;
                if (volcano.age < volcano.fadeDuration) {
                    opacity = volcano.age / volcano.fadeDuration;
                    scale = Math.sin(opacity * Math.PI / 2);
                } else if (volcano.age > volcano.lifespan - volcano.fadeDuration) {
                    opacity = Math.max(0, (volcano.lifespan - volcano.age) / volcano.fadeDuration);
                    scale = Math.sin(opacity * Math.PI / 2);
                }
                if (volcano.age >= volcano.lifespan) {
                    volcanoesGroup.remove(volcano.mesh); ashPlumesGroup.remove(volcano.ashMesh);
                    volcano.mesh.geometry.dispose(); volcano.mesh.material.dispose();
                    volcano.ashMesh.geometry.dispose(); volcano.ashMesh.material.dispose();
                    activeVolcanoes.splice(idx, 1);
                    continue;
                }
                
                volcano.mesh.material.opacity = opacity;
                volcano.ashMesh.material.uniforms.uTime.value = tectonicTime;
                volcano.ashMesh.material.uniforms.uOpacity.value = opacity;

                const tremorOffset = getNaturalTremor(tectonicTime * volcano.tremorFrequency, volcano.tremorAmplitude * opacity);
                const volcanoData = buildVolcanoGeometry(volcano.lat, volcano.lng, scale, tremorOffset, getDeformedEarthRadiusAt(volcano.lat, volcano.lng));
                
                if (volcanoData && volcanoData.geometry) {
                    volcano.mesh.geometry.dispose(); 
                    volcano.mesh.geometry = volcanoData.geometry;
                }
            }
        }

        // 15. DATA GEOJSON LEMPENG TEKTONIK
        fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json')
            .then(response => response.json())
            .then(data => {
                data.features.forEach(feature => {
                    if (feature.geometry.type === 'LineString') allFaultCoords.push(feature.geometry.coordinates);
                    else if (feature.geometry.type === 'MultiLineString') feature.geometry.coordinates.forEach(ls => allFaultCoords.push(ls));
                });
                for (let i = 0; i < 2; i++) { spawnRandomFaultRidge(); spawnRandomVolcano(); }
            }).catch(err => console.error("Gagal memuat GeoJSON lempeng:", err));

        // 16. BULAN DENGAN ORBIT & PENCAHAYAAN NATURAL
        const moonGeometry = new THREE.SphereGeometry(1.1, 64, 64);
        const moonMaterial = new THREE.MeshPhongMaterial({
            map: moonTexture, 
            color: 0x888888,
            shininess: 2
        });
        const moon = new THREE.Mesh(moonGeometry, moonMaterial);
        moon.castShadow = true; moon.receiveShadow = true;
        scene.add(moon);

        const moonOrbitRadiusX = 9.2; 
        const moonOrbitRadiusZ = 7.8; 
        const moonInclination = 0.15; 
        let moonOrbitAngle = 0;

        function adjustObjectsPosition() {
            if (heroContainer.clientWidth <= 768) earth.position.set(0, -0.8, 0);
            else earth.position.set(4.5, -0.3, 0);
        }
        adjustObjectsPosition();

        // 17. INTERAKSI MOUSE DRAG & MOUSE PRESS ELASTIS
        let isDragging = false, prevMouse = { x: 0, y: 0 };
        let targetEarthScale = 1.0;
        let currentEarthScale = 1.0;

        function handlePressDown(clientX, clientY) {
            isDragging = true;
            prevMouse = { x: clientX, y: clientY };
            targetEarthScale = 0.93; 
        }

        function handlePressRelease() {
            isDragging = false;
            targetEarthScale = 1.0; 
        }

        window.addEventListener('mousedown', (e) => handlePressDown(e.clientX, e.clientY));
        window.addEventListener('mouseup', handlePressRelease);
        window.addEventListener('mouseleave', handlePressRelease);
        
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            earth.rotation.y += (e.clientX - prevMouse.x) * 0.004;
            earth.rotation.x += (e.clientY - prevMouse.y) * 0.004;
            prevMouse = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) handlePressDown(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchend', handlePressRelease);
        window.addEventListener('touchcancel', handlePressRelease);
        
        window.addEventListener('touchmove', (e) => {
            if (!isDragging || e.touches.length === 0) return;
            earth.rotation.y += (e.touches[0].clientX - prevMouse.x) * 0.004;
            earth.rotation.x += (e.touches[0].clientY - prevMouse.y) * 0.004;
            prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }, { passive: true });

        // 18. ANIMASI RENDERING LOOP
        let tectonicTime = 0;

        function animate() {
            requestAnimationFrame(animate);

            // Respon Skala Mulus saat Ditekan
            currentEarthScale += (targetEarthScale - currentEarthScale) * 0.12; 
            earth.scale.set(currentEarthScale, currentEarthScale, currentEarthScale);

            if (!isDragging) earth.rotation.y += 0.0018;
            clouds.rotation.y += 0.0022; 
            
            stars.rotation.y -= 0.00015;
            if (starMaterial) {
                starMaterial.opacity = 0.75 + Math.sin(tectonicTime * 0.8) * 0.15;
            }

            tectonicTime += 0.025;

            updateEarthSurfaceWave(tectonicTime);
            updateAnimatedRidges(tectonicTime);
            updateAnimatedVolcanoes(tectonicTime);

            // Orbit Bulan & Rotasi Pasang Surut (Tidally Locked)
            moonOrbitAngle += 0.0018; 
            moon.position.x = earth.position.x + Math.cos(moonOrbitAngle) * moonOrbitRadiusX;
            moon.position.z = earth.position.z + Math.sin(moonOrbitAngle) * moonOrbitRadiusZ;
            moon.position.y = earth.position.y + Math.sin(moonOrbitAngle) * (moonOrbitRadiusX * moonInclination);

            moon.rotation.y = -moonOrbitAngle + Math.PI / 2;
            moon.rotation.x = 0.05 * Math.sin(moonOrbitAngle);

            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = heroContainer.clientWidth / heroContainer.clientHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(heroContainer.clientWidth, heroContainer.clientHeight);
            adjustObjectsPosition();
        });
    }
})();
