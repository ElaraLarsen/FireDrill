# Product

<!-- impeccable:product-schema 1 -->

> Written unattended from the repository and the operator's chat instructions on 2026-11-04 (the operator asked not to be interviewed: "you're in control now"). Facts marked *(inferred)* are reasonable readings of the repo, not confirmed answers.

## Platform

web

## Users

- Hackathon judges and viewers watching a recorded FireDrill drill, often on a projector or a laptop, with no time to learn the system. *(inferred from README and demo script)*
- Engineers on the team who run a live gate locally and follow it in the dashboard.
- The operator wants it readable and inviting for anyone, "a 3-year-old, a 40-year-old, an 80-year-old".

## Product Purpose

The dashboard replays (or follows live) a FireDrill drill: a Claude fixer patches an incident, a Codex breaker attacks the patch, a gate agent runs real tests and merges only after the patch survives an attack and a named human signs off in the Switch room. Success: a first-time viewer can say who did what, why the first patch was refused, and why the merge was allowed.

## Positioning

Switch's own docs say human approval is "instructions only". FireDrill enforces it in code: sign-off is authenticated by Switch participant id, and only the gate holds the key to main.

## Operating Context

Replays of three recorded drills (`fixtures/*.jsonl`, scripted participants, real verifier evidence) on any static host; live mode over `ws://<host>:8787/telemetry` when a gate runs locally. One page per drill step: case, room, attack, ruling, sign-off.

## Capabilities and Constraints

- Read-only: no approve button; approval happens in the Switch room.
- Every value on screen is derived from recorded frames; nothing invented.
- Deep links `#/case/<run>/<page>?step=<n|end>` and legacy `?replay=` must keep working.
- Offline: fonts are self-hosted; no runtime network requests besides the gate.

## Brand Commitments

- Name: FireDrill. Line: "No attack, no sign-off."
- Fixed cast roles: fixer, breaker, gate, approver, guest.
- Operator's visual constraints (binding): vibrant, eye-catching colour; plain black allowed in places but not everywhere; no dark-blue/navy "AI theme"; no pink-on-navy. References the operator named: reactbits Liquid Chrome background, motion-primitives Text Scramble, Lenis smooth scroll, basement.studio, Watermelon UI.

## Evidence on Hand

Three recordings in `dashboard/fixtures/` with provenance sidecars. No customers, testimonials or benchmarks exist; none may be invented.

## Product Principles

1. Show, don't claim: every state comes from a real frame.
2. Every state is a colour, a word and an icon.
3. The refusal is the story: "no attack, no sign-off" must be impossible to miss.
4. Big, friendly, touchable: any age can follow it.

## Accessibility & Inclusion

Large type and targets, visible focus, status words beside colour, `prefers-reduced-motion` respected.
