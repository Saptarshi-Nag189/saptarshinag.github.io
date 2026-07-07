/* ==========================================================================
   twin-data.js — EVERYTHING editable about the Saptarshi AI twin + domains.
   To update the twin: edit this file only. Three exports:
     FAIRY   — scripted companion lines (biome intros, events, idle)
     CORPUS  — Q&A intents for the chat drawer (patterns are lowercase substrings)
     DOMAINS — station content for every dungeon
   ========================================================================== */

export const FAIRY = {
  wake: "Oh! You're here. I'm Saptarshi's twin — I'll wander with you. ◀ ▶ walk · ▲ hop or enter · Esc steps out of any domain · T opens a chat with me. The road knows the way.",
  rest: "Shhh… lie down. You walked a whole life today. I'll be right here on the table. Listen — rain.",
  idle: [
    "The path continues ▶ — no map needed, I promise.",
    "If you're curious about him, tap me anytime and just ask.",
    "Every glowing door hides a piece of his story."
  ],
  biomes: {
    glade:  "This is where every story starts — soft light and no plans. Walk on ▶",
    forest: "The Grove of Foundations… his learning years grew tall here. That glowing arch leads inside.",
    river:  "Hear the water? Hop in the boat — his research years flowed just like this. Listen…",
    desert: "The Dunes of Craft. Everything he practised, distilled to an oasis. Doors shimmer near water.",
    snow:   "Hush now — the Quiet Archive keeps what he published. Snow keeps paper safe, you know.",
    sky:    "Hold on — this is my favourite part. Spread the cape. We fly from here. ✧",
    city:   "The Atelier! Everything he builds lives in there — you can actually run his machines.",
    meadow: "Journey's end… or a beginning. Send a lantern up, he always answers."
  },
  doorEnter: "In we go — softly…",
  doorExit: "Back to the open air ✧",
  demoDone: [
    "You did that just like he does. Almost.",
    "See? His work makes more sense when your hands do it.",
    "I'm keeping a note that you were good at this."
  ],
  chatGreeting: "Hi! Ask me anything about Saptarshi — his work, projects, studies… I keep all of it."
};

export const CORPUS = [
  { p: ["who are you","what are you","your name"], a: "I'm Saptarshi's digital twin — a small local mind trained on his story. No servers, no spying; I live entirely in this page. One day a real language model will sit where I am (the plumbing is already here)." },
  { p: ["who is saptarshi","about him","who is he","introduce"], a: "Saptarshi Nag is an AI/ML engineer — M.Tech in Artificial Intelligence from DIAT (DRDO), research at NCRA-TIFR and GMRT, and now a Project Engineer at C-DAC building real-time IoT security with Zero Trust and ML detection. He works the whole stack: raw data → models → production." },
  { p: ["education","study","college","degree","btech","mtech","gate"], a: "B.Tech in CSE from Academy of Technology, Kolkata (CGPA 9.44), then M.Tech in AI at DIAT (DRDO), Pune (CGPA 8.64). GATE 2024: rank 1790 in Data Science & AI — top 5%. The Grove of Foundations in the forest holds all of it." },
  { p: ["current","c-dac","cdac","job","work now","zero trust","iot"], a: "At C-DAC Chennai he builds a real-time Zero-Trust framework for IoT — WiFi, BLE, Zigbee and LoRa at once. Two-stage detection (1-second windows + flows), 96.97% accuracy, 63 features engineered from raw PCAPs, SPIFFE/SPIRE identity, mTLS. You can fight off an attack yourself at the WiFi-Guard post in the Atelier." },
  { p: ["pulsar","ncra","astronomy","telescope","gmrt"], a: "His research years: at GMRT he refactored the telescope's signal pipeline for multicore and halved its latency; at NCRA-TIFR he built a ResNet1D with SE-attention that finds weak pulsars at 99.8% F1 across 70M+ samples. Both live on the Listening River — the boat will take you." },
  { p: ["f1","tyre","tire","race","formula"], a: "His F1 project predicts tyre degradation with physics-informed neural networks — thermal and mechanical wear split apart — plus LSTM-XGBoost on 10 Hz telemetry, and custom CUDA/CuPy kernels for a 4.1× training speedup. Try beating his model at the pit wall in the Atelier!" },
  { p: ["omniscience","rag","retrieval"], a: "Omniscience Pro is his privacy-first local RAG system — multi-modal ingestion, vector search under 50 ms (HNSW), first token under 500 ms, all offline on consumer hardware with GPU-aware Docker and CI/CD." },
  { p: ["aro","agent","multi-agent"], a: "ARO — Autonomous Research Operator — runs multi-agent LLM workflows as directed graphs (NetworkX) with a Flask SSE backend and React front. After building it he red-teamed it himself: found and fixed 16 vulnerabilities across auth, SSRF, validation and CORS." },
  { p: ["llama","fine-tun","quant"], a: "He fine-tuned Llama 3.2 (1B and 3B) on 21.5k domain interactions and squeezed it to 4-bit with Unsloth — no meaningful quality loss, runs on consumer GPUs. That's also the model family destined to replace my little local brain someday." },
  { p: ["skill","stack","tools","language"], a: "Python (advanced) and C++ (proficient) at the core; PyTorch, XGBoost, scikit-learn, PINNs; CUDA and CuPy for speed; Docker, Flask, ChromaDB, Git for shipping; RAG, LLM fine-tuning and multi-agent orchestration for the AI work. The desert oasis shows them as constellations." },
  { p: ["paper","publication","iotais"], a: "Two papers at IoTaIS 2025 in Bali: 'Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks' and 'A Comprehensive Survey on Zero Trust Architecture in IoT Networks'. They rest in the snow archive." },
  { p: ["contact","email","hire","reach","linkedin","github","cv","resume"], a: "Reach him at saptarshinag18@gmail.com, /in/saptarshi18 on LinkedIn, or Saptarshi-Nag189 on GitHub. His CV waits at journey's end — or right here: I'd say he's open to interesting problems." },
  { p: ["metric","number","stat","achievement"], a: "The numbers he's proudest of: 96.97% IoT attack detection, 99.8% pulsar F1 over 70M+ samples, 4.1× GPU speedup, a 50% latency cut at GMRT, and retrieval under 50 ms." },
  { p: ["hello","hi ","hey","namaste"], a: "Hello, wanderer ✧ Lovely night for a walk through a life, isn't it? Ask me anything, or just keep going ▶" },
  { p: ["thank","thanks"], a: "Always. He'd say it too — softly, and then go back to training something." }
];
export const CORPUS_FALLBACK = "Mmm, that's beyond my little local brain — for now. Try asking about his education, research, C-DAC, the F1 or RAG projects, skills, papers, or how to reach him. (A full language model will move in here someday — the socket's ready.)";

/* ---------- domain station content (subsections) ---------- */
export const DOMAINS = {
  forest: {
    name: "Grove of Foundations", sub: "education", door: "a ring of glowing birches",
    stations: [
      { k:"first roots · 2019–2023", t:"B.Tech — Computer Science & Engineering",
        b:"<p><b>Academy of Technology, Kolkata</b> · CGPA <b>9.44/10.0</b></p><p>Where the fundamentals took root — C, algorithms, systems — the quiet years that made everything after possible.</p>" },
      { k:"the ascent · 2023–2025", t:"M.Tech — CSE (Artificial Intelligence)",
        b:"<p><b>DIAT (DRDO), Pune</b> · CGPA <b>8.64/10.0</b></p><p>Defence Institute of Advanced Technology — deep learning, HPC, and AI for defence. The years the forest grew tall.</p>" },
      { k:"the proof · 2024", t:"GATE — Data Science & AI",
        b:"<p>Rank <b>1790</b> nationally · <b>top 5%</b>.</p><p>One exam, one afternoon, years of roots underneath it.</p>" }
    ]
  },
  river: {
    name: "The Listening River", sub: "research years", door: "a moon-gate over the water",
    stations: [
      { k:"winter 2023 · GMRT", t:"Making a telescope breathe",
        b:"<p><b>Giant Metrewave Radio Telescope · NCRA-TIFR · Pune</b></p><ul><li>Profiled the legacy <b>CPU signal-filtering pipeline</b>, rebuilt it for <b>multicore</b>.</li><li>Latency fell <b>50%</b> — real-time processing of continuous sky streams, unblocked.</li></ul><p><i>Play the waterwheel console here to feel the same rebalancing.</i></p>", demo:"gmrt" },
      { k:"2024–25 · NCRA-TIFR", t:"Hearing dead stars",
        b:"<p><b>Research Intern (M.Tech project)</b></p><ul><li><b>ResNet1D + Squeeze-and-Excitation attention</b> for weak pulsar signals at low SNR.</li><li><b>99.8% F1</b> across <b>70M+ samples</b>, adaptive thresholds for shifting noise floors.</li><li>Scoped, built, and defended entirely alone.</li></ul><p><i>The folding pool beside this stone lets you find a pulsar yourself.</i></p>", demo:"pulsar" }
    ]
  },
  desert: {
    name: "Oasis of Craft", sub: "skills", door: "an archway of woven palm-light",
    stations: [
      { k:"spoken tongues", t:"Languages",
        b:"<div class='tags'><span class='tag'>Python (advanced)</span><span class='tag'>C++ (proficient)</span><span class='tag'>C</span><span class='tag'>Bash</span><span class='tag'>SQL</span></div>" },
      { k:"the loom", t:"ML & Scientific Computing",
        b:"<div class='tags'><span class='tag'>PyTorch</span><span class='tag'>XGBoost</span><span class='tag'>Scikit-learn</span><span class='tag'>PINNs</span><span class='tag'>NumPy</span><span class='tag'>SciPy</span></div>" },
      { k:"the forge", t:"HPC & Systems",
        b:"<div class='tags'><span class='tag'>CUDA</span><span class='tag'>CuPy</span><span class='tag'>Parallel Processing</span><span class='tag'>Quantisation 4/8-bit</span><span class='tag'>Latency Optimisation</span><span class='tag'>Linux</span></div>" },
      { k:"the caravan", t:"Data, Engineering & MLOps",
        b:"<div class='tags'><span class='tag'>Anomaly Detection</span><span class='tag'>Time-Series</span><span class='tag'>CI/CD</span><span class='tag'>Docker</span><span class='tag'>Git</span><span class='tag'>Flask</span><span class='tag'>ChromaDB</span><span class='tag'>RAG</span><span class='tag'>LLM Fine-Tuning</span><span class='tag'>Multi-Agent (NetworkX · LangChain)</span></div>" }
    ]
  },
  snow: {
    name: "The Quiet Archive", sub: "publications & milestones", door: "doors of frosted glass",
    stations: [
      { k:"IoTaIS 2025 · Bali", t:"Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks",
        b:"<p>The C-DAC detection work, peer-reviewed — window models, flow models, and what it takes to watch four radio protocols at once, published.</p>" },
      { k:"IoTaIS 2025 · Bali", t:"A Comprehensive Survey on Zero Trust Architecture in IoT Networks",
        b:"<p>The wider map: how Zero Trust must bend to fit constrained devices — and where the field goes next.</p>" }
    ]
  },
  sky: {
    name: "The Dreamer's Isle", sub: "about him", door: "a gap in the clouds",
    stations: [
      { k:"the person", t:"Saptarshi Nag — AI/ML Engineer",
        b:"<p>An engineer at the meeting point of <b>security and systems research</b> — happiest where raw data becomes a working model that must survive production.</p><p>From Kolkata, through Pune's telescopes and defence labs, to Chennai's live networks — the thread is the same: teach machines to notice what matters.</p>" },
      { k:"carried lights", t:"The numbers he keeps",
        b:"<div class='mgrid'><div class='mtile'><div class='v'>96.97%</div><div class='l'>IoT attack detection</div></div><div class='mtile'><div class='v'>99.8%</div><div class='l'>pulsar F1</div></div><div class='mtile'><div class='v'>4.1×</div><div class='l'>GPU speedup</div></div><div class='mtile'><div class='v'>50%</div><div class='l'>latency cut</div></div><div class='mtile'><div class='v'>70M+</div><div class='l'>samples</div></div></div>" }
    ]
  },
  city: {
    name: "The Atelier", sub: "projects & c-dac — run his machines", door: "a portal of soft neon",
    stations: [
      { k:"machine 01", t:"F1 Tyre Lab", b:"<p>Physics-informed tyre degradation — watch thermal and mechanical wear separate, then call the pit stop against his model. <b>4.1× CUDA speedup · LSTM-XGBoost · 10 Hz telemetry.</b></p>", demo:"f1" },
      { k:"machine 02", t:"Omniscience Console", b:"<p>His privacy-first local RAG. Ask, and watch retrieval happen in embedding space — <b>&lt;50 ms search · &lt;500 ms first token · LangChain, ChromaDB, Docker.</b></p>", demo:"oracle" },
      { k:"machine 03", t:"ARO Table", b:"<p>Autonomous Research Operator — multi-agent workflows as living graphs. <b>Flask SSE · NetworkX · React · 16 vulnerabilities found & fixed in his own audit.</b></p>", demo:"aro" },
      { k:"machine 04", t:"WiFi-Guard Post (C-DAC)", b:"<p>His day job, live: management-frame streams, a deauth storm, a window model that flags it — and you on the quarantine switch. <b>96.97% · 63 PCAP features · SPIFFE/SPIRE · mTLS.</b></p>", demo:"wifi" }
    ]
  },
  meadow: {
    name: "The Send-off", sub: "contact", door: "an arch of fireflies",
    stations: [
      { k:"send a lantern", t:"Reach the real one",
        b:"<p>The wander ends; the conversation doesn't have to.</p><div class='links'><a href='mailto:saptarshinag18@gmail.com'><i class='fa-solid fa-envelope'></i>saptarshinag18@gmail.com</a><a href='https://www.linkedin.com/in/saptarshi18' target='_blank' rel='noopener'><i class='fa-brands fa-linkedin'></i>/in/saptarshi18</a><a href='https://github.com/Saptarshi-Nag189' target='_blank' rel='noopener'><i class='fa-brands fa-github'></i>Saptarshi-Nag189</a><a href='../saptarshi_resume_linkedin_2026.pdf' target='_blank' rel='noopener'><i class='fa-solid fa-file-arrow-down'></i>his CV</a></div>" }
    ]
  }
};
