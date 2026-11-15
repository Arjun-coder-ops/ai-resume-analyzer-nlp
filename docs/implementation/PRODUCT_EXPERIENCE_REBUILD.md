# ResumeIQ Product Experience Rebuild

## Product direction

ResumeIQ is being rebuilt as an evidence led career workspace. The interface makes the relationship between a candidate document and a target role visible before it asks the user to make an editing decision. It avoids a decorative analytics dashboard and does not make claims the submitted analysis cannot support.

## Design decisions

- **Identity:** calm, editorial, and precise. A warm paper canvas makes documents legible; deep green anchors trustworthy actions; restrained terracotta marks comparison and items requiring review.
- **Typography:** Geist is the single interface face. Display moments use scale, weight, and spacing rather than a second display font.
- **Layout:** public pages read as a narrative. The authenticated product uses a narrow persistent rail and a contextual workbench instead of an array of competing cards.
- **Components:** surfaces are flat with a single structural border. Controls have small radii and visible keyboard focus. Status colors retain semantic meaning.
- **Motion:** GSAP motion communicates sequence and state. The landing story enters once, score and analysis motion are reserved for real state changes, and `gsap.matchMedia()` removes transform motion for reduced motion users. Animations are scoped with `useGSAP` cleanup.
- **Content:** demos are labeled illustrative. Product pages describe actual current behavior, while future modules are clearly unavailable previews.

## Public page outline

1. Clear outcome and account action
2. Illustrative resume to role evidence comparison
3. Scroll revealed benefit statement
4. Three step working model
5. Product FAQ
6. Account conversion and legal ready footer area

## Implementation boundaries

Business logic, authenticated API calls, CSRF behavior, polling, private downloads, and deletion controls remain in their existing components. This rebuild replaces presentation architecture only.
