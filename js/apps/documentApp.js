import { basename, createElement } from '../utils.js';
import { readLines, readTextFile } from './contentHelpers.js';

export async function createDocumentApp({ vfs, payload }) {
  const path = payload.path;
  const resolved = vfs.resolvePath(path);
  const isBundle = resolved?.node.type === 'directory';
  const content = isBundle ? '' : readTextFile(vfs, path);
  const lines = isBundle
    ? resolved.node.children
        .filter((child) => child.type === 'file')
        .map((child) => `${child.name.replace('.txt', '').replace(/-/g, ' ')}: ${vfs.readFile(`${path}/${child.name}`)}`)
        .filter((line) => !line.endsWith(': '))
    : readLines(vfs, path);

  return {
    title: basename(path),
    processName: `Document ${basename(path)}`,
    icon: 'TXT',
    size: { w: 760, h: 520 },
    minSize: { w: 420, h: 280 },
    mount(container) {
      const bodyLines = lines.length ? lines : [content || '(empty file)'];
      const doc = createElement('div', {
        className: 'document-app doc-viewer',
        children: [
          createElement('div', {
            className: 'doc-viewer__title-row',
            children: [
              createElement('div', { className: 'list-chip', text: 'document viewer' }),
              createElement('h2', { className: 'doc-viewer__title', text: basename(path) }),
              createElement('div', {
                className: 'doc-viewer__meta mono',
                text: isBundle ? `${path} [bundle]` : path,
              }),
            ],
          }),
          createElement('div', {
            className: 'doc-lines',
            children: bodyLines.map((line) => createElement('div', {
              className: 'doc-line',
              text: line,
            })),
          }),
        ],
      });

      container.appendChild(doc);
    },
  };
}
