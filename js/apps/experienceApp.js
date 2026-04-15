import { createElement } from '../utils.js';
import { listChildDirectories, readLines, readTextFile } from './contentHelpers.js';

export async function createExperienceApp({ vfs, payload }) {
  const experienceRoot = '/home/saptarshi/experience';
  const entries = listChildDirectories(vfs, experienceRoot).map(({ name, path }) => ({
    id: name,
    path,
    organisation: readTextFile(vfs, `${path}/organisation.txt`),
    role: readTextFile(vfs, `${path}/role.txt`),
    dates: readTextFile(vfs, `${path}/dates.txt`),
    location: readTextFile(vfs, `${path}/location.txt`),
    details: readLines(vfs, `${path}/details.txt`),
  }));

  const highlightedPath = payload.path && payload.path !== experienceRoot ? payload.path : null;

  return {
    title: 'Experience',
    processName: 'Experience Viewer',
    icon: '::',
    size: { w: 900, h: 620 },
    minSize: { w: 620, h: 380 },
    mount(container) {
      const timeline = createElement('div', {
        className: 'experience-app panel-layout__content',
      });

      timeline.appendChild(createElement('div', {
        className: 'list-chip',
        text: 'career timeline',
      }));

      const list = createElement('div', { className: 'timeline' });

      entries.forEach((entry) => {
        const isActive = entry.path === highlightedPath;
        const card = createElement('article', {
          className: 'timeline__entry',
          children: [
            createElement('div', {
              className: 'timeline__heading',
              children: [
                createElement('div', {
                  children: [
                    createElement('h3', { className: 'timeline__title', text: entry.organisation }),
                    createElement('p', { className: 'timeline__role', text: entry.role }),
                  ],
                }),
                createElement('div', {
                  className: 'timeline__meta mono',
                  text: `${entry.dates} // ${entry.location}`,
                }),
              ],
            }),
            createElement('ul', {
              className: 'timeline__list',
              children: entry.details.map((detail) => createElement('li', { text: detail })),
            }),
          ],
        });

        if (isActive) {
          card.style.borderColor = 'rgba(79, 212, 218, 0.32)';
          card.style.background = 'rgba(79, 212, 218, 0.08)';
        }

        list.appendChild(card);
      });

      timeline.appendChild(list);
      container.appendChild(timeline);
    },
  };
}
