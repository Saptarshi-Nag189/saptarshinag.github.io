# saptarshinag.github.io — project memory

Personal portfolio for **Saptarshi Nag**, AI/ML engineer (Chennai, India). Static site,
zero build step, deployed via GitHub Pages from `master`. Repo: `Saptarshi-Nag189/saptarshinag.github.io`.
Live at https://saptarshi-nag189.github.io/saptarshinag.github.io/

Contact: saptarshinag18@gmail.com · LinkedIn `/in/saptarshi18` · GitHub `Saptarshi-Nag189`.
**Phone number is deliberately NOT published on the site** (it's on the downloadable CV PDF only) — don't add it to any page without the user asking.

## Site map

- **`index.html`** (root) — classic terminal/brutalist homepage: hero, metrics strip,
  experience timeline, projects, publications, skills, contact. Links to `/wander/` and `/signal/`.
- **`/demos/`** — archive of 14 earlier "choose your experience" concepts (Terminal OS, Mission
  Control, Neural Graph, Signal Decode, Night Drive, Movie Premiere, 2D World, The Constellation,
  Liquid, Night Train, Abyss, Library, Elysium, Classic). `demos/index.html` is the chooser, with
  featured cards for `/wander/` and `/signal/` at the top. **Kept as archive, not deleted.**
- **`demos/_shared/sfx.js`** — shared synthesized Web Audio engine (zero audio files, all synth
  oscillators/noise). Used by demos, `/signal/`, and `/wander/`. Has ambient/projector/engine/
  chiptune/rain/clack/brook/wind/crickets/hum loops plus many named one-shots. Auto mute button,
  gesture-unlock. To add a new sound: add a named entry to the `lib` object or a new loop pair
  (`startX`/`stopX`) here — every surface can then call `SFX.play('name')`.
- **`/signal/`** — **THE SIGNAL — a playable biography**. 8-act sequencer (`acts.js`), zero
  modals; each act simulates real work (epoch-folding pulsar detection, GMRT parallel
  scheduling, C-DAC intrusion detection, F1 PINN pit call, RAG oracle). Secondary flagship,
  explicitly kept per user request alongside THE WANDER.
- **`/wander/`** — **THE WANDER**, the current primary flagship. A 3D dreamlike exploration
  game/portfolio. See below.

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
- **`index.html`** — shell: veil/start screen (controls taught up front), HUD (journey dots, POV
  toggle, run/walk toggle, floating chat button for touch devices), mobile bottom-sheet plate,
  night/end-card overlays for the goodnight ending.

## Résumé facts (source of truth: user's LaTeX CV)

Every metric on the site must **name its source project** — this was an explicit user
requirement, don't regress to bare numbers.

- **C-DAC** (Chennai) — Project Engineer, AI Research & IoT Security, **July 2025–present**.
  Real-time Zero-Trust framework for IoT (WiFi/BLE/Zigbee/LoRa). Two-stage detection (window +
  flow model). **<1 ms inference/window** (optimized XGBoost/MLP, edge-deployable). **97.93%
  accuracy** on high-throughput traffic (this is the correct number — NOT 96.97, which was an
  earlier draft figure corrected across the whole site in this engagement). SHAP explainability.
  SQL pipelines + live dashboards. 63 features from raw PCAPs (Scapy/PyShark). SPIFFE/SPIRE,
  mTLS, OTP 2FA. Co-authored 2 papers at IoTaIS 2025, Bali.
- **M.Tech CSE (AI), DIAT (DRDO), Pune** — CGPA 8.64/10.0, 2023–2025.
- **B.Tech CSE, Academy of Technology, Kolkata** — CGPA 9.44/10.0, 2019–2023. GATE 2024 rank
  1790, Data Science & AI, top 5%.
- **NCRA-TIFR** (Pune) intern, Aug 2024–Apr 2025 — ResNet1D + SE-attention pulsar detector,
  **99.8% F1** over **70M+ samples**.
- **GMRT** (NCRA-TIFR, Pune) winter intern, Dec 2023–Jan 2024 — multicore refactor of the CPU
  filtering pipeline, **50% latency cut**.
- **Featured projects**: Omniscience Pro (privacy-first local RAG — LangChain/ChromaDB/Docker,
  <50 ms HNSW vector search, <500 ms first token, citation-weighted ranking across local/web/
  academic sources, hardened with path-traversal protection/rate limiting/POSIX file locking);
  ARO/Autonomous Research Operator (multi-agent LLM workflows via NetworkX directed graphs,
  Flask+SSE+React, SQLAlchemy/SQLite persistent memory, self-audited 16 vulnerabilities fixed);
  Llama 3.2 optimization (1B/3B fine-tuned on 21.5k interactions, 4-bit via Unsloth); F1
  GPU-accelerated tyre-degradation prediction (physics-informed loss splitting thermal/
  mechanical wear, LSTM-XGBoost, custom CUDA/CuPy kernels, **4.1× speedup**, 10 Hz telemetry).
- **Skills**: Python (advanced), C++ (proficient), SQL, Bash, Git, Docker, Linux, Flask,
  Streamlit; PyTorch, TensorFlow, Keras, XGBoost, Scikit-learn, PINNs; LangChain, ChromaDB,
  Ollama, Llama 3.2, Unsloth, Hugging Face, RAG; CUDA, 4/8-bit quantization, HPC.

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

## Open items

- `wander/audio/*.ogg` real recordings — user hasn't dropped these in yet (synth fallback is
  active). This is the one remaining gap between the visual and audio polish of the experience.
- Possible future direction (not committed): swap `window.TwinBrain`'s `LocalBrain` for a
  WebLLM-backed brain running an in-browser Llama — the interface is already there for it.
