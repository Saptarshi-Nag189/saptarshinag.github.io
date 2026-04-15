import { basename, resolveAssetContent, splitLines } from '../utils.js';

export function readTextFile(vfs, path) {
  return String(vfs.readFile(path));
}

export function readLines(vfs, path) {
  return splitLines(readTextFile(vfs, path));
}

export function readAssetUrl(vfs, path) {
  const content = readTextFile(vfs, path);
  return resolveAssetContent(content);
}

export function listChildDirectories(vfs, path) {
  const resolved = vfs.resolvePath(path);

  if (!resolved || resolved.node.type !== 'directory') {
    return [];
  }

  return resolved.node.children
    .filter((child) => child.type === 'directory')
    .map((child) => ({
      name: child.name,
      path: `${resolved.path}/${child.name}`.replace('//', '/'),
    }));
}

export function readNamedFiles(vfs, directoryPath, fileNames) {
  const payload = {};

  fileNames.forEach((fileName) => {
    payload[fileName] = readTextFile(vfs, `${directoryPath}/${fileName}`);
  });

  return payload;
}

export function fileLabel(path) {
  return basename(path).replace(/[-_]/g, ' ');
}
