/* ==========================================================================
   twin.js — the companion's mind, and everything editable about her.

   Ported from /wander/'s twin-data.js, with the place references rewritten for
   this island: there is no Atelier or Grove here, there is a dune sea, a deep
   wood, a lake with a boat, a temple and a frozen crown.

   THE HOUSE RULE HOLDS: every metric names the project it came from. A bare
   number is a decoration, not a claim.

   To update the twin, edit this file and nothing else. The brain below is a
   substring-intent matcher — small, instant, offline, and incapable of making
   anything up, which for a résumé matters more than fluency. The socket is the
   same one /wander/ used, so a real language model can replace it later:

     window.TwinBrain = { ready, kind, answer(question) -> Promise<string> }
   ========================================================================== */

export const FAIRY = {
  wake: "Oh — you're here. That hooded figure is Saptarshi Nag, walking his own island; I'm his digital twin, and I ride along as this light. Ask me anything about him.",
  greeting: "Ask me about his work, his research, the numbers he's proudest of, or how to reach him ✧",
  idle: [
    "Seven lands on this island, and one day's light to cross them.",
    "Curious about him? Just ask — I'm a local mind, I answer instantly.",
    "The temple is worth the climb. So is the lake at dusk.",
  ],
  places: {
    beach:  "Where the island begins. He'd say every project starts on a shore like this.",
    desert: "The Dune Sea — dry, and older than the rest of it.",
    meadow: "The easy middle. Good walking.",
    forest: "The Deep Wood. Close, and full of quiet.",
    marsh:  "The Still Water. There's a boat on the bank — press E and take it out.",
    rock:   "Above where things grow.",
    snow:   "The Frozen Crown. Cold enough to keep paper safe, he'd tell you.",
  },
};

export const CORPUS = [
  /* "who is this?" was the first thing a real player asked. Keep the patterns
     specific — a loose one like "figure" steals "what figures is he proudest
     of" from the metrics answer. */
  { p: ["who is this", "who am i", "who is that", "who do i play", "playing as",
        "the character", "the traveller", "the traveler", "hooded", "the wanderer"],
    a: "The traveller you're steering is Saptarshi himself — the island is his career laid out as ground, and each biome is a chapter of it. I'm the light at his shoulder: his digital twin, here to answer for him." },
  { p: ["who are you", "what are you", "your name", "who r u"],
    a: "I'm Saptarshi's digital twin — a small local mind that knows his story. No servers and no tracking: I live entirely in this page, which is also why I answer instantly and never invent a number." },
  { p: ["who is saptarshi", "about saptarshi", "about him", "who is he", "introduce", "his background"],
    a: "Saptarshi Nag is an AI/ML engineer. M.Tech in Artificial Intelligence from DIAT (DRDO), research at NCRA-TIFR and GMRT, and now a Project Engineer at C-DAC Chennai building real-time IoT security. He works the whole stack — raw data, models, and the production system around them." },
  { p: ["education", "study", "college", "degree", "btech", "mtech", "gate", "university"],
    a: "B.Tech in CSE from Academy of Technology, Kolkata — CGPA 9.44. Then M.Tech in AI at DIAT (DRDO), Pune — CGPA 8.64. GATE 2024: All India Rank 1790 in Data Science & AI, top 5%." },
  { p: ["current", "c-dac", "cdac", "job", "work now", "zero trust", "iot", "security"],
    a: "At C-DAC Chennai since July 2025, as Project Engineer in AI Research & IoT Security. He builds real-time detection for IoT networks across WiFi, BLE, Zigbee and LoRa: two-stage XGBoost/MLP models reaching 97.93% accuracy on high-throughput traffic at under 1 ms per window, so it runs at the edge rather than in a datacentre. 63 features engineered from raw PCAPs, SHAP for explainability, and SPIFFE/SPIRE with mTLS for identity." },
  { p: ["pulsar", "ncra", "astronomy", "telescope", "gmrt", "research"],
    a: "His research years. At GMRT he refactored the telescope's CPU filtering pipeline for multicore and cut its latency by 50%. At NCRA-TIFR he built a ResNet1D with squeeze-and-excitation attention that finds pulsars at 99.8% F1 across more than 70 million samples." },
  { p: ["f1", "tyre", "tire", "race", "formula", "cuda"],
    a: "His F1 project predicts tyre degradation with a physics-informed loss that splits thermal from mechanical wear instead of fitting one blended curve, LSTM plus XGBoost over 10 Hz telemetry, and custom CUDA/CuPy kernels giving a 4.1x training speedup." },
  { p: ["omniscience", "rag", "retrieval", "vector"],
    a: "Omniscience Pro is his privacy-first local RAG system: under 50 ms HNSW vector search and under 500 ms to first token, entirely offline. Citation-weighted ranking across local, web and academic sources, hardened with path-traversal protection, rate limiting and POSIX file locking." },
  { p: ["aro", "agent", "multi-agent", "autonomous"],
    a: "ARO — the Autonomous Research Operator — runs multi-agent LLM workflows as NetworkX directed graphs, so execution order is data rather than control flow. Flask with server-sent events into a React front end, SQLAlchemy persistence for agent memory. He then red-teamed it himself and fixed 16 vulnerabilities." },
  { p: ["llama", "fine-tun", "quant", "unsloth"],
    a: "He fine-tuned Llama 3.2, both 1B and 3B, on 21.5k interactions and quantised to 4-bit with Unsloth so it trains and runs on a single consumer GPU." },
  { p: ["skill", "stack", "tools", "language", "tech"],
    a: "Python (advanced) and C++ (proficient) at the core. PyTorch, TensorFlow, XGBoost, scikit-learn and physics-informed networks for the modelling; CUDA and 4/8-bit quantisation for speed; LangChain, ChromaDB, Ollama and RAG for the LLM work; Docker, Flask, SQL and Linux for shipping it." },
  { p: ["paper", "publication", "iotais", "published"],
    a: "Two papers accepted at IoTaIS 2025 in Bali, both out of the C-DAC zero-trust IoT work." },
  { p: ["contact", "email", "hire", "reach", "linkedin", "github", "cv", "resume", "hiring"],
    a: "saptarshinag18@gmail.com, /in/saptarshi18 on LinkedIn, Saptarshi-Nag189 on GitHub. Press L to read everything plainly, CV and all." },
  { p: ["metric", "number", "stat", "achievement", "best", "proud"],
    a: "The ones he'd stand behind, each with the build it came from: 97.93% detection at under 1 ms per window (C-DAC's IoT zero-trust framework), 99.8% F1 over 70M+ samples (the NCRA-TIFR pulsar ResNet1D), 4.1x training speedup (custom CUDA kernels, F1 tyre project), 50% latency cut (the GMRT pipeline refactor), and sub-50 ms retrieval (Omniscience Pro)." },
  { p: ["this world", "this game", "how did you make", "babylon", "island", "built this"],
    a: "This island is procedural — no downloaded terrain. A climate of temperature and moisture decides where the desert, forest and snow go; the world streams in 64-metre tiles and frees what is behind you, so memory stays flat however far you walk. Press L for the plain version of everything." },
  { p: ["hello", "hi ", "hey", "namaste", "yo"],
    a: "Hello ✧ Ask me anything about him — or just keep walking." },
  { p: ["thank", "thanks"],
    a: "Any time." },
];

export const CORPUS_FALLBACK =
  "That's past what I keep locally. Try his education, his research, C-DAC, the F1 or RAG projects, his skills, the papers, or how to reach him.";

/* ==========================================================================
   The brain
   ========================================================================== */

/**
 * Substring-intent matching, scored by the length of what matched, so a long
 * specific pattern beats a short generic one. Deliberately not clever: it can
 * only return sentences that were written by hand, which is the right property
 * for something answering questions about a real person's career.
 *
 * Hitting SEVERAL of an intent's patterns is stronger evidence than hitting one
 * long one, and without that bonus a conversational opener wins on length
 * alone: "tell me about the pulsar work at ncra" scored 13 for the phrase
 * "tell me about" in the biography and only 10 for "pulsar" + "ncra", so the
 * question about pulsars got answered with a résumé summary.
 */
const MULTI_BONUS = 3;

export const LocalBrain = {
  ready: true,
  kind: 'local-corpus',
  answer(q) {
    q = (q || '').toLowerCase();
    let best = null, score = 0;
    for (const item of CORPUS) {
      let s = 0, hits = 0;
      for (const pat of item.p) if (q.includes(pat)) { s += pat.length; hits++; }
      if (hits > 1) s += (hits - 1) * MULTI_BONUS;
      if (s > score) { score = s; best = item; }
    }
    return Promise.resolve(best ? best.a : CORPUS_FALLBACK);
  },
};

/** The socket a real model can take over later. */
export function installBrain() {
  if (typeof window === 'undefined') return LocalBrain;
  window.TwinBrain = window.TwinBrain || LocalBrain;
  return window.TwinBrain;
}
