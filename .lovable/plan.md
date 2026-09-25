# Mobile-first review: audit, then fixes

Phase 1 is a written audit and changes no code. Phase 2 starts only after you approve the audit.

## Audit findings (Phase 1)

### High
| File | Problem | Fix |
|---|---|---|
| layout/DashboardLayout.tsx | The sidebar is always fixed on the left (`w-60`/`w-16`) and the page content is pushed over with `ml-60`. At 320px the page scrolls sideways and there's no mobile menu. | Below `lg`, hide the sidebar and open it from a menu button in the header using the shadcn Sheet. Keep the sidebar that stays on screen and can collapse at `lg` and up. Add labels to the collapse and sign-out buttons for screen readers when collapsed. |
| member/VotePage.tsx | On mobile, the button to submit or confirm a vote sits below the ballot, out of thumb reach. Success and failure messages are not read out to screen readers. | Add a submit bar that sticks to the bottom on mobile and respects the phone's safe area. Add an `aria-live` region for the result. Voting logic stays the same. |
| index.html | Placeholder title and description. Viewport lacks `viewport-fit=cover`. No manifest or theme-color. | Set real titles and descriptions for VoteWell Secure, add `viewport-fit=cover`, and add the manifest and theme-color. |
| (none) | No web app manifest or icons. | Add `public/manifest.webmanifest` with 192px and 512px icons, `display: standalone`, and theme and background colours (see PWA note below). |
| member/Results.tsx, group/ElectionDetail.tsx | Result and candidate rows are laid out in wide rows that break at 320px. | On mobile, show stacked cards, or put tables inside an `overflow-x-auto` wrapper. |

### Medium
| File | Problem | Fix |
|---|---|---|
| components/ui/input.tsx (and every form) | Text is `text-sm` (14px) on mobile, so iOS zooms in when you tap a field. | Use `text-base md:text-sm` in the shared Input, Textarea and Select. |
| Login, Register, ForgotPassword, Contact | Missing `autoComplete` (email, current-password, new-password, name, tel). Contact phone field doesn't use `type="tel"`. | Add the right `autoComplete` values and input types. |
| group/ElectionCreate.tsx | The 2-column date and position grids don't stack on narrow screens. The icon-only button that removes a position has no label and is 36px. The Cancel and Create buttons sit in one row. | Use one column at base and two at `sm`. Add `aria-label` and make the button 44px. Stack the buttons full-width on mobile. |
| group/Elections.tsx | Each row puts the title and status side by side with `justify-between`, so they collide at 320px. | Use `flex-col sm:flex-row`, wrap badges, and make the whole row a proper link that shows focus. |
| Dashboards (admin, group, member) | Buttons that do nothing ("Quick actions") and headers that don't wrap. | Wire the buttons to real pages. Scale headings down on small screens (`text-xl sm:text-2xl`). |
| App.tsx | Every page loads up front. | Load each page only when it's opened (`React.lazy`) inside `Suspense`, with a skeleton while it loads. |
| Pages that load data (elections, nominations, vote, results) | Loading shows plain text or nothing, so the layout jumps. | Show shadcn Skeleton placeholders plus clear empty-state panels. |
| Home.tsx | The floating and entrance animations ignore reduced-motion settings. The hero image isn't lazy-loaded and has no size set. | Turn off `animate-float` and entrance motion when reduced motion is on. Set width and height, plus `loading="eager"` for the hero and lazy loading for anything below it. |

### Low
| File | Problem | Fix |
|---|---|---|
| NotFound, Unauthorized | `min-h-screen` (can be the wrong height on mobile browsers) and a hardcoded `bg-muted` screen. | Use `min-h-dvh`. |
| PublicNavbar.tsx | Mobile menu is a hand-built panel with no focus trap. The menu button is 24px. | Switch to the shadcn Sheet and make the button 44px. |
| Pricing.tsx, Features.tsx | Card grids start at 1 column, which is good, but the gaps are too tight at 320px. | Adjust padding and gaps. |
| Links styled with `hover:underline` or hover colours | Hover is the only visual cue. | Add `focus-visible` rings. Limit hover effects to devices that can hover via a `hover:` media variant in the Tailwind config. |
| index.css | No safe-area helpers and no global reduced-motion rule. | Add `.pb-safe` / `.pt-safe` utilities using `env(safe-area-inset-*)` and a `prefers-reduced-motion` rule. |
| src/assets/hero-voting.jpg | 57KB. That's fine. | No change. |

### Accessibility (general)
- Check that every page has one h1 and no skipped heading levels (a few cards jump from h1 to h3).
- Give each form field a proper label and announce errors with `aria-describedby`.
- Colour contrast: `text-sidebar-foreground/70` on navy is fine, but `/50` hover states need checking.

## PWA note
The brief asks for a service worker. It would only cache the app's own static files. It would never cache sign-in, ballots, votes or data from the backend (all requests to the backend would go straight to the network). It would also stay turned off in the editor preview so it can't serve stale pages. Offline caching only works in the published app.

## Phase 2 order (after approval)
1. Dashboard layout and mobile menu, public navbar sheet, safe areas
2. Vote page thumb bar and live announcements (presentation only)
3. Forms: input sizes, autocomplete, input types, ElectionCreate layout
4. Results and lists on mobile
5. Loading skeletons, empty states, page-by-page loading
6. Reduced motion, focus states, heading fixes
7. Manifest, icons, meta tags, then the service worker
8. Check at 320, 375, 768, 1024 and 1440px, then list what still needs testing on real iOS and Android phones

I'll summarise each area with the files touched after I finish it.

## Constraints
No changes to sign-in, permissions, database security rules, how votes are submitted, or the data model. No new UI libraries. Existing branding stays.
