import { basename, createElement, resolveAssetContent } from '../utils.js';

export async function createPdfApp({ vfs, payload }) {
  const path = payload.path;
  const locator = String(vfs.readFile(path));
  const pdfUrl = resolveAssetContent(locator);

  return {
    title: basename(path),
    processName: 'PDF Viewer',
    icon: 'PDF',
    size: { w: 900, h: 640 },
    minSize: { w: 500, h: 320 },
    mount(container) {
      const root = createElement('div', {
        className: 'pdf-app',
        children: [
          createElement('iframe', {
            className: 'pdf-app__frame',
            attrs: {
              src: pdfUrl,
              title: basename(path),
            },
          }),
        ],
      });

      container.appendChild(root);
    },
  };
}
