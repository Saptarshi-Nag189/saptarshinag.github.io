import { basename, formatDuration } from './utils.js';

const MAN_NOTES = {
  clear: 'Useful when you want a clean prompt without closing the terminal session.',
  exit: 'Closes only the current terminal window, not the whole Browser OS.',
  open: 'Targets can be app aliases such as about, projects, files, experience, and cv.',
  ps: 'Shows both simulated services and app processes with Browser OS pids.',
  tree: 'Prints an ASCII directory tree generated from the live VFS.',
};

function result(lines = [], extras = {}) {
  return {
    lines: Array.isArray(lines) ? lines : [String(lines)],
    clear: false,
    ...extras,
  };
}

export function tokenize(input) {
  const tokens = [];
  let current = '';
  let quote = null;
  let escaping = false;

  for (const char of String(input)) {
    if (escaping) {
      current += char;
      escaping = false;
      continue;
    }

    if (char === '\\') {
      escaping = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === '\'') {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaping) {
    current += '\\';
  }

  if (current || quote) {
    tokens.push(current);
  }

  return tokens;
}

export function parse(tokens) {
  if (!tokens.length) {
    return {
      command: '',
      args: [],
    };
  }

  return {
    command: tokens[0],
    args: tokens.slice(1),
  };
}

export function createExecutionContext() {
  return {
    cwd: '/home/saptarshi',
    windowId: null,
    env: {
      USER: 'saptarshi',
      SHELL: 'browser-sh',
    },
    history: [],
    historyCursor: null,
  };
}

function formatEntries(entries) {
  return entries
    .sort((left, right) => {
      if (left.type === right.type) {
        return left.name.localeCompare(right.name);
      }

      return left.type === 'directory' ? -1 : 1;
    })
    .map((entry) => (entry.type === 'directory' ? `${entry.name}/` : entry.name))
    .join('  ');
}

function resolveFileOrDirectory(vfs, path, cwd) {
  const resolved = vfs.resolvePath(path, cwd);

  if (!resolved) {
    throw new Error(`Path not found: ${path}`);
  }

  return resolved;
}

function buildTreeLines(vfs, targetPath, prefix = '') {
  const { node } = resolveFileOrDirectory(vfs, targetPath, '/');

  if (node.type === 'file') {
    return [basename(targetPath)];
  }

  const entries = vfs.listDirectory(targetPath)
    .sort((left, right) => {
      if (left.type === right.type) {
        return left.name.localeCompare(right.name);
      }

      return left.type === 'directory' ? -1 : 1;
    });

  const lines = [];

  entries.forEach((entry, index) => {
    const isLast = index === entries.length - 1;
    const connector = isLast ? '`-- ' : '|-- ';
    const childPrefix = `${prefix}${isLast ? '    ' : '|   '}`;
    const childPath = `${targetPath.replace(/\/$/, '')}/${entry.name}`.replace('//', '/');
    const label = entry.type === 'directory' ? `${entry.name}/` : entry.name;

    lines.push(`${prefix}${connector}${label}`);

    if (entry.type === 'directory') {
      lines.push(...buildTreeLines(vfs, childPath, childPrefix));
    }
  });

  return lines;
}

export function createCommandRegistry(system, vfs) {
  const commands = {
    ls: {
      description: 'list directory contents',
      usage: 'ls [path]',
      execute(ctx, args) {
        const target = args[0] || ctx.cwd;
        const { node, path } = resolveFileOrDirectory(vfs, target, ctx.cwd);

        if (node.type === 'file') {
          return result([basename(path)]);
        }

        return result([formatEntries(vfs.listDirectory(path))]);
      },
    },
    cd: {
      description: 'change working directory',
      usage: 'cd <path>',
      execute(ctx, args) {
        const target = args[0] || '/home/saptarshi';
        const { node, path } = resolveFileOrDirectory(vfs, target, ctx.cwd);

        if (node.type !== 'directory') {
          throw new Error(`Not a directory: ${path}`);
        }

        ctx.cwd = path;
        return result();
      },
    },
    cat: {
      description: 'print file contents',
      usage: 'cat <file>',
      execute(ctx, args) {
        if (!args[0]) {
          throw new Error('Usage: cat <file>');
        }

        const { node, path } = resolveFileOrDirectory(vfs, args[0], ctx.cwd);

        if (node.type !== 'file') {
          throw new Error(`Not a file: ${path}`);
        }

        return result(String(vfs.readFile(path)).split('\n'));
      },
    },
    echo: {
      description: 'print text back to the terminal',
      usage: 'echo <text...>',
      execute(ctx, args) {
        return result([args.join(' ')]);
      },
    },
    help: {
      description: 'show available commands',
      usage: 'help',
      execute() {
        const lines = ['Available commands:'];

        Object.entries(commands)
          .sort(([left], [right]) => left.localeCompare(right))
          .forEach(([name, meta]) => {
            lines.push(`${name.padEnd(8, ' ')} ${meta.description}`);
          });

        return result(lines);
      },
    },
    clear: {
      description: 'clear terminal output',
      usage: 'clear',
      execute() {
        return result([], { clear: true });
      },
    },
    exit: {
      description: 'close the current terminal window',
      usage: 'exit',
      execute(ctx) {
        if (!ctx.windowId) {
          throw new Error('No terminal window is attached to this session.');
        }

        system.closeApp(ctx.windowId);
        return result();
      },
    },
    man: {
      description: 'show a short manual entry for a command',
      usage: 'man [command]',
      execute(ctx, args) {
        if (!args[0]) {
          return result([
            'Manual topics:',
            ...Object.keys(commands).sort().map((name) => `  ${name}`),
          ]);
        }

        const topic = args[0];
        const entry = commands[topic];

        if (!entry) {
          throw new Error(`No manual entry for ${topic}`);
        }

        const lines = [
          `${topic.toUpperCase()} MANUAL`,
          `${entry.usage}  ${entry.description}`,
        ];

        if (MAN_NOTES[topic]) {
          lines.push(MAN_NOTES[topic]);
        }

        return result(lines);
      },
    },
    open: {
      description: 'open an app, file, or directory',
      usage: 'open <target>',
      async execute(ctx, args) {
        if (!args[0]) {
          throw new Error('Usage: open <target>');
        }

        const opened = await system.openTarget(args[0], ctx.cwd);
        return result([opened.message]);
      },
    },
    ps: {
      description: 'list running processes',
      usage: 'ps',
      execute() {
        const processes = system.listProcesses();
        const lines = ['PID   KIND     STATE      NAME'];

        processes.forEach((process) => {
          lines.push(
            `${String(process.pid).padEnd(5, ' ')} ${process.kind.padEnd(8, ' ')} ${process.state.padEnd(10, ' ')} ${process.name}`,
          );
        });

        return result(lines);
      },
    },
    tree: {
      description: 'print a recursive directory tree',
      usage: 'tree [path]',
      execute(ctx, args) {
        const target = args[0] || ctx.cwd;
        const { node, path } = resolveFileOrDirectory(vfs, target, ctx.cwd);

        if (node.type === 'file') {
          return result([basename(path)]);
        }

        const rootLabel = path === '/' ? '/' : `${basename(path)}/`;
        return result([rootLabel, ...buildTreeLines(vfs, path)]);
      },
    },
    uptime: {
      description: 'show system uptime',
      usage: 'uptime',
      execute() {
        return result([`uptime ${formatDuration(system.getUptime())}`]);
      },
    },
    pwd: {
      description: 'print working directory',
      usage: 'pwd',
      execute(ctx) {
        return result([ctx.cwd]);
      },
    },
    whoami: {
      description: 'print the active Browser OS user',
      usage: 'whoami',
      execute(ctx) {
        return result([ctx.env.USER]);
      },
    },
  };

  return commands;
}

function commonPrefix(values) {
  if (!values.length) {
    return '';
  }

  let prefix = values[0];

  for (let index = 1; index < values.length; index += 1) {
    while (!values[index].startsWith(prefix) && prefix) {
      prefix = prefix.slice(0, -1);
    }
  }

  return prefix;
}

function getDirectorySuggestions(vfs, partialPath, cwd) {
  const hasSlash = partialPath.includes('/');
  const endsWithSlash = partialPath.endsWith('/');
  const parentHint = hasSlash ? partialPath.slice(0, partialPath.lastIndexOf('/')) : '.';
  const searchBase = endsWithSlash ? '' : partialPath.slice(partialPath.lastIndexOf('/') + 1);
  const parentPath = endsWithSlash ? partialPath : parentHint;
  const resolvedParent = vfs.resolvePath(parentPath || '.', cwd);

  if (!resolvedParent || resolvedParent.node.type !== 'directory') {
    return [];
  }

  return vfs.listDirectory(resolvedParent.path).filter((entry) => entry.name.startsWith(searchBase)).map((entry) => ({
    completion: `${hasSlash ? `${parentHint}/` : ''}${entry.name}${entry.type === 'directory' ? '/' : ''}`,
    display: entry.type === 'directory' ? `${entry.name}/` : entry.name,
  }));
}

export function getAutocompleteSuggestions(input, ctx, registry, vfs, aliases = []) {
  const endsWithSpace = /\s$/.test(input);
  const tokens = tokenize(input);

  if (!tokens.length && !endsWithSpace) {
    return Object.keys(registry)
      .concat(aliases)
      .sort()
      .map((value) => ({ completion: value, display: value }));
  }

  if (tokens.length <= 1 && !endsWithSpace) {
    const current = tokens[0] || '';
    return Object.keys(registry)
      .concat(aliases)
      .filter((entry) => entry.startsWith(current))
      .sort()
      .map((value) => ({ completion: value, display: value }));
  }

  const partial = endsWithSpace ? '' : tokens[tokens.length - 1];
  return getDirectorySuggestions(vfs, partial, ctx.cwd);
}

export function applyAutocomplete(input, suggestions) {
  if (!suggestions.length) {
    return {
      nextInput: input,
      printedSuggestions: [],
    };
  }

  if (suggestions.length === 1) {
    const tokenPattern = /\S+$/;
    const trailingSpace = suggestions[0].completion.endsWith('/') ? '' : ' ';
    const nextInput = tokenPattern.test(input)
      ? input.replace(tokenPattern, `${suggestions[0].completion}${trailingSpace}`)
      : `${input}${suggestions[0].completion}${trailingSpace}`;

    return {
      nextInput,
      printedSuggestions: [],
    };
  }

  const prefix = commonPrefix(suggestions.map((suggestion) => suggestion.completion));
  const tokenPattern = /\S+$/;

  if (prefix) {
    const nextInput = tokenPattern.test(input)
      ? input.replace(tokenPattern, prefix)
      : `${input}${prefix}`;

    if (nextInput !== input) {
      return {
        nextInput,
        printedSuggestions: [],
      };
    }
  }

  return {
    nextInput: input,
    printedSuggestions: suggestions.map((suggestion) => suggestion.display),
  };
}
