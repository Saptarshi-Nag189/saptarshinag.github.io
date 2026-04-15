import { createElement } from '../utils.js';
import { readAssetUrl, readLines, readTextFile } from './contentHelpers.js';

function parseContactLines(lines) {
  return lines.map((line) => {
    const separatorIndex = line.indexOf(':');

    if (separatorIndex === -1) {
      return {
        label: 'Status',
        value: line,
      };
    }

    return {
      label: line.slice(0, separatorIndex).trim(),
      value: line.slice(separatorIndex + 1).trim(),
    };
  });
}

export async function createAboutApp({ vfs }) {
  const aboutText = readTextFile(vfs, '/home/saptarshi/about.txt');
  const contactLines = parseContactLines(readLines(vfs, '/home/saptarshi/contact.txt'));
  const imageUrl = readAssetUrl(vfs, '/home/saptarshi/media/profile.jpg');

  return {
    title: 'About // Saptarshi Nag',
    processName: 'About Viewer',
    icon: 'i',
    size: { w: 920, h: 600 },
    minSize: { w: 560, h: 360 },
    mount(container) {
      const contactList = createElement('ul', { className: 'about-view__contact-list' });

      contactLines.forEach((entry) => {
        contactList.appendChild(createElement('li', {
          children: [
            createElement('span', {
              className: 'about-view__meta mono',
              text: entry.label,
            }),
            createElement('span', { text: entry.value }),
          ],
        }));
      });

      const root = createElement('div', {
        className: 'about-app about-view',
        children: [
          createElement('aside', {
            className: 'about-view__media',
            children: [
              createElement('img', {
                className: 'about-view__image',
                attrs: {
                  src: imageUrl,
                  alt: 'Saptarshi Nag portrait',
                },
              }),
              createElement('div', {
                className: 'about-view__caption',
                text: 'Profile asset loaded from /home/saptarshi/media/profile.jpg',
              }),
            ],
          }),
          createElement('section', {
            className: 'about-view__content',
            children: [
              createElement('div', { className: 'list-chip', text: 'profile runtime' }),
              createElement('h2', { className: 'about-view__title', text: 'Saptarshi Nag' }),
              createElement('p', {
                className: 'about-view__body',
                text: aboutText,
              }),
              createElement('div', { className: 'list-chip', text: 'contact channels' }),
              contactList,
            ],
          }),
        ],
      });

      container.appendChild(root);
    },
  };
}
