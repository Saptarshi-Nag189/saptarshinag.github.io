export function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);

  if (options.className) {
    element.className = options.className;
  }

  if (options.text !== undefined) {
    element.textContent = options.text;
  }

  if (options.html !== undefined) {
    element.innerHTML = options.html;
  }

  if (options.attrs) {
    Object.entries(options.attrs).forEach(([name, value]) => {
      if (value !== undefined && value !== null) {
        element.setAttribute(name, value);
      }
    });
  }

  if (options.dataset) {
    Object.entries(options.dataset).forEach(([name, value]) => {
      element.dataset[name] = value;
    });
  }

  if (options.children) {
    options.children.forEach((child) => {
      if (child) {
        element.appendChild(child);
      }
    });
  }

  return element;
}

export function clearNode(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

export function basename(path) {
  const parts = String(path || '/').split('/').filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '/';
}

export function fileExtension(path) {
  const name = basename(path);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex).toLowerCase() : '';
}

export function formatDuration(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function titleFromId(value) {
  return String(value)
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function resolveAssetContent(content) {
  if (!String(content).startsWith('asset:')) {
    return null;
  }

  return new URL(content.slice('asset:'.length), document.baseURI).href;
}

export function splitLines(content) {
  return String(content)
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line, index, lines) => line.length > 0 || (index > 0 && index < lines.length - 1));
}
