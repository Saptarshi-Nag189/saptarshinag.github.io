import { basename, createElement, titleFromId } from '../utils.js';

function entryIcon(entry) {
  if (entry.type === 'directory') {
    return 'DIR';
  }

  if (entry.name.endsWith('.pdf')) {
    return 'PDF';
  }

  return 'TXT';
}

export async function createExplorerApp({ system, vfs, payload }) {
  let currentPath = payload.path || '/home/saptarshi';
  let selectedPath = currentPath;
  let searchQuery = '';
  let windowApiRef = null;

  function opensAsDocumentBundle(path) {
    return path.startsWith('/home/saptarshi/publications/') || path.startsWith('/home/saptarshi/education/');
  }

  function readDirectoryNode(path) {
    const resolved = vfs.resolvePath(path);
    return resolved && resolved.node.type === 'directory' ? resolved : null;
  }

  function getEntries(path) {
    const resolved = readDirectoryNode(path);
    if (!resolved) {
      return [];
    }

    return resolved.node.children.slice();
  }

  function matchesSearch(entry, entryPath) {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return entry.name.toLowerCase().includes(query) || entryPath.toLowerCase().includes(query);
  }

  function buildTree(treeRoot, path, depth = 0) {
    const resolved = readDirectoryNode(path);

    if (!resolved) {
      return;
    }

    resolved.node.children
      .filter((child) => child.type === 'directory')
      .forEach((child) => {
        const childPath = `${resolved.path}/${child.name}`.replace('//', '/');
        const button = createElement('button', {
          className: `tree-item__button${currentPath === childPath ? ' is-active' : ''}`,
          attrs: { type: 'button' },
          children: [
            createElement('span', {
              className: 'tree-item__label',
              children: [
                createElement('span', {
                  className: 'tree-item__indent',
                  text: ''.padStart(depth, ' '),
                }),
                createElement('span', { className: 'tree-item__icon', text: 'DIR' }),
                createElement('span', { text: titleFromId(child.name) }),
              ],
            }),
            createElement('span', {
              className: 'tree-item__meta',
              text: childPath,
            }),
          ],
        });

        button.addEventListener('click', () => {
          selectedPath = childPath;
          render();
        });

        button.addEventListener('dblclick', () => {
          currentPath = childPath;
          selectedPath = childPath;
          render();
        });

        const wrapper = createElement('div', {
          className: 'tree-item',
          children: [button],
        });
        treeRoot.appendChild(wrapper);
        buildTree(treeRoot, childPath, depth + 1);
      });
  }

  function renderBreadcrumbs() {
    const wrap = createElement('div', { className: 'breadcrumbs' });
    const parts = currentPath.split('/').filter(Boolean);
    let running = '';

    wrap.appendChild(createElement('button', {
      className: 'breadcrumbs__button',
      text: '/',
      attrs: { type: 'button' },
    }));

    wrap.firstChild.addEventListener('click', () => {
      currentPath = '/';
      selectedPath = '/';
      render();
    });

    parts.forEach((part) => {
      running += `/${part}`;
      const button = createElement('button', {
        className: 'breadcrumbs__button',
        text: part,
        attrs: { type: 'button' },
      });
      button.addEventListener('click', () => {
        currentPath = running;
        selectedPath = running;
        render();
      });
      wrap.appendChild(button);
    });

    return wrap;
  }

  let rootElement;

  function render() {
    if (!rootElement) {
      return;
    }

    windowApiRef?.setTitle(`Explorer // ${basename(currentPath)}`);

    const treeColumn = rootElement.querySelector('[data-explorer-tree]');
    const contentColumn = rootElement.querySelector('[data-explorer-content]');
    treeColumn.replaceChildren();
    contentColumn.replaceChildren();

    buildTree(treeColumn, '/home/saptarshi');
    const entries = getEntries(currentPath);
    const visibleEntries = entries.filter((entry) => {
      const entryPath = `${currentPath}/${entry.name}`.replace('//', '/');
      return matchesSearch(entry, entryPath);
    });

    contentColumn.appendChild(renderBreadcrumbs());
    const searchInput = createElement('input', {
      className: 'search-input',
      attrs: {
        type: 'search',
        value: searchQuery,
        placeholder: 'Filter filenames in this directory',
        'aria-label': 'Filter filenames in explorer',
      },
    });
    searchInput.addEventListener('input', (event) => {
      searchQuery = event.target.value;
      render();
      const nextSearchInput = rootElement.querySelector('.search-input');
      nextSearchInput?.focus();
      nextSearchInput?.setSelectionRange(searchQuery.length, searchQuery.length);
    });
    contentColumn.appendChild(searchInput);

    const list = createElement('div', { className: 'file-list' });

    visibleEntries.forEach((entry) => {
      const entryPath = `${currentPath}/${entry.name}`.replace('//', '/');
      const button = createElement('button', {
        className: `file-row${selectedPath === entryPath ? ' is-selected' : ''}`,
        attrs: { type: 'button' },
        children: [
          createElement('div', {
            className: 'file-row__name',
            children: [
              createElement('span', { className: 'file-row__icon', text: entryIcon(entry) }),
              createElement('span', { text: entry.name }),
            ],
          }),
          createElement('span', {
            className: 'file-row__meta',
            text: entry.type === 'directory' ? 'directory' : 'file',
          }),
        ],
      });

      button.addEventListener('click', () => {
        selectedPath = entryPath;
        render();
      });

        button.addEventListener('dblclick', async () => {
        if (entry.type === 'directory' && !opensAsDocumentBundle(entryPath)) {
          currentPath = entryPath;
          selectedPath = entryPath;
          render();
          windowApiRef?.setTitle(`Explorer // ${basename(currentPath)}`);
          return;
        }

        await system.openTarget(entryPath, currentPath);
      });

      list.appendChild(button);
    });

    if (!visibleEntries.length) {
      list.appendChild(createElement('div', {
        className: 'placeholder-state',
        text: searchQuery.trim() ? 'No filenames match this filter.' : 'No entries in this directory.',
      }));
    }

    contentColumn.appendChild(list);
  }

  return {
    title: `Explorer // ${basename(currentPath)}`,
    processName: 'Explorer',
    icon: '[]',
    size: { w: 860, h: 540 },
    minSize: { w: 520, h: 320 },
    mount(container, windowApi) {
      windowApiRef = windowApi;
      rootElement = createElement('div', {
        className: 'explorer-app panel-layout panel-layout--split',
        children: [
          createElement('div', {
            className: 'panel-layout__sidebar',
            children: [
              createElement('div', {
                className: 'panel-layout__section',
                children: [
                  createElement('div', { className: 'list-chip', text: 'virtual file system' }),
                  createElement('div', {
                    className: 'window__path mono',
                    text: '/home/saptarshi',
                  }),
                ],
              }),
              createElement('div', {
                className: 'panel-layout__section',
                attrs: { 'data-explorer-tree': 'true' },
              }),
            ],
          }),
          createElement('div', {
            className: 'panel-layout__content',
            attrs: { 'data-explorer-content': 'true' },
          }),
        ],
      });

      container.appendChild(rootElement);
      render();
    },
  };
}
