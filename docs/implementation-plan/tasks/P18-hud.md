# P18 — Action feedback, accessible dialogs, and keyboard board actions

**Status:** Not started. **Dependencies:** P03, P04, P17. **Goal:** players understand available actions and can complete existing gameplay using keyboard or touch.

## Read and edit

`src/ui/hud.ts`, `src/ui/styles/hud.css`, tokens/craft styles, Game input blocking, and existing legal snapshot fields. Add small dialog/focus helpers under `src/ui/`; retain vanilla TypeScript.

## Steps

1. Use stable HUD regions (message/dice, players, resources, actions, modal) and event delegation. Update changing content without replacing focused inputs indiscriminately. Preserve P04 freshness identity rather than replaying entry animations on unrelated renders.
2. Derive build availability from validated legal targets, costs, and piece limits. Show disabled buttons with concise visible reasons and cost text. Keep the engine authoritative. Bank trade should explain identical resources/insufficient cards; discard should show remaining count and reject fractions visibly.
3. Keep trade selection and per-player discard draft in HUD state. Preserve them on unrelated renders and storage/style updates. Clear them on successful completion, player/phase transition, or explicit cancel as appropriate. A failed command keeps the draft and explains recovery.
4. Implement modal dialog semantics, labelled headings, initial focus, Tab containment, and focus return. Escape closes trade/Style but cannot skip required discard/steal; describe that requirement in text. Block board picking and camera interaction while a modal owns input. Do not trap focus in hidden DOM.
5. Add a collapsible `Board actions` list for current legal vertices/edges/hexes. Give each a stable ID and readable nearby terrain/number description. Arrow keys move list focus; focus highlights the corresponding board site; Enter activates the same engine command as pointer picking. Use normal buttons and preserve their focus after a rejected command.
6. Add a restrained aria-live status for phase/result changes, not every frame or resource-cell update. Include player names and textual resource labels; color alone is not the only cue.
7. Reposition Style so it does not overlap the player panel. Use P17 safe-inset measurements, 44 px touch targets, visible focus styling, and responsive wrapping. Keep typography and general visual language.

## Acceptance

Complete setup, a roll/build/trade, discard, and robber selection with keyboard only. Focus stays in/returns from dialogs correctly; screen-reader status announces once. Invalid actions give recoverable explanations. No overlap at core/mobile viewports. Repeated dice still animate correctly; reduced-motion preference works. Build/typecheck/smoke pass.

## Boundaries

No React rewrite, new gameplay actions, full rules tutorial, or guarantee of formal accessibility certification. Test the documented flows and record remaining limitations.

**Copyable prompt:** Implement P18 only. Improve stable HUD state, actionable errors, dialog focus, and the keyboard legal-action list using existing engine commands. Verify keyboard/touch/reduced-motion cases and update STATUS.
