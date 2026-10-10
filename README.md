# Portfolio — Dul Kipli Kurniawan

Personal portfolio published with GitHub Pages at <https://dkiplikurniawan.github.io/portfolio/>.

## Structure

| Path | What it is |
|---|---|
| `index.html` | Home page (hero, about, featured DEAFSAPP, projects, experience, skills, contact) |
| `deafsapp.html` | DEAFSAPP case study with evidence-tagged architecture and evaluation audit |
| `projects/retail-demand-forecasting/` | Data science project: code, notebook, README, generated results page |
| `style.css` | Design tokens and the few styles Tailwind utilities don't cover |
| `script.js` | Mobile menu, one-time reveal animation, contact form |
| `assets/case-study.css` | Shared plain-CSS styles for case-study pages |
| `assets/` | CV, certificates, images, favicon, social-sharing image |
| `404.html`, `sitemap.xml` | Not-found page and sitemap |

No build step: the home page uses the Tailwind Play CDN, case-study pages use plain CSS.

## Preview locally

```bash
python -m http.server 8000
# open http://localhost:8000/
```

Open via a local server rather than double-clicking the file so relative links behave as on GitHub Pages.

## Publish

GitHub Pages serves the `main` branch root. Commit and push:

```bash
git add -A
git commit -m "Portfolio overhaul"
git push origin main
```

## Motion system

Layout and scroll feel are modelled on editorial sites such as Lenval Properties, using the same open-source stack, loaded from jsDelivr with pinned versions:

- **GSAP 3.15.0** with **ScrollTrigger** and **SplitText**: reveals, scroll-scrubbed effects, 3D phones.
- **Lenis 1.3.21**: smooth scrolling.

| Effect | Markup hook | Function in `script.js` |
|---|---|---|
| Intro: lens + name traced in outline, then filled (Ownitt-inspired), once per session, Skip button / Esc | `.curtain` | `initIntro()` |
| Hero entrance: "Hello." by character, photo clip reveal | `[data-hero]` | `initIntro()` |
| Heading line reveal | `data-split-lines` | `initTextReveals()` |
| Words brighten while scrolling | `data-scrub-words` | `initTextReveals()` |
| About photo opens to full bleed with parallax (NY Phil-inspired split) | `data-about-photo` | `initAboutPhoto()` |
| Number reels roll from 0 to the value | `.odo[data-count]` | `initOdometers()` |
| Fade-up blocks (staggered, once) | `data-fade` | `initTextReveals()` |
| DEAFSAPP stages + field-photo stack that wipes up as you read (Bright Avenue-inspired light layout); carousel on phones | `#pipeline .stage[data-stage]`, `[data-gallery] .g-slide` | `initPipeline()` |
| VOLDO 3D phones fan out, pointer tilt | `data-phones` | `initPhones()` |
| Image preview following the cursor on work rows | `.work-row[data-preview]` | `initWorkPreview()` |
| Magnetic primary buttons (max 6 px) | `data-magnetic` | `initMagnetic()` |
| Skills tabs (original design, ARIA tabs) | `[data-tabs]` | `initTabs()` |

Fallbacks:

- **No JavaScript:** everything is visible as static HTML, including all four skill panels.
- **CDN unreachable:** the page renders statically and the pipeline still works.
- **`script.js` fails:** a failsafe shows all content after 2.5 s.
- **`prefers-reduced-motion`:** no curtain, no smooth scroll, no tweens.

## Content rules

- Every metric on the site must have a source. DEAFSAPP thesis results are labelled "reported" because the evaluation data is not public.
- Project status labels: Completed, In progress, Research prototype, Conceptual case study.
- Portrait: `assets/profile-480.webp` / `profile-800.webp` (from `PROFILE 4X6.jpeg`), header avatar `assets/avatar-72.webp`.
- DEAFSAPP field photos: `assets/deafsapp-field-{1..5}-{640,1100}.webp` (from `kegiatan 1–5.jpeg`).
- CV link points to `assets/CV_DUL KIPLI KURNIAWAN.pdf` (the latest CV).

## Contact form

Messages are delivered by [FormSubmit](https://formsubmit.co) to `dkiplikurniawan@gmail.com` (endpoint `FORM_ENDPOINT` in `script.js`). The service answers with JSON, so the page shows **Message sent** only when delivery is confirmed; otherwise the visitor gets an error with a ready-made email link and keeps their text.

**One-time activation (required):**

1. Publish the site, open it, and send yourself a test message through the form.
2. FormSubmit emails **"Activate Form"** to dkiplikurniawan@gmail.com (check Spam/Promotions too). Click the button in that email once.
3. Send another test message; it should now arrive in your inbox, with the visitor's address as Reply-To.

Until activation is done, the form shows "The contact form is being set up" with the email fallback.

Optional: after activation FormSubmit shows a random alias for your address; replace the email in `FORM_ENDPOINT` with it to keep the address out of the page source.

The send button animates: the paper plane flies off, the button becomes a spinner, then a check mark; a success panel replaces the form, with **Send another message** to reset.
