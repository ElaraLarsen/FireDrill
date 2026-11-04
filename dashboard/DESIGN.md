---
name: FireDrill Courtroom
description: A precise developer console for inspecting adversarial hotfix evidence.
colors:
  obsidian: "#06070A"
  panel: "#0B0D13"
  raised: "#10131C"
  raised-secondary: "#181D29"
  hairline: "rgb(255 255 255 / .08)"
  border-strong: "#303747"
  foreground: "#F3F4F6"
  muted: "#9CA3AF"
  faint: "#8993A5"
  indigo: "#818CF8"
  rose: "#FB7185"
  crimson: "#F43F5E"
  cyan: "#38BDF8"
  emerald: "#34D399"
  merged: "#10B981"
  amber: "#FBBF24"
  violet: "#C4A2FF"
typography:
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  verdict:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(38px, 4.35vw, 78px)"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, Consolas, monospace"
    fontWeight: 400
rounded:
  badge: "4px"
  control: "6px"
  inset: "7px"
  panel: "10px"
spacing:
  compact: "8px"
  inset: "12px"
  mobile-gutter: "16px"
  panel: "18px"
  desktop-gutter: "24px"
components:
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
  inset-card:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.inset}"
---

# Design System: FireDrill Courtroom

## Overview

A high-precision observability console: a chronological room trace, inspectable verification evidence, and a prominent current verdict. Evidence determines every status. This document describes the dashboard implementation; it does not certify backend behavior.

## Colors

Obsidian anchors tonal surfaces with 1px hairline borders. Indigo identifies the fixer and interactive focus, rose the red-team and failed checks, cyan the gate, emerald authenticated approvers and passed checks. Guest messages use muted rose (`#C58B96`). Amber marks caution and the Rule R3 filter; violet identifies verifier errors. Pair color with text and icons.

The top ambient radial tint follows current state: neutral indigo, crimson on RED, emerald on GREEN or merged, each at 9% opacity. Merged monuments use solid `merged` with dark text; ordinary GREEN remains a tinted surface.

## Typography

Inter carries UI text and large verdicts. JetBrains Mono carries commands, SHAs, verdict IDs, durations, counters, and terminal output; numeric values use tabular figures. Dense evidence text is generally 10–12px, with clear 13–14px section headings. Preserve legibility when adding metadata.

Fonts are self-hosted in `public/fonts/`. Upstream files: `rsms/inter` → `docs/font-files/InterVariable.woff2`; `JetBrains/JetBrainsMono` → `fonts/webfonts/JetBrainsMono-Regular.woff2`. Keep `Inter-LICENSE.txt` and `JetBrainsMono-OFL.txt` with the bundled assets.

## Layout

At widths ≥1280px, the viewport shell holds the command bar and docket outside the scrolling workspace. The three panel tracks have a 3:5:4 ratio (room / case and QA / verdict). Each panel owns its evidence scroll; avoid adding another workspace scroller. Desktop gutters are 24px and gaps 14px; ≥1800px uses 32px gutters and 20px gaps. The shell has a 650px minimum height.

At 768–1279px, the room spans two columns above the case and verdict, with room height capped at 420px. Below 768px, panels stack in one column with 16px gutters. The incident switcher and docket may scroll horizontally; QA rows wrap and drop dashed leaders. Small crosshair markers identify major panel corners.

## Elevation & Depth

Depth comes from surface tone, hairline borders, and restrained state tint rather than drop shadows. A 5-second linear trace crosses the verdict's top border. Controls use 160ms color transitions and a 140ms press transition with `cubic-bezier(.23,1,.32,1)`. Reduced motion disables animation, transitions, and smooth scrolling entirely.

## Shapes

Use 10px outer panels, 7px inset cards, 6px controls, and 3–5px compact metadata shapes. Timeline dots are circular; message cards have a straight left edge and a role-colored border. Keep structural borders thin.

## Components

- **Command bar:** indexed incident segments, replay transport, speed, and frame count. Space toggles playback and arrow keys step outside focused controls. Keep unavailable actions disabled. Preserve `?replay=<run>&step=<n|end>` entry points.
- **Room trace:** role badges, timeline spine, and structured SUBMIT / ATTACK / APPROVE / STATUS or gate-result pills. Long messages expand. New frames follow the stream; reduced motion uses immediate scrolling.
- **Case inspector:** keyboard-operable brief/patch tabs. Show supplied branch, SHA, author, and diff statistics; missing metadata gets explicit empty text.
- **QA matrix:** named checks, FIX/REF target, measured duration, icon, and result. Native disclosure rows reveal the supplied `output_tail` with error/pass highlights. Historical verdict selection changes inspected checks, not the current verdict or vault.
- **Rule R3:** a dedicated amber callout separates discarded overbroad tests from checks against the submitted fix. Disclosure exposes exclusion reasons and reference validation.
- **Verdict and vault:** distinguish repro-only GREEN, surviving all checks, pending, error, RED, and merged. The three locks display attack execution, fix checks plus invariant, and authenticated participant sign-off from state. Approval instructions belong in the Switch room; the dashboard displays evidence and receipts.
- **Docket:** event-derived milestone buttons seek to their actual frame and pause playback. Preserve range input keyboard access, current-step semantics, and visible focus.

## Do's and Don'ts

- Do keep visible focus (2px indigo outline), skip navigation, readable disclosures, and status text alongside icons.
- Do label scripted participants and test-verifier recordings honestly, retaining the Evidence provenance disclosure.
- Do show missing output, missing diff metadata, idle, pending, and fault states explicitly.
- Don't invent timings, patch statistics, approval identities, verification results, or merge receipts for presentation.
- Don't turn historical QA inspection into a change to the current gate state, or hide the repro-only sign-off warning.
