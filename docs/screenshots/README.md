# Screenshots

Captured from **demo mode** (no API keys) in headless Chrome: 1440×900 viewport, device scale 1.5, light theme, English UI.

| File | Screen |
| --- | --- |
| `overview.png` | Main page after "Process all samples": results table, status badges, export bar, legend (full page) |
| `review.png` | Detail panel of `northwind-invoice.pdf`: date in *needs review* with A / B / arbiter chips; discount line kept by 2/3 |
| `validation.png` | Detail panel of `kahve-duragi-shared-misread.png`: shared misread agreed by both models, flagged by the totals check |
| `fallback.png` | Detail panel of `kalem-kutusu-fallback.png`: extractor B failed, fallback reading banner and *agreed (fallback)* fields |
| `recorded.png` | Detail panel of `kuzey-market.png` (real Ollama recording): the misread name fixed by the blind arbiter; the models and date are shown |

An exported `.xlsx` screenshot is not included: it needs a spreadsheet application to render.

To regenerate: run the production build with no models configured (e.g. blank `EXTRACTOR_A_MODEL`, `EXTRACTOR_B_MODEL`, `ARBITER_MODEL`), open the page with the `lang=en` cookie, click **Process all samples**, then open each document.
