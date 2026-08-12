# My School — Search Bars Design

**Date:** 2026-08-11
**Status:** Approved

## Problem

On `/my-school` (`app/(dashboard)/my-school/SchoolHubClient.tsx`), alumni, faculty/staff, and students browsing to send a partnership request (`RequestPartnershipModal`) have to scroll a flat, unfiltered card grid. At schools with many students this list gets long enough that finding a specific person is difficult. There is currently no way to filter any of the four sections (Staff, Mentor Spotlight, Alumni Network, Students) by name.

**Standing preference:** going forward, any list/browse UI in this app with more than a handful of items should include a search bar by default — this is a general pattern to apply, not a one-off fix.

## Scope

Add a search input to three sections on `SchoolHubClient.tsx`:
- **Staff**
- **Alumni Network**
- **Students**

**Out of scope:** Mentor Spotlight (short, curated subset of alumni — not the pain point called out).

## Design

- Each of the three sections gets its own local `useState<string>` query (`staffQuery`, `alumniQuery`, `studentQuery`), independent of the others.
- Match logic: case-insensitive substring match against `displayName` only (no other fields — e.g. industry, staff title, grad year are not searched).
- Filtering is pure client-side over the props already passed into the component (`staff`, `alumni`, `students` are already fetched in full by the server component) — no new API calls or query params.
- **Alumni Network composition:** the section already has an All/Mentors toggle (`alumniFilter`) that derives `visibleAlumni`. The search query filters `visibleAlumni` further (toggle first, then search) rather than replacing or bypassing the toggle.
- **Placement:** search input sits in each section's header row, next to (not replacing) the existing heading text. For Alumni Network, it sits alongside the existing All/Mentors toggle buttons.
- **Empty state:** when a query filters a section down to zero results, show a small inline message ("No staff match your search." / "No alumni match your search." / "No students match your search.") — same visual treatment as the existing "no staff/alumni/students yet" empty states, distinct copy.
- **Selection mode interaction:** `selectMode`/`selected` (used to build a partnership request) is untouched by search. Filtering only changes which cards are rendered — a card that's checked and then scrolled out of view via a new search query stays checked, and stays counted in the floating "N selected" bar at the bottom. Unchecking still requires the card to be visible (matches current single-click-card-to-toggle behavior).

## Non-goals

- No fuzzy matching, no debounce (lists are already fully loaded client-side and typically small enough that instant `.includes()` filtering per keystroke is cheap).
- No persistence of search query across navigation/reload.
- No changes to the Mentor Spotlight section.
- No changes to `RequestPartnershipModal.tsx` itself (it only renders already-selected people).

## Testing

- Manual: type a partial name into each of the three search inputs, confirm the grid filters live and empty-state copy shows correctly when no match.
- Manual: select a few people, then type a search query that hides one of the selected cards — confirm the floating "N selected" count doesn't change and the modal still includes that person when opened.
- Manual: Alumni Network — toggle to "Mentors", then search — confirm both filters compose (not either/or).
