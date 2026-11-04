---
name: FireDrill Courtroom (mixed)
description: An editorial courtroom on cream paper and deep forest, with four hues that each mean one thing (lime the fixer, tangerine the attack, sky the gate, lilac the human). One page per step, each in its own colour.
colors:
  tangerine: "#FF8A3D"
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
  scarlet: "#E5383B"
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
| tangerine #FF8A3D | the attack | attack page board, breaker avatar, attack branch and tags, idempotency case |
| sky #8FCBF2 | the gate | room page board, gate avatar, "testing" seal and waiting states, rate-limit case |
| lilac #C4B3F6 | the human | sign-off page board, approver avatar, pagination case |

Jade (#1FA463) is a pass and scarlet (#E5383B) a failure. Sage, moss, pine and stone are quiet supporting neutrals. There is no navy, pink or purple-blue.

Each step of the drill has its own board, matching whoever acts on that page:

| Page | Board | Text on it |
|---|---|---|
| Case | cream | forest |
| Room | sky | forest |
| Attack | tangerine | forest |
| Ruling | forest | cream |
| Sign-off | lilac | forest |

`App.tsx` sets `--board` and `--on-board` on `<html>` from `PAGE_INK`, and the board eases between pages. When the board is forest, `<html>` gets `board-dark` so the brand mark and grain adjust. Content sits on rounded forest panels (`.panel`), and the hues come back inside them as avatars, chips and tags. Forest text on every board is at least 6:1.

**Liquid field** (`src/ui/LiquidChrome.tsx`): the reactbits Liquid Chrome warp, with its silver replaced by a ramp (deep forest, forest, pine, the hot colour, cream), lit more towards the bottom. On the home hero the hot colour turns lime → sky → lilac → tangerine every 4.5s (held still under reduced motion), and the "Pick a case" button follows it. Hovering a case pours that case's colour. On the ruling page it pours the verdict's colour. A forest scrim keeps the hero text readable.

## Pages

Hash routes, so any static host works:

| Route | Page |
|---|---|
| `#/` | Home: liquid hero, three cases, "Five steps, one gate." |
| `#/case/<run>/case` · `/room` · `/attack` · `/ruling` · `/signoff` | The five steps |
| `#/live/<page>` | The same pages following a running gate |

`?step=<n|end>` pauses at that frame, and old `?replay=` links are upgraded. While playing, the app follows each frame to its page (`src/pages.ts → pageTrack`). A newly opened page lingers about 2s.

## Colors in use

- **Cast:** fixer lime, breaker tangerine, gate sky, approver lilac, guest stone. Avatars are discs of the colour with the role's tool drawn in forest.
- **States:** pass jade, fail scarlet, waiting sky, gate error tangerine. The merged seal is lime.
- **Cases:** idempotency tangerine, rate limit sky, pagination lilac.
- **Tags:** pills of the colour with forest text. On forest panels the text is on / on-2 / on-3.
- **Rules:**
  - Body text on every light board is forest, never cream.
  - Jade and scarlet are used as fills, big type, or beside an icon and a word, never as the only signal.
  - A hue never changes meaning. If tangerine shows up, it is about the attack.
  - Banned: navy, pink, purple-blue gradients, pure black and pure white. The only gradients are the liquid field and the hero's forest scrim.

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
