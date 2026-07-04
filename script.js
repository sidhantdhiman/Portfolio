/* ==========================================================================
   PORTFOLIO SCRIPT
   Sections:
   1. Three.js constellation / particle background
   2. Loader
   3. Theme toggle (dark / light)
   4. Mobile nav toggle + active link highlighting
   5. Typing text effect (hero)
   6. Scroll-based reveal animations (IntersectionObserver)
   7. Animated skill progress bars
   8. Contact form validation
   9. Back-to-top button
   ========================================================================== */

/* -------------------------------------------------------------------------
   1. THREE.JS CONSTELLATION BACKGROUND
   A field of particles that drift slowly and draw thin connecting lines
   between nearby points — a "galaxy / constellation" effect that also
   reacts gently to the mouse position for a bit of depth.
   ------------------------------------------------------------------------- */
function initThreeScene() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas || typeof THREE === 'undefined') return;

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
  );
  camera.position.z = 60;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true, // transparent so the CSS background shows through
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  // ---- Particle field ----
  const PARTICLE_COUNT = window.innerWidth < 768 ? 260 : 520;
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const velocities = [];

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 140;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 90;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

    velocities.push({
      x: (Math.random() - 0.5) * 0.02,
      y: (Math.random() - 0.5) * 0.02,
      z: (Math.random() - 0.5) * 0.02,
    });
  }

  const particleGeometry = new THREE.BufferGeometry();
  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

  const particleMaterial = new THREE.PointsMaterial({
    color: 0x6ee7d8,
    size: 0.6,
    transparent: true,
    opacity: 0.85,
    sizeAttenuation: true,
  });

  const particles = new THREE.Points(particleGeometry, particleMaterial);
  scene.add(particles);

  // ---- Connecting lines between nearby particles (constellation effect) ----
  const MAX_CONNECT_DIST = 9;
  const lineGeometry = new THREE.BufferGeometry();
  const lineMaterial = new THREE.LineBasicMaterial({
    color: 0x9b7bff,
    transparent: true,
    opacity: 0.18,
  });
  const lineMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
  scene.add(lineMesh);

  // Only recompute connections every few frames (perf) and only across a
  // reasonable subset so it stays smooth on lower-end devices.
  let frameCount = 0;

  function updateConnections() {
    const linePositions = [];
    const pos = particleGeometry.attributes.position.array;

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      for (let j = i + 1; j < PARTICLE_COUNT; j++) {
        const dx = pos[i * 3] - pos[j * 3];
        const dy = pos[i * 3 + 1] - pos[j * 3 + 1];
        const dz = pos[i * 3 + 2] - pos[j * 3 + 2];
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < MAX_CONNECT_DIST) {
          linePositions.push(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
          linePositions.push(pos[j * 3], pos[j * 3 + 1], pos[j * 3 + 2]);
        }
      }
    }

    lineGeometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array(linePositions), 3)
    );
  }

  // ---- Mouse parallax ----
  const mouse = { x: 0, y: 0 };
  window.addEventListener('mousemove', (e) => {
    mouse.x = (e.clientX / window.innerWidth - 0.5) * 2;
    mouse.y = (e.clientY / window.innerHeight - 0.5) * 2;
  });

  // ---- Animation loop ----
  function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    const pos = particleGeometry.attributes.position.array;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] += velocities[i].x;
      pos[i * 3 + 1] += velocities[i].y;
      pos[i * 3 + 2] += velocities[i].z;

      // Wrap particles back into the field bounds
      if (Math.abs(pos[i * 3]) > 70) velocities[i].x *= -1;
      if (Math.abs(pos[i * 3 + 1]) > 45) velocities[i].y *= -1;
      if (Math.abs(pos[i * 3 + 2]) > 40) velocities[i].z *= -1;
    }
    particleGeometry.attributes.position.needsUpdate = true;

    // Recompute connecting lines every 4th frame for performance
    if (frameCount % 4 === 0) updateConnections();

    // Gentle camera drift toward the mouse for a parallax feel
    camera.position.x += (mouse.x * 8 - camera.position.x) * 0.02;
    camera.position.y += (-mouse.y * 5 - camera.position.y) * 0.02;
    camera.lookAt(scene.position);

    // Slow ambient rotation of the whole field
    particles.rotation.y += 0.0006;
    lineMesh.rotation.y += 0.0006;

    renderer.render(scene, camera);
  }
  animate();

  // ---- Resize handling ----
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

/* -------------------------------------------------------------------------
   2. LOADER
   Hide the preload screen once the window has fully loaded (fonts, images,
   and the Three.js scene included). A small minimum delay keeps the
   animation from flashing too quickly on fast connections.
   ------------------------------------------------------------------------- */
function initLoader() {
  const loader = document.getElementById('loader');
  const MIN_DISPLAY_MS = 900;
  const start = Date.now();

  window.addEventListener('load', () => {
    const elapsed = Date.now() - start;
    const wait = Math.max(MIN_DISPLAY_MS - elapsed, 0);
    setTimeout(() => loader.classList.add('hidden'), wait);
  });
}

/* -------------------------------------------------------------------------
   3. THEME TOGGLE (dark / light)
   Persists the choice in-memory for the session and swaps a data attribute
   on <html>, which the CSS variables in style.css respond to.
   ------------------------------------------------------------------------- */
function initThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  const root = document.documentElement;
  let theme = 'dark';

  toggle.addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', theme);
  });
}

/* -------------------------------------------------------------------------
   4. MOBILE NAV + ACTIVE LINK HIGHLIGHTING
   ------------------------------------------------------------------------- */
function initNav() {
  const nav = document.getElementById('nav');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const links = document.querySelectorAll('[data-nav]');
  const sections = document.querySelectorAll('main section[id]');

  // Hamburger menu open/close on mobile
  navToggle.addEventListener('click', () => {
    const isOpen = navLinks.classList.toggle('open');
    navToggle.classList.toggle('open', isOpen);
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close mobile menu after a link is tapped
  links.forEach((link) => {
    link.addEventListener('click', () => {
      navLinks.classList.remove('open');
      navToggle.classList.remove('open');
    });
  });

  // Add a subtle background once the page is scrolled
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Highlight the nav link matching the section currently in view
  const sectionObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          links.forEach((link) => {
            link.classList.toggle(
              'active',
              link.getAttribute('href') === `#${entry.target.id}`
            );
          });
        }
      });
    },
    { rootMargin: '-45% 0px -50% 0px' }
  );
  sections.forEach((section) => sectionObserver.observe(section));
}

/* -------------------------------------------------------------------------
   5. TYPING TEXT EFFECT (hero subtitle)
   Cycles through a list of roles, typing and deleting each in turn.
   ------------------------------------------------------------------------- */
function initTypingEffect() {
  const el = document.getElementById('typedText');
  if (!el) return;

  const phrases = [
    'Frontend Developer',
    'UI Enthusiast',
    'Learning 3D Web',
    'Web Development Learner',
  ];

  let phraseIndex = 0;
  let charIndex = 0;
  let deleting = false;

  function tick() {
    const current = phrases[phraseIndex];

    if (!deleting) {
      charIndex++;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === current.length) {
        deleting = true;
        setTimeout(tick, 1400); // pause at full phrase
        return;
      }
    } else {
      charIndex--;
      el.textContent = current.slice(0, charIndex);
      if (charIndex === 0) {
        deleting = false;
        phraseIndex = (phraseIndex + 1) % phrases.length;
      }
    }

    setTimeout(tick, deleting ? 45 : 85);
  }

  tick();
}

/* -------------------------------------------------------------------------
   6. SCROLL-BASED REVEAL ANIMATIONS
   Adds .is-visible to any .reveal element once it enters the viewport,
   which triggers the fade-in / slide-up transition defined in CSS.
   ------------------------------------------------------------------------- */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );

  items.forEach((item) => observer.observe(item));
}

/* -------------------------------------------------------------------------
   7. ANIMATED SKILL PROGRESS BARS
   Fills each bar to its target percentage and counts the number up once
   the skills section scrolls into view.
   ------------------------------------------------------------------------- */
function initSkillBars() {
  const skillsSection = document.getElementById('skills');
  if (!skillsSection) return;

  let animated = false;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !animated) {
          animated = true;

          document.querySelectorAll('.skill-fill').forEach((bar) => {
            bar.style.width = `${bar.dataset.fill}%`;
          });

          document.querySelectorAll('.skill-pct').forEach((label) => {
            const target = parseInt(label.dataset.target, 10);
            let current = 0;
            const step = Math.max(1, Math.round(target / 40));

            const counter = setInterval(() => {
              current += step;
              if (current >= target) {
                current = target;
                clearInterval(counter);
              }
              label.textContent = `${current}%`;
            }, 25);
          });

          observer.unobserve(skillsSection);
        }
      });
    },
    { threshold: 0.3 }
  );

  observer.observe(skillsSection);
}

/* -------------------------------------------------------------------------
   8. CONTACT FORM VALIDATION
   Simple client-side validation with inline error messages. No backend is
   wired up — on success it just shows a confirmation message, since this
   is a static front-end demo.
   ------------------------------------------------------------------------- */
function initContactForm() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const status = document.getElementById('formStatus');

  const validators = {
    name: (value) => value.trim().length >= 2 || 'Please enter your name.',
    email: (value) =>
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Please enter a valid email address.',
    message: (value) => value.trim().length >= 10 || 'Message should be at least 10 characters.',
  };

  function showError(field, message) {
    const row = form.querySelector(`#${field}`).closest('.form-row');
    const errorEl = form.querySelector(`[data-error-for="${field}"]`);
    row.classList.toggle('error', Boolean(message));
    errorEl.textContent = message === true ? '' : message || '';
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let isValid = true;

    Object.entries(validators).forEach(([field, validate]) => {
      const value = form.querySelector(`#${field}`).value;
      const result = validate(value);
      if (result !== true) {
        isValid = false;
        showError(field, result);
      } else {
        showError(field, '');
      }
    });

    if (!isValid) {
      status.textContent = '';
      return;
    }

    // Simulate a send (no backend in this static demo)
    const submitBtn = form.querySelector('.form-submit .btn-text');
    submitBtn.textContent = 'Sending…';

    setTimeout(() => {
      status.textContent = "Thanks! Your message has been sent — I'll get back to you soon.";
      submitBtn.textContent = 'Send message';
      form.reset();
    }, 900);
  });

  // Clear an error as soon as the user starts fixing that field
  Object.keys(validators).forEach((field) => {
    form.querySelector(`#${field}`).addEventListener('input', (e) => {
      if (validators[field](e.target.value) === true) showError(field, '');
    });
  });
}

/* -------------------------------------------------------------------------
   9. BACK TO TOP BUTTON
   ------------------------------------------------------------------------- */
function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 600);
  });

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

/* -------------------------------------------------------------------------
   INIT — run everything once the DOM is ready
   ------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('year').textContent = new Date().getFullYear();

  initLoader();
  initThreeScene();
  initThemeToggle();
  initNav();
  initTypingEffect();
  initScrollReveal();
  initSkillBars();
  initContactForm();
  initBackToTop();
});