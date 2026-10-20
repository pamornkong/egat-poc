# EGAT-POC typography

Self-hosted variable WOFF2 assets, loaded with `next/font/local` in `app/layout.tsx`.

| Asset | Family | Subset | Weight range |
| --- | --- | --- | --- |
| `manrope-latin-variable.woff2` | Manrope | Latin | 200–800 |
| `anuphan-thai-variable.woff2` | Anuphan | Thai | 100–700 |

Manrope is first in the font stack for English and numbers; Anuphan supplies Thai glyphs. System fonts cover other scripts. Both use `font-display: swap` and are served by the app without runtime requests to Google Fonts.

Original asset sources (retrieved 20 October 2026):

- Manrope: https://fonts.gstatic.com/s/manrope/v20/xn7gYHE41ni1AdIRggexSg.woff2
- Anuphan: https://fonts.gstatic.com/s/anuphan/v6/2sDeZGxYgY7LkLT0mX4Dan29.woff2

Upstream projects and license notices:

- https://github.com/googlefonts/manrope
- https://github.com/cadsondemak/Anuphan
- https://github.com/google/fonts/tree/main/ofl/manrope
- https://github.com/google/fonts/tree/main/ofl/anuphan

Both families are distributed under the SIL Open Font License 1.1. Keep the copyright notices and license in `OFL.txt` with these assets.
