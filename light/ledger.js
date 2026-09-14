/* ==========================================================================
   ledger.js — THE LEDGER.

   Every fact about Saptarshi, as real DOM text.

   The 3D world is the experience; this is the record. It exists because an
   explorable island is the wrong interface for four of the audiences that
   matter: a search engine, a screen reader, a browser with WebGL disabled,
   and a recruiter with ninety seconds. All four get the same facts here, in
   the plain order they expect, with no scene to load first.

   House rule, kept from the rest of the site: EVERY metric names the project
   it came from. A bare number is not a claim, it is a decoration.
   ========================================================================== */

const LEDGER = {
  name: 'Saptarshi Nag',
  role: 'AI/ML Engineer · Chennai, India',
  blurb: `Project Engineer at C-DAC working on zero-trust security for IoT, with a
          research background in radio astronomy pipelines at NCRA-TIFR and GMRT.
          I build systems where the machine learning has to survive contact with
          real throughput, real latency budgets and real hardware.`,

  links: [
    ['Email', 'saptarshinag18@gmail.com', 'mailto:saptarshinag18@gmail.com'],
    ['LinkedIn', '/in/saptarshi18', 'https://www.linkedin.com/in/saptarshi18'],
    ['GitHub', 'Saptarshi-Nag189', 'https://github.com/Saptarshi-Nag189'],
  ],

  experience: [
    {
      org: 'C-DAC, Chennai',
      role: 'Project Engineer — AI Research & IoT Security',
      when: 'July 2025 — present',
      points: [
        'Built a real-time Zero-Trust framework for IoT across WiFi, BLE, Zigbee and LoRa.',
        'Two-stage detection (a per-window model and a per-flow model) reaching <b>97.93% accuracy</b> on high-throughput traffic.',
        'Optimised XGBoost/MLP inference to <b>under 1 ms per window</b>, so it can be deployed at the edge rather than in a datacentre.',
        'Engineered <b>63 features</b> from raw PCAPs with Scapy and PyShark; SHAP for explainability.',
        'Identity and transport hardening with SPIFFE/SPIRE, mTLS and OTP-based 2FA.',
        'SQL pipelines and live dashboards for monitoring.',
        'Co-authored two papers accepted at <b>IoTaIS 2025, Bali</b>.',
      ],
    },
    {
      org: 'NCRA-TIFR, Pune',
      role: 'Research Intern — pulsar detection',
      when: 'Aug 2024 — Apr 2025',
      points: [
        'ResNet1D with squeeze-and-excitation attention for pulsar candidate classification.',
        '<b>99.8% F1</b> across <b>70M+ samples</b> of folded candidate data.',
      ],
    },
    {
      org: 'GMRT (NCRA-TIFR), Pune',
      role: 'Winter Intern — signal processing',
      when: 'Dec 2023 — Jan 2024',
      points: [
        'Refactored the CPU filtering pipeline for multicore execution.',
        '<b>50% latency reduction</b> on the GMRT filtering stage.',
      ],
    },
  ],

  projects: [
    {
      name: 'Omniscience Pro',
      what: 'Privacy-first local RAG',
      points: [
        'LangChain + ChromaDB, containerised with Docker; nothing leaves the machine.',
        '<b>Under 50 ms</b> HNSW vector search and <b>under 500 ms</b> to first token.',
        'Citation-weighted ranking across local, web and academic sources.',
        'Hardened with path-traversal protection, rate limiting and POSIX file locking.',
      ],
    },
    {
      name: 'ARO — Autonomous Research Operator',
      what: 'Multi-agent LLM workflows',
      points: [
        'Agent workflows as NetworkX directed graphs, so execution order is data, not control flow.',
        'Flask + SSE + React front end; SQLAlchemy/SQLite for persistent agent memory.',
        'Self-audited: <b>16 vulnerabilities</b> found and fixed.',
      ],
    },
    {
      name: 'F1 tyre-degradation prediction',
      what: 'GPU-accelerated, physics-informed',
      points: [
        'Physics-informed loss that splits thermal from mechanical wear rather than fitting one blended curve.',
        'LSTM + XGBoost over <b>10 Hz</b> telemetry.',
        'Custom CUDA/CuPy kernels for a <b>4.1× speedup</b>.',
      ],
    },
    {
      name: 'Llama 3.2 optimisation',
      what: 'Fine-tuning and quantisation',
      points: [
        '1B and 3B variants fine-tuned on <b>21.5k interactions</b>.',
        '4-bit quantisation via Unsloth for single-GPU training and inference.',
      ],
    },
  ],

  education: [
    ['M.Tech, Computer Science & Engineering (AI)', 'DIAT (DRDO), Pune', '2023 — 2025', 'CGPA 8.64 / 10.0'],
    ['B.Tech, Computer Science & Engineering', 'Academy of Technology, Kolkata', '2019 — 2023', 'CGPA 9.44 / 10.0'],
  ],
  honours: [
    'GATE 2024, Data Science & AI — All India Rank <b>1790</b> (top 5%).',
    'Two papers accepted at IoTaIS 2025, Bali (C-DAC zero-trust IoT work).',
  ],

  skills: [
    ['Languages & tools', 'Python (advanced), C++ (proficient), SQL, Bash, Git, Docker, Linux, Flask, Streamlit'],
    ['Machine learning', 'PyTorch, TensorFlow, Keras, XGBoost, Scikit-learn, physics-informed neural networks'],
    ['LLM & retrieval', 'LangChain, ChromaDB, Ollama, Llama 3.2, Unsloth, Hugging Face, RAG'],
    ['Performance', 'CUDA, 4-bit and 8-bit quantisation, HPC, multicore pipeline optimisation'],
  ],
};

/* -------------------------------------------------------------------------- */

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Facts are authored above; only <b> is meaningful inside a point. */
const rich = (s) => esc(s).replace(/&lt;b&gt;/g, '<b>').replace(/&lt;\/b&gt;/g, '</b>');

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
    ${section('Honours', hon)}
    ${section('Skills', sk)}
    <footer class="lfoot">
      <p>This page is also an explorable world — close this panel to walk it.</p>
    </footer>`;
}

export { LEDGER };
