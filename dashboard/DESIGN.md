---
name: FireDrill Courtroom
description: A bright, friendly console that lets anyone follow an adversarial hotfix drill and see why nothing merges without proof.
colors:
  canvas: "#F5F6FC"
  card: "#FFFFFF"
  soft: "#F1F3FA"
  line: "#E4E7F2"
  ink: "#141A33"
  ink-secondary: "#4A5272"
  ink-tertiary: "#8A91AB"
  fixer: "#7C3AED"
  breaker: "#DB2777"
  gate: "#2563EB"
  approver: "#0D9488"
  pass: "#059669"
  fail: "#E11D48"
  wait: "#0284C7"
  error: "#9333EA"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13.5px"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 800
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontWeight: 400
rounded:
  card: "24px"
  inset: "16px"
  control: "999px"
---

# Design System: FireDrill Courtroom

## Overview

A light, colourful console meant to read at a glance for anyone: engineers, managers, students. Every state is a colour **and** a word **and** an icon. A one-sentence narrator names what just happened in plain language, and everything on screen is derived from recorded frames. This document describes the dashboard, not backend behaviour.

## Colors

A pale lavender canvas with slowly drifting blurred colour behind frosted-white cards. No orange, amber or black anywhere. The cast has fixed colours: **violet** the fixer, **pink** the breaker, **blue** the gate, **teal** the approver, slate for guests. States: emerald PASS/GREEN/MERGED, rose RED/refused, sky PENDING, purple ERROR. Discarded (Rule R3) tests are neutral slate with hatching, not red: they are not failures.

## Typography

Inter for UI and headings (self-hosted in `public/fonts/`, keep the licence files), JetBrains Mono for commands, SHAs, verdict ids, durations and test output.

## Layout

Header (brand, provenance badges, player), three incident cards, the journey map with a scrubber, the narrator banner, then three cards: room, case file, ruling. At ≥1024px the cards share the viewport and scroll on their own; below that everything stacks and the page scrolls. No horizontal page scroll at any width.

## Interaction

Every tappable component responds: a ripple from the touch point (a short buzz on phones), a press-in, a hover lift. Each also does something real: journey nodes and verdict dots seek the replay; avatars filter the room by role; bubbles expand; the brief expands; attack tiles flip to show output; check rows open stdout; the seal wiggles (confetti when GREEN or merged); the narrator banner steps forward; the approve command copies. Space plays/pauses and arrows step. Motion is disabled under `prefers-reduced-motion`.

## Do's and Don'ts

- Do keep the visible focus ring (2px violet), the skip link, and status text next to every colour.
- Do label scripted participants and test-verifier recordings honestly and keep the "What's real?" disclosure.
- Do show missing output, missing diff data and idle/pending states explicitly. Preserve `?replay=<run>&step=<n|end>`.
- Don't invent timings, diffs, approval identities, verification results or merge receipts.
- Don't hide the repro-only warning ("no attack, no sign-off"), and don't let a historical verdict change the current gate state.
