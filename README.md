# Client Opportunity Calculator

Two-tab event website for entering client information, calculating projected net worth at age 80, saving entries through protected Supabase RPCs, viewing past clients, and exporting the saved list as CSV for Google Sheets.

## Calculation
Current net worth grows annually to age 80. The life-insurance death benefit is then added at the end. The final amount is used for the $14,000,000 high-net-worth threshold.

## Important
`config.js` contains the Supabase project URL and publishable browser key. Do not replace it with a service-role key.
