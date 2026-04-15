import {
  applyAutocomplete,
  createCommandRegistry,
  createExecutionContext,
  getAutocompleteSuggestions,
  parse,
  tokenize,
} from '../terminal.js';
import { createElement } from '../utils.js';

function promptLabel(ctx) {
  return `saptarshi@browser-os:${ctx.cwd} $`;
}

export async function createTerminalApp({ system, vfs }) {
  const ctx = createExecutionContext();
  const commands = createCommandRegistry(system, vfs);
  let inputElement = null;

  return {
    title: 'Terminal',
    processName: 'Terminal',
    icon: '>',
    size: { w: 760, h: 480 },
    minSize: { w: 420, h: 280 },
    mount(container, windowApi) {
      ctx.windowId = windowApi.id;
      const output = createElement('div', {
        className: 'terminal-app__output',
        attrs: { role: 'log', 'aria-live': 'polite' },
      });
      const input = createElement('input', {
        className: 'terminal-app__input',
        attrs: {
          type: 'text',
          spellcheck: 'false',
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          'aria-label': 'Terminal command input',
        },
      });
      inputElement = input;
      const prompt = createElement('span', {
        className: 'terminal-prompt',
        text: promptLabel(ctx),
      });

      const root = createElement('div', {
        className: 'terminal-app',
        children: [
          output,
          createElement('div', {
            className: 'terminal-app__input-row',
            children: [prompt, input],
          }),
        ],
      });

      function scrollToBottom() {
        output.scrollTop = output.scrollHeight;
      }

      function appendEntry(text, type = 'output') {
        if (!text && type !== 'output') {
          return;
        }

        const entry = createElement('div', {
          className: `terminal-app__entry terminal-app__entry--${type}`,
          text,
        });
        output.appendChild(entry);
        scrollToBottom();
      }

      async function runCommand(rawInput) {
        const trimmedInput = rawInput.trim();

        if (!trimmedInput) {
          prompt.textContent = promptLabel(ctx);
          return;
        }

        ctx.history.push(trimmedInput);
        ctx.historyCursor = null;

        const tokens = tokenize(trimmedInput);
        const { command, args } = parse(tokens);
        appendEntry(`${promptLabel(ctx)} ${trimmedInput}`, 'prompt');

        if (!command) {
          return;
        }

        const meta = commands[command];

        if (!meta) {
          appendEntry(`Command not found: ${command}`, 'error');
          prompt.textContent = promptLabel(ctx);
          return;
        }

        try {
          const response = await meta.execute(ctx, args);

          if (response.clear) {
            output.replaceChildren();
          }

          response.lines.forEach((line) => {
            if (line !== undefined && line !== null && line !== '') {
              appendEntry(line, 'output');
            }
          });
        } catch (error) {
          appendEntry(error.message, 'error');
        }

        prompt.textContent = promptLabel(ctx);
      }

      input.addEventListener('keydown', async (event) => {
        if (event.key === 'Enter') {
          const submitted = input.value;
          input.value = '';
          await runCommand(submitted);
          return;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();

          if (!ctx.history.length) {
            return;
          }

          if (ctx.historyCursor === null) {
            ctx.historyCursor = ctx.history.length - 1;
          } else {
            ctx.historyCursor = Math.max(0, ctx.historyCursor - 1);
          }

          input.value = ctx.history[ctx.historyCursor];
          return;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();

          if (ctx.historyCursor === null) {
            return;
          }

          ctx.historyCursor = Math.min(ctx.history.length, ctx.historyCursor + 1);
          input.value = ctx.historyCursor >= ctx.history.length ? '' : ctx.history[ctx.historyCursor];
          return;
        }

        if (event.key === 'Tab') {
          event.preventDefault();
          const suggestions = getAutocompleteSuggestions(
            input.value,
            ctx,
            commands,
            vfs,
            system.listAppAliases(),
          );
          const completion = applyAutocomplete(input.value, suggestions);
          input.value = completion.nextInput;

          if (completion.printedSuggestions.length) {
            appendEntry(completion.printedSuggestions.join('  '), 'meta');
          }
        }
      });

      root.addEventListener('pointerdown', () => {
        window.setTimeout(() => input.focus(), 0);
      });

      container.appendChild(root);
      appendEntry('Saptarshi Browser OS terminal session initialised.', 'meta');
      appendEntry('Type "help" to inspect the live command registry.', 'meta');
      prompt.textContent = promptLabel(ctx);
      window.setTimeout(() => input.focus(), 120);
    },
    onFocus() {
      inputElement?.focus();
    },
  };
}
