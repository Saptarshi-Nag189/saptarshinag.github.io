# The Wander: ambience recordings

The world plays real recordings from this folder when they exist, and falls back
to the built-in synth ambience when they don't. Drop files here with these exact
names (`.ogg` preferred, `.mp3` also works), then list each one in `RECORDINGS` at
the top of `../ambience.js`, for example `{ river:'ogg', rain:'mp3' }`. The list
stops the page from requesting files that aren't there.

| File | What to look for | Suggested search |
|---|---|---|
| `glade.ogg`  | soft morning meadow, distant songbirds, gentle | "morning meadow ambience loop" |
| `forest.ogg` | birdsong + leaves rustling in a light breeze | "forest birds ambience loop" |
| `river.ogg`  | steady small river / stream flow, close water | "river stream flowing loop" |
| `desert.ogg` | wide dry wind, occasional gusts, no birds | "desert wind ambience loop" |
| `snow.ogg`   | thin cold wind, hushed, slightly whistling | "winter wind mountain ambience" |
| `sky.ogg`    | high open-air wind rush, airy and bright | "high altitude wind loop" |
| `city.ogg`   | dark sci-fi hum / neon city drone, low | "sci-fi city ambience drone loop" |
| `meadow.ogg` | night crickets + soft night air | "night crickets ambience loop" |
| `rain.ogg`   | steady rain on a roof, cozy, no thunder | "rain on roof loop" |

Good free sources (pick CC0 / royalty-free):
- **pixabay.com/sound-effects**: a CC0-like license with no attribution needed (the easiest)
- **freesound.org**: filter by the "Creative Commons 0" license
- **opengameart.org**: filter by CC0

Tips: pick loops 30 s–2 min long; "seamless loop" in the title is ideal.
Keep files under ~2 MB each so the page stays light (choose 96–128 kbps OGG).

If a file needs attribution (CC-BY), add a line to `CREDITS.md` in this folder.
