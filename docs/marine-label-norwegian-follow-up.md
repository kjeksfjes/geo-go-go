# Norwegian water-name follow-up audit

Audit date: 2026-10-17. Baseline: accepted label changes committed as `bd8b0ee`, following release 0.18.0. The 47 documented alternatives have now been applied to the curated names and shipped label data; the 54 unresolved names remain unchanged.

## Coverage and results

All 279 shipped Norwegian fields were scanned. All 119 containing English-looking water descriptors received the reference searches described below and a Wikipedia language-link lookup. The original inventory has 143 differing English/Norwegian values and 136 identical ones; the other 17 identical names use Norwegian, Scandinavian, or other local-language forms.

The earlier audit missed Øst-Koreabukta because it relied too heavily on SNL and institutional sources. The user supplied the English-to-Bokmål Wikipedia link. The follow-up applies that lookup to every one of the 119 entries, including names whose English form occurs in SNL.

| Result | Count | Meaning |
| --- | --- | --- |
| Norwegian alternative verified in reference/institutional sources | 33 | Includes optional alternatives and explicitly identified historical usage. |
| Additional Norwegian alternative supported by Wikipedia | 14 | A Bokmål article or observed language-link target documents the form; article-fetch limits are recorded per entry. |
| Current English form supported | 18 | Norwegian reference usage is attested; this does not exclude a Norwegian alternative. |
| Unresolved | 54 | Evidence remains insufficient to recommend a replacement or declare the current form fully reviewed. |

There are now 47 documented alternatives, up from 33. The 14 additional alternatives resolve all eight former candidates, four formerly unresolved names, and two names previously classified only as supported English usage. The former blanket statement that all 136 identical values were intentionally correct was unjustified.

## Method and limits

Each entry was searched in Store norske leksikon using its English name, geographic stem, Norwegian compounds/transcription variants, and a quoted-name search. Matched article text and regional geography articles were consulted. Språkrådet, institutional sources, and broader Norwegian-context web searches supplemented those checks. The [per-name review record](marine-label-norwegian-review.json) preserves the queries, source links, geographic anchors, prior decisions, and Wikipedia outcomes.

The Wikipedia pass fetched 115 English articles and inspected their Bokmål language links; four English pages could not be fetched: Ronne Entrance, Wrigley Gulf, Goldsmith Channel, and Kao Bay. There were 40 Bokmål links, including one rejected related-feature link. Some Norwegian target articles could not be fetched: their observed link destinations document the Norwegian title, but their article text has not been verified. Direct API access was forbidden; prior Wikidata bulk discovery was rate-limited. Neither failure nor a missing language link proves absence of a Norwegian name.

Norwegian Wikipedia is accepted as useful evidence of Norwegian usage, separately labeled from SNL, Språkrådet, and institutional sources. Historical Kartverket usage is explicitly historical. Translation aggregators and automatic localization alone do not establish a spelling. This audit is not an official naming ruling.

Geographic identity was checked for the added alternatives against the application anchors. Known homonyms use explicitly selected English articles: Smith Sound in British Columbia, Dampier Strait in Indonesia, Queen Charlotte Sound in Canada, Cordova Bay in Alaska, Mackenzie Bay in Canada, and Porpoise Bay in Antarctica. The Peacock Sound language link leads to Abbotisen, an ice shelf; it was rejected as a translation of the sound.

## Additional Wikipedia-supported alternatives

| English display | Norwegian form | Evidence |
| --- | --- | --- |
| Balearic Sea | Det baleariske hav | [English article](https://en.wikipedia.org/wiki/Balearic_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Det_baleariske_hav); article fetched. |
| Maluku Sea | Molukksjøen | [English article](https://en.wikipedia.org/wiki/Maluku_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Molukksj%C3%B8en); link target observed; target text unavailable. |
| Davis Sea | Davishavet | [English article](https://en.wikipedia.org/wiki/Davis_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Davishavet); link target observed; target text unavailable. |
| East Korea Bay | Øst-Koreabukta | [English article](https://en.wikipedia.org/wiki/East_Korea_Bay) → [Bokmål article](https://no.wikipedia.org/wiki/%C3%98st-Koreabukta); link target observed; target text unavailable. |
| Lützow-Holm Bay | Lützow-Holmbukta | [English article](https://en.wikipedia.org/wiki/L%C3%BCtzow-Holm_Bay) → [Bokmål article](https://no.wikipedia.org/wiki/L%C3%BCtzow-Holmbukta); article fetched. |
| Uchiura Bay | Uchiurabukta | [English article](https://en.wikipedia.org/wiki/Uchiura_Bay) → [Bokmål article](https://no.wikipedia.org/wiki/Uchiurabukta); link target observed; target text unavailable. |
| Yenisei Gulf | Jenisejbukta | [English article](https://en.wikipedia.org/wiki/Yenisei_Gulf) → [Bokmål article](https://no.wikipedia.org/wiki/Jenisejbukta); article fetched. |
| Bali Sea | Balisjøen | [English article](https://en.wikipedia.org/wiki/Bali_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Balisj%C3%B8en); article fetched. |
| Delaware Bay | Delawarebukten | [English article](https://en.wikipedia.org/wiki/Delaware_Bay) → [Bokmål article](https://no.wikipedia.org/wiki/Delawarebukten); article fetched. |
| Fury and Hecla Strait | Fury og Heclastredet | [English article](https://en.wikipedia.org/wiki/Fury_and_Hecla_Strait) → [Bokmål article](https://no.wikipedia.org/wiki/Fury_og_Heclastredet); link target observed; target text unavailable. |
| Halmahera Sea | Halmaherasjøen | [English article](https://en.wikipedia.org/wiki/Halmahera_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Halmaherasj%C3%B8en); link target observed; target text unavailable. |
| Kara Strait | Karastredet | [English article](https://en.wikipedia.org/wiki/Kara_Strait) → [Bokmål article](https://no.wikipedia.org/wiki/Karastredet); link target observed; target text unavailable. |
| Savu Sea | Savusjøen | [English article](https://en.wikipedia.org/wiki/Savu_Sea) → [Bokmål article](https://no.wikipedia.org/wiki/Savusj%C3%B8en); link target observed; target text unavailable. |
| Ragay Gulf | Ragaybukta | [English article](https://en.wikipedia.org/wiki/Ragay_Gulf) → [Bokmål article](https://no.wikipedia.org/wiki/Ragaybukta); link target observed; target text unavailable. |

## Reference and institutional alternatives

| English display | Proposed form / outcome | Evidence and qualification |
| --- | --- | --- |
| Bay of Campeche | Campechebukta | [source 1](https://snl.no/Campechebukta). Norwegian form attested for the same water body. |
| Gulf of Kachchh | Kutchbukta | [source 1](https://snl.no/Gujarat). SNL uses Kutchbukta for this bay. The English value should retain the reviewed contemporary Kachchh spelling. |
| Gulf of Maine | Mainegulfen | [source 1](https://snl.no/Fundybukta). Norwegian form attested for the same water body. |
| Gulf of Panama | Panamabukta | [source 1](https://snl.no/Panama_by). Norwegian form attested for the same water body. |
| Sea of the Hebrides | Hebridhavet | [source 1](https://snl.no/De_ytre_Hebridene). Norwegian form attested for the same water body. |
| Seram Sea | Seramsjøen | [source 1](https://snl.no/Seram). Norwegian form attested for the same water body. |
| Shelikhov Gulf | Sjelikovbukta | [source 1](https://snl.no/Okhotskhavet). Norwegian form attested for the same water body. |
| Viscount Melville Sound | Viscount Melville-sundet | [source 1](https://snl.no/Barrowstredet). The full compound is used in Barrowstredet; shorter Melvillesundet and Viscount Melville-stredet also occur. Keep the same Canadian water identity. |
| Cumberland Sound | Cumberlandsundet | [source 1](https://snl.no/John_Davis). Norwegian form attested for the same water body. |
| Dixon Entrance | Dixonstredet | [source 1](https://snl.no/Dixonstredet). Norwegian form attested for the same water body. |
| Frobisher Bay | Frobisherbukten | [source 1](https://snl.no/Charles_Francis_Hall). Norwegian form attested for the same water body. |
| Gulf St Vincent | St. Vincent-bukta | [source 1](https://snl.no/Australias_geografi). The regional article explicitly uses St. Vincent-bukta and St. Vincentgulfen. Both identify the bay east of Yorke Peninsula. |
| Gulf of Corcovado | Corcovadobukta | [source 1](https://snl.no/Chilo%C3%A9). Norwegian form attested for the same water body. |
| Gulf of Guayaquil | Guayaquilbukta | [source 1](https://snl.no/Ecuadors_geografi). Norwegian form attested for the same water body. |
| Gulf of Khambhat | Khambhatbukta | [source 1](https://snl.no/Khambhat). Norwegian form attested for the same water body. |
| Gulf of Mottama | Mottamabukta | [source 1](https://snl.no/Mawlamyine). Norwegian form attested for the same water body. |
| Hangzhou Bay | Hangzhoubukta | [source 1](https://snl.no/Hangzhou). Norwegian form attested for the same water body. |
| Joseph Bonaparte Gulf | Joseph Bonaparte-bukta | [source 1](https://snl.no/Australias_geografi). The regional geography article explicitly names the bay where the Timor Sea indents northern Australia. |
| Kotzebue Sound | Kotzebuesundet | [source 1](https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/utanlandske-stadnamn/). Språkrådet identifies the bay in Alaska; Kotzebuestredet is also allowed in Bokmål. |
| La Pérouse Strait | La Pérousestredet | [source 1](https://snl.no/Hokkaido), [source 2](https://snl.no/Okhotskhavet). Hokkaido uses La Pérousestredet (Soya-kaikyo). Okhotskhavet also uses Soyastredet and identifies the same Hokkaido–Sakhalin waterway. |
| Lincoln Sea | Lincolnhavet | [source 1](https://www.stortinget.no/globalassets/pdf/referater/stortinget/2012-2013/s121207-ny.pdf). Norwegian parliamentary record explicitly describes the Canada–Greenland maritime boundary in Lincolnhavet. |
| Maputo Bay | Maputobukta | [source 1](https://snl.no/Maputobukta_-_Ba%C3%ADa_de_Maputo). Norwegian form attested for the same water body. |
| Vilkitsky Strait | Vilkitskijstredet | [source 1](https://snl.no/Boris_Vilkitskij). Norwegian form attested for the same water body. |
| Yucatán Channel | Yucatánkanalen | [source 1](https://snl.no/Yucat%C3%A1n_-_halv%C3%B8y). Norwegian form attested for the same water body. |
| Gulf of Anadyr | Anadyrbukta | [source 1](https://www.birdlife.no/prosjekter/rapporter/2008_03_NOF.pdf). Norwegian Ornithological Society scientific report uses Anadyrbukta for the eastern Russian locality. |
| Bay of Mecklenburg | Mecklenburgbukta | [source 1](https://www.kartverket.no/efs-documents/editions/1871-1946/Efterretninger%20for%20Sj%C3%B8farende%201944.pdf). Attested historical Norwegian hydrographic usage, notice 244; not a current naming ruling. |
| Bohol Sea | Mindanaosjøen | [source 1](https://snl.no/Mindanao), [source 2](https://mseas.mit.edu/Sea_exercises/Philex_IOP09/RIOP09_LEG1_rept.pdf). SNL uses Mindanaosjøen for the sea north of Mindanao at the Agusan mouth. Bohol Sea and Mindanao Sea are names for the same sea; the MIT cruise report explicitly uses both. |
| Monterey Bay | Montereybukta | [source 1](https://snl.no/Monterey). Norwegian form attested for the same water body. |
| Pamlico Sound | Pamlicosundet | [source 1](https://sprakradet.no/stedsnavn-og-navn-pa-statsorgan/navnelister-norsk-skrivemate/utanlandske-stadnamn-navn-pa-stater-og-sprak-transkripsjon/utanlandske-stadnamn/). Språkrådet explicitly lists the English equivalent; Pamlicostredet is also allowed in Bokmål. |
| Prince of Wales Strait | Prince of Wales-stredet | [source 1](https://snl.no/Nordvestpassasjen). Norwegian compound attested in Nordvestpassasjen; SNL also uses the full English name as an article heading. Both forms have support. |
| Matochkin Strait | Matotsjkin Sjar | [source 1](https://snl.no/Novaja_Semlja). The Norwegian article identifies the strait separating the two main islands. Use its attested Norwegian transcription, not an invented compound. |
| Leyte Gulf | Leytebukta | [source 1](https://snl.no/kamikaze). Norwegian form attested for the same water body. |
| Surigao Strait | Surigaostredet | [source 1](https://snl.no/slaglinje). Norwegian form attested for the same water body. |

## Supported current forms

| English display | Proposed form / outcome | Evidence and qualification |
| --- | --- | --- |
| Bay of Plenty | Current form attested | [source 1](https://snl.no/Astrolabe). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Bristol Bay | Current form attested | [source 1](https://snl.no/Bristol_Bay). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Chesapeake Bay | Current form attested | [source 1](https://snl.no/Chesapeake_Bay). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Cook Inlet | Current form attested | [source 1](https://snl.no/Anchorage). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Kane Basin | Current form attested | [source 1](https://snl.no/Charles_Francis_Hall). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Marguerite Bay | Current form attested | [source 1](https://snl.no/Finn_R%C3%B8nne). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Norton Sound | Current form attested | [source 1](https://snl.no/Nome_-_by_i_Alaska,_USA). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Prydz Bay | Current form attested | [source 1](https://snl.no/Ingrid_Christensen). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Ronne Entrance | Current form attested | [source 1](https://snl.no/Finn_R%C3%B8nne). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Shark Bay | Current form attested | [source 1](https://snl.no/stromatolitt). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Albemarle Sound | Current form attested | [source 1](https://snl.no/Nord-Carolina). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| George VI Sound | Current form attested | [source 1](https://snl.no/Finn_R%C3%B8nne). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Hall Basin | Current form attested | [source 1](https://snl.no/Charles_Francis_Hall). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Hamilton Inlet | Current form attested | [source 1](https://snl.no/Hamilton_Inlet). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Hecate Strait | Current form attested | [source 1](https://snl.no/Haida_Gwaii). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Long Island Sound | Current form attested | [source 1](https://snl.no/Long_Island). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Massachusetts Bay | Current form attested | [source 1](https://snl.no/Boston_-_by_i_Massachusetts,_USA). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |
| Queen Charlotte Strait | Current form attested | [source 1](https://snl.no/Vancouver_Island). The current form is used in a Norwegian reference for this water body; this is evidence of usage, not proof that no alternative exists. |

## Unresolved names

| English display | Proposed form / outcome | Evidence and qualification |
| --- | --- | --- |
| San Jorge Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Geographe Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Gulf of Masirah | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Kamchatka Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Karaginsky Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Kronotsky Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| M'Clure Strait | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Mackenzie Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Olenyok Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Porpoise Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Sakhalin Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| San Matías Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| St. Helena Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Sulzberger Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Uda Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Vincennes Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Wrigley Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Yana Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Chaunskaya Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Khatanga Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Salish Sea | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Antongil Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Buli Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Darnley Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Dmitry Laptev Strait | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Eclipse Sound | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Franklin Bay | Unresolved | The Greely reference concerns Lady Franklin Bay in the high Arctic, not the app bay near Cape Parry; rejected as a homonym. |
| Gulf of Urabá | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Hadley Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Liddon Gulf | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Marajó Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Murchison Sound | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Peacock Sound | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Prince Albert Sound | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Queen Charlotte Sound | Unresolved | App anchor is in British Columbia (-129.3931, 51.9486). The James Cook article refers to the New Zealand namesake; rejected for this label. |
| Sibuyan Sea | Unresolved | [source 1](https://no.aroundus.com/p/9139840-sibuyan-sea). A tourism page contains a Norwegian-looking form, but translation provenance is unclear. Not accepted as established Norwegian usage. |
| Uummannaq Fjord | Unresolved | [source 1](https://marineregions.org/gazetteer.php?id=48783&p=details). Fjord is itself Norwegian as well as English. Source spelling/capitalization and a preferred Bokmål display form still need confirmation; a Danish/Greenlandic source alone is not a Norwegian naming ruling. |
| Baird Inlet | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Bathurst Inlet | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Cordova Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Dampier Strait | Unresolved | App anchor is in Raja Ampat (-0.5713, 130.8638). Dampier also names a strait off New Britain. The SNL biographical mention does not disambiguate the strait; no automatic replacement. |
| Goldsmith Channel | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Inútil Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Kao Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Minto Inlet | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Richard Collinson Inlet | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Robeson Channel | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Sherman Basin | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Smith Sound | Unresolved | App anchor is in British Columbia (-127.8911, 52.0756). SNL Smithsundet references describe Greenland; rejected as a different water body. |
| Tayabas Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Visayan Sea | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Wager Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Wynniatt Bay | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |
| Bali Strait | Unresolved | English name, name stem, Norwegian compounds/transcriptions, and a broader Norwegian-context search checked. No sufficiently reliable preferred Norwegian form or same-water Norwegian reference established in this pass. This is not proof that no form exists. |

## Implementation boundary

All 47 documented alternatives are applied in `scripts/marine-label-names.json` and synchronized into `src/data/marine-labels.json`. Identities, English labels, anchors, ranks, and rendering metadata are preserved. No constructed translations were added. The review record retains baseline `nameNb` values and records each implemented correction in `appliedNameNb`; source qualifications and genuine spelling alternatives remain available for review.
