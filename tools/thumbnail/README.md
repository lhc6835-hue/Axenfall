# Thumbnail GIF

Renders a short scripted fight frame by frame from the dev build and turns it into a looping GIF.

```bash
npm run dev                                   # http://localhost:5173
OUT=/path/to/out
node tools/thumbnail/capture.cjs $OUT 165 full 4   # frames + logo (seed 4)
python3 tools/thumbnail/compose.py $OUT             # crop, logo, loop fade
ffmpeg -framerate 30 -i $OUT/comp/c%04d.png -vf "palettegen=max_colors=256:stats_mode=full" $OUT/pal.png
ffmpeg -framerate 30 -i $OUT/comp/c%04d.png -i $OUT/pal.png -lavfi "paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 $OUT/thumbnail.gif
```

`capture.cjs` uses two dev-only hooks in the game: `window.__manual` / `window.__step(dt)` take over the clock,
and `window.__cine` hides the HUD except damage numbers and PARRY / PERFECT pops. `dry` instead of `full`
skips the frames and prints how the take went, to pick a seed.
