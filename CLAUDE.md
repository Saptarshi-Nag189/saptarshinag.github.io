# saptarshinag.github.io — project memory

Personal portfolio for **Saptarshi Nag**, AI/ML engineer (Chennai, India). Static site,
zero build step, deployed via GitHub Pages from `master`. Repo: `Saptarshi-Nag189/saptarshinag.github.io`.
Live at https://saptarshi-nag189.github.io/saptarshinag.github.io/

Contact: saptarshinag18@gmail.com · LinkedIn `/in/saptarshi18` · GitHub `Saptarshi-Nag189`.
**Phone number is deliberately NOT published on the site.** Don't add it to any page without the user asking. (The current CV PDF doesn't carry one either.)

## Site map

- **`index.html`** (root) — classic terminal/brutalist homepage: hero, metrics strip,
  experience timeline, projects, publications, education, skills, a "~/play" section linking
  the four playable versions (`/wander/`, `/signal/`, `/light/`, `/demos/`), and contact.
- **`/demos/`** — archive of 14 earlier "choose your experience" concepts (Terminal OS, Mission
  Control, Neural Graph, Signal Decode, Night Drive, Movie Premiere, 2D World, The Constellation,
  Liquid, Night Train, Abyss, Library, Elysium, Classic). `demos/index.html` is the chooser, with
  featured cards for `/wander/`, `/signal/` and `/light/` at the top. **Kept as archive, not deleted.**
- **`demos/_shared/sfx.js`** — shared synthesized Web Audio engine (zero audio files, all synth
  oscillators/noise). Used by demos, `/signal/`, and `/wander/`. Has ambient/projector/engine/
  chiptune/rain/clack/brook/wind/crickets/hum loops plus many named one-shots. Auto mute button,
  gesture-unlock. To add a new sound: add a named entry to the `lib` object or a new loop pair
  (`startX`/`stopX`) here — every surface can then call `SFX.play('name')`.
- **`demos/_shared/a11y.js`** — `A11Y.dialog()` turns a demo's panel into a modal dialog (focus
  in, Tab trapped, focus back on close) and `A11Y.chapters()` adds a keyboard list of chapter
  buttons, hidden until tabbed into. Any new demo with a canvas-only way in should use both.
- **`/signal/`** — **THE SIGNAL — a playable biography**. 8-act sequencer (`acts.js`), zero
  modals; each act simulates real work (epoch-folding pulsar detection, GMRT parallel
  scheduling, C-DAC intrusion detection, F1 PINN pit call, RAG oracle). Secondary flagship,
  explicitly kept per user request alongside THE WANDER.
- **`/wander/`** — **THE WANDER**, the current primary flagship. A 3D dreamlike exploration
  game/portfolio. See below. If WebGL is missing, `fallback.js` renders the same DOMAINS as a
  plain page.
- **`/light/`** — **THE LONG LIGHT**, experimental. A streaming procedural island (vendored
  Babylon.js 9.26 + glTF2 loader) with seven biomes, a day cycle, a rideable boat, a rigged
  traveller dressed in the shader (`rigged.js` › `garment()`, cut from the bind pose), a fairy
  companion and chat (`companion.js`, facts in `twin.js`), and touch controls. `ledger.js` is
  the plain-text version and the no-WebGL fallback; it opens on its own when WebGL is missing.
  Build notes and lessons are in `light/README.md`. Tests: `light/verify.mjs`,
  `verify-stream.mjs` (determinism + memory), `verify-twin.mjs` (corpus facts),
  `verify-input.mjs` (thumbstick maths).

## THE WANDER — architecture

Zero-build, vendored **Three.js r162** at `wander/lib/three.module.js` (MIT license, no CDN —
CDNs don't load in the build sandbox, so this had to be vendored to be testable at all).

- **`game.js`** — engine core: renderer, a Catmull-Rom spline path through 8 biomes (glade,
  forest, river, desert, snow, sky, city, meadow), the cloaked-wanderer character (cape/boat/
  wings depending on biome), the fairy companion, 3rd/1st-person camera rig, run/walk toggle
  (Shift key + button), path-side "juice" (birds that scatter, chime-flowers, snow poffs —
  reactive touches along quiet stretches), per-biome culling + frozen static matrices for perf,
  ambience integration.
- **`domains.js`** — door/portal system (soft bloom transition in/out), station content plates,
  **6 runnable "machine" consoles**: GMRT waterwheel, NCRA pulsar folding (real epoch-folding
  math), F1 tyre lab, Omniscience RAG console, ARO agent graph, WiFi-Guard C-DAC intrusion sim.
  Twin chat drawer with a `window.TwinBrain` interface (local corpus matcher today; the socket
  is ready for a future WebLLM/Llama upgrade — swap the implementation, keep the interface).
  Rest/goodnight sequence in the cabin (bed → rain → fade → end-card → restart). Arrival-moment
  announcements (camera drift + fairy line on first sight of each door), journey-tracker dots,
  doors turn gold once visited.
- **`dungeons.js`** — **seven distinct dungeon interiors** (major rework after user feedback that
  they all looked the same): forest = *The Root Archive* (root-cathedral under a colossal tree),
  river = *The Sunken Observatory* (glass dome under the river), desert = *The Mirage Bazaar*
  (night souk), snow = *The Frozen Library* (glacier ice-stacks + aurora), sky = *The Star Loom*
  (open night, stones that light underfoot, self-drawing constellations), city = *The Foundry
  Floor* (neon industrial catwalk), meadow = the cozy night cabin ending.
- **`twin-data.js`** — **the single file to edit** to update the digital twin or any résumé fact:
  `FAIRY` (companion dialogue), `CORPUS` (chat Q&A intent-matched pairs), `DOMAINS` (station/
  subsection content per dungeon, including the machine-console blurbs).
- **`ambience.js`** — plays real recordings from `wander/audio/<biome>.ogg|mp3` if present,
  falls back to synth automatically. `wander/audio/README.md` lists the needed filenames + free
  CC0 sources (Pixabay etc.). **User has not yet dropped in real recordings — still pending.**
  This is the last open gap between the visual and audio quality of the experience.
- **`index.html`** — shell: veil/start screen (controls taught up front), HUD (journey dots,
  memory-spark counter, POV toggle, run/walk toggle, photo-mode button, floating chat button),
  mobile bottom-sheet plate, night/end-card overlays (the end card carries the spark
  constellation) for the goodnight ending.
- **Photo mode** (P key / camera button): HUD melts, slow orbit around the wanderer, name
  watermark — built for shareable screenshots. **Memory sparks**: seven hidden collectibles,
  one per chapter, drawn as a constellation on the end card.
- **`brain/llm-brain.js` + `lib/transformers.min.js` (vendored, 548 KB)** — the twin's optional
  "full brain": SmolLM2-360M-Instruct (q4, ~300 MB) loaded in the visitor's browser on the
  chat's "✨ full brain" button (WebGPU→WASM fallback). RAG-grounded: the corpus matcher
  retrieves facts, the model only phrases them. LocalBrain remains default + fallback for every
  failure. The happy path is untestable in the sandbox (CDN-blocked weights) — only the user
  can judge generation quality live. Model swap = one MODEL_ID constant.

## Résumé facts (source of truth: the linked CV PDF, `saptarshi_resume_linkedin_2026.pdf`)

**The site says only what the CV says.** The user decided this in October 2026, after an audit
found the site claiming things the CV doesn't: <1 ms per window, SHAP, SQL pipelines and
dashboards, edge deployment, Omniscience's citation-weighted ranking, path-traversal protection
and rate limiting, and ARO's SQLite memory. All of those were removed, and must not come back
unless the CV gains them. Read the CV with `pdftotext -layout` when in doubt.

Every metric on the site must **name its source project**. This was an explicit user
requirement; don't regress to bare numbers.

- **C-DAC** (Chennai): Project Engineer, AI Research & IoT Security, **July 2025–present**.
  - Real-time Zero Trust framework for IoT (WiFi 802.11, BLE, Zigbee, LoRa), with ML attack
    detection feeding a 7-pillar device trust score.
  - Two-stage detection: a window model (1 s windows of 802.11 management frames, 7 attack
    classes) and a flow model. RF, XGBoost, SVM, MLP and a Voting Ensemble were compared, with
    SMOTE and Optuna.
  - **96.97% accuracy on flow classification (RF)**, and **90.86% accuracy / 86.78% macro F1 on
    window classification (Voting Ensemble)**. The user confirmed the CV's 96.97 is correct. An
    earlier note in this file said 97.93 was correct and 96.97 a stale draft; that was wrong, and
    97.93 is gone from the site.
  - 63 features from raw PCAPs (Scapy/PyShark), and a Watchdog drop-folder pipeline with MD5
    dedup.
  - SPIFFE/SPIRE, mTLS, OTP 2FA.
  - Two papers at IoTaIS 2025, Bali: "Protocol-Aware Continuous Monitoring and Anomaly Detection
    in IoT Networks" and "A Comprehensive Survey on Zero Trust Architecture in IoT Networks".
- **M.Tech, Computer Science & Engineering (Artificial Intelligence), DIAT (DRDO), Pune**: CGPA
  8.64/10.0, 2023–2025. DIAT is a DRDO institute; don't list DRDO as an employer.
- **B.Tech CSE, Academy of Technology, Kolkata**: CGPA 9.44/10.0, 2019–2023. GATE 2024 rank 1790,
  Data Science & AI, top 5% of applicants.
- **NCRA-TIFR** (Pune), Research Intern (M.Tech project), Aug 2024–Apr 2025: ResNet1D +
  Squeeze-and-Excitation pulsar detector, **99.8% F1** over **70M+ samples**, adaptive thresholding.
- **GMRT** (NCRA-TIFR, Pune), Winter Intern, HPC & Signal Processing Optimisation, Dec 2023–Jan
  2024: multicore refactor of the CPU filtering pipelines, **50% latency cut**.
- **Projects**:
  - **F1 tyre degradation**: LSTM-XGBoost, 10 Hz telemetry, physics-informed loss splitting
    thermal/mechanical wear, CUDA/CuPy kernels cutting training time **4.1×**.
  - **Omniscience Pro**: local privacy-first RAG on LangChain/ChromaDB, multi-modal ingestion,
    <50 ms HNSW search, <500 ms first token on consumer hardware, GPU-aware Docker with CI/CD,
    POSIX file locking.
  - **ARO**: multi-agent LLM workflows as NetworkX directed graphs, Flask + SSE + React, an
    adversarial audit fixing 16 vulnerabilities across auth, SSRF, input validation and CORS,
    SQLAlchemy-backed audit trails.
  - **Llama 3.2**: 1B/3B fine-tuned on 21.5k interactions, 4-bit with Unsloth.
- **Skills**, as the CV lists them:
  - Python (advanced), C++ (proficient), C, Bash, SQL
  - PyTorch, XGBoost, scikit-learn, PINNs, NumPy, SciPy
  - CUDA, CuPy, parallel processing, 4/8-bit quantisation, latency optimisation, Linux
  - anomaly detection, time series, CI/CD, Docker, Git, Flask, ChromaDB
  - RAG, LLM fine-tuning, multi-agent orchestration (NetworkX, LangChain), SQLAlchemy

  No TensorFlow, Keras, Streamlit or Ollama.

## Working conventions established for this repo

- Branch per change: `claude/<slug>` off `master`. Never push straight to master.
- Verify headless before opening a PR: `python3 -m http.server <port>` + Playwright + Chromium
  with `--enable-unsafe-swiftshader` (software WebGL works fine in this sandbox — real GPUs are
  strictly faster). Screenshot key states, check zero console errors, then commit/push/PR via
  the GitHub MCP tools. Subscribe to PR activity; don't reopen a merged PR.
- **CDNs don't load in the build sandbox** (fonts, Font Awesome, three.js-from-CDN etc. fail) —
  any new dependency must be vendored into the repo to be testable, or accepted as
  untestable-locally (e.g. the old Constellation demo).
- **`pkill -f "http.server"` kills the agent's own shell** in this sandbox — always kill test
  servers by their stored PID, never by pattern match.
- `.nojekyll` is required at repo root so Jekyll doesn't strip underscore-prefixed directories
  like `demos/_shared/`.
- Performance pattern for the 3D scenes (apply if adding new geometry): pool/share lights
  (roam one light instead of N per-object point lights — every light multiplies shader cost per
  lit fragment), cull whole object groups once outside the relevant fog/visibility window,
  freeze static objects' matrices (`matrixAutoUpdate=false`), gate expensive per-frame animation
  to proximity, hoist per-frame `Vector3`/allocations out of the render loop. **Perf changes must
  be visually invisible** — the user explicitly wants speed without any quality/experience loss.
- The user play-tests hands-on and returns specific, itemized feedback (numbered bug lists with
  screenshots) — treat these as ground truth and verify each fix headlessly before shipping.
  Prefers being asked via `AskUserQuestion` only on genuine ambiguity; otherwise wants execution
  through to a shippable PR without excessive mid-task check-ins.
- Earlier in the project the user explicitly rejected a first-draft "too simple" AI-portfolio
  concept before landing on THE WANDER as the true flagship — don't revert to safer/simpler
  concepts without being asked; this user wants ambitious, bespoke builds.

## Writing conventions (October 2026 overhaul)

- Site copy follows the humanizer skill (github.com/blader/humanizer). It bans:
  - em dashes in prose
  - not-X-but-Y contrasts, one-line closers and rows of fragments
  - aphorisms and forced triads
  - Title Case headings

  En dashes stay in numeric and date ranges. Playful voices (the fairies, Signal's operator) keep
  their warmth and lose the staging.
- Design follows the web-applicable parts of the apple-design skill (github.com/dickwu/apple-design-skill):
  - small text at 4.5:1 contrast or better, computed rather than guessed
  - nothing under about 11 to 12 px
  - icons aria-hidden, and controls labelled
  - reduced motion honoured
- Simulated numbers inside the playable machines are labelled "simulated", so they don't read as
  measured results.
- Both skills were installed per session (`~/.claude/skills/`), not committed: Pages publishes every
  file, and apple-design carries 123 pages of Apple's HIG text.
- **Information architecture:**
  - The root homepage is the front door. Its "~/play" section links The Wander, The Signal,
    The Long Light (experimental) and the archive.
  - The flagships' exit links go to the homepage.
  - `/demos/` is "the archive", with a link home.
- The `browser-os-experiment` branch stays unmerged. It's from April to June 2026 and 80 commits
  behind master, it rewrites the landing page, and its facts are stale. At most, salvage its
  window manager as a new demo.

## Open items

- `wander/audio/*.ogg` real recordings — user hasn't dropped these in yet (synth fallback is
  active). This is the one remaining gap between the visual and audio polish of the experience.
- The in-browser LLM twin is BUILT (see brain/llm-brain.js above). Until October 2026 its button
  could never load it: the import path resolved to /brain/. Pending: the user's live quality check
  of SmolLM2-360M, and possibly swapping in a self-fine-tuned model later.
- To add Wander audio, drop the files in and list each one in `RECORDINGS` at the top of
  `wander/ambience.js`. The manifest stops the page from probing for files that aren't there.
- The CV PDF's own profile says "M.Tech in Artificial Intelligence"; the site uses the CV's
  education wording, "M.Tech in CSE (Artificial Intelligence)". Updating the PDF needs the
  user's LaTeX source.
- `img/sapta_image.jpeg` (691 KB) isn't referenced anywhere. Ask before deleting it.
