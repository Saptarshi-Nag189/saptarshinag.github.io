const file = (name, content) => ({
  type: 'file',
  name,
  content,
});

const directory = (name, children) => ({
  type: 'directory',
  name,
  children,
});

export const vfsTemplate = directory('/', [
  directory('system', [
    directory('logs', [
      file('boot.log', ''),
      file('services.log', ''),
    ]),
  ]),
  directory('home', [
    directory('saptarshi', [
      file(
        'about.txt',
        `AI/ML engineer with an M.Tech in Artificial Intelligence (DIAT, DRDO) and research
experience at NCRA-TIFR and GMRT. Works across the full stack of an ML project:
feature engineering from raw data, model development and optimisation, and production
deployment under tight performance constraints. Current work at C-DAC focuses on
real-time IoT security using a Zero Trust framework with ML-based threat detection
across multiple wireless protocols. Past projects span physics-informed neural networks,
GPU-accelerated scientific computing, LLM fine-tuning, and RAG systems.`,
      ),
      file(
        'contact.txt',
        `Email: saptarshinag18@gmail.com
LinkedIn: /in/saptarshi18
GitHub: Saptarshi-Nag189
Open to research collaborations, engineering roles, and interesting problems.`,
      ),
      directory('media', [
        file('profile.jpg', 'asset:./assets/profile/sapta_image.jpeg'),
      ]),
      directory('documents', [
        file('cv.pdf', 'asset:./assets/docs/saptarshi_resume_linkedin_2026.pdf'),
      ]),
      directory('experience', [
        directory('cdac', [
          file('organisation.txt', 'C-DAC (Centre for Development of Advanced Computing)'),
          file('role.txt', 'Project Engineer -- AI Research & IoT Security'),
          file('dates.txt', 'July 2025 -- Present'),
          file('location.txt', 'Chennai, India'),
          file(
            'details.txt',
            `Built a real-time Zero Trust security framework for IoT networks covering WiFi (802.11), BLE, Zigbee, and LoRa; ML-based attack detection feeds a continuous 7-pillar device trust score engine.
Two-stage hybrid detection pipeline: window model (1-second sliding windows, 7 attack classes) + flow model for longer-duration patterns. Compared RF, XGBoost, SVM, MLP, and Voting Ensemble across 6 preprocessing iterations with SMOTE and Optuna (TPE) hyperparameter search.
Best results: 96.97% accuracy (flow/RF); 90.86% accuracy / 86.78% macro F1 (window/Voting Ensemble).
Engineered 63 statistical and behavioural features from raw PCAPs using Scapy and PyShark (MAC entropy, frame rate statistics, sequence gap analysis, EAPOL key MIC ratios, beacon timestamp variance).
Live PCAP drop-folder pipeline via Watchdog: MD5 deduplication, multi-threaded extraction, batch inference, per-resource thread-safe locking.
Integrated SPIFFE/SPIRE workload identity, mTLS, OTP-based 2FA.
Co-authored two papers published at IoTaIS 2025.`,
          ),
        ]),
        directory('ncra-tifr', [
          file('organisation.txt', 'National Centre for Radio Astrophysics (NCRA-TIFR)'),
          file('role.txt', 'Research Intern (M.Tech Project)'),
          file('dates.txt', 'Aug 2024 -- Apr 2025'),
          file('location.txt', 'Pune, India'),
          file(
            'details.txt',
            `Designed a ResNet1D architecture with Squeeze-and-Excitation attention for weak pulsar signal detection in noisy astrophysical data at low SNR.
Achieved 99.8% F1-score across 70M+ samples; built adaptive thresholding for non-stationary noise floors across observation sessions.
Ran the project end-to-end independently: scoping through deployment and write-up.`,
          ),
        ]),
        directory('gmrt', [
          file('organisation.txt', 'Giant Metrewave Radio Telescope (GMRT-NCRA-TIFR)'),
          file('role.txt', 'Winter Intern -- HPC & Signal Processing Optimisation'),
          file('dates.txt', 'Dec 2023 -- Jan 2024'),
          file('location.txt', 'Pune, India'),
          file(
            'details.txt',
            `Profiled legacy CPU signal filtering pipelines, refactored for multicore execution.
Cut latency by 50%, unblocking real-time processing of continuous telescope data streams.`,
          ),
        ]),
      ]),
      directory('projects', [
        directory('f1-tyre-degradation', [
          file('title.txt', 'GPU-Accelerated F1 Tyre Degradation & Race Strategy'),
          file(
            'stack.txt',
            `Python
PyTorch
CUDA
CuPy
XGBoost`,
          ),
          file(
            'details.txt',
            `Hybrid LSTM-XGBoost architecture for tyre wear modelling and pit-stop window prediction from 10 Hz telemetry.
Physics-Informed Loss Functions (PINNs) separating thermal and mechanical degradation; enforces physical constraints pure data-driven models cannot capture.
Custom CUDA/CuPy kernels for dense matrix operations; 4.1x training speedup.`,
          ),
        ]),
        directory('omniscience-pro', [
          file('title.txt', 'Omniscience Pro -- Privacy-First Local RAG System'),
          file(
            'stack.txt',
            `Python
LangChain
ChromaDB
Docker`,
          ),
          file(
            'details.txt',
            `Local, privacy-first RAG supporting multi-modal document ingestion.
<50 ms vector search (HNSW index); <500 ms first-token latency on consumer hardware.
GPU-aware Docker with full CI/CD pipeline; POSIX file locking for concurrent access.`,
          ),
        ]),
        directory('aro', [
          file('title.txt', 'ARO -- Autonomous Research Operator (Multi-Agent LLM Platform)'),
          file(
            'stack.txt',
            `Python
Flask
SQLAlchemy
NetworkX
React`,
          ),
          file(
            'details.txt',
            `Multi-agent LLM workflows as directed graphs (NetworkX); Flask backend streaming via Server-Sent Events; React frontend for interactive output.
Full adversarial audit post-build: found and fixed 16 vulnerabilities across auth, SSRF, input validation, and CORS. SQLAlchemy-backed audit trails.`,
          ),
        ]),
        directory('llama-3-2-optimisation', [
          file('title.txt', 'Llama 3.2 Optimisation for Efficient Inference'),
          file(
            'stack.txt',
            `Python
Unsloth
Hugging Face
PyTorch`,
          ),
          file(
            'details.txt',
            `Fine-tuned Llama 3.2 (1B and 3B) on 21.5k domain-specific interactions for specialised task following and agentic use cases.
4-bit quantisation via Unsloth for consumer GPU deployment; no meaningful quality drop vs full-precision baselines.`,
          ),
        ]),
      ]),
      directory('publications', [
        directory('protocol-aware-continuous-monitoring', [
          file('title.txt', 'Protocol-Aware Continuous Monitoring and Anomaly Detection in IoT Networks'),
          file('venue.txt', 'IoTaIS 2025, Bali, Indonesia'),
        ]),
        directory('zero-trust-survey', [
          file('title.txt', 'A Comprehensive Survey on Zero Trust Architecture in IoT Networks'),
          file('venue.txt', 'IoTaIS 2025, Bali, Indonesia'),
        ]),
      ]),
      directory('education', [
        directory('mtech-diat', [
          file('degree.txt', 'M.Tech'),
          file('field.txt', 'Computer Science & Engineering (Artificial Intelligence)'),
          file('institution.txt', 'Defence Institute of Advanced Technology (DIAT), DRDO'),
          file('location.txt', 'Pune, India'),
          file('years.txt', '2023 -- 2025'),
          file('score.txt', 'CGPA: 8.64/10.0'),
          file('badge.txt', ''),
        ]),
        directory('btech-aot', [
          file('degree.txt', 'B.Tech'),
          file('field.txt', 'Computer Science & Engineering'),
          file('institution.txt', 'Academy of Technology'),
          file('location.txt', 'Kolkata, India'),
          file('years.txt', '2019 -- 2023'),
          file('score.txt', 'CGPA: 9.44/10.0'),
          file('badge.txt', 'GATE 2024 Qualified -- Rank 1790 in Data Science & AI (Top 5%)'),
        ]),
      ]),
      directory('skills', [
        file(
          'languages.txt',
          `Python (advanced)
C++ (proficient)
C
Bash
SQL`,
        ),
        file(
          'ml-scientific-computing.txt',
          `PyTorch
XGBoost
Scikit-learn
PINNs
NumPy
SciPy`,
        ),
        file(
          'hpc-systems.txt',
          `CUDA
CuPy
Parallel Processing
Model Quantisation (4-bit/8-bit)
Latency Optimisation
Linux`,
        ),
        file(
          'data-engineering.txt',
          `Statistical Anomaly Detection
Time-Series Analysis
CI/CD
Docker
Git
Flask
ChromaDB`,
        ),
        file(
          'ai-mlops.txt',
          `RAG Systems
LLM Fine-Tuning
Multi-Agent Orchestration (NetworkX, LangChain)
SQLAlchemy`,
        ),
      ]),
    ]),
  ]),
]);

function cloneNode(node) {
  if (node.type === 'file') {
    return {
      type: 'file',
      name: node.name,
      content: node.content,
    };
  }

  return {
    type: 'directory',
    name: node.name,
    children: node.children.map(cloneNode),
  };
}

export function isDirectory(node) {
  return Boolean(node && node.type === 'directory');
}

export function getParentPath(path) {
  const normalised = normalisePath(path);
  if (normalised === '/') {
    return '/';
  }

  const parts = normalised.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? `/${parts.join('/')}` : '/';
}

export function normalisePath(inputPath = '/', cwd = '/home/saptarshi') {
  const raw = String(inputPath || '').trim();

  if (!raw || raw === '.') {
    return cwd;
  }

  const workingPath = raw === '~'
    ? '/home/saptarshi'
    : raw.startsWith('~/')
      ? `/home/saptarshi/${raw.slice(2)}`
      : raw.startsWith('/')
        ? raw
        : `${cwd.replace(/\/$/, '')}/${raw}`;

  const stack = [];

  workingPath.split('/').forEach((part) => {
    if (!part || part === '.') {
      return;
    }

    if (part === '..') {
      stack.pop();
      return;
    }

    stack.push(part);
  });

  return stack.length ? `/${stack.join('/')}` : '/';
}

export function resolvePath(root, targetPath = '/', cwd = '/home/saptarshi') {
  const absolutePath = normalisePath(targetPath, cwd);

  if (absolutePath === '/') {
    return {
      node: root,
      path: '/',
    };
  }

  const parts = absolutePath.split('/').filter(Boolean);
  let current = root;

  for (const part of parts) {
    if (!isDirectory(current)) {
      return null;
    }

    const next = current.children.find((child) => child.name === part);

    if (!next) {
      return null;
    }

    current = next;
  }

  return {
    node: current,
    path: absolutePath,
  };
}

export function listDirectory(root, targetPath = '/', cwd = '/home/saptarshi') {
  const resolved = resolvePath(root, targetPath, cwd);

  if (!resolved) {
    throw new Error(`Path not found: ${targetPath}`);
  }

  if (!isDirectory(resolved.node)) {
    throw new Error(`Not a directory: ${resolved.path}`);
  }

  return resolved.node.children.map((child) => ({ ...child }));
}

export function readFile(root, targetPath, cwd = '/home/saptarshi') {
  const resolved = resolvePath(root, targetPath, cwd);

  if (!resolved) {
    throw new Error(`Path not found: ${targetPath}`);
  }

  if (resolved.node.type !== 'file') {
    throw new Error(`Not a file: ${resolved.path}`);
  }

  return resolved.node.content;
}

export function writeFile(root, targetPath, content, cwd = '/home/saptarshi') {
  const resolved = resolvePath(root, targetPath, cwd);

  if (!resolved || resolved.node.type !== 'file') {
    throw new Error(`Not a file: ${targetPath}`);
  }

  resolved.node.content = String(content);
  return resolved.node.content;
}

export function appendFile(root, targetPath, content, cwd = '/home/saptarshi') {
  const existing = readFile(root, targetPath, cwd);
  const nextContent = existing ? `${existing}\n${content}` : String(content);
  writeFile(root, targetPath, nextContent, cwd);
  return nextContent;
}

export function createVfs() {
  const root = cloneNode(vfsTemplate);

  return {
    root,
    normalisePath: (path, cwd) => normalisePath(path, cwd),
    getParentPath,
    resolvePath: (path, cwd) => resolvePath(root, path, cwd),
    listDirectory: (path, cwd) => listDirectory(root, path, cwd),
    readFile: (path, cwd) => readFile(root, path, cwd),
    writeFile: (path, content, cwd) => writeFile(root, path, content, cwd),
    appendFile: (path, content, cwd) => appendFile(root, path, content, cwd),
    isDirectory,
  };
}
