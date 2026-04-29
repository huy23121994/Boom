---
sc: PWA-iPhone
title: iPhone Add-to-Home-Screen smoke test
status: pending
task: T024
---

# PWA iPhone Smoke Test

## Criterion

> App launches in `standalone` mode with the manifest name and icons after being installed to iPhone Home Screen via Safari. The smoke test passes.

## How to run (from quickstart.md "Manual PWA pass")

1. `npm run build && npm run preview -- --host`
2. Find the LAN IP in the Vite preview output (e.g. `http://192.168.x.x:4173`).
3. On iPhone Safari, navigate to that IP.
4. Tap the Share icon → "Add to Home Screen" → confirm the name is "Boom".
5. Launch the app from the Home Screen icon.
6. Check: does the browser chrome (address bar, toolbar) disappear? That confirms `standalone` mode.
7. Tap the bubble. Grant mic. Verify greeting plays.

## Checklist

- [ ] App installs from Safari "Add to Home Screen"
- [ ] Home Screen icon shows the correct Boom orb graphic (not a blank page screenshot)
- [ ] App launches in standalone mode (no Safari address bar / toolbar)
- [ ] Manifest `name` shown correctly in the install sheet and on the Home Screen
- [ ] Greeting plays after tap (TTS not blocked — user tap counts as gesture)
- [ ] Mic permission prompt appears; granting it starts listening

## Observations

**iPhone model / iOS version:**

**Issues encountered:**

## Result

- [ ] PASS — all checklist items ticked
- [ ] FAIL — describe

**Recorded by:** _(name)_ on _(date)_
