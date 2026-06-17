import { clamp, createElement } from './utils.js';

const RESIZE_DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
const DEFAULT_MIN_SIZE = { w: 320, h: 220 };

function cloneRecord(record) {
  return {
    id: record.id,
    appId: record.appId,
    position: { ...record.position },
    size: { ...record.size },
    state: record.state,
    zIndex: record.zIndex,
    isFocused: record.isFocused,
  };
}

function cloneMeta(meta) {
  return {
    processId: meta.processId,
    payloadPath: meta.payloadPath,
    title: meta.title,
    icon: meta.icon,
  };
}

export function createWindowManager({
  layer,
  taskStrip,
  bus,
  getViewportRect = () => layer.getBoundingClientRect(),
}) {
  const records = new Map();
  const metadata = new Map();
  let focusedId = null;
  let windowCounter = 0;
  let topZ = 30;
  let focusCycleOrder = [];
  let focusCycleIndex = -1;

  function resetFocusCycle() {
    focusCycleOrder = [];
    focusCycleIndex = -1;
  }

  function emit(type, record, meta) {
    bus.dispatchEvent(new CustomEvent(type, {
      detail: {
        record: cloneRecord(record),
        meta: cloneMeta(meta),
        windows: listWindows(),
        focusedId,
      },
    }));
  }

  function listWindows() {
    return Array.from(records.values())
      .sort((left, right) => left.zIndex - right.zIndex)
      .map(cloneRecord);
  }

  function getBoundsForMaximisedWindow() {
    const viewport = getViewportRect();
    return {
      position: { x: 10, y: 10 },
      size: {
        w: Math.max(320, Math.floor(viewport.width - 20)),
        h: Math.max(220, Math.floor(viewport.height - 20)),
      },
    };
  }

  function syncTaskButton(record, meta) {
    const button = meta.taskButton;
    if (!button) {
      return;
    }

    button.textContent = meta.title;
    button.classList.toggle('is-focused', record.isFocused);
    button.classList.toggle('is-minimised', record.state === 'minimised');
    button.title = meta.title;
  }

  function syncWindow(record, meta) {
    const element = meta.element;
    element.dataset.state = record.state;
    element.style.setProperty('--window-x', `${record.position.x}px`);
    element.style.setProperty('--window-y', `${record.position.y}px`);
    element.style.setProperty('--window-w', `${record.size.w}px`);
    element.style.setProperty('--window-h', `${record.size.h}px`);
    element.style.zIndex = String(record.zIndex);
    element.classList.toggle('is-focused', record.isFocused);
    syncTaskButton(record, meta);
  }

  function getNextFocusableWindow(excludedId) {
    return Array.from(records.values())
      .filter((record) => record.id !== excludedId && record.state !== 'minimised')
      .sort((left, right) => right.zIndex - left.zIndex)[0] || null;
  }

  function focusWindow(id, { emitEvent = true, preserveCycle = false } = {}) {
    const target = records.get(id);

    if (!target || target.state === 'minimised') {
      return null;
    }

    if (!preserveCycle) {
      resetFocusCycle();
    }

    records.forEach((record, recordId) => {
      const meta = metadata.get(recordId);
      record.isFocused = recordId === id;

      if (recordId === id) {
        record.zIndex = ++topZ;
      }

      syncWindow(record, meta);
    });

    focusedId = id;

    if (emitEvent) {
      emit('window:focused', target, metadata.get(id));
    }

    metadata.get(id).instance?.onFocus?.(cloneRecord(target));
    return cloneRecord(target);
  }

  function getFocusedWindow() {
    return focusedId ? cloneRecord(records.get(focusedId)) : null;
  }

  function focusNextWindow() {
    const focusable = Array.from(records.values())
      .filter((record) => record.state !== 'minimised')
      .sort((left, right) => right.zIndex - left.zIndex);

    if (!focusable.length) {
      return null;
    }

    const orderIds = focusable.map((record) => record.id);
    const sameOrder = focusCycleOrder.length === orderIds.length
      && focusCycleOrder.every((id) => orderIds.includes(id));

    if (!sameOrder) {
      focusCycleOrder = orderIds;
      focusCycleIndex = focusedId ? Math.max(orderIds.indexOf(focusedId), 0) : -1;
    }

    const nextIndex = (focusCycleIndex + 1) % focusCycleOrder.length;
    focusCycleIndex = nextIndex;
    return focusWindow(focusCycleOrder[nextIndex], { preserveCycle: true });
  }

  function notifyUpdate(id, eventName = 'window:updated') {
    const record = records.get(id);
    const meta = metadata.get(id);

    if (!record || !meta) {
      return;
    }

    syncWindow(record, meta);
    meta.instance?.onResize?.(cloneRecord(record));
    emit(eventName, record, meta);
  }

  function applyMaximisedBounds(record) {
    const bounds = getBoundsForMaximisedWindow();
    record.position = bounds.position;
    record.size = bounds.size;
  }

  function minimiseWindow(id) {
    const record = records.get(id);
    const meta = metadata.get(id);

    if (!record || record.state === 'minimised') {
      return null;
    }

    meta.preMinimiseState = record.state;
    record.state = 'minimised';
    record.isFocused = false;
    syncWindow(record, meta);

    const nextWindow = getNextFocusableWindow(id);
    focusedId = nextWindow ? nextWindow.id : null;

    if (nextWindow) {
      focusWindow(nextWindow.id);
    }

    emit('window:minimised', record, meta);
    return cloneRecord(record);
  }

  function maximiseWindow(id) {
    const record = records.get(id);
    const meta = metadata.get(id);

    if (!record) {
      return null;
    }

    if (record.state === 'minimised') {
      restoreWindow(id);
    }

    if (record.state !== 'maximised') {
      meta.previousBounds = {
        position: { ...record.position },
        size: { ...record.size },
      };
    }

    record.state = 'maximised';
    applyMaximisedBounds(record);
    focusWindow(id, { emitEvent: false });
    notifyUpdate(id, 'window:maximised');
    return cloneRecord(record);
  }

  function restoreWindow(id) {
    const record = records.get(id);
    const meta = metadata.get(id);

    if (!record) {
      return null;
    }

    if (record.state === 'minimised') {
      const stateBeforeMinimise = meta.preMinimiseState || 'normal';
      record.state = stateBeforeMinimise;

      if (stateBeforeMinimise === 'maximised') {
        applyMaximisedBounds(record);
      }

      focusWindow(id, { emitEvent: false });
      notifyUpdate(id, 'window:restored');
      return cloneRecord(record);
    }

    if (record.state === 'maximised') {
      record.state = 'normal';

      if (meta.previousBounds) {
        record.position = { ...meta.previousBounds.position };
        record.size = { ...meta.previousBounds.size };
      }

      focusWindow(id, { emitEvent: false });
      notifyUpdate(id, 'window:restored');
      return cloneRecord(record);
    }

    focusWindow(id, { emitEvent: false });
    notifyUpdate(id, 'window:restored');
    return cloneRecord(record);
  }

  function closeWindow(id) {
    const record = records.get(id);
    const meta = metadata.get(id);

    if (!record || !meta) {
      return null;
    }

    meta.instance?.destroy?.();
    meta.element.remove();
    meta.taskButton.remove();
    records.delete(id);
    metadata.delete(id);

    if (focusedId === id) {
      const nextWindow = getNextFocusableWindow(id);
      focusedId = nextWindow ? nextWindow.id : null;

      if (nextWindow) {
        focusWindow(nextWindow.id);
      }
    }

    bus.dispatchEvent(new CustomEvent('window:closed', {
      detail: {
        record: cloneRecord(record),
        meta: cloneMeta(meta),
        windows: listWindows(),
        focusedId,
      },
    }));

    return cloneRecord(record);
  }

  function updateTitle(id, title) {
    const meta = metadata.get(id);
    const record = records.get(id);

    if (!meta || !record) {
      return;
    }

    meta.title = title;
    meta.titleElement.textContent = title;
    syncTaskButton(record, meta);
    emit('window:updated', record, meta);
  }

  function attachWindowInteractions(record, meta) {
    const element = meta.element;
    const titlebar = meta.titlebar;
    const controlButtons = [
      meta.minimiseButton,
      meta.maximiseButton,
      meta.closeButton,
    ];

    element.addEventListener('pointerdown', () => {
      focusWindow(record.id);
    });

    titlebar.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || event.target.closest('[data-window-control]')) {
        return;
      }

      if (record.state !== 'normal') {
        return;
      }

      event.preventDefault();
      focusWindow(record.id);

      const viewport = getViewportRect();
      const start = {
        x: event.clientX,
        y: event.clientY,
        left: record.position.x,
        top: record.position.y,
      };

      function onMove(moveEvent) {
        const nextX = clamp(
          start.left + (moveEvent.clientX - start.x),
          0,
          Math.max(0, viewport.width - record.size.w),
        );
        const nextY = clamp(
          start.top + (moveEvent.clientY - start.y),
          0,
          Math.max(0, viewport.height - record.size.h),
        );

        record.position = {
          x: nextX,
          y: nextY,
        };

        notifyUpdate(record.id);
      }

      function onUp() {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      }

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    meta.resizeHandles.forEach((handle) => {
      handle.addEventListener('pointerdown', (event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        focusWindow(record.id);

        if (record.state !== 'normal') {
          return;
        }

        const direction = handle.dataset.direction;
        const viewport = getViewportRect();
        const minSize = meta.minSize || DEFAULT_MIN_SIZE;
        const start = {
          x: event.clientX,
          y: event.clientY,
          left: record.position.x,
          top: record.position.y,
          width: record.size.w,
          height: record.size.h,
        };

        function onMove(moveEvent) {
          const dx = moveEvent.clientX - start.x;
          const dy = moveEvent.clientY - start.y;
          let nextLeft = start.left;
          let nextTop = start.top;
          let nextWidth = start.width;
          let nextHeight = start.height;

          if (direction.includes('e')) {
            nextWidth = clamp(start.width + dx, minSize.w, viewport.width - start.left);
          }

          if (direction.includes('s')) {
            nextHeight = clamp(start.height + dy, minSize.h, viewport.height - start.top);
          }

          if (direction.includes('w')) {
            nextLeft = clamp(start.left + dx, 0, start.left + start.width - minSize.w);
            nextWidth = clamp(start.width - dx, minSize.w, viewport.width - nextLeft);
          }

          if (direction.includes('n')) {
            nextTop = clamp(start.top + dy, 0, start.top + start.height - minSize.h);
            nextHeight = clamp(start.height - dy, minSize.h, viewport.height - nextTop);
          }

          record.position = { x: nextLeft, y: nextTop };
          record.size = { w: nextWidth, h: nextHeight };
          notifyUpdate(record.id);
        }

        function onUp() {
          window.removeEventListener('pointermove', onMove);
          window.removeEventListener('pointerup', onUp);
        }

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
      });
    });

    controlButtons.forEach((button) => {
      button.addEventListener('pointerdown', (event) => {
        event.stopPropagation();
      });
    });

    meta.minimiseButton.addEventListener('click', () => minimiseWindow(record.id));
    meta.maximiseButton.addEventListener('click', () => {
      if (record.state === 'maximised') {
        restoreWindow(record.id);
      } else {
        maximiseWindow(record.id);
      }
    });
    meta.closeButton.addEventListener('click', () => closeWindow(record.id));
    meta.taskButton.addEventListener('click', () => {
      if (record.state === 'minimised') {
        restoreWindow(record.id);
      } else {
        focusWindow(record.id);
      }
    });
  }

  function createWindow(options) {
    const id = options.id || `window-${++windowCounter}`;
    const viewport = getViewportRect();
    const position = options.position || {
      x: clamp(90 + records.size * 24, 32, Math.max(32, viewport.width - options.size.w - 32)),
      y: clamp(70 + records.size * 24, 32, Math.max(32, viewport.height - options.size.h - 32)),
    };
    const record = {
      id,
      appId: options.appId,
      position: { ...position },
      size: { ...options.size },
      state: 'normal',
      zIndex: ++topZ,
      isFocused: false,
    };

    const taskButton = createElement('button', {
      className: 'task-strip__button',
      text: options.title,
      attrs: { type: 'button' },
    });

    const titleElement = createElement('span', {
      className: 'window__title-text',
      text: options.title,
    });

    const titlebar = createElement('div', {
      className: 'window__titlebar',
      children: [
        createElement('div', {
          className: 'window__title',
          children: [
            createElement('span', { className: 'window__icon', text: options.icon }),
            titleElement,
          ],
        }),
      ],
    });

    const minimiseButton = createElement('button', {
      className: 'window__button',
      text: '—',
      attrs: { type: 'button', 'aria-label': 'Minimise window', 'data-window-control': 'minimise' },
    });
    const maximiseButton = createElement('button', {
      className: 'window__button',
      text: '□',
      attrs: { type: 'button', 'aria-label': 'Maximise window', 'data-window-control': 'maximise' },
    });
    const closeButton = createElement('button', {
      className: 'window__button window__button--close',
      text: '×',
      attrs: { type: 'button', 'aria-label': 'Close window', 'data-window-control': 'close' },
    });
    const chrome = createElement('div', {
      className: 'window__chrome',
      children: [minimiseButton, maximiseButton, closeButton],
    });
    titlebar.appendChild(chrome);

    const appContainer = createElement('div', {
      className: 'window__app app-shell',
    });
    const body = createElement('div', {
      className: 'window__body',
      children: [appContainer],
    });

    const element = createElement('article', {
      className: 'window',
      attrs: {
        'data-window-id': id,
        'data-app-id': options.appId,
      },
      children: [titlebar, body],
    });

    const resizeHandles = RESIZE_DIRECTIONS.map((direction) => createElement('button', {
      className: 'window__resize',
      attrs: {
        type: 'button',
        'aria-hidden': 'true',
        tabindex: '-1',
        'data-direction': direction,
      },
    }));

    resizeHandles.forEach((handle) => element.appendChild(handle));

    const meta = {
      processId: options.processId,
      payloadPath: options.payloadPath || null,
      title: options.title,
      icon: options.icon,
      element,
      titleElement,
      titlebar,
      taskButton,
      minimiseButton,
      maximiseButton,
      closeButton,
      resizeHandles,
      minSize: options.minSize || DEFAULT_MIN_SIZE,
      instance: options.instance,
      previousBounds: null,
      preMinimiseState: null,
    };

    records.set(id, record);
    metadata.set(id, meta);
    layer.appendChild(element);
    taskStrip.appendChild(taskButton);
    attachWindowInteractions(record, meta);
    syncWindow(record, meta);

    options.instance?.mount?.(appContainer, createWindowApi(id));
    focusWindow(id, { emitEvent: false });
    emit('window:created', record, meta);

    return cloneRecord(record);
  }

  function createWindowApi(id) {
    return {
      id,
      setTitle(title) {
        updateTitle(id, title);
      },
      getRecord() {
        const record = records.get(id);
        return record ? cloneRecord(record) : null;
      },
      focus() {
        focusWindow(id);
      },
      close() {
        closeWindow(id);
      },
      minimise() {
        minimiseWindow(id);
      },
      maximise() {
        maximiseWindow(id);
      },
      restore() {
        restoreWindow(id);
      },
    };
  }

  function getWindowMeta(id) {
    return metadata.get(id) || null;
  }

  function relayoutMaximisedWindows() {
    records.forEach((record, id) => {
      if (record.state === 'maximised') {
        applyMaximisedBounds(record);
        notifyUpdate(id);
      }
    });
  }

  window.addEventListener('resize', relayoutMaximisedWindows);

  return {
    createWindow,
    closeWindow,
    focusWindow,
    focusNextWindow,
    resetFocusCycle,
    minimiseWindow,
    maximiseWindow,
    restoreWindow,
    updateTitle,
    getFocusedWindow,
    listWindows,
    getWindowMeta,
  };
}
