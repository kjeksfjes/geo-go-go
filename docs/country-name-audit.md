# Country-name audit — 2026-10-05

Reviewed all 238 canonical country/territory identities in English and Norwegian Bokmål (476 labels). The catalog in `src/data/country-names.json` supplies names to every browser; browser locale databases and Natural Earth display names are not naming authorities. This review covers existing country identities, including territories and the legacy Siachen identity, without adding quiz answers or changing boundaries, flags, components, affiliations, or region membership. Deferred supplemental-area labels remain under TASK-002 and TASK-003.

## Naming policy and references

Use established, readable short names in each language. Retain valid exonyms and accents; use longer names where they distinguish two identities or correctly describe a grouped territory. Names need not be identical between languages. Alphabetized reference labels such as “Bahamas, The” are displayed as “The Bahamas”; classification-only qualifiers and parenthetical articles are omitted. The app's country IDs are stable internal keys, not a current ISO code registry.

- **P**: [PCGN country names](https://www.gov.uk/government/publications/country-names/country-names-the-permanent-committee-on-geographical-names-for-british-official-use), updated 20 July 2026, for English state names.
- **R**: [Språkrådet state names](https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/navn-pa-stater/), coordinated with Norway's Foreign Ministry, for Bokmål state names and permitted variants.
- **S**: Statistics Norway's [country-code classification](https://www.ssb.no/klass/klassifikasjoner/100), current version 1693: [English](https://data.ssb.no/api/klass/v1/versions/1693?language=en) and [Bokmål](https://data.ssb.no/api/klass/v1/versions/1693?language=nb), for territories and a second bilingual comparison. Classification titles may differ from readable map labels.
- **G**: [Språkrådet foreign place names](https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/utanlandske-stadnamn/), including capitalization of Jomfruøyene.
- **F**: [UK government Turkey travel advice](https://www.gov.uk/foreign-travel-advice/turkey), supporting established English usage for Turkey.
- **U**: [UN country/area names](https://unstats.un.org/unsd/methodology/m49/), supporting Cabo Verde and Türkiye; [UN Naoero entry](https://metadata.un.org/skosmos/thesaurus/en/page/1004349), recording the name change effective 26 June 2026.
- **A**: [Australian government territory inventory](https://www.infrastructure.gov.au/territories-regions/australian-territories), for Ashmore and Cartier Islands and the grouped Indian Ocean Territories. Their Bokmål labels are descriptive app translations, not claims of standardized official Norwegian titles.
- **H**: [Saint Helena government](https://www.sainthelena.gov.sh/st-helena/government/legislation/general-introduction/), confirming the territory's three constituent parts.
- **K**: [Siachen — Store norske leksikon](https://snl.no/Siachen), supporting Siachenbreen; the English geographic name is retained from the source map unit. This is a glacier name, not a sovereign-state designation.

## Corrections

| ID | Language | Before | After |
| --- | --- | --- | --- |
| BLM | en | Saint Barthelemy | Saint Barthélemy |
| COD | nb | Den demokratiske republikken Kongo | Den demokratiske republikk Kongo |
| GMB | en | Gambia | The Gambia |
| NRU | en | Nauru | Naoero |
| SHN | en | Saint Helena | Saint Helena, Ascension and Tristan da Cunha |
| SHN | nb | Saint Helena | Sankt Helena, Ascension og Tristan da Cunha |
| SRB | en | Republic of Serbia | Serbia |
| STP | en | São Tomé and Principe | São Tomé and Príncipe |
| SWZ | en | eSwatini | Eswatini |
| TZA | en | United Republic of Tanzania | Tanzania |
| VGB | nb | De britiske jomfruøyene | De britiske Jomfruøyene |
| VIR | nb | De amerikanske jomfruøyene | De amerikanske Jomfruøyene |

Serbia and Tanzania now use their short English names. The two Congos remain unambiguous; the Democratic Republic's Bokmål formal title now follows Språkrådet's “republikk” form. Saint Helena's country label names the complete SH territory rather than just its principal island; this corrects the identity label without adding missing source geometry.

Naoero is the current English state name in PCGN and the UN. Bokmål retains Nauru because Språkrådet's current Norwegian list still specifies that name. This is an explicit language-specific choice, not a browser fallback; revisit it when Norwegian naming guidance changes. The internal NRU identity and existing flag mapping remain stable.

## Retained variants and scope decisions

- CIV: “Ivory Coast” is PCGN's English short name; “Elfenbenskysten” is an explicitly permitted Bokmål spelling. Neither needs to become Côte d'Ivoire.
- CPV: retain Cabo Verde in English and established Bokmål Kapp Verde.
- TUR: updated on 2026-10-06 to Turkey in English and retained Tyrkia in Bokmål, following the user’s preference for familiar English short names. Türkiye remains the UN form and a search alias; accent normalization also matches Turkiye. This changes the label only, retaining the TUR identity and flag.
- TLS: East Timor / Øst-Timor remain established short names; Timor-Leste is also valid but does not require a rename here.
- LUX/NZL: Luxemburg and New Zealand are permitted Norwegian forms; do not rewrite valid variants merely to match SSB's first choice.
- MMR: Myanmar (Burma) is a permitted, informative Norwegian presentation; the English short name remains Myanmar.
- KNA/LCA/VCT: spell out Saint instead of the allowed St. abbreviation. STP retains the accented Portuguese spelling in both languages.
- COD/COG: retain explicit disambiguation instead of labeling both countries simply Congo/Kongo.
- PCN: Pitcairn Islands / Pitcairnøyene describes the island group; SSB's shorter Pitcairn does not make it incorrect.
- IOT: retain the Norwegian descriptive “territoriet” rather than SSB's “territorium”; this review does not decide sovereignty or change its existing map identity.
- VGB/VIR: retain the definite Bokmål ending “øyene”, with the proper-name capital J supported by Språkrådet.
- WLF: Wallis og Futuna is a readable short name; SSB's Wallis- og Futunaøyene is a valid longer alternative.
- IOA: represents Christmas and Cocos (Keeling) Islands together; do not label the whole identity Christmas Island from its source ISO hint. ATC similarly retains its territory name rather than inheriting Australia from the source code.
- MAF/SXM: distinguish the French and Dutch parts through Saint Martin / Sint Maarten and their existing cards; classification-only (FR)/(NL) suffixes are not necessary in the name itself.
- PSX, SAH, KOS, TWN and KAS: labels describe existing map identities; inclusion or omission of formal diplomatic qualifiers does not change recognition or quiz policy. Vatican City is the geographic short label rather than SSB's diplomatic Holy See.
- Other differences from SSB are ordinary short names versus formal state titles, reordered articles, geographic group labels, or PCGN spellings (for example Vietnam rather than Viet Nam). Each was reviewed rather than copied automatically.

## Complete reviewed catalog

References identify the naming authorities consulted, not an assertion that every app label is a verbatim reference title. The policy and exceptions above explain deliberate differences. P/R covers states; S covers the remaining classification identities; supplemental references cover special groupings and names. Both languages are explicit even where the spelling is identical.

| ID | English | Bokmål | References |
| --- | --- | --- | --- |
| ABW | Aruba | Aruba | S |
| AFG | Afghanistan | Afghanistan | P, R, S |
| AGO | Angola | Angola | P, R, S |
| AIA | Anguilla | Anguilla | S |
| ALB | Albania | Albania | P, R, S |
| AND | Andorra | Andorra | P, R, S |
| ARE | United Arab Emirates | De forente arabiske emirater | P, R, S |
| ARG | Argentina | Argentina | P, R, S |
| ARM | Armenia | Armenia | P, R, S |
| ASM | American Samoa | Amerikansk Samoa | S |
| ATC | Ashmore and Cartier Islands | Ashmore- og Cartierøyene | A (Bokmål: descriptive translation) |
| ATF | French Southern and Antarctic Lands | De franske sørterritorier | S |
| ATG | Antigua and Barbuda | Antigua og Barbuda | P, R, S |
| AUS | Australia | Australia | P, R, S |
| AUT | Austria | Østerrike | P, R, S |
| AZE | Azerbaijan | Aserbajdsjan | P, R, S |
| BDI | Burundi | Burundi | P, R, S |
| BEL | Belgium | Belgia | P, R, S |
| BEN | Benin | Benin | P, R, S |
| BFA | Burkina Faso | Burkina Faso | P, R, S |
| BGD | Bangladesh | Bangladesh | P, R, S |
| BGR | Bulgaria | Bulgaria | P, R, S |
| BHR | Bahrain | Bahrain | P, R, S |
| BHS | The Bahamas | Bahamas | P, R, S |
| BIH | Bosnia and Herzegovina | Bosnia-Hercegovina | P, R, S |
| BLM | Saint Barthélemy | Saint-Barthélemy | S |
| BLR | Belarus | Belarus | P, R, S |
| BLZ | Belize | Belize | P, R, S |
| BMU | Bermuda | Bermuda | S |
| BOL | Bolivia | Bolivia | P, R, S |
| BRA | Brazil | Brasil | P, R, S |
| BRB | Barbados | Barbados | P, R, S |
| BRN | Brunei | Brunei | P, R, S |
| BTN | Bhutan | Bhutan | P, R, S |
| BWA | Botswana | Botswana | P, R, S |
| CAF | Central African Republic | Den sentralafrikanske republikk | P, R, S |
| CAN | Canada | Canada | P, R, S |
| CHE | Switzerland | Sveits | P, R, S |
| CHL | Chile | Chile | P, R, S |
| CHN | China | Kina | P, R, S |
| CIV | Ivory Coast | Elfenbenskysten | P, R, S |
| CMR | Cameroon | Kamerun | P, R, S |
| COD | Democratic Republic of the Congo | Den demokratiske republikk Kongo | P, R, S |
| COG | Republic of the Congo | Kongo-Brazzaville | P, R, S |
| COK | Cook Islands | Cookøyene | S |
| COL | Colombia | Colombia | P, R, S |
| COM | Comoros | Komorene | P, R, S |
| CPV | Cabo Verde | Kapp Verde | P, R, S, U |
| CRI | Costa Rica | Costa Rica | P, R, S |
| CUB | Cuba | Cuba | P, R, S |
| CUW | Curaçao | Curaçao | S |
| CYM | Cayman Islands | Caymanøyene | S |
| CYP | Cyprus | Kypros | P, R, S |
| CZE | Czechia | Tsjekkia | P, R, S |
| DEU | Germany | Tyskland | P, R, S |
| DJI | Djibouti | Djibouti | P, R, S |
| DMA | Dominica | Dominica | P, R, S |
| DNK | Denmark | Danmark | P, R, S |
| DOM | Dominican Republic | Den dominikanske republikk | P, R, S |
| DZA | Algeria | Algerie | P, R, S |
| ECU | Ecuador | Ecuador | P, R, S |
| EGY | Egypt | Egypt | P, R, S |
| ERI | Eritrea | Eritrea | P, R, S |
| ESP | Spain | Spania | P, R, S |
| EST | Estonia | Estland | P, R, S |
| ETH | Ethiopia | Etiopia | P, R, S |
| FIN | Finland | Finland | P, R, S |
| FJI | Fiji | Fiji | P, R, S |
| FLK | Falkland Islands | Falklandsøyene | S |
| FRA | France | Frankrike | P, R, S |
| FRO | Faroe Islands | Færøyene | S |
| FSM | Federated States of Micronesia | Mikronesiaføderasjonen | P, R, S |
| GAB | Gabon | Gabon | P, R, S |
| GBR | United Kingdom | Storbritannia | P, R, S |
| GEO | Georgia | Georgia | P, R, S |
| GGY | Guernsey | Guernsey | S |
| GHA | Ghana | Ghana | P, R, S |
| GIN | Guinea | Guinea | P, R, S |
| GMB | The Gambia | Gambia | P, R, S |
| GNB | Guinea-Bissau | Guinea-Bissau | P, R, S |
| GNQ | Equatorial Guinea | Ekvatorial-Guinea | P, R, S |
| GRC | Greece | Hellas | P, R, S |
| GRD | Grenada | Grenada | P, R, S |
| GRL | Greenland | Grønland | S |
| GTM | Guatemala | Guatemala | P, R, S |
| GUM | Guam | Guam | S |
| GUY | Guyana | Guyana | P, R, S |
| HKG | Hong Kong | Hongkong | S |
| HMD | Heard Island and McDonald Islands | Heard- og McDonaldøyene | S |
| HND | Honduras | Honduras | P, R, S |
| HRV | Croatia | Kroatia | P, R, S |
| HTI | Haiti | Haiti | P, R, S |
| HUN | Hungary | Ungarn | P, R, S |
| IDN | Indonesia | Indonesia | P, R, S |
| IMN | Isle of Man | Man | S |
| IND | India | India | P, R, S |
| IOA | Australian Indian Ocean Territories | Australske territorier i Indiahavet | A (Bokmål: descriptive translation) |
| IOT | British Indian Ocean Territory | Det britiske territoriet i Indiahavet | S |
| IRL | Ireland | Irland | P, R, S |
| IRN | Iran | Iran | P, R, S |
| IRQ | Iraq | Irak | P, R, S |
| ISL | Iceland | Island | P, R, S |
| ISR | Israel | Israel | P, R, S |
| ITA | Italy | Italia | P, R, S |
| JAM | Jamaica | Jamaica | P, R, S |
| JEY | Jersey | Jersey | S |
| JOR | Jordan | Jordan | P, R, S |
| JPN | Japan | Japan | P, R, S |
| KAS | Siachen Glacier | Siachenbreen | K (English: source geographic name) |
| KAZ | Kazakhstan | Kasakhstan | P, R, S |
| KEN | Kenya | Kenya | P, R, S |
| KGZ | Kyrgyzstan | Kirgisistan | P, R, S |
| KHM | Cambodia | Kambodsja | P, R, S |
| KIR | Kiribati | Kiribati | P, R, S |
| KNA | Saint Kitts and Nevis | Saint Kitts og Nevis | P, R, S |
| KOR | South Korea | Sør-Korea | P, R, S |
| KOS | Kosovo | Kosovo | P, R, S |
| KWT | Kuwait | Kuwait | P, R, S |
| LAO | Laos | Laos | P, R, S |
| LBN | Lebanon | Libanon | P, R, S |
| LBR | Liberia | Liberia | P, R, S |
| LBY | Libya | Libya | P, R, S |
| LCA | Saint Lucia | Saint Lucia | P, R, S |
| LIE | Liechtenstein | Liechtenstein | P, R, S |
| LKA | Sri Lanka | Sri Lanka | P, R, S |
| LSO | Lesotho | Lesotho | P, R, S |
| LTU | Lithuania | Litauen | P, R, S |
| LUX | Luxembourg | Luxemburg | P, R, S |
| LVA | Latvia | Latvia | P, R, S |
| MAC | Macao | Macao | S |
| MAF | Saint Martin | Saint-Martin | S |
| MAR | Morocco | Marokko | P, R, S |
| MCO | Monaco | Monaco | P, R, S |
| MDA | Moldova | Moldova | P, R, S |
| MDG | Madagascar | Madagaskar | P, R, S |
| MDV | Maldives | Maldivene | P, R, S |
| MEX | Mexico | Mexico | P, R, S |
| MHL | Marshall Islands | Marshalløyene | P, R, S |
| MKD | North Macedonia | Nord-Makedonia | P, R, S |
| MLI | Mali | Mali | P, R, S |
| MLT | Malta | Malta | P, R, S |
| MMR | Myanmar | Myanmar (Burma) | P, R, S |
| MNE | Montenegro | Montenegro | P, R, S |
| MNG | Mongolia | Mongolia | P, R, S |
| MNP | Northern Mariana Islands | Nord-Marianene | S |
| MOZ | Mozambique | Mosambik | P, R, S |
| MRT | Mauritania | Mauritania | P, R, S |
| MSR | Montserrat | Montserrat | S |
| MUS | Mauritius | Mauritius | P, R, S |
| MWI | Malawi | Malawi | P, R, S |
| MYS | Malaysia | Malaysia | P, R, S |
| NAM | Namibia | Namibia | P, R, S |
| NCL | New Caledonia | Ny-Caledonia | S |
| NER | Niger | Niger | P, R, S |
| NFK | Norfolk Island | Norfolkøya | S |
| NGA | Nigeria | Nigeria | P, R, S |
| NIC | Nicaragua | Nicaragua | P, R, S |
| NIU | Niue | Niue | S |
| NLD | Netherlands | Nederland | P, R, S |
| NOR | Norway | Norge | P, R, S |
| NPL | Nepal | Nepal | P, R, S |
| NRU | Naoero | Nauru | P, R, S, U |
| NZL | New Zealand | New Zealand | P, R, S |
| OMN | Oman | Oman | P, R, S |
| PAK | Pakistan | Pakistan | P, R, S |
| PAN | Panama | Panama | P, R, S |
| PCN | Pitcairn Islands | Pitcairnøyene | S |
| PER | Peru | Peru | P, R, S |
| PHL | Philippines | Filippinene | P, R, S |
| PLW | Palau | Palau | P, R, S |
| PNG | Papua New Guinea | Papua Ny-Guinea | P, R, S |
| POL | Poland | Polen | P, R, S |
| PRI | Puerto Rico | Puerto Rico | S |
| PRK | North Korea | Nord-Korea | P, R, S |
| PRT | Portugal | Portugal | P, R, S |
| PRY | Paraguay | Paraguay | P, R, S |
| PSX | Palestine | Palestina | P, R, S |
| PYF | French Polynesia | Fransk Polynesia | S |
| QAT | Qatar | Qatar | P, R, S |
| ROU | Romania | Romania | P, R, S |
| RUS | Russia | Russland | P, R, S |
| RWA | Rwanda | Rwanda | P, R, S |
| SAH | Western Sahara | Vest-Sahara | S |
| SAU | Saudi Arabia | Saudi-Arabia | P, R, S |
| SDN | Sudan | Sudan | P, R, S |
| SDS | South Sudan | Sør-Sudan | P, R, S |
| SEN | Senegal | Senegal | P, R, S |
| SGP | Singapore | Singapore | P, R, S |
| SGS | South Georgia and the South Sandwich Islands | Sør-Georgia og Sør-Sandwichøyene | S |
| SHN | Saint Helena, Ascension and Tristan da Cunha | Sankt Helena, Ascension og Tristan da Cunha | S, H |
| SLB | Solomon Islands | Salomonøyene | P, R, S |
| SLE | Sierra Leone | Sierra Leone | P, R, S |
| SLV | El Salvador | El Salvador | P, R, S |
| SMR | San Marino | San Marino | P, R, S |
| SOM | Somalia | Somalia | P, R, S |
| SPM | Saint Pierre and Miquelon | Saint-Pierre-et-Miquelon | S |
| SRB | Serbia | Serbia | P, R, S |
| STP | São Tomé and Príncipe | São Tomé og Príncipe | P, R, S |
| SUR | Suriname | Surinam | P, R, S |
| SVK | Slovakia | Slovakia | P, R, S |
| SVN | Slovenia | Slovenia | P, R, S |
| SWE | Sweden | Sverige | P, R, S |
| SWZ | Eswatini | Eswatini | P, R, S |
| SXM | Sint Maarten | Sint Maarten | S |
| SYC | Seychelles | Seychellene | P, R, S |
| SYR | Syria | Syria | P, R, S |
| TCA | Turks and Caicos Islands | Turks- og Caicosøyene | S |
| TCD | Chad | Tsjad | P, R, S |
| TGO | Togo | Togo | P, R, S |
| THA | Thailand | Thailand | P, R, S |
| TJK | Tajikistan | Tadsjikistan | P, R, S |
| TKM | Turkmenistan | Turkmenistan | P, R, S |
| TLS | East Timor | Øst-Timor | P, R, S |
| TON | Tonga | Tonga | P, R, S |
| TTO | Trinidad and Tobago | Trinidad og Tobago | P, R, S |
| TUN | Tunisia | Tunisia | P, R, S |
| TUR | Turkey | Tyrkia | F, R, U |
| TUV | Tuvalu | Tuvalu | P, R, S |
| TWN | Taiwan | Taiwan | S |
| TZA | Tanzania | Tanzania | P, R, S |
| UGA | Uganda | Uganda | P, R, S |
| UKR | Ukraine | Ukraina | P, R, S |
| URY | Uruguay | Uruguay | P, R, S |
| USA | United States of America | USA | P, R, S |
| UZB | Uzbekistan | Usbekistan | P, R, S |
| VAT | Vatican City | Vatikanstaten | P, R, S |
| VCT | Saint Vincent and the Grenadines | Saint Vincent og Grenadinene | P, R, S |
| VEN | Venezuela | Venezuela | P, R, S |
| VGB | British Virgin Islands | De britiske Jomfruøyene | S, G |
| VIR | United States Virgin Islands | De amerikanske Jomfruøyene | S, G |
| VNM | Vietnam | Vietnam | P, R, S |
| VUT | Vanuatu | Vanuatu | P, R, S |
| WLF | Wallis and Futuna | Wallis og Futuna | S |
| WSM | Samoa | Samoa | P, R, S |
| YEM | Yemen | Jemen | P, R, S |
| ZAF | South Africa | Sør-Afrika | P, R, S |
| ZMB | Zambia | Zambia | P, R, S |
| ZWE | Zimbabwe | Zimbabwe | P, R, S |

## Verification

`npm run build` checks complete English/Bokmål catalog coverage against canonical map identities before type checking and bundling. Focused runtime checks confirm that every canonical identity uses the catalog in each locale, including Elfenbenskysten, grouped territories, and the corrected names. There is no permanent test suite. Visual acceptance is left to the user.
