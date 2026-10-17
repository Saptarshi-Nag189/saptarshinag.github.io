/* ==========================================================================
   twin-data.js: everything editable about the Saptarshi twin and the domains.
   To update the twin, edit this file only. Three exports:
     FAIRY   scripted companion lines (biome intros, events, idle)
     CORPUS  Q&A intents for the chat drawer (patterns match whole words, see domains.js)
     DOMAINS station content for every dungeon

   Facts come from the linked CV (saptarshi_resume_linkedin_2026.pdf) and
   nothing else, and every number names the project it came from.
   ========================================================================== */

export const FAIRY = {
  wake: "Oh! You're here. I'm Saptarshi's twin, and I'll wander with you. ◀ ▶ walk, ▲ hops or goes through a door, Esc steps back out of any domain, and T opens a chat with me. The road only goes one way, so you can't get lost.",
  rest: "Shhh… lie down. That was a long walk. I'll be right here on the table. Listen, it's raining.",
  idle: [
    "The path keeps going ▶ and there's no map to read.",
    "If you're curious about him, tap me and ask.",
    "Each glowing door opens onto a part of his work."
  ],
  biomes: {
    glade:  "This is the start. Walk on ▶",
    forest: "The Grove of Foundations holds his degrees. That glowing arch leads inside.",
    river:  "Hear the water? Hop in the boat. His two research internships are down this river.",
    desert: "The Oasis of Craft. His skills are in here, laid out as constellations. The doors shimmer near the water.",
    snow:   "Hush now. The Quiet Archive keeps his two papers. Snow keeps paper safe, you know.",
    sky:    "Hold on, this is my favourite part. Spread the cape, we fly from here. ✧",
    city:   "The Atelier! His projects are in there, and you can actually run them.",
    meadow: "Journey's End. Send a lantern up and you'll find how to reach him."
  },
  doorEnter: "In we go, softly…",
  doorExit: "Back to the open air ✧",
  demoDone: [
    "You did that just like he does. Almost.",
    "His work makes more sense once your hands have done it.",
    "I'm keeping a note that you were good at this."
  ],
  chatGreeting: "Hi! Ask me about Saptarshi: his work, his projects, where he studied. I know all of it."
};

export const CORPUS = [
  { p: ["who are you","what are you","your name"], a: "I'm Saptarshi's digital twin. Right now I'm a small matcher that picks from answers written about him, and I run entirely in this page, with no server. Press ✨ full brain and a small language model loads in your browser to phrase the same answers." },
  { p: ["who is saptarshi","about him","who is he","introduce"], a: "Saptarshi Nag is an AI/ML engineer. He has an M.Tech in Computer Science and Engineering (Artificial Intelligence) from DIAT, a DRDO institute, did research at NCRA-TIFR and GMRT, and is now a Project Engineer at C-DAC Chennai, building ML-based attack detection for a Zero Trust IoT framework." },
  { p: ["education","study","studied","college","degree","btech","b.tech","mtech","m.tech","gate"], a: "B.Tech in Computer Science and Engineering from Academy of Technology, Kolkata (CGPA 9.44, 2019–2023), then an M.Tech in CSE (Artificial Intelligence) at DIAT, Pune (CGPA 8.64, 2023–2025). He qualified GATE 2024 with rank 1790 in Data Science & AI, in the top 5% of applicants. The Grove of Foundations in the forest holds all of it." },
  { p: ["current","c-dac","cdac","job","work now","zero trust","iot","security"], a: "Since July 2025 he's been a Project Engineer, AI Research & IoT Security, at C-DAC Chennai. He built a real-time Zero Trust framework for IoT networks covering WiFi, BLE, Zigbee and LoRa, where ML attack detection feeds a 7-pillar device trust score. The detection has two stages, a window model and a flow model. The flow model (RF) reached 96.97% accuracy, and the window model (Voting Ensemble) 90.86% accuracy with 86.78% macro F1. He engineered 63 features from raw PCAPs and added SPIFFE/SPIRE, mTLS and OTP 2FA. You can stop an attack yourself at the WiFi-Guard post in the Atelier." },
  { p: ["pulsar","ncra","astronomy","telescope","gmrt","research"], a: "Two internships. At GMRT (Dec 2023 to Jan 2024) he refactored the telescope's CPU filtering pipeline for multicore and cut its latency by 50%. At NCRA-TIFR (Aug 2024 to Apr 2025, his M.Tech project) he built a ResNet1D with Squeeze-and-Excitation attention that detects weak pulsars at 99.8% F1 across 70M+ samples. Both are on the Listening River, and the boat will take you." },
  { p: ["f1","tyre","tire","formula"], a: "His F1 project predicts tyre degradation and pit-stop windows with a hybrid LSTM-XGBoost model on 10 Hz telemetry. A physics-informed loss separates thermal from mechanical wear, and custom CUDA/CuPy kernels cut training time by 4.1×. Try beating his model at the pit wall in the Atelier!" },
  { p: ["omniscience","rag","retrieval"], a: "Omniscience Pro is his privacy-first local RAG system. It ingests several kinds of documents, searches its vector index in under 50 ms (HNSW), and returns the first token in under 500 ms on consumer hardware. It runs in a GPU-aware Docker container with a full CI/CD pipeline and uses POSIX file locking so concurrent sessions stay safe." },
  { p: ["aro","agent","agents","multi-agent"], a: "ARO, the Autonomous Research Operator, runs multi-agent LLM workflows as directed graphs in NetworkX. A Flask backend streams progress to a React frontend over Server-Sent Events. After building it he audited it adversarially and fixed 16 vulnerabilities across auth, SSRF, input validation and CORS, and he added SQLAlchemy-backed audit trails." },
  { p: ["llama","fine-tune","fine-tuning","finetune","quantisation","quantization","quantise","quantize"], a: "He fine-tuned Llama 3.2 1B and 3B on 21.5k domain-specific interactions, then quantised them to 4-bit with Unsloth. That brought memory down far enough for a consumer GPU, with no meaningful drop in output quality." },
  { p: ["skill","skills","stack","tools","language","languages"], a: "Python (advanced) and C++ (proficient), plus C, Bash and SQL. For ML: PyTorch, XGBoost, scikit-learn and PINNs. For speed: CUDA, CuPy and 4/8-bit quantisation. For shipping: Docker, Git, Flask, ChromaDB and CI/CD. On the AI side, RAG, LLM fine-tuning and multi-agent orchestration with NetworkX and LangChain. The desert oasis shows them as constellations." },
  { p: ["paper","papers","publication","publications","iotais"], a: "Two papers at IoTaIS 2025 in Bali, both on the C-DAC framework: 'Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks' and 'A Comprehensive Survey on Zero Trust Architecture in IoT Networks'. They're in the snow archive." },
  { p: ["contact","email","hire","reach","linkedin","github","cv","resume"], a: "You can reach him at saptarshinag18@gmail.com, at /in/saptarshi18 on LinkedIn, or as Saptarshi-Nag189 on GitHub. His CV is at Journey's End, the last stop on the road." },
  { p: ["metric","metrics","number","numbers","figures","stat","stats","achievement","achievements","proud","proudest"], a: "The headline numbers, each with its project: 96.97% flow-attack accuracy (C-DAC's Zero Trust IoT framework, RF model), 99.8% F1 over 70M+ samples (the NCRA-TIFR pulsar ResNet1D), a 4.1× training speedup (CUDA kernels in the F1 tyre project), a 50% latency cut (the GMRT pipeline refactor), and search under 50 ms (Omniscience Pro)." },
  { p: ["hello","hi","hey","namaste"], a: "Hello, wanderer ✧ Ask me anything about him, or just keep walking ▶" },
  { p: ["thank","thanks"], a: "Any time." }
];
/* Score one intent against a question. Patterns match whole words only: plain
   substring matching sent "around" to ARO, "storage" to RAG and "navigate" to
   GATE. Several hits on one intent count for more than one long hit, so an
   opener like "tell me about" can't outvote the topic words after it. */
export function scoreIntent(q, patterns){
  let s=0, hits=0;
  for(const p of patterns){
    const esc=p.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    if(new RegExp('(^|[^a-z0-9])'+esc+'($|[^a-z0-9])').test(q)){ s+=p.length; hits++; }
  }
  return hits>1 ? s+(hits-1)*3 : s;
}

export const CORPUS_FALLBACK = "I don't have an answer for that one. Try asking about his education, his research, C-DAC, the F1 or RAG projects, his skills, the papers, or how to reach him.";

/* ---------- domain station content (subsections) ---------- */
export const DOMAINS = {
  forest: {
    name: "Grove of Foundations", sub: "education", door: "a ring of glowing birches",
    stations: [
      { k:"first roots · 2019–2023", t:"B.Tech, Computer Science & Engineering",
        b:"<p><b>Academy of Technology, Kolkata</b> · CGPA <b>9.44/10.0</b></p>" },
      { k:"the ascent · 2023–2025", t:"M.Tech, CSE (Artificial Intelligence)",
        b:"<p><b>Defence Institute of Advanced Technology (DIAT), DRDO, Pune</b> · CGPA <b>8.64/10.0</b></p>" },
      { k:"the exam · 2024", t:"GATE, Data Science & AI",
        b:"<p>Rank <b>1790</b> · in the <b>top 5%</b> of applicants.</p>" }
    ]
  },
  river: {
    name: "The Listening River", sub: "research years", door: "a moon-gate over the water",
    stations: [
      { k:"Dec 2023 – Jan 2024 · GMRT", t:"Speeding up a telescope",
        b:"<p><b>Winter Intern, HPC & Signal Processing Optimisation · GMRT, NCRA-TIFR · Pune</b></p><ul><li>Profiled the legacy <b>CPU signal-filtering pipelines</b> and refactored them for <b>multicore</b> execution.</li><li>Latency fell <b>50%</b>, enough to process the continuous telescope data stream in real time.</li></ul><p><i>The waterwheel console here lets you do the same rebalancing (simulated).</i></p>", demo:"gmrt" },
      { k:"Aug 2024 – Apr 2025 · NCRA-TIFR", t:"Finding faint pulsars",
        b:"<p><b>Research Intern (M.Tech project)</b></p><ul><li>A <b>ResNet1D with Squeeze-and-Excitation attention</b> to tell weak pulsar signals from interference at low SNR.</li><li><b>99.8% F1</b> across <b>70M+ samples</b>, with adaptive thresholds for noise floors that shifted between sessions.</li><li>He ran it alone, from scoping through deployment and the write-up.</li></ul><p><i>The folding pool beside this stone lets you find a pulsar yourself.</i></p>", demo:"pulsar" }
    ]
  },
  desert: {
    name: "Oasis of Craft", sub: "skills", door: "an archway of woven palm-light",
    stations: [
      { k:"spoken tongues", t:"Languages",
        b:"<div class='tags'><span class='tag'>Python (advanced)</span><span class='tag'>C++ (proficient)</span><span class='tag'>C</span><span class='tag'>Bash</span><span class='tag'>SQL</span></div>" },
      { k:"the loom", t:"ML and scientific computing",
        b:"<div class='tags'><span class='tag'>PyTorch</span><span class='tag'>XGBoost</span><span class='tag'>scikit-learn</span><span class='tag'>PINNs</span><span class='tag'>NumPy</span><span class='tag'>SciPy</span></div>" },
      { k:"the forge", t:"HPC and systems",
        b:"<div class='tags'><span class='tag'>CUDA</span><span class='tag'>CuPy</span><span class='tag'>parallel processing</span><span class='tag'>4/8-bit quantisation</span><span class='tag'>latency optimisation</span><span class='tag'>Linux</span></div>" },
      { k:"the caravan", t:"Data, engineering and AI",
        b:"<div class='tags'><span class='tag'>anomaly detection</span><span class='tag'>time-series analysis</span><span class='tag'>CI/CD</span><span class='tag'>Docker</span><span class='tag'>Git</span><span class='tag'>Flask</span><span class='tag'>ChromaDB</span><span class='tag'>RAG</span><span class='tag'>LLM fine-tuning</span><span class='tag'>multi-agent (NetworkX, LangChain)</span><span class='tag'>SQLAlchemy</span></div>" }
    ]
  },
  snow: {
    name: "The Quiet Archive", sub: "publications", door: "doors of frosted glass",
    stations: [
      { k:"IoTaIS 2025 · Bali", t:"Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks",
        b:"<p>Co-authored at C-DAC, on the Zero Trust framework's ML detection.</p>" },
      { k:"IoTaIS 2025 · Bali", t:"A Comprehensive Survey on Zero Trust Architecture in IoT Networks",
        b:"<p>Co-authored at C-DAC: a survey of Zero Trust architectures for IoT networks.</p>" }
    ]
  },
  sky: {
    name: "The Dreamer's Sky", sub: "about him", door: "a gap in the clouds",
    stations: [
      { k:"the person", t:"Saptarshi Nag, AI/ML Engineer",
        b:"<p>He works across the whole of an ML project: features from raw data, the model, and deployment under tight performance limits.</p><p>Kolkata for the B.Tech, Pune for the M.Tech and two telescope internships, and now Chennai, at C-DAC.</p>" },
      { k:"carried lights", t:"The numbers, and where each came from",
        b:"<div class='mgrid'><div class='mtile'><div class='v'>96.97%</div><div class='l'>flow-attack accuracy (RF) · C-DAC Zero Trust IoT</div></div><div class='mtile'><div class='v'>86.78%</div><div class='l'>window macro F1 (Voting Ensemble) · C-DAC</div></div><div class='mtile'><div class='v'>99.8%</div><div class='l'>pulsar F1 · NCRA ResNet1D</div></div><div class='mtile'><div class='v'>4.1×</div><div class='l'>training speedup · F1 tyre CUDA kernels</div></div><div class='mtile'><div class='v'>50%</div><div class='l'>latency cut · GMRT pipeline</div></div><div class='mtile'><div class='v'>70M+</div><div class='l'>samples · NCRA pulsar search</div></div></div>" }
    ]
  },
  city: {
    name: "The Atelier", sub: "projects and C-DAC: run his machines", door: "a portal of soft neon",
    stations: [
      { k:"machine 01", t:"F1 Tyre Lab", b:"<p>Physics-informed tyre degradation. Watch thermal and mechanical wear separate, then call the pit stop against his model. <b>LSTM-XGBoost · 10 Hz telemetry · CUDA/CuPy kernels, 4.1× faster training.</b></p>", demo:"f1" },
      { k:"machine 02", t:"Omniscience Console", b:"<p>His privacy-first local RAG system. Ask a question and watch retrieval happen in embedding space (simulated). <b>Under 50 ms search · under 500 ms to first token · POSIX file locking · GPU-aware Docker.</b></p>", demo:"oracle" },
      { k:"machine 03", t:"ARO Table", b:"<p>The Autonomous Research Operator runs multi-agent workflows as directed graphs. <b>Flask SSE · NetworkX · React · 16 vulnerabilities found and fixed in his own adversarial audit · SQLAlchemy audit trails.</b></p>", demo:"aro" },
      { k:"machine 04", t:"WiFi-Guard Post (C-DAC)", b:"<p>His current job, simulated: a stream of management frames, a deauth flood, a window model that flags it, and you on the quarantine switch. <b>Flow model 96.97% accuracy (RF) · window model 90.86% / 86.78% macro F1 · 63 features from raw PCAPs.</b></p>", demo:"wifi" }
    ]
  },
  meadow: {
    name: "Journey's End", sub: "contact", door: "an arch of fireflies",
    stations: [
      { k:"send a lantern", t:"Reach the real one",
        b:"<p>He's open to research collaborations and engineering roles.</p><div class='links'><a href='mailto:saptarshinag18@gmail.com'><i aria-hidden='true' class='fa-solid fa-envelope'></i>saptarshinag18@gmail.com</a><a href='https://www.linkedin.com/in/saptarshi18' target='_blank' rel='noopener'><i aria-hidden='true' class='fa-brands fa-linkedin'></i>/in/saptarshi18</a><a href='https://github.com/Saptarshi-Nag189' target='_blank' rel='noopener'><i aria-hidden='true' class='fa-brands fa-github'></i>Saptarshi-Nag189</a><a href='../saptarshi_resume_linkedin_2026.pdf' target='_blank' rel='noopener'><i aria-hidden='true' class='fa-solid fa-file-arrow-down'></i>his CV</a></div>" }
    ]
  }
};
