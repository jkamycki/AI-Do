# A.I DO Store Listing

## App Name
A.I DO

## Subtitle
AI wedding planner and guest hub

## Short Description
Plan your wedding, manage guests, publish your website, and keep vendors, budget, documents, and day-of details together.

## Full Description
A.I DO is an AI-powered wedding planning workspace for couples who want one place to manage the moving pieces. Build and publish a wedding website, track guests and RSVPs, organize vendors and contracts, manage your budget, collect guest photos, and keep your checklist, timeline, seating chart, documents, and day-of details close at hand.

The mobile app is designed for quick planning on the go, with deeper editing available on the web at aidowedding.net. Use A.I DO to review guest responses, check budget progress, capture vendor notes, manage photo drop approvals, and ask Aria for planning help when you need a draft, checklist, or next step.

## Keywords
wedding planner, wedding planning, RSVP, wedding website, guest list, budget, vendors, checklist, seating chart, wedding photos

## Category
Productivity

## Support URL
https://aidowedding.net/help/updates-improvements

## Marketing URL
https://aidowedding.net/

## Privacy URL
https://aidowedding.net/privacy

## Screenshot Checklist
- Home dashboard with planning summary
- Guest hub or RSVP management
- Website editor or published website preview
- Guest photo drop or invitation preview
- Budget summary
- Vendor or contracts screen
- Aria planning assistant

Generate current screenshots from production with:

```powershell
corepack pnpm run capture:release:screenshots
```

This command requires `.auth/user.json` to be saved from `https://aidowedding.net`.

For local screenshot drafts while the dev server is running:

```powershell
corepack pnpm run capture:release:screenshots:local
```

Mobile screenshots are saved to `mobile/app/store/screenshots/iphone`. Website launch screenshots are saved to `marketing/release-screenshots/web`.

## Release Notes

Use the Android and iOS release notes in `docs/release-notes.md`.
