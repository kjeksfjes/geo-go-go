# Marine label audit

Audit date: 2026-09-28

## Scope and policy

All 279 marine labels shipped by the application were reviewed, including the five manually positioned oceans and 274 labels imported from Natural Earth. The reviewed values are stored by stable label identifier in `scripts/marine-label-names.json`; `scripts/import-marine-labels.py` combines them with Natural Earth geometry to generate `src/data/marine-labels.json`.

The audit uses contemporary English names and established Norwegian Bokmål exonyms. When no recognized Norwegian exonym could be verified, the Norwegian field explicitly repeats the authoritative international or local name. For politically disputed names, the application conservatively follows established Western European conventions and records the competing convention rather than presenting the choice as undisputed. Community translations were useful for discovery but were not accepted without support from Språkrådet, Store norske leksikon, or a relevant national or hydrographic authority.

The regeneration preserved every identifier, anchor position, rank, minimum visibility level, and maximum visibility level. Nine clearly incorrect broad water-body categories were corrected without changing rendering or visibility.

## Results

- 279 of 279 labels now have explicit English and Norwegian Bokmål values.
- 12 English display names were corrected or modernized; 267 remained unchanged.
- 3 of the 26 previously explicit Norwegian values were corrected.
- 117 additional labels received a verified Norwegian form.
- 136 labels intentionally use the same value in English and Norwegian because no established Norwegian exonym was verified.
- 9 broad water-body categories were corrected.

## English corrections

| Natural Earth value | Reviewed display name | Basis |
| --- | --- | --- |
| Tikahtnu Inlet | Cook Inlet | Official Alaska usage; the Dena’ina name is recorded separately as a naming sensitivity. |
| Gulf of Kutch | Gulf of Kachchh | Contemporary Indian Directorate General of Lighthouses and Lightships spelling. |
| Gulf of Saint Lawrence | Gulf of St. Lawrence | Contemporary Government of Canada spelling. |
| Molucca Sea | Maluku Sea | Contemporary Indonesian government spelling. |
| Ceram Sea | Seram Sea | Contemporary Indonesian government spelling. |
| Florida Strait | Straits of Florida | NOAA chart and hydrographic usage. |
| Bight of Biafra | Bight of Bonny | Name established by Nigerian decree in 1975 and retained in current Nigerian government usage. |
| Gulf of Martaban | Gulf of Mottama | Contemporary Myanmar government usage; Martaban is retained as a former name. |
| Hangzhouwan | Hangzhou Bay | Contemporary English form used by the Hangzhou municipal government. |
| Uda Gulf | Uda Bay | Current English hydrographic and Russian scientific usage. |
| Saint Lawrence River | St. Lawrence River | Contemporary Government of Canada spelling. |
| Uummannaq fjord | Uummannaq Fjord | Display capitalization normalized for the proper geographic name. |

## Norwegian corrections

The three previously translated values corrected during the audit were:

| English | Previous Bokmål | Reviewed Bokmål |
| --- | --- | --- |
| Labrador Sea | Labradorhavet | Labradorsjøen |
| South China Sea | Sør-Kinahavet | Sør-Kina-havet |
| East China Sea | Øst-Kinahavet | Øst-Kina-havet |

The complete set of 279 explicit Bokmål decisions is recorded in `scripts/marine-label-names.json`. Examples newly supplied from recognized Norwegian usage include `Adenbukta`, `Beauforthavet`, `Biscayabukta`, `Den engelske kanal`, `Drakestredet`, `Gibraltarstredet`, `Japanhavet`, `Kvitsjøen`, `Mosambikkanalen`, `Persiabukta`, `St. Lawrence-bukta`, `Torressundet`, and `Tsjuktsjerhavet`.

The 136 intentionally identical values are not missing translations. They include international or local proper names such as `Bay of Plenty`, `Chesapeake Bay`, `Gulf of Kachchh`, `Río de la Plata`, `Uummannaq Fjord`, and `Øresund`, for which the reviewed policy does not invent a literal Norwegian form.

## Disputed and sensitive names

| Label used | Alternative or issue | Decision |
| --- | --- | --- |
| Persian Gulf / Persiabukta | Arabian Gulf is used by several Arab states. | Retained the UN standard English designation and Språkrådet’s Norwegian form. |
| Sea of Japan / Japanhavet | South Korea advocates concurrent use of East Sea; North Korea advocates East Sea of Korea. | Retained prevailing international English usage and the established Norwegian exonym, while recording the dispute. |
| Gulf of Mexico / Mexicogolfen | The United States changed its federal usage to Gulf of America in 2025. | Retained prevailing international and Norwegian usage, while recording the US federal convention. |
| Cook Inlet | Tikahtnu is the traditional Dena’ina name and was present in Natural Earth’s English field. | Used the official English geographic name; recorded the Indigenous name rather than treating it as an error. |
| Bight of Bonny / Biafrabukta | Bight of Biafra is the former English name and remains the basis of the established Norwegian exonym. | Used current Nigerian English and retained Språkrådet’s Norwegian exonym. |
| Gulf of Mottama | Gulf of Martaban is the former English name. | Used contemporary Myanmar government usage; no established Norwegian exonym was verified. |

## Water-body categories

| Label | Natural Earth category | Reviewed category |
| --- | --- | --- |
| Cook Inlet | bay | inlet |
| Hamilton Inlet | bay | inlet |
| Bathurst Inlet | bay | inlet |
| Minto Inlet | sound | inlet |
| Richard Collinson Inlet | bay | inlet |
| Buli Bay | gulf | bay |
| Kao Bay | gulf | bay |
| Yana Bay | gulf | bay |
| Skagerrak | fjord | sea area |

## Principal sources

- [Natural Earth 1:10m Geography Marine Polygons](https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-physical-labels/) supplied stable source identities, geometry, ranks, and label visibility metadata.
- [Språkrådet’s list of foreign place names](https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/utanlandske-stadnamn/) was the primary authority for established Norwegian forms.
- [Store norske leksikon](https://snl.no/) was used to verify additional established Norwegian forms not present in Språkrådet’s list.
- [NOAA’s Straits of Florida chart listing](https://www.aoml.noaa.gov/general/lib/flamaps.htm), [India’s Directorate General of Lighthouses and Lightships](https://dgll.nic.in/about-DGLL/Service-reminders/buoys), [the Government of Canada’s St. Lawrence documentation](https://www.canada.ca/en/canadian-coast-guard/corporate/publications/ice-navigation-in-canadian-waters/chapter-3-ice-climatology-environmental-conditions.html), [Indonesia’s Ministry of Energy and Mineral Resources](https://www.esdm.go.id/en/media-center/news-archives/govt-strategic-measures-to-increase-national-og-reserves), [Indonesia’s official marine map](https://jdih.kkp.go.id/peraturan/terjemahan/2019pp032_english.pdf), [Myanmar’s Department of Fisheries](https://www.dof.gov.mm/my/file-download/download/public/169), [the Hangzhou municipal government](https://www.ehangzhou.gov.cn/2018-07/12/c_254917.htm), and [Nigeria’s official record of the Bight of Bonny decree](https://nigeriareposit.nln.gov.ng/server/api/core/bitstreams/196a5185-17dd-49e5-9e7c-d712c92304f4/content) support the specific English corrections.
- [The UN Law of the Sea Persian Gulf index](https://www.un.org/depts/los/LEGISLATIONANDTREATIES/persian_gulf.htm), [UN records of the Sea of Japan/East Sea disagreement](https://unstats.un.org/unsd/methods/cartog/econf853.htm), [the US federal Gulf of America proclamation](https://www.whitehouse.gov/presidential-actions/2025/02/gulf-of-america-day-2025/), and [the International Hydrographic Organization’s Gulf of Mexico commission history](https://iho.int/en/machc) document the disputed-name decisions.
