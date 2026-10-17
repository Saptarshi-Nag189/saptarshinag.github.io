/* ==========================================================================
   twin.js: the companion's mind, and everything editable about her.

   Ported from /wander/'s twin-data.js, with the place references rewritten for
   this island: there is no Atelier or Grove here, there is a dune sea, a deep
   wood, a lake with a boat, a temple and a frozen crown.

   House rules: facts come from the linked CV only, and every metric names the
   project it came from.

   To update the twin, edit this file and nothing else. The brain below is a
   whole-word intent matcher. It's small, instant and offline, and it can't make
   anything up, which for a résumé matters more than fluency. The socket is the
   same one /wander/ used, so a real language model can replace it later:

     window.TwinBrain = { ready, kind, answer(question) -> Promise<string> }
   ========================================================================== */

export const FAIRY = {
  wake: "Oh, you're here. That hooded figure is Saptarshi Nag, walking his own island. I'm his digital twin, and I ride along as this light. Ask me anything about him.",
  greeting: "You can ask about his work, his research, his numbers, or how to reach him ✧",
};

export const CORPUS = [
  /* "who is this?" was the first thing a real player asked. Keep the patterns
     specific: a loose one like "figure" steals "what figures is he proudest
     of" from the numbers answer. */
  { p: ["who is this", "who am i", "who is that", "who do i play", "playing as",
        "the character", "the traveller", "the traveler", "hooded", "the wanderer"],
    a: "The traveller you're steering is Saptarshi. I'm the light at his shoulder, his digital twin, here to answer for him." },
  { p: ["who are you", "what are you", "your name", "who r u"],
    a: "I'm Saptarshi's digital twin. I pick from answers written from his CV, and I run entirely in this page, so I can only tell you what's in them." },
  { p: ["who is saptarshi", "about saptarshi", "about him", "who is he", "introduce", "his background"],
    a: "Saptarshi Nag is an AI/ML engineer. He has an M.Tech in Computer Science and Engineering (Artificial Intelligence) from DIAT, a DRDO institute, did research internships at NCRA-TIFR and GMRT, and is now a Project Engineer at C-DAC Chennai, working on ML-based attack detection for IoT networks." },
  { p: ["education", "study", "studied", "college", "degree", "btech", "b.tech", "mtech", "m.tech", "gate", "university"],
    a: "A B.Tech in Computer Science and Engineering from Academy of Technology, Kolkata (CGPA 9.44, 2019–2023), then an M.Tech in CSE (Artificial Intelligence) at DIAT, Pune (CGPA 8.64, 2023–2025). He qualified GATE 2024 with rank 1790 in Data Science & AI, in the top 5% of applicants." },
  { p: ["current", "c-dac", "cdac", "job", "work now", "zero trust", "iot", "security"],
    a: "Since July 2025 he's been a Project Engineer in AI Research & IoT Security at C-DAC Chennai. He built a real-time Zero Trust framework for IoT networks covering WiFi, BLE, Zigbee and LoRa, with two-stage ML detection: the flow model (RF) reached 96.97% accuracy, and the window model (Voting Ensemble) 90.86% accuracy with 86.78% macro F1. He engineered 63 features from raw PCAPs and added SPIFFE/SPIRE, mTLS and OTP 2FA." },
  { p: ["pulsar", "pulsars", "ncra", "astronomy", "telescope", "gmrt", "research"],
    a: "Two research internships. At GMRT he refactored the telescope's CPU filtering pipelines for multicore and cut latency by 50%. At NCRA-TIFR, for his M.Tech project, he built a ResNet1D with Squeeze-and-Excitation attention that detects weak pulsars at 99.8% F1 across 70M+ samples." },
  { p: ["f1", "tyre", "tyres", "tire", "tires", "formula", "cuda"],
    a: "His F1 project predicts tyre wear and pit-stop windows with a hybrid LSTM-XGBoost model on 10 Hz telemetry. A physics-informed loss separates thermal from mechanical degradation, and custom CUDA/CuPy kernels cut training time by 4.1×." },
  { p: ["omniscience", "rag", "retrieval", "vector"],
    a: "Omniscience Pro is his privacy-first local RAG system, built on LangChain and ChromaDB. It searches its vector index in under 50 ms (HNSW) and returns the first token in under 500 ms on consumer hardware, and it ships as a GPU-aware Docker image with POSIX file locking for concurrent sessions." },
  { p: ["aro", "agent", "agents", "multi-agent", "autonomous"],
    a: "ARO, the Autonomous Research Operator, runs multi-agent LLM workflows as directed graphs in NetworkX, with a Flask backend streaming to a React frontend over Server-Sent Events. An adversarial audit after the build found and fixed 16 vulnerabilities across auth, SSRF, input validation and CORS." },
  { p: ["llama", "fine-tune", "fine-tuning", "finetune", "quantisation", "quantization", "unsloth"],
    a: "He fine-tuned Llama 3.2 1B and 3B on 21.5k domain-specific interactions and quantised them to 4-bit with Unsloth, which cut memory enough for a consumer GPU with no meaningful drop in output quality." },
  { p: ["skill", "skills", "stack", "tools", "language", "languages", "tech"],
    a: "Python (advanced) and C++ (proficient), plus C, Bash and SQL. PyTorch, XGBoost, scikit-learn and physics-informed networks for modelling; CUDA, CuPy and 4/8-bit quantisation for speed; Docker, Flask, Git, ChromaDB and CI/CD for shipping; RAG, LLM fine-tuning and multi-agent orchestration with NetworkX and LangChain." },
  { p: ["paper", "papers", "publication", "publications", "iotais", "published"],
    a: "Two papers at IoTaIS 2025 in Bali, both on the C-DAC framework: 'Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks' and 'A Comprehensive Survey on Zero Trust Architecture in IoT Networks'." },
  { p: ["contact", "email", "hire", "reach", "linkedin", "github", "cv", "resume", "hiring"],
    a: "saptarshinag18@gmail.com, /in/saptarshi18 on LinkedIn, or Saptarshi-Nag189 on GitHub. Press L for the plain version of everything, with a link to his CV." },
  { p: ["metric", "metrics", "number", "numbers", "figures", "stat", "stats", "achievement", "achievements", "best", "proud", "proudest"],
    a: "The headline numbers, each with its project: 96.97% flow-attack accuracy (C-DAC's Zero Trust IoT framework, RF model), 99.8% F1 over 70M+ samples (the NCRA-TIFR pulsar ResNet1D), a 4.1× training speedup (CUDA kernels in the F1 tyre project), a 50% latency cut (the GMRT pipeline refactor), and search under 50 ms (Omniscience Pro)." },
  { p: ["this world", "this game", "how did you make", "babylon", "island", "built this", "how was this made"],
    a: "The island is generated, not modelled: a climate of temperature and moisture decides where desert, forest and snow go, and the world streams in 64-metre tiles that are freed once they're behind you. Press L for the plain version of everything." },
  { p: ["hello", "hi", "hey", "namaste", "yo"],
    a: "Hello ✧ Ask me anything about him, or just keep walking." },
  { p: ["thank", "thanks", "thank you"],
    a: "Any time." },
];

export const CORPUS_FALLBACK =
  "I don't have an answer for that one. Try his education, his research, C-DAC, the F1 or RAG projects, his skills, the papers, or how to reach him.";

/* ==========================================================================
   The brain
   ========================================================================== */

/**
 * Intent matching, scored by the length of what matched, so a long specific
 * pattern beats a short generic one. Deliberately not clever: it can only
 * return sentences that were written by hand, which is the right property for
 * something answering questions about a real person's career.
 *
 * Patterns match WHOLE WORDS. Substring matching sent "around" to ARO,
 * "storage" and "average" to RAG, "navigate" to GATE, "entire" to tyres, and
 * any "you"/"your" question to the hello line via "yo".
 *
 * Hitting several of an intent's patterns is stronger evidence than hitting one
 * long one. Without that bonus, "tell me about the pulsar work at ncra" scored
 * 13 for the opener "tell me about" and only 10 for "pulsar" + "ncra".
 */
const MULTI_BONUS = 3;

const escapeRe = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function scoreIntent(q, patterns) {
  let s = 0, hits = 0;
  for (const pat of patterns) {
    const re = new RegExp('(^|[^a-z0-9])' + escapeRe(pat.trim()) + '($|[^a-z0-9])');
    if (re.test(q)) { s += pat.length; hits++; }
  }
  return hits > 1 ? s + (hits - 1) * MULTI_BONUS : s;
}

export const LocalBrain = {
  ready: true,
  kind: 'local-corpus',
  answer(q) {
    q = (q || '').toLowerCase();
    let best = null, score = 0;
    for (const item of CORPUS) {
      const s = scoreIntent(q, item.p);
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
