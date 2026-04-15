import { basename, createElement } from '../utils.js';
import { listChildDirectories, readLines, readTextFile } from './contentHelpers.js';

export async function createProjectsApp({ vfs, payload }) {
  const directories = listChildDirectories(vfs, '/home/saptarshi/projects');
  const projects = directories.map(({ path, name }) => ({
    id: name,
    path,
    title: readTextFile(vfs, `${path}/title.txt`),
    stack: readLines(vfs, `${path}/stack.txt`),
    details: readLines(vfs, `${path}/details.txt`),
  }));

  let activePath = payload.path && payload.path !== '/home/saptarshi/projects'
    ? payload.path
    : projects[0]?.path;
  let rootElement;

  function render() {
    if (!rootElement) {
      return;
    }

    const listColumn = rootElement.querySelector('[data-project-list]');
    const detailColumn = rootElement.querySelector('[data-project-detail]');
    listColumn.replaceChildren();
    detailColumn.replaceChildren();

    projects.forEach((project) => {
      const button = createElement('button', {
        className: `project-card__button${project.path === activePath ? ' is-active' : ''}`,
        attrs: { type: 'button' },
        children: [
          createElement('h3', { className: 'project-card__title', text: project.title }),
          createElement('p', {
            className: 'project-card__subtitle',
            text: project.stack.join(' • '),
          }),
        ],
      });

      button.addEventListener('click', () => {
        activePath = project.path;
        render();
      });

      listColumn.appendChild(createElement('article', {
        className: 'project-card',
        children: [button],
      }));
    });

    const activeProject = projects.find((project) => project.path === activePath) || projects[0];

    if (!activeProject) {
      detailColumn.appendChild(createElement('div', {
        className: 'placeholder-state',
        text: 'No projects found in the VFS.',
      }));
      return;
    }

    detailColumn.appendChild(createElement('div', {
      className: 'detail-panel',
      children: [
        createElement('div', {
          className: 'detail-panel__header',
          children: [
            createElement('div', { className: 'list-chip', text: basename(activeProject.path) }),
            createElement('h2', { className: 'detail-panel__title', text: activeProject.title }),
            createElement('div', {
              className: 'tag-list',
              children: activeProject.stack.map((item) => createElement('span', {
                className: 'tag',
                text: item,
              })),
            }),
          ],
        }),
        createElement('ul', {
          className: 'detail-panel__list',
          children: activeProject.details.map((line) => createElement('li', { text: line })),
        }),
      ],
    }));
  }

  return {
    title: 'Projects',
    processName: 'Projects Viewer',
    icon: '{ }',
    size: { w: 960, h: 620 },
    minSize: { w: 620, h: 380 },
    mount(container) {
      rootElement = createElement('div', {
        className: 'projects-app panel-layout panel-layout--split',
        children: [
          createElement('div', {
            className: 'panel-layout__sidebar',
            children: [
              createElement('div', {
                className: 'panel-layout__section',
                children: [
                  createElement('div', { className: 'list-chip', text: 'project registry' }),
                  createElement('div', {
                    className: 'window__path mono',
                    text: '/home/saptarshi/projects',
                  }),
                ],
              }),
              createElement('div', {
                className: 'panel-layout__section project-list',
                attrs: { 'data-project-list': 'true' },
              }),
            ],
          }),
          createElement('div', {
            className: 'panel-layout__content',
            attrs: { 'data-project-detail': 'true' },
          }),
        ],
      });

      container.appendChild(rootElement);
      render();
    },
  };
}
