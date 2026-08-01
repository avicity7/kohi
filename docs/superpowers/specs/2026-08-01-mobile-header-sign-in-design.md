# Mobile Header Sign-In Design

## Problem

At phone widths, the site header becomes a vertical flex stack. The anonymous
"Sign in" link therefore occupies its own row after the full-width search
field. Right-aligning that isolated row keeps the control compact, but makes it
look detached from the site identity and produces the odd positioning reported
by the user.

## Design

Group all authentication actions in a `header-actions` container. At widths up
to 520px, render the header as a two-column grid: the site title occupies the
first column and the action group occupies the second column on the first row.
The search field and filter chips each span both columns on subsequent rows.

The action group remains an inline flex row so the authenticated state can show
"Add" and "Sign out" together. The anonymous "Sign in" control retains a
minimum height of 44px for a reliable touch target. Desktop layout continues to
use the existing wrapping flex header, with the grouped actions treated as one
item.

## Alternatives Considered

- Absolute positioning: fewer markup changes, but fragile with dynamic header
  height, sticky positioning, and authenticated actions.
- Flex `order` and alignment changes: workable for the anonymous state, but
  difficult to make coherent when two authenticated actions are present.
- Explicit grid with grouped actions: selected because it expresses the visual
  relationships directly and works for both authentication states.

## Testing

Add a component-structure regression test that verifies:

- the anonymous sign-in link is inside `header-actions`;
- the phone header uses a two-column grid;
- the title and action group share the first row;
- search and filter chips span the full mobile header width;
- the sign-in target retains a 44px minimum height.

Run the focused route test, the complete test suite, and the production build.
If a browser preview is available, also inspect 320px, 390px, 520px, and a
desktop width. In this session the in-app browser is unavailable, so automated
layout assertions and the production compiler are the verification sources.

## Scope

Only the home-page header markup, responsive CSS, and its regression test are
changed. No authentication behavior, content, or unrelated responsive layout is
modified.
