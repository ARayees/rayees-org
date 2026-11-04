# V1 Validation Report

## Date

November 4, 2026

## Purpose

This check confirms that the browser model handles its core arithmetic and boundary cases consistently. It does not prove that the assumptions are correct. Assumption quality remains limited by the public information available about First Jet.

## Automated checks

The same calculation core used by the browser is tested with:

```text
node scripts/validate_model.mjs
```

The current checks cover:

1. Base launch arithmetic: 4 aircraft × 4 flight legs/day × 330 days = 5,280 annual flight legs.
2. Available seats and expected passengers for the A320neo base case.
3. Explicit block-hour calculation using the 2.0-hour V1 placeholder.
4. Positive revenue and finite operating-result output.
5. Zero-demand behavior.
6. Zero-fleet behavior.
7. No-passenger-revenue behavior and infinite break-even requirement.

## Manual checks for the website

- Changing the operating structure resets the structure-specific cost proxies.
- Changing the aircraft resets the default seat count.
- Changing launch scale changes fleet size, flight legs per day, operating days, and conversion assumption.
- Changing demand changes load factor.
- Changing base fare and membership fee changes revenue without changing capacity.
- Advanced edits change the model output immediately.
- The ancillary default displays the exact $66.56 calculation.
- Investor count displays 11,160 and the dated snapshot in Advanced.
- Break-even above 100% displays `>100%` rather than a misleading feasible result.
- The evidence page is read-only and its filters and sorting remain functional.

## Known limits that are intentionally not “fixed” in V1

- The 2.0-hour average block-time input is a placeholder because First Jet’s route network and stage length are not public.
- Cost inputs are structure-specific proxies, not operator quotations.
- Investor-to-member conversion remains a project assumption.
- Taxes, interest, financing, route economics, booking curves, fuel sensitivity, and detailed contracts remain outside the main model.

## Release decision

The model is suitable for a transparent V1 review with First Jet’s team after the user reviews the Evidence Register. It should be described as a directional scenario model, not as an official forecast or investment recommendation.
