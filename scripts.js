// Enhanced Configuration
const CONFIG = {
    galaxy: {
        particleCount: 8000,
        maxRadius: 300,
        branches: 4,
        spin: 0.01,
        colors: {
            inner: '#8B5CF6',
            middle: '#06B6D4',
            outer: '#EC4899',
            accent: '#10B981'
        }
    },
    planets: [
        { radius: 20, position: [180, 80, -60], colors: ['#8B5CF6', '#06B6D4'], speed: 0.002 },
        { radius: 15, position: [-150, 100, -50], colors: ['#EC4899', '#8B5CF6'], speed: 0.003 },
        { radius: 12, position: [120, -80, -55], colors: ['#06B6D4', '#10B981'], speed: 0.0015 },
        { radius: 18, position: [-100, -60, -70], colors: ['#F59E0B', '#EC4899'], speed: 0.004 }
    ]
};

// Global variables
let scene, camera, renderer, galaxySystem, planetMeshes = [];
let mouseX = 0, mouseY = 0, time = 0;
let isInitialized = false;

// Initialize Enhanced Galaxy System
function initGalaxy() {
    try {
        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x010409, 0.0005);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
        camera.position.set(0, 30, 120);

        const canvas = document.getElementById('galaxy-canvas');
        renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            alpha: true,
            antialias: window.devicePixelRatio < 2,
            powerPreference: "high-performance"
        });
        
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(0x010409, 1);

        createGalaxy();
        createPlanets();
        createStars();
        createAmbientLighting();

        isInitialized = true;
        animate();
    } catch (error) {
        console.error('Galaxy initialization failed:', error);
        handleGalaxyError();
    }
}

function createGalaxy() {
    const geometry = new THREE.BufferGeometry();
    const { particleCount, maxRadius, branches, spin } = CONFIG.galaxy;
    
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    const colorInner = new THREE.Color(CONFIG.galaxy.colors.inner);
    const colorMiddle = new THREE.Color(CONFIG.galaxy.colors.middle);
    const colorOuter = new THREE.Color(CONFIG.galaxy.colors.outer);

    for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        
        const radius = Math.pow(Math.random(), 0.6) * maxRadius;
        const spinAngle = radius * spin;
        const branchAngle = (i % branches) * (Math.PI * 2) / branches;
        
        const randomX = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 15;
        const randomY = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 5;
        const randomZ = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? 1 : -1) * 15;

        positions[i3] = Math.cos(branchAngle + spinAngle) * radius + randomX;
        positions[i3 + 1] = randomY;
        positions[i3 + 2] = Math.sin(branchAngle + spinAngle) * radius + randomZ;

        // Color mixing
        const mixedColor = colorInner.clone();
        mixedColor.lerp(colorMiddle, radius / maxRadius);
        mixedColor.lerp(colorOuter, Math.pow(radius / maxRadius, 0.5));

        colors[i3] = mixedColor.r;
        colors[i3 + 1] = mixedColor.g;
        colors[i3 + 2] = mixedColor.b;

        sizes[i] = Math.random() * 4 + 1;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    const material = new THREE.ShaderMaterial({
        uniforms: {
            uTime: { value: 0 },
            uSize: { value: 30 * renderer.getPixelRatio() }
        },
        vertexShader: `
            attribute float size;
            uniform float uTime;
            uniform float uSize;
            varying vec3 vColor;

            void main() {
                vColor = color;
                vec4 modelPosition = modelMatrix * vec4(position, 1.0);
                vec4 viewPosition = viewMatrix * modelPosition;
                vec4 projectedPosition = projectionMatrix * viewPosition;
                gl_Position = projectedPosition;
                gl_PointSize = size * uSize * (1.0 / -viewPosition.z);
            }
        `,
        fragmentShader: `
            varying vec3 vColor;
            
            void main() {
                float strength = distance(gl_PointCoord, vec2(0.5));
                strength = 1.0 - strength;
                strength = pow(strength, 3.0);
                
                vec3 color = mix(vec3(0.0), vColor, strength);
                gl_FragColor = vec4(color, strength);
            }
        `,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        transparent: true,
        vertexColors: true
    });

    galaxySystem = new THREE.Points(geometry, material);
    scene.add(galaxySystem);
}

function createPlanets() {
    CONFIG.planets.forEach((planetConfig, index) => {
        const geometry = new THREE.SphereGeometry(planetConfig.radius, 32, 32);
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor1: { value: new THREE.Color(planetConfig.colors[0]) },
                uColor2: { value: new THREE.Color(planetConfig.colors[1]) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    vUv = uv;
                    vPosition = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform vec3 uColor1;
                uniform vec3 uColor2;
                varying vec2 vUv;
                varying vec3 vPosition;
                
                void main() {
                    float noise = sin(vPosition.x * 0.1 + uTime) * sin(vPosition.y * 0.1 + uTime * 0.7) * sin(vPosition.z * 0.1 + uTime * 0.3);
                    vec3 color = mix(uColor1, uColor2, noise * 0.5 + 0.5);
                    gl_FragColor = vec4(color, 0.8);
                }
            `,
            transparent: true,
            blending: THREE.AdditiveBlending
        });

        const planet = new THREE.Mesh(geometry, material);
        planet.position.set(...planetConfig.position);
        planet.userData = { 
            speed: planetConfig.speed, 
            originalPosition: [...planetConfig.position],
            orbitRadius: Math.sqrt(planetConfig.position[0] ** 2 + planetConfig.position[2] ** 2)
        };
        
        planetMeshes.push(planet);
        scene.add(planet);
    });
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 3000;
    const positions = new Float32Array(starCount * 3);
    
    for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 2000;
    }
    
    starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 2,
        transparent: true,
        opacity: 0.8
    });
    
    const stars = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(stars);
}

function createAmbientLighting() {
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x8B5CF6, 1, 1000);
    pointLight.position.set(0, 0, 0);
    scene.add(pointLight);

    const pointLight2 = new THREE.PointLight(0x06B6D4, 0.5, 800);
    pointLight2.position.set(200, 100, -100);
    scene.add(pointLight2);
}

function animate() {
    if (!isInitialized) return;
    
    requestAnimationFrame(animate);
    time += 0.01;

    // Update galaxy rotation
    if (galaxySystem) {
        galaxySystem.rotation.y = time * 0.1;
        if (galaxySystem.material.uniforms) {
            galaxySystem.material.uniforms.uTime.value = time;
        }
    }

    // Update planets
    planetMeshes.forEach((planet, index) => {
        const userData = planet.userData;
        const angle = time * userData.speed;
        
        planet.position.x = Math.cos(angle) * userData.orbitRadius;
        planet.position.z = Math.sin(angle) * userData.orbitRadius;
        planet.rotation.y += userData.speed * 2;
        
        if (planet.material.uniforms) {
            planet.material.uniforms.uTime.value = time;
        }
    });

    // Camera movement
    camera.position.x += (mouseX * 0.5 - camera.position.x) * 0.02;
    camera.position.y += (-mouseY * 0.3 - camera.position.y + 30) * 0.02;
    camera.lookAt(scene.position);

    renderer.render(scene, camera);
}

function handleGalaxyError() {
    console.warn('3D Galaxy disabled due to compatibility issues');
    document.getElementById('galaxy-canvas').style.display = 'none';
}

// Mouse movement
document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - window.innerWidth / 2) / 100;
    mouseY = (event.clientY - window.innerHeight / 2) / 100;
});

// Window resize
window.addEventListener('resize', () => {
    if (!isInitialized) return;
    
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// Cosmic particles
function createCosmicParticles() {
    const container = document.getElementById('cosmicParticles');
    const particleCount = 150;
    
    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'cosmic-particle';
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = Math.random() * 100 + '%';
        particle.style.animationDelay = Math.random() * 3 + 's';
        particle.style.animationDuration = (Math.random() * 2 + 2) + 's';
        container.appendChild(particle);
    }
}

// Navigation functionality
function initNavigation() {
    const navbar = document.getElementById('navbar');
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Scroll effect
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    // Mobile menu toggle
    mobileToggle.addEventListener('click', () => {
        mobileToggle.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Active link highlighting
    function updateActiveLink() {
        const sections = document.querySelectorAll('section');
        const scrollPos = window.scrollY + 100;

        sections.forEach(section => {
            const top = section.offsetTop;
            const bottom = top + section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos <= bottom) {
                navLinks.forEach(link => {
                    link.classList.remove('active');
                    if (link.getAttribute('href') === `#${id}`) {
                        link.classList.add('active');
                    }
                });
            }
        });
    }

    window.addEventListener('scroll', updateActiveLink);

    // Smooth scrolling
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80;
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
            
            // Close mobile menu
            mobileToggle.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });
}

// Scroll animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Observe all animated elements
    document.querySelectorAll('.fade-in, .slide-in-left, .slide-in-right').forEach(el => {
        observer.observe(el);
    });
}

// Counter animations
function animateCounters() {
    const counters = [
        { element: document.getElementById('projectCount'), target: 0, suffix: ' ' },
        { element: document.getElementById('skillsCount'), target: 6, suffix: '+' }
    ];

    counters.forEach(counter => {
        if (counter.element) {
            let current = 0;
            const increment = counter.target / 50;
            const timer = setInterval(() => {
                current += increment;
                if (current >= counter.target) {
                    current = counter.target;
                    clearInterval(timer);
                }
                counter.element.textContent = Math.floor(current) + (counter.suffix || '');
            }, 50);
        }
    });
}

// Loading screen
function hideLoadingScreen() {
    const loading = document.getElementById('loading');
    setTimeout(() => {
        loading.classList.add('hidden');
        setTimeout(() => {
            loading.style.display = 'none';
        }, 800);
    }, 2000);
}

// Initialize everything
document.addEventListener('DOMContentLoaded', () => {
    hideLoadingScreen();
    createCosmicParticles();
    initNavigation();
    initScrollAnimations();
    
    // Initialize galaxy with error handling
    if (window.THREE) {
        initGalaxy();
    } else {
        console.warn('Three.js not loaded, skipping 3D galaxy');
        handleGalaxyError();
    }

    // Start counter animations when stats section is visible
    const statsSection = document.getElementById('stats');
    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounters();
                statsObserver.unobserve(entry.target);
            }
        });
    });
    if (statsSection) {
        statsObserver.observe(statsSection);
    }

    // Add keyboard navigation support
    document.body.classList.add('keyboard-navigation');
});

// Performance optimization
let ticking = false;
function requestTick() {
    if (!ticking) {
        requestAnimationFrame(updateAnimations);
        ticking = true;
    }
}

function updateAnimations() {
    ticking = false;
}

// Error handling
window.addEventListener('error', (event) => {
    console.error('Portfolio error:', event.error);
});

// Fallback for older browsers
if (!window.requestAnimationFrame) {
    window.requestAnimationFrame = function(callback) {
        return setTimeout(callback, 1000 / 60);
    };
}