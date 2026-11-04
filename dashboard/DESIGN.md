---
name: FireDrill Courtroom (mixed)
description: An editorial courtroom on cream paper and deep forest, with four hues that each mean one thing (lime the fixer, rose the attack, sky the gate, lilac the human). One page per step, each in its own colour.
colors:
  rose: "#FF8FB1"
  sky: "#8FCBF2"
  lilac: "#C4B3F6"
  forest: "#0F2A1D"
  panel-1: "#143322"
  panel-2: "#1B3F2B"
  panel-3: "#255036"
  pine: "#2F5D3F"
  moss: "#7FB77E"
  sage: "#A9C5A0"
  cream: "#F3EEDF"
  lime: "#C6F432"
  on: "#F3EEDF"
  on-2: "#CDD8C4"
  on-3: "#9BB092"
  jade: "#1FA463"
  scarlet: "#FF6B6B"
  stone: "#B9C4B0"
typography:
  display:
    fontFamily: "Instrument Serif (400 + italic)"
    use: "Titles, panel headings, big numbers, the verdict. Sentence case; the last word of a page title is italic."
    fontSize: "48-96px (pages), 64-150px (home)"
  body:
    fontFamily: "Bricolage Grotesque (variable, wght 200-800, wdth 75-100, opsz)"
    fontSize: "16-21px"
  label:
    fontFamily: "Bricolage Grotesque"
    style: "12px, 600, uppercase, +0.14em"
  mono:
    fontFamily: "JetBrains Mono"
    use: "SHAs, commands, test output, numbered facts"
rounded:
  panel: "22px"
  card: "18-26px"
  inset: "14px"
  control: "999px (pills in the bars, nav and chips)"
---

# Design System: FireDrill Courtroom (mixed)

## Overview

The ground is cream paper (#F3EEDF) and deep forest (#0F2A1D). Four hues sit on that ground, and each one stands for one member of the cast, wherever it appears:

| Hue | Means | Where it shows |
|---|---|---|
| lime #C6F432 | the fixer, "go" | fixer avatar and patch card, the merged seal, primary calls to action |
| rose #FF8FB1 | the attack | attack page board, breaker avatar, attack branch and tags, idempotency case |
| sky #8FCBF2 | the gate | room page board, gate avatar, "testing" seal and waiting states, rate-limit case |
| lilac #C4B3F6 | the human | sign-off page board, approver avatar, pagination case |

Jade (#1FA463) is a pass and scarlet (#FF6B6B) a failure. Sage, moss, pine and stone are quiet supporting neutrals. There is no navy, pink or purple-blue.

Each step of the drill has its own board, matching whoever acts on that page:

| Page | Board | Text on it |
|---|---|---|
| Case | cream | forest |
| Room | sky | forest |
| Attack | rose | forest |
| Ruling | forest | cream |
| Sign-off | lilac | forest |

`App.tsx` sets `--board` and `--on-board` on `<html>` from `PAGE_INK`, and the board eases between pages. When the board is forest, `<html>` gets `board-dark` so the brand mark and grain adjust. Content sits on rounded forest panels (`.panel`), and the hues come back inside them as avatars, chips and tags. Forest text on every board is at least 6:1.

**Liquid field** (`src/ui/LiquidChrome.tsx`): the reactbits Liquid Chrome warp, with its silver replaced by a ramp (deep forest, forest, pine, the hot colour, cream), lit more towards the bottom. On the home hero the hot colour turns lime → sky → lilac → rose every 4.5s (held still under reduced motion), and the "Pick a case" button follows it. Hovering a case pours that case's colour. On the ruling page it pours the verdict's colour. A forest scrim keeps the hero text readable.

## Pages

Hash routes, so any static host works:

| Route | Page |
|---|---|
| `#/` | The landing page (below). Old `#/landing` links still land here, and the FireDrill mark on every page leads back to it. |
| `#/cases` | The case list: liquid hero, three cases, "Five steps, one gate." "Open the courtroom" and the console's `home` lead here. |
| `#/case/<run>/case` · `/room` · `/attack` · `/ruling` · `/signoff` | The five steps |
| `#/live/<page>` | The same pages following a running gate |

`?step=<n|end>` pauses at that frame, and old `?replay=` links are upgraded. While playing, the app follows each frame to its page (`src/pages.ts → pageTrack`). A newly opened page lingers about 2s.

## Colors in use

- **Cast:** fixer lime, breaker rose, gate sky, approver lilac, guest stone. Avatars are discs of the colour with the role's tool drawn in forest.
- **States:** pass jade, fail scarlet, waiting sky, gate error rose. The merged seal is lime.
- **Cases:** idempotency rose, rate limit sky, pagination lilac.
- **Tags:** pills of the colour with forest text. On forest panels the text is on / on-2 / on-3.
- **Rules:**
  - Body text on every light board is forest, never cream.
  - Jade and scarlet are used as fills, big type, or beside an icon and a word, never as the only signal.
  - A hue never changes meaning. If rose shows up, it is about the attack.
  - Banned: navy, pink, purple-blue gradients, pure black and pure white. The only gradients are the liquid field and the hero's forest scrim.

## Landing page (`#/`, the front door)

A front door for people who have never seen FireDrill. It borrows its structure from a cinematic, chaptered landing page:

1. a drawn world under the title;
2. a story band with figures;
3. a pinned reel;
4. the steps;
5. a closing word;
6. a footer.

It is styled **neo-brutalist** in this same palette: 3px forest outlines, hard offset shadows with no blur (`.nb`, `.nb-lg`, and `.nb-btn`, which sinks into its shadow when pressed), flat fills and dot-grid grounds.

- **Hero** (`src/ui/CourtScene.tsx`): a hand-built SVG, not a picture. The courthouse's five columns wear the five steps' colours, the gate's seal is the sun, and FIREDRILL stands behind the front steps like an inscription. There is a lantern, flat clouds, and outlined confetti on a canvas. The layers part with the pointer and the scroll. There are two compositions: wide, and tall for phones and portrait screens.
- **Sections:**
  - Story: the stats are counted from the bundled recordings and labelled as scripted replays.
  - Two crossing tickers carry the rules.
  - A reel of the three cases, pinned on wide screens and stacked on narrow ones, shows each verdict trail from the recording.
  - The five steps.
  - The verdict, with a giant outlined "Merged".
  - The footer.
- **Motion:**
  - `motion` handles component entrances.
  - **GSAP** (`src/ui/landingFx.tsx`, with ScrollTrigger and SplitText) handles:
    - a cursor ring that swells over controls;
    - magnetic main buttons;
    - paragraphs that rise line by line;
    - tickers that skew with scroll speed;
    - the hero copy drifting away;
    - the footer wordmark assembling letter by letter.
  - The cursor and magnets run only on a fine pointer. Under reduced motion, GSAP does nothing.

## Typography

- **Instrument Serif speaks:** page titles (the last word in italic, via `Headline`), panel headings, case names, big counters and the verdict.
- **Bricolage Grotesque does the work:** body, buttons, tabs, chips. It is sentence case and semibold at most. Labels are small uppercase tracked Bricolage.
- **JetBrains Mono** is only for code-like things: SHAs, commands, test output.
- All three are self-hosted in `public/fonts/`, with their OFL licences beside them.

## Motion and touch

`motion` and `lenis`. Every component has its own movement and touch response:

- Titles scramble in and rise.
- The hero field follows the pointer and pours the hovered case's colour.
- Case cards lift.
- Tabs grow.
- Messages fly in and dim the rest when one opens.
- Attack tiles shake and flip.
- The seal stamps down, its ring fills, and tapping it on a pass sets off confetti.
- The padlock lifts.
- The copy button morphs.
- Every `.tap` ripples, and buzzes on phones.

Confetti is printed in all the hues. Opening a case that has already merged does not celebrate; reaching the merge during playback does. Everything respects `prefers-reduced-motion`.

## Do's and Don'ts

- **Do** keep:
  - the visible focus ring (3px: on-board colour on the board, lime inside forest panels);
  - the skip link;
  - a word and an icon beside every colour;
  - "What's real?" and the scripted and test-verifier labels.
- **Don't:**
  - invent timings, diffs, identities, verdicts or merge receipts;
  - add an approve button;
  - add a fifth hue, or use one of the four for something other than its role;
  - set body text in the serif, or titles in the grotesk.

## Console (replaces the video-style player)
A glass window that is hidden until asked for (`src/ui/Console.tsx`, logic in `src/console.ts`). It is not a media player: no play/pause, no scrubber, no speed, and Space does nothing.
- **Hidden by default.** The page shows a small glass pill at the foot: `‹  ❯ Console 12/48  ›`. The arrows step the replay without opening anything. Click the pill, or press `/` or a backtick, and the window springs up out of it (blur, scale, rise); Escape puts it away again and returns focus to the pill. It stays open while you move between pages.
- **Its own controls, no window dots.** A glass tab overhangs the window's top-left corner. In it: three rising bars that set the size (prompt only, normal, large; the lit bar is the current one, in a lime-to-sky gradient), the title, and a fold (a tilted lozenge that opens into a circle as you reach for it) that puts the console away. A command typed while it is prompt-only reopens the log so the answer is visible. "Next" is a slanted lime-to-sky blade.
- **Glass, with colour, and not a rectangle.** The window is a leaf: two large opposite corners, two small ones, with the tab riding the top-left. A frosted pane (`backdrop-filter: blur(30px) saturate(190%)`) with lime, sky, lilac and rose light pooled inside, lit from the top left, and a rainbow edge drawn as a masked conic-gradient border so it follows every curve. Its ink is the page's own `--on-board`, so it reads on cream, sky, rose, lilac and forest alike; on the dark ruling page it turns smoked glass. The pill carries a slowly turning orb of the four hues.
- **Transcript.** The room log scrolls by as lines in JetBrains Mono. Each line is printed from exactly one recorded frame (time, who, what), followed by a dim `# plain-language comment`.
- **Prompt.** A real input. Enter runs the next step. Commands: `next [n]`, `back [n]`, `run` (plays on its own; any key stops it), `reset`, `goto <page>`, `case <name>`, `status`, `clear`, `home`, `help`. Tab completes, Up/Down walks history.
- Opening a case no longer auto-plays; it waits for you. The console is labelled "scripted cast" for recorded drills.

## Colour tokens added with the console
- The attack colour is rose (`#FF8FB1`), not orange.
- Scarlet is `#FF6B6B` (forest text on it passes AA). `flare` (`#FF8585`) and `mint` (`#3DDC8F`) are the text-safe tints of fail and pass for use on forest panels; use scarlet and jade for fills.

## Tests
`npm test` runs the unit tests (vitest). `npm run e2e` runs Playwright against the dev server in Chrome, on a desktop and a phone profile: the console (hidden by default, animation, size steps and fold, no mac dots, every command, run/stop, every incident to its merge), every route for page errors and horizontal scroll, axe (serious and critical rules) with the console open, and WCAG AA colour contrast with it closed.
