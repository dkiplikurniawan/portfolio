// Ganti URL ini dengan URL Web App Google Apps Script Anda yang dipublikasikan
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz8ri3e7kEKwxzMDA-Tkcigr9FGRr8w8Jtojygwv2F6qc2EdK0YhcMkFNmi4TBGqeNR/exec';
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// 1. HERO REVEAL & PARALLAX & NAVBAR SHRINK & BLUR EXIT
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.hero-reveal').forEach(el => el.classList.add('is-visible'));

  const heroPortrait = document.getElementById('hero-portrait-frame');
  const heroSection = document.getElementById('hero-section');
  const heroContent = document.getElementById('hero-content');

  if (heroPortrait && heroSection && !prefersReducedMotion) {
    heroSection.addEventListener('mousemove', (e) => {
      if (window.innerWidth < 1024) return;
      const { left, top, width, height } = heroSection.getBoundingClientRect();
      const transX = Math.max(-8, Math.min(8, ((e.clientX - left - width / 2) / (width / 2)) * 8));
      const transY = Math.max(-8, Math.min(8, ((e.clientY - top - height / 2) / (height / 2)) * 8));
      heroPortrait.style.transform = `translate3d(${transX}px, ${transY}px, 0)`;
    });
    heroSection.addEventListener('mouseleave', () => {
      heroPortrait.style.transform = 'translate3d(0, 0, 0)';
    });
  }

  const navbar = document.getElementById('navbar');
  const navbarContainer = document.getElementById('navbar-container');
  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;
    if (scrollY > 80) {
      navbar.classList.add('apple-glass-scrolled');
      navbarContainer.classList.remove('h-20');
      navbarContainer.classList.add('h-16');
    } else {
      navbar.classList.remove('apple-glass-scrolled');
      navbarContainer.classList.remove('h-16');
      navbarContainer.classList.add('h-20');
    }

    if (heroContent && !prefersReducedMotion && scrollY < 900) {
      heroContent.style.opacity = Math.max(0, 1 - scrollY / 650);
      heroContent.style.transform = `translateY(${(scrollY * 0.15).toFixed(1)}px)`;
      heroContent.style.filter = `blur(${(scrollY / 100).toFixed(1)}px)`;
    }
  });
});

// 2. BI-DIRECTIONAL SCROLL REVEAL (Entry & Exit)
document.addEventListener('DOMContentLoaded', () => {
  const revealItems = document.querySelectorAll('.scroll-reveal-item');
  if (revealItems.length > 0) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          entry.target.classList.remove('is-exited');
        } else if (!prefersReducedMotion) {
          if (entry.boundingClientRect.top < 0) {
            entry.target.classList.add('is-exited');
            entry.target.classList.remove('is-visible');
          } else {
            entry.target.classList.remove('is-visible', 'is-exited');
          }
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach(item => observer.observe(item));
  }
});

// 3. ABOUT GPA 3D TILT & PROGRESS METRIC COUNTER
document.addEventListener('DOMContentLoaded', () => {
  const gpaCard = document.getElementById('gpa-card');
  if (gpaCard && !prefersReducedMotion) {
    gpaCard.addEventListener('mousemove', (e) => {
      const rect = gpaCard.getBoundingClientRect();
      const rotateX = (-(e.clientY - rect.top - rect.height / 2) / (rect.height / 2)) * 3;
      const rotateY = ((e.clientX - rect.left - rect.width / 2) / (rect.width / 2)) * 3;
      gpaCard.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
    });
    gpaCard.addEventListener('mouseleave', () => {
      gpaCard.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
    });
  }

  const progressCircle = document.getElementById('gpa-circle-progress');
  const counterEl = document.getElementById('gpa-counter');
  let gpaAnimated = false;

  if (gpaCard && progressCircle && counterEl) {
    const gpaObserver = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !gpaAnimated) {
        gpaAnimated = true;
        progressCircle.style.strokeDashoffset = '23.56';
        if (prefersReducedMotion) { counterEl.innerText = '3.70'; return; }
        const duration = 2000;
        const startTime = performance.now();
        function step(now) {
          const progress = Math.min((now - startTime) / duration, 1);
          counterEl.innerText = ((1 - Math.pow(1 - progress, 3)) * 3.70).toFixed(2);
          if (progress < 1) requestAnimationFrame(step);
          else counterEl.innerText = '3.70';
        }
        requestAnimationFrame(step);
      }
    }, { threshold: 0.3 });
    gpaObserver.observe(gpaCard);
  }
});

// 4. DEAFSAPP PATH & STATS COUNTER GLOW
document.addEventListener('DOMContentLoaded', () => {
  const pipelineSection = document.getElementById('deafsapp-pipeline');
  const deafsappPath = document.querySelector('.deafsapp-path');
  if (pipelineSection && deafsappPath) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) deafsappPath.classList.add('is-drawn');
    }, { threshold: 0.2 }).observe(pipelineSection);
  }

  const numbersSection = document.getElementById('deafsapp-numbers-section');
  const statCounters = document.querySelectorAll('.deafsapp-stat-counter');
  const statIcons = document.querySelectorAll('.stat-icon-glow');
  let statsAnimated = false;

  if (numbersSection && statCounters.length > 0) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !statsAnimated) {
        statsAnimated = true;
        statCounters.forEach(el => {
          const target = parseFloat(el.getAttribute('data-target') || '0');
          if (prefersReducedMotion) { el.innerText = target.toFixed(1); return; }
          const duration = 1800;
          const startTime = performance.now();
          function stepStats(now) {
            const progress = Math.min((now - startTime) / duration, 1);
            el.innerText = ((1 - Math.pow(1 - progress, 3)) * target).toFixed(1);
            if (progress < 1) requestAnimationFrame(stepStats);
            else {
              el.innerText = target.toFixed(1);
              statIcons.forEach(icon => { icon.classList.remove('opacity-0'); icon.classList.add('opacity-100', 'icon-glow-emerald'); });
            }
          }
          requestAnimationFrame(stepStats);
        });
      }
    }, { threshold: 0.3 }).observe(numbersSection);
  }
});

// 5. SUCARE 3D ROTATE-IN & SPOTLIGHT CARDS
document.addEventListener('DOMContentLoaded', () => {
  const sucareSection = document.getElementById('sucare-phones-section');
  const phoneCenter = document.querySelector('.phone-center');
  const phoneLeft = document.querySelector('.phone-left');
  const phoneRight = document.querySelector('.phone-right');

  if (sucareSection && phoneCenter) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setTimeout(() => phoneCenter.classList.add('is-visible'), 100);
        setTimeout(() => phoneLeft.classList.add('is-visible'), 280);
        setTimeout(() => phoneRight.classList.add('is-visible'), 440);
      } else if (!prefersReducedMotion) {
        phoneCenter.classList.remove('is-visible');
        phoneLeft.classList.remove('is-visible');
        phoneRight.classList.remove('is-visible');
      }
    }, { threshold: 0.2 }).observe(sucareSection);
  }

  document.querySelectorAll('.spotlight-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      card.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`);
      card.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`);
    });
  });
});

// 6. SKILLS TAB SWITCHER
function switchSkillTab(panelId, btn) {
  document.querySelectorAll('.skill-tab-btn').forEach(b => {
    b.classList.remove('bg-white', 'text-neutral-950', 'shadow-sm');
    b.classList.add('text-neutral-600');
  });
  btn.classList.add('bg-white', 'text-neutral-950', 'shadow-sm');
  btn.classList.remove('text-neutral-600');

  const activePanel = document.querySelector('.skill-panel:not(.hidden)');
  const targetPanel = document.getElementById(panelId);

  if (activePanel && activePanel !== targetPanel) {
    if (prefersReducedMotion) {
      activePanel.classList.add('hidden'); activePanel.classList.remove('block');
      targetPanel.classList.remove('hidden'); targetPanel.classList.add('block');
      return;
    }
    activePanel.style.opacity = '0';
    activePanel.style.transform = 'translateY(10px)';

    setTimeout(() => {
      activePanel.classList.add('hidden'); activePanel.classList.remove('block');
      targetPanel.classList.remove('hidden'); targetPanel.classList.add('block');
      targetPanel.style.opacity = '0'; targetPanel.style.transform = 'translateY(-10px)';
      requestAnimationFrame(() => {
        setTimeout(() => { targetPanel.style.opacity = '1'; targetPanel.style.transform = 'translateY(0)'; }, 20);
      });
    }, 250);
  }
}

// 7. CONTACT FORM REAL EMAIL DELIVERY & BUTTON STATE RESET FIX
function handleInquirySubmit(e) {
  e.preventDefault();

  const form = document.getElementById('inquiry-form');
  const nameInput = document.getElementById('inquiry-name');
  const emailInput = document.getElementById('inquiry-email');
  const classificationInput = document.getElementById('inquiry-classification');
  const messageInput = document.getElementById('inquiry-message');

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const classification = classificationInput.value;
  const message = messageInput.value.trim();

  if (!name || !email || !message) return;

  const submitBtn = document.getElementById('inquiry-submit-btn');
  const btnText = document.getElementById('btn-text');
  const btnIconWrapper = document.getElementById('btn-icon-wrapper');
  const planeIcon = document.getElementById('btn-plane-icon');
  const arrowIcon = document.getElementById('btn-arrow');
  const banner = document.getElementById('inquiry-feedback-banner');
  const feedbackTitle = document.getElementById('feedback-title');
  const feedbackDesc = document.getElementById('feedback-desc');
  const feedbackIconBox = document.getElementById('feedback-icon-box');
  const fallbackActions = document.getElementById('feedback-fallback-actions');
  const gmailLink = document.getElementById('feedback-gmail-link');

  // 1. Sending Animation State (Dark style, no white flash)
  submitBtn.disabled = true;
  submitBtn.className = "w-full sm:w-auto px-8 py-3.5 rounded-full bg-neutral-800 text-emerald-400 font-semibold text-[13px] transition-all flex items-center justify-center gap-2 shadow-lg cursor-not-allowed font-headline";
  if (planeIcon) planeIcon.classList.add('animate-plane-fly');
  if (arrowIcon) arrowIcon.classList.add('hidden');
  btnText.innerText = 'Sending...';

  const payload = { name, email, classification, message };

  // 2. Fetch POST to Google Apps Script
  fetch(SCRIPT_URL, {
    method: 'POST', 
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(() => {
    setTimeout(() => {
      // Show Success state on button
      submitBtn.className = "w-full sm:w-auto px-8 py-3.5 rounded-full bg-emerald-600 text-white font-semibold text-[13px] transition-all flex items-center justify-center gap-2 shadow-lg font-headline";
      btnIconWrapper.innerHTML = `<span class="material-symbols-outlined text-[16px]">check_circle</span>`;
      btnText.innerText = 'Pesan Terkirim';

      // Open Success Banner
      banner.classList.remove('bg-amber-950/30', 'border-amber-500/30', 'is-closing');
      banner.classList.add('bg-emerald-950/30', 'border-emerald-500/30', 'is-open');
      feedbackIconBox.className = "w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400 mt-0.5";
      feedbackIconBox.innerHTML = `<span class="material-symbols-outlined text-[18px]">check_circle</span>`;
      feedbackTitle.innerText = "Pesan Berhasil Terkirim!";
      feedbackDesc.innerHTML = `Terima kasih, <strong>${name}</strong>. Pesan Anda telah dikirimkan langsung ke <strong>dkiplikurniawan@gmail.com</strong>.`;
      fallbackActions.classList.add('hidden');

      // Reset form fields
      form.reset();

      // Automatically reset button back to default state after 3.5 seconds
      setTimeout(() => {
        resetSubmitButton();
      }, 3500);

    }, 700);
  })
  .catch(() => {
    // Fallback if backend failed
    setTimeout(() => {
      submitBtn.className = "w-full sm:w-auto px-8 py-3.5 rounded-full bg-amber-600 text-white font-semibold text-[13px] transition-all flex items-center justify-center gap-2 shadow-lg font-headline";
      btnIconWrapper.innerHTML = `<span class="material-symbols-outlined text-[16px]">warning</span>`;
      btnText.innerText = 'Opening Gmail...';

      const gmailComposeUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent('dkiplikurniawan@gmail.com')}&su=${encodeURIComponent(`[Inquiry - ${classification}] from ${name}`)}&body=${encodeURIComponent(`Full Name: ${name}\nEmail: ${email}\nClassification: ${classification}\n\nMessage:\n${message}`)}`;
      gmailLink.href = gmailComposeUrl;

      banner.classList.remove('bg-emerald-950/30', 'border-emerald-500/30', 'is-closing');
      banner.classList.add('bg-amber-950/30', 'border-amber-500/30', 'is-open');
      feedbackIconBox.className = "w-8 h-8 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400 mt-0.5";
      feedbackIconBox.innerHTML = `<span class="material-symbols-outlined text-[18px]">open_in_new</span>`;
      feedbackTitle.innerText = "Gagal Mengirim Langsung — Opsi Cadangan";
      feedbackDesc.innerText = "Server pengirim belum dikonfigurasi. Silakan klik tombol di bawah untuk membuka draf langsung di Web Gmail Anda.";
      fallbackActions.classList.remove('hidden');

      window.open(gmailComposeUrl, '_blank');
      
      setTimeout(() => {
        resetSubmitButton();
      }, 4000);
    }, 700);
  });
}

// Reset button back to initial clean state
function resetSubmitButton() {
  const submitBtn = document.getElementById('inquiry-submit-btn');
  const btnText = document.getElementById('btn-text');
  const btnIconWrapper = document.getElementById('btn-icon-wrapper');
  const arrowIcon = document.getElementById('btn-arrow');

  if (submitBtn) {
    submitBtn.className = "w-full sm:w-auto px-8 py-3.5 rounded-full bg-white text-neutral-950 font-semibold text-[13px] hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 shadow-lg active:scale-95 font-headline disabled:opacity-80 disabled:cursor-not-allowed cursor-pointer focus-visible:ring-2";
    submitBtn.disabled = false;
  }
  if (btnIconWrapper) {
    btnIconWrapper.innerHTML = `<span class="material-symbols-outlined text-[16px] transition-transform duration-300" id="btn-plane-icon">send</span>`;
  }
  if (btnText) btnText.innerText = 'Send Message';
  if (arrowIcon) {
    arrowIcon.classList.remove('hidden');
    arrowIcon.innerText = '↗';
  }
}

// Dismiss Banner
function dismissFeedbackBanner() {
  const banner = document.getElementById('inquiry-feedback-banner');
  if (banner) {
    banner.classList.add('is-closing');
    setTimeout(() => { 
      banner.classList.remove('is-open', 'is-closing'); 
    }, 400);
  }
}