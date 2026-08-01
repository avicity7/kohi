# Responsive dial-in editor

**Date:** 2026-07-31
**Scope:** Repair the add/edit dial-in experience on phone viewports and refine the same component on larger screens.

## Context

`DialinForm.svelte` uses a native modal `<dialog>` styled as a right-hand drawer on desktop and a bottom sheet below 520px. The mobile rules set a content-box dialog to `width: 100%` while retaining horizontal padding, so its rendered box exceeds the viewport. The repeatable grind and pour grids also retain three or four columns whose intrinsic widths cannot shrink enough for a phone. Because the entire long sheet scrolls, its close and save controls can move out of reach, especially when the software keyboard reduces the visual viewport.

## Chosen direction

Use one adaptive editor:

- At widths above 520px, retain a right-hand drawer.
- At widths of 520px and below, make the dialog an edge-to-edge, full-height editor.
- Keep the header and action bar visible while only the form body scrolls.
- Preserve the native dialog's focus trapping, Escape behavior, and backdrop.

A patched bottom sheet was rejected because a partially tall surface is a poor fit for a long, dynamic form. A centered modal was rejected because it offers less usable space on both phones and desktop.

## Layout

The dialog is a three-row grid:

1. A header containing a small context label, a concise title, and a 44px close button.
2. A scrollable body containing feedback, fields, dynamic rows, and the edit-only delete action.
3. A footer containing Cancel and Save.

The scrollable body contains the create/update form followed by the edit-only delete form, visually separating destructive actions from routine fields. The header and footer remain fixed siblings of that body. The footer's Save button targets the create/update form through its native `form` attribute, preserving standard HTML submission without nesting the delete form.

On desktop, the dialog is a slightly wider right drawer with a maximum width that still respects narrow laptop windows. On phones, it occupies the dynamic viewport and removes the drawer border radius. Safe-area insets pad the header and footer where supported.

## Form presentation

- Group fields into readable sections for coffee identity, recipe, grinder settings, and notes without changing submitted field names.
- Keep related short numeric fields in two columns when space permits.
- Below the phone breakpoint, allow only pairs that remain comfortably usable; repeatable grind and pour rows become labeled card-like stacks rather than compressed multi-column grids.
- Set form controls to at least 16px on phones to prevent iOS input zoom.
- Use 44px minimum targets for close, row removal, and primary actions.
- Make Save the visually dominant action. On phones, Cancel and Save share the footer width, with Save receiving greater emphasis.
- Keep the destructive delete action separate and subdued until intentionally selected.

## Interaction and accessibility

- Preserve create, edit, delete, validation, method switching, dynamic row addition/removal, Escape, Cancel, and close behavior.
- Add an accessible dialog label relationship and contextual title treatment.
- Use visible `:focus-visible` outlines instead of relying only on border-color changes.
- Keep error feedback in the scrollable body and maintain its alert semantics.
- Prevent horizontal overflow at the dialog, grid-item, and input levels.
- Honor reduced-motion preferences if a dialog entrance transition is introduced; animation is optional and not required for this change.

## Error handling and data flow

No server action, form field name, or persistence behavior changes. Validation failures keep the dialog open, render the existing banner or inline errors, and retain entered values through the current enhanced-form flow. Successful create, update, or delete operations continue to close the dialog and refresh page data.

## Verification

- Add a source-level component regression test for the structural contract that enables independent scrolling, persistent actions, accessible labeling, and mobile-safe row classes.
- Run the new test once before implementation and confirm it fails for the missing structure.
- Run the complete Node test suite and production build after implementation.
- Inspect the rendered component on representative phone and desktop dimensions if an interactive browser is available. If it remains unavailable, document that limitation and use the regression test plus build output as the automated evidence.

## Out of scope

- Server actions, database schema, authentication, and dial-in data shape.
- A multi-step wizard or changes to which fields are required.
- Restyling the surrounding card list beyond any strictly necessary modal integration.
