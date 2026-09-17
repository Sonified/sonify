# sonify.now.audio

**Sound Science: listen to the sounds of the cosmos.**
A full-screen, scroll-snapping presentation site built on the Sonara runtime
(audio-reactive particle hero, data-driven sequencer and wavetable synth).

## Run locally

```bash
cd ~/GitHub/sonify
python3 -m http.server 3334
# open http://localhost:3334
```

Any static server works. No build step.

## Reorder or remove pages

Edit `PAGE_ORDER` in [js/pages.js](js/pages.js). That's it.

```js
PAGE_ORDER: ['hero', 'synth', 'work-with-robert']
```

Pages left out of the array are removed from the DOM, so their canvases and
audio never load. To try an order without editing anything, use a URL param:

```
http://localhost:3334/?pages=hero,synth,work-with-robert
```

### Page names

| data-page          | What it is                                   | Background engine (section id) |
|--------------------|----------------------------------------------|--------------------------------|
| `hero`             | SOUND SCIENCE title, solar wind particles    | `hero` (hero-canvas + rays)    |
| `nasa-video`       | NASA "Listen To SPACE" video                 | `education` (starfield, click to add stars) |
| `audio-production` | HARP video + Edgar Mitchell VR video         | `vision` (nebula orbs)         |
| `pop`              | JVKE golden hour, sample pack, Rolling Stone | `citizen-science` (waveform)   |
| `synth`            | Sequencer + wavetable synth                  | `stem-music` (spectrum bars)   |
| `work-with-robert` | Headshot, logos, contact CTA                 | `contact` (custom solar flow)  |

The `id` on each `<section>` is what Sonara's `visuals.js` / `main.js` key on
for backgrounds and audio. Keep the id, rename the page with `data-page`.

## Page links

Each page has a shareable tag (set in `SLUGS` in js/pages.js). The address bar
updates as you scroll, and loading a tagged link jumps straight to that page:

| Page | Link |
|---|---|
| Hero | `sonify.now.audio/#soundscience` |
| NASA video | `#listen` |
| Sound as experience | `#experience` |
| Music production | `#music` |
| Play the Sun | `#play` |
| Work with (form) | `#connect` |
| QR (with `?qr=1`) | `#qr` |

Combine with form pre-selects: `sonify.now.audio/?type=educator&interest=workshop#connect`

## Presentation mode: QR page

Add `?qr=1` to the URL and one extra page appears after the last one: a big
white QR code on black, sized for a projector. Normal visitors never see it.

```
https://sonify.now.audio/?qr=1
```

## Links to fill in

Also in [js/pages.js](js/pages.js), under `LINKS`:

- `samplePack` – public link to the Solar Sample Pack zip. Until set, the card shows "Download link coming soon".
- `googleForm` – Google Form URL for "Start a conversation" (set). Blank = falls back to email.
- `googleFormEmbed` – embed URL (`...?embedded=true`, set). When set, the button opens the form in a modal over the page; blank it to open a new tab instead.

## Logos

Drop image files into `logos/` and the page picks them up. If a file is
missing, a text wordmark shows in its place automatically:

- `logos/cannes.svg` – Festival de Cannes (missing, wordmark shown)
- `logos/rolling-stone.svg` – Rolling Stone (missing, wordmark shown)
- `logos/breathscape.jpg` – Breathscape (square app tile)

## Deploy

Hosted on **Cloudflare Pages** (project `sonify`). A git push does not deploy.

```bash
./tools/deploy.sh      # builds dist/ and deploys (functions/ included)
```

Server pieces (Pages Functions, R2 bucket `sonify-beats`):

- `POST /api/beat` saves a shared beat (sequencer state + sun snapshot). Shares are permanent.
- `/beat/<id>` opens the site with that beat loaded and its own link preview
- `/og/<id>.jpg` is the preview image
- `/video/<name>` streams video from R2 `media/` with byte ranges (needed for iPhone)

## Files

- `index.html` – all pages as `<section data-page="...">`
- `sonify.css` – site-specific styles and overrides
- `styles.css`, `js/{audio,main,rays,visuals}.js`, `audio/` – copied from Sonara (`explorations/sonara`)
- `js/pages.js` – page order + links (edit this)
- `js/sonify.js` – YouTube click-to-play facades, solar flow canvas
