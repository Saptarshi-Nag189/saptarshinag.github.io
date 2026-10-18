# Saptarshi Nag: portfolio

Personal portfolio of Saptarshi Nag, AI/ML engineer at C-DAC Chennai. Hand-written HTML, CSS and
JavaScript, with no build step and no framework, served by GitHub Pages.

## Pages

- **Portfolio:** [saptarshi-nag189.github.io/saptarshinag.github.io](https://saptarshi-nag189.github.io/saptarshinag.github.io/).
  The main site, with experience, projects, publications, education, skills and contact.
- **The Wander:** [/wander](https://saptarshi-nag189.github.io/saptarshinag.github.io/wander/).
  A 3D walk through eight small worlds. The doors open onto parts of his work, six machines inside
  actually run, and a fairy answers questions about him.
- **The Signal:** [/signal](https://saptarshi-nag189.github.io/saptarshinag.github.io/signal/).
  A biography in eight short acts, each a simplified version of a real task.
- **The Long Light** `experimental`: [/light](https://saptarshi-nag189.github.io/saptarshinag.github.io/light/).
  An island of seven biomes to walk, run and row across, with a fairy who answers questions. The
  world streams in 64 m tiles and frees the ones behind you. It's still being tuned: the weather
  layer is off, and the quality tiers have only been tested on software rendering.
- **The Launch:** [/demos/launch](https://saptarshi-nag189.github.io/saptarshinag.github.io/demos/launch/).
  His recent work as a product launch page: the C-DAC framework catches a simulated attack as you scroll,
  then chapters on Omniscience Pro (RAG), ARO (multi-agent LLM) and the Llama 3.2 fine-tune. Every number
  has a footnote naming its project. Follows the light or dark setting.
- **The archive:** [/demos](https://saptarshi-nag189.github.io/saptarshinag.github.io/demos/).
  Fourteen earlier concepts: Terminal OS, Mission Control, Neural Graph, Signal Decode, Night
  Drive, Movie Premiere, 2D World, The Constellation, Liquid, Night Train, Abyss, Library, Elysium
  and Classic.

## Facts

Every fact on the site comes from the CV linked from the homepage, and every metric names the
project it came from. To change one, edit the CV first, then the content files: `index.html`,
`wander/twin-data.js`, `signal/acts.js`, `light/ledger.js`, `light/twin.js`, and the demos.

## Stack

- HTML, CSS and vanilla JavaScript. There's a raw WebGL2 fluid simulation in Liquid.
- Three.js r162, vendored, for The Wander. The Constellation loads Three.js from jsDelivr.
- Babylon.js 9.26 and its glTF2 loader, vendored, for The Long Light, plus one rigged character
  credited in `light/assets/CREDITS.md`.
- Canvas 2D scenes, and a Web Audio sound engine that synthesises every sound (no audio files).
- Inter and JetBrains Mono from Google Fonts, and Font Awesome from cdnjs for The Wander, The Signal
  and the archive.
