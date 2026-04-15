import { createDesktopScene } from './desktopScene.js';
import { createSystem } from './system.js';
import { formatDuration } from './utils.js';
import { createVfs } from './vfs.js';
import { createAboutApp } from './apps/aboutApp.js';
import { createDocumentApp } from './apps/documentApp.js';
import { createExperienceApp } from './apps/experienceApp.js';
import { createExplorerApp } from './apps/explorerApp.js';
import { createPdfApp } from './apps/pdfApp.js';
import { createProjectsApp } from './apps/projectsApp.js';
import { createTerminalApp } from './apps/terminalApp.js';

const mount = {
  bootScreen: document.getElementById('boot-screen'),
  bootLog: document.getElementById('boot-log'),
  bootKernelState: document.getElementById('boot-kernel-state'),
  bootServicesState: document.getElementById('boot-services-state'),
  bootUiState: document.getElementById('boot-ui-state'),
  bootProgressLabel: document.getElementById('boot-progress-label'),
  bootProgressBar: document.getElementById('boot-progress-bar'),
  osRoot: document.getElementById('os-root'),
  canvas: document.getElementById('desktop-scene'),
  windowLayer: document.getElementById('window-layer'),
  taskStrip: document.getElementById('task-strip'),
  desktopIcons: document.getElementById('desktop-icons'),
  focusedWindowLabel: document.getElementById('focused-window-label'),
  processCount: document.getElementById('process-count'),
  uptimeDisplay: document.getElementById('uptime-display'),
  systemClock: document.getElementById('system-clock'),
};

const vfs = createVfs();
const apps = {
  terminal: createTerminalApp,
  files: createExplorerApp,
  about: createAboutApp,
  projects: createProjectsApp,
  experience: createExperienceApp,
  document: createDocumentApp,
  pdf: createPdfApp,
};

const system = createSystem({ mount, vfs, apps });
let scene = null;

try {
  scene = createDesktopScene({ canvas: mount.canvas, bus: system.bus });
  system.attachScene(scene);
  document.body.dataset.scene = 'active';
} catch (error) {
  mount.canvas.dataset.renderMode = 'init-fallback';
  document.body.dataset.scene = 'fallback';
  console.warn('Desktop scene failed to initialise; continuing with the DOM runtime only.', error);
}

document.body.dataset.runtime = 'initialising';

function updateClock() {
  mount.systemClock.textContent = new Date().toLocaleTimeString('en-GB', {
    hour12: false,
  });
}

function updateMetrics() {
  mount.processCount.textContent = `${system.listProcesses().length} processes`;
  mount.uptimeDisplay.textContent = `uptime ${formatDuration(system.getUptime())}`;
}

function appendBootLine(line) {
  const stamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
  const row = document.createElement('div');
  row.className = 'boot-log__line';
  row.innerHTML = `<span class="boot-log__stamp">[${stamp}]</span><span>${line}</span>`;
  mount.bootLog.appendChild(row);
  mount.bootLog.scrollTop = mount.bootLog.scrollHeight;
  system.appendLog('/system/logs/boot.log', line);
}

async function runBootSequence() {
  const steps = [
    {
      label: 'firmware self-test complete',
      progress: 14,
      apply() {
        mount.bootKernelState.textContent = 'loading scheduler';
      },
    },
    {
      label: 'kernel scheduler online',
      progress: 28,
      apply() {
        system.registerService('kerneld', 'kerneld');
        mount.bootKernelState.textContent = 'online';
      },
    },
    {
      label: 'vfs mounted at /home/saptarshi',
      progress: 46,
      apply() {
        system.registerService('vfsd', 'vfsd');
        mount.bootServicesState.textContent = 'mounting';
      },
    },
    {
      label: 'compositor linked with perspective desktop scene',
      progress: 64,
      apply() {
        system.registerService('compositor', 'compositor');
        mount.bootServicesState.textContent = 'online';
      },
    },
    {
      label: 'launchd indexed applications and aliases',
      progress: 82,
      apply() {
        system.registerService('launchd', 'launchd');
        mount.bootUiState.textContent = 'loading';
      },
    },
    {
      label: 'sessiond prepared interactive workspace',
      progress: 100,
      apply() {
        system.registerService('sessiond', 'sessiond');
        mount.bootUiState.textContent = 'ready';
      },
    },
  ];

  for (const step of steps) {
    mount.bootProgressLabel.textContent = step.label;
    mount.bootProgressBar.style.width = `${step.progress}%`;
    step.apply();
    appendBootLine(step.label);
    await new Promise((resolve) => window.setTimeout(resolve, 260));
  }
}

function bindDesktopIcons() {
  mount.desktopIcons.querySelectorAll('[data-open]').forEach((button) => {
    const launch = async () => {
      await system.openTarget(button.dataset.open);
    };

    button.addEventListener('click', launch);
    button.addEventListener('keydown', async (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        await launch();
      }
    });
  });
}

function bindStatusObservers() {
  updateClock();
  updateMetrics();
  window.setInterval(updateClock, 1000);
  window.setInterval(updateMetrics, 1000);

  system.bus.addEventListener('process:updated', updateMetrics);
  system.bus.addEventListener('window:focused', (event) => {
    mount.focusedWindowLabel.textContent = event.detail.meta.title;
  });
  system.bus.addEventListener('window:closed', (event) => {
    mount.focusedWindowLabel.textContent = event.detail.focusedId ? mount.focusedWindowLabel.textContent : 'desktop idle';
  });
}

async function boot() {
  document.body.dataset.runtime = 'booting';
  bindDesktopIcons();
  bindStatusObservers();
  await runBootSequence();
  mount.focusedWindowLabel.textContent = 'boot complete';
  system.markBootComplete();
  system.startBackgroundServices();
  mount.osRoot.classList.remove('is-hidden');
  requestAnimationFrame(() => {
    mount.osRoot.classList.add('is-ready');
    mount.bootScreen.classList.add('is-fading');
  });

  await system.launchApp('terminal');
  document.body.dataset.runtime = 'ready';
}

boot().catch((error) => {
  document.body.dataset.runtime = 'fault';
  mount.bootUiState.textContent = 'fault';
  mount.bootProgressLabel.textContent = 'boot failed';
  appendBootLine(`boot failure: ${error.message}`);
  console.error(error);
});
