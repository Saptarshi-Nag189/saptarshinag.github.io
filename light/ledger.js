/* ==========================================================================
   ledger.js: the ledger.

   Every fact about Saptarshi, as real DOM text, taken from the linked CV.

   The 3D world is the experience; this is the record. It exists because an
   explorable island is the wrong interface for four of the audiences that
   matter: a search engine, a screen reader, a browser with WebGL disabled,
   and a recruiter with ninety seconds. All four get the same facts here, in
   the plain order they expect, with no scene to load first.

   House rule, kept from the rest of the site: every metric names the project
   it came from.
   ========================================================================== */

const LEDGER = {
  name: 'Saptarshi Nag',
  role: 'AI/ML Engineer · Chennai, India',
  blurb: `Project Engineer at C-DAC Chennai, building ML-based attack detection for a
          Zero Trust IoT security framework. Before that, an M.Tech in Computer Science
          and Engineering (Artificial Intelligence) at DIAT, and research internships at
          NCRA-TIFR and GMRT.`,

  links: [
    ['Email', 'saptarshinag18@gmail.com', 'mailto:saptarshinag18@gmail.com'],
    ['LinkedIn', '/in/saptarshi18', 'https://www.linkedin.com/in/saptarshi18'],
    ['GitHub', 'Saptarshi-Nag189', 'https://github.com/Saptarshi-Nag189'],
    ['CV', 'PDF', '../saptarshi_resume_linkedin_2026.pdf'],
  ],

  experience: [
    {
      org: 'C-DAC, Chennai',
      role: 'Project Engineer, AI Research & IoT Security',
      when: 'July 2025 – present',
      points: [
        'Built a real-time Zero Trust security framework for IoT networks covering WiFi (802.11), BLE, Zigbee and LoRa. ML-based attack detection feeds a continuous 7-pillar device trust score.',
        'Two-stage detection: a window model classifies 1-second windows of 802.11 management frames into 7 attack classes, and a flow model handles longer patterns. Compared RF, XGBoost, SVM, MLP and a Voting Ensemble.',
        'Best results: <b>96.97% accuracy</b> on flow classification (RF), and <b>90.86% accuracy / 86.78% macro F1</b> on window classification (Voting Ensemble).',
        'Engineered <b>63 features</b> from raw PCAP captures with Scapy and PyShark, and a live PCAP drop-folder pipeline with MD5 deduplication and batch inference.',
        'Integrated SPIFFE/SPIRE workload identity, mTLS and OTP-based 2FA.',
        'Co-authored two papers on the framework at <b>IoTaIS 2025, Bali</b>.',
      ],
    },
    {
      org: 'NCRA-TIFR, Pune',
      role: 'Research Intern (M.Tech project)',
      when: 'Aug 2024 – Apr 2025',
      points: [
        'ResNet1D with Squeeze-and-Excitation attention to detect weak pulsar signals against interference at low SNR.',
        '<b>99.8% F1</b> across <b>70M+ samples</b>, with adaptive thresholds for noise floors that shifted between sessions.',
      ],
    },
    {
      org: 'GMRT (NCRA-TIFR), Pune',
      role: 'Winter Intern, HPC & Signal Processing Optimisation',
      when: 'Dec 2023 – Jan 2024',
      points: [
        'Profiled the legacy CPU signal-filtering pipelines and refactored them for multicore execution.',
        'Cut latency by <b>50%</b>, enough to process the continuous telescope data stream in real time.',
      ],
    },
  ],

  projects: [
    {
      name: 'Omniscience Pro',
      what: 'Privacy-first local RAG system',
      points: [
        'Local RAG with multi-modal document ingestion, built on LangChain and ChromaDB.',
        '<b>Under 50 ms</b> HNSW vector search and <b>under 500 ms</b> to first token, on consumer hardware.',
        'GPU-aware Docker with a full CI/CD pipeline, and POSIX file locking for safe concurrent sessions.',
      ],
    },
    {
      name: 'ARO, Autonomous Research Operator',
      what: 'Multi-agent LLM platform',
      points: [
        'Multi-agent LLM workflows as directed graphs in NetworkX.',
        'Flask backend streaming progress over Server-Sent Events to a React frontend.',
        'An adversarial audit after the build found and fixed <b>16 vulnerabilities</b> across auth, SSRF, input validation and CORS; SQLAlchemy-backed audit trails.',
      ],
    },
    {
      name: 'F1 tyre degradation and race strategy',
      what: 'GPU-accelerated predictive analytics',
      points: [
        'Hybrid LSTM-XGBoost model predicting tyre wear and pit-stop windows from <b>10 Hz</b> telemetry.',
        'Physics-informed loss separating thermal and mechanical degradation.',
        'Custom CUDA/CuPy kernels cut training time by <b>4.1×</b>.',
      ],
    },
    {
      name: 'Llama 3.2 for efficient inference',
      what: 'Fine-tuning and quantisation',
      points: [
        '1B and 3B models fine-tuned on <b>21.5k</b> domain-specific interactions.',
        '4-bit quantisation with Unsloth, enough for a consumer GPU, with no meaningful drop in output quality.',
      ],
    },
  ],

  education: [
    ['M.Tech, Computer Science & Engineering (Artificial Intelligence)', 'DIAT (DRDO), Pune', '2023–2025', 'CGPA 8.64 / 10.0'],
    ['B.Tech, Computer Science & Engineering', 'Academy of Technology, Kolkata', '2019–2023', 'CGPA 9.44 / 10.0'],
  ],
  honours: [
    'GATE 2024, Data Science & AI: rank <b>1790</b>, top 5% of applicants.',
    'Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks · IoTaIS 2025, Bali.',
    'A Comprehensive Survey on Zero Trust Architecture in IoT Networks · IoTaIS 2025, Bali.',
  ],

  skills: [
    ['Languages', 'Python (advanced), C++ (proficient), C, Bash, SQL'],
    ['ML and scientific computing', 'PyTorch, XGBoost, scikit-learn, physics-informed neural networks, NumPy, SciPy'],
    ['HPC and systems', 'CUDA, CuPy, parallel processing, 4-bit and 8-bit quantisation, latency optimisation, Linux'],
    ['Data and engineering', 'statistical anomaly detection, time-series analysis, CI/CD, Docker, Git, Flask, ChromaDB'],
    ['AI and MLOps', 'RAG, LLM fine-tuning, multi-agent orchestration (NetworkX, LangChain), SQLAlchemy'],
  ],
};

/* -------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Facts are authored above; only <b> is meaningful inside a point. */
const rich = (s) => esc(s).replace(/&lt;(\/?)b>/g, '<$1b>'); // esc() leaves '>' alone

function section(title, inner) {
  return `<section class="lsec"><h2>${esc(title)}</h2>${inner}</section>`;
}

export function renderLedger(el) {
  const L = LEDGER;

  const links = L.links
    .map(([k, v, href]) => `<a href="${href}" rel="noopener">${esc(k)} · ${esc(v)}</a>`)
    .join('');

  const exp = L.experience.map((e) => `
    <article class="item">
      <h3>${esc(e.role)}</h3>
      <p class="meta">${esc(e.org)} · ${esc(e.when)}</p>
      <ul>${e.points.map((p) => `<li>${rich(p)}</li>`).join('')}</ul>
    </article>`).join('');

  const proj = L.projects.map((p) => `
    <article class="item">
      <h3>${esc(p.name)}</h3>
      <p class="meta">${esc(p.what)}</p>
      <ul>${p.points.map((x) => `<li>${rich(x)}</li>`).join('')}</ul>
    </article>`).join('');

  const edu = L.education.map(([d, s, w, g]) => `
    <article class="item">
      <h3>${esc(d)}</h3>
      <p class="meta">${esc(s)} · ${esc(w)} · ${esc(g)}</p>
    </article>`).join('');

  const hon = `<ul>${L.honours.map((h) => `<li>${rich(h)}</li>`).join('')}</ul>`;

  const sk = L.skills.map(([k, v]) => `
    <article class="item">
      <h3>${esc(k)}</h3>
      <p class="meta">${esc(v)}</p>
    </article>`).join('');

  el.innerHTML = `
    <header class="lhead">
      <h1>${esc(L.name)}</h1>
      <p class="role">${esc(L.role)}</p>
      <p class="blurb">${esc(L.blurb.replace(/\s+/g, ' ').trim())}</p>
      <nav class="links">${links}</nav>
    </header>
    ${section('Experience', exp)}
    ${section('Selected projects', proj)}
    ${section('Education', edu)}
    ${section('Honours and papers', hon)}
    ${section('Skills', sk)}
    <footer class="lfoot">
      <p>Close this panel to walk the island it belongs to.</p>
    </footer>`;
}

export { LEDGER };
