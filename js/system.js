import { fileExtension, formatDuration, titleFromId } from './utils.js';
import { createWindowManager } from './windowManager.js';

const HOME_PATH = '/home/saptarshi';
const CV_PATH = '/home/saptarshi/documents/cv.pdf';

function delay(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function cloneProcess(process) {
  return {
    ...process,
    startedAt: process.startedAt,
  };
}

export function createSystem({ mount, vfs, apps, scene = null }) {
  const bus = new EventTarget();
  const windowManager = createWindowManager({
    layer: mount.windowLayer,
    taskStrip: mount.taskStrip,
    bus,
  });

  let pidCounter = 99;
  let bootCompletedAt = null;
  let sceneRef = scene;
  let backgroundTimers = [];

  const processes = new Map();
  const servicePids = new Map();
  const aliases = {
    terminal: { appId: 'terminal' },
    files: { appId: 'files' },
    about: { appId: 'about' },
    projects: { appId: 'projects' },
    experience: { appId: 'experience' },
    cv: { appId: 'pdf', payload: { path: CV_PATH } },
  };

  function emit(type, detail) {
    bus.dispatchEvent(new CustomEvent(type, { detail }));
  }

  function listProcesses() {
    return Array.from(processes.values())
      .map((process) => ({
        ...cloneProcess(process),
        uptimeMs: performance.now() - process.startedAt,
      }))
      .sort((left, right) => left.pid - right.pid);
  }

  function updateProcessSnapshot() {
    emit('process:updated', {
      processes: listProcesses(),
    });
  }

  function createProcess(name, kind, patch = {}) {
    const pid = ++pidCounter;
    const process = {
      pid,
      name,
      kind,
      state: 'starting',
      startedAt: performance.now(),
      windowId: null,
      ...patch,
    };
    processes.set(pid, process);
    updateProcessSnapshot();
    return process;
  }

  function patchProcess(pid, patch) {
    const process = processes.get(pid);

    if (!process) {
      return null;
    }

    Object.assign(process, patch);
    updateProcessSnapshot();
    return process;
  }

  function removeProcess(pid) {
    if (processes.delete(pid)) {
      updateProcessSnapshot();
    }
  }

  function appendLog(path, message) {
    const timestamp = new Date().toLocaleTimeString('en-GB', { hour12: false });
    const line = `[${timestamp}] ${message}`;
    vfs.appendFile(path, line);
    emit('log:append', { path, line });
    return line;
  }

  function getUptime() {
    if (!bootCompletedAt) {
      return 0;
    }

    return performance.now() - bootCompletedAt;
  }

  function markBootComplete() {
    bootCompletedAt = performance.now();
    emit('system:booted', { uptime: getUptime() });
  }

  function registerService(serviceName, displayName = serviceName) {
    if (servicePids.has(serviceName)) {
      return servicePids.get(serviceName);
    }

    const process = createProcess(displayName, 'service', {
      state: 'running',
      serviceName,
    });
    servicePids.set(serviceName, process.pid);
    appendLog('/system/logs/services.log', `${serviceName} online with pid ${process.pid}`);
    return process.pid;
  }

  function startBackgroundServices() {
    if (backgroundTimers.length) {
      return;
    }

    const messages = [
      {
        service: 'telemetryd',
        interval: 14000,
        buildMessage: () => `telemetryd sampled process table (${listProcesses().length} processes visible)`,
      },
      {
        service: 'indexerd',
        interval: 18000,
        buildMessage: () => `indexerd verified ${vfs.listDirectory(HOME_PATH).length} home entries`,
      },
      {
        service: 'watchd',
        interval: 22000,
        buildMessage: () => `watchd heartbeat ok, uptime ${formatDuration(getUptime())}`,
      },
    ];

    messages.forEach(({ service, interval, buildMessage }) => {
      registerService(service, service);
      const timer = window.setInterval(() => {
        appendLog('/system/logs/services.log', buildMessage());
      }, interval);
      backgroundTimers.push(timer);
    });
  }

  function stopBackgroundServices() {
    backgroundTimers.forEach((timer) => window.clearInterval(timer));
    backgroundTimers = [];
  }

  function attachScene(nextScene) {
    sceneRef = nextScene;
  }

  function chooseWindowPosition() {
    const openWindows = windowManager.listWindows();
    return {
      x: 120 + (openWindows.length % 5) * 28,
      y: 84 + (openWindows.length % 5) * 26,
    };
  }

  function getAppName(appId) {
    if (appId === 'files') {
      return 'Explorer';
    }

    if (appId === 'pdf') {
      return 'PDF Viewer';
    }

    return titleFromId(appId);
  }

  async function launchApp(appId, payload = {}) {
    const factory = apps[appId];

    if (!factory) {
      throw new Error(`Unknown app: ${appId}`);
    }

    const process = createProcess(getAppName(appId), 'app', {
      appId,
      payloadPath: payload.path || null,
    });

    appendLog('/system/logs/services.log', `launchd received request for ${appId} (pid ${process.pid})`);
    await delay(160 + Math.floor(Math.random() * 260));

    const descriptor = await factory({
      system: api,
      vfs,
      payload,
      pid: process.pid,
      bus,
    });

    const size = descriptor.size || { w: 720, h: 460 };
    const record = windowManager.createWindow({
      appId,
      processId: process.pid,
      payloadPath: payload.path || null,
      title: descriptor.title || getAppName(appId),
      icon: descriptor.icon || appId.slice(0, 2).toUpperCase(),
      size,
      minSize: descriptor.minSize,
      position: descriptor.position || chooseWindowPosition(),
      instance: descriptor,
    });

    patchProcess(process.pid, {
      state: 'running',
      windowId: record.id,
      name: descriptor.processName || descriptor.title || getAppName(appId),
    });

    appendLog('/system/logs/services.log', `launchd attached ${record.id} to pid ${process.pid}`);
    emit('app:launched', {
      appId,
      pid: process.pid,
      windowId: record.id,
    });

    if (sceneRef?.notifyAppLaunch) {
      sceneRef.notifyAppLaunch(record.id);
    }

    return {
      pid: process.pid,
      windowId: record.id,
    };
  }

  function closeApp(windowId) {
    windowManager.closeWindow(windowId);
  }

  function focusWindow(windowId) {
    return windowManager.focusWindow(windowId);
  }

  function focusNextWindow() {
    return windowManager.focusNextWindow();
  }

  function resetWindowCycle() {
    return windowManager.resetFocusCycle();
  }

  function getFocusedWindow() {
    return windowManager.getFocusedWindow();
  }

  function closeFocusedWindow() {
    const focusedWindow = getFocusedWindow();

    if (!focusedWindow) {
      return null;
    }

    closeApp(focusedWindow.id);
    return focusedWindow;
  }

  function minimiseWindow(windowId) {
    return windowManager.minimiseWindow(windowId);
  }

  function maximiseWindow(windowId) {
    return windowManager.maximiseWindow(windowId);
  }

  function restoreWindow(windowId) {
    return windowManager.restoreWindow(windowId);
  }

  async function openPath(path, cwd) {
    const resolved = vfs.resolvePath(path, cwd);

    if (!resolved) {
      throw new Error(`Path not found: ${path}`);
    }

    const absolutePath = resolved.path;
    const { node } = resolved;

    if (node.type === 'directory') {
      if (absolutePath === `${HOME_PATH}/projects` || absolutePath.startsWith(`${HOME_PATH}/projects/`)) {
        const handle = await launchApp('projects', { path: absolutePath });
        return {
          ...handle,
          message: `Opened projects at ${absolutePath}`,
        };
      }

      if (absolutePath === `${HOME_PATH}/experience` || absolutePath.startsWith(`${HOME_PATH}/experience/`)) {
        const handle = await launchApp('experience', { path: absolutePath });
        return {
          ...handle,
          message: `Opened experience at ${absolutePath}`,
        };
      }

      if (absolutePath.startsWith(`${HOME_PATH}/publications/`) || absolutePath.startsWith(`${HOME_PATH}/education/`)) {
        const handle = await launchApp('document', { path: absolutePath });
        return {
          ...handle,
          message: `Opened ${absolutePath}`,
        };
      }

      const handle = await launchApp('files', { path: absolutePath });
      return {
        ...handle,
        message: `Opened explorer at ${absolutePath}`,
      };
    }

    const extension = fileExtension(absolutePath);

    if (extension === '.txt') {
      const handle = await launchApp('document', { path: absolutePath });
      return {
        ...handle,
        message: `Opened ${absolutePath}`,
      };
    }

    if (extension === '.pdf') {
      const handle = await launchApp('pdf', { path: absolutePath });
      return {
        ...handle,
        message: `Opened ${absolutePath}`,
      };
    }

    throw new Error(`Unsupported file type: ${absolutePath}`);
  }

  async function openTarget(target, cwd = HOME_PATH) {
    const alias = aliases[target];

    if (alias) {
      const handle = await launchApp(alias.appId, alias.payload || {});
      return {
        ...handle,
        message: `Opened ${target}`,
      };
    }

    return openPath(target, cwd);
  }

  function listAppAliases() {
    return Object.keys(aliases);
  }

  bus.addEventListener('window:closed', (event) => {
    const processId = event.detail.meta.processId;

    if (processId) {
      appendLog('/system/logs/services.log', `launchd closed ${event.detail.record.id} (pid ${processId})`);
      removeProcess(processId);
    }
  });

  const api = {
    bus,
    scene: sceneRef,
    attachScene,
    launchApp,
    closeApp,
    focusWindow,
    focusNextWindow,
    resetWindowCycle,
    getFocusedWindow,
    closeFocusedWindow,
    minimiseWindow,
    maximiseWindow,
    restoreWindow,
    openTarget,
    listAppAliases,
    listProcesses,
    getUptime,
    registerService,
    appendLog,
    markBootComplete,
    startBackgroundServices,
    stopBackgroundServices,
  };

  return api;
}
