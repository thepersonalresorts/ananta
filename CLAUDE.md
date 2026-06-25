# Ananta web — CLAUDE.md

Globální FIPOX pravidla platí (viz `~/.claude/CLAUDE.md`): nefabrikovat (co řeknu že
proběhlo, musí reálně proběhnout přes nástroj a ověřit se), fact-check čísel proti zdroji,
status = známý stav ne budoucnost, hloubka před šířkou, web-search-first u živých věcí,
council před rozhodnutím se stakes. Tady drž jen to, co je specifické pro tenhle projekt.

## Co to je

Sloučený statický web značky Ananta (boutique resort developer na Bali) pod FIPOX /
The Personal Resorts. Jeden web = landing + dvě podstránky projektů: Ananta Villas
(8 vil, Bukit / Nusa Dua) a Ananta Canggu (36 apartmánů). Hlavní cíl webu: organická
indexace (SEO) a konverze přes lead capture.

## Stack

Čisté statické HTML/CSS/JS, žádný build step, žádné dependencies. Repo = deploy strom.
- **Hosting:** Cloudflare Pages napojený na org repo `thepersonalresorts/ananta`.
  Deploy = push na `main` → Pages auto-build. Build command žádný, output = root repa.
- **Doména:** zatím TBD (ananta.com není jistá, může skončit jinde). Do rozhodnutí jede
  preview na `*.pages.dev`. Doménu NELINKOVAT a NEHARDCODOVAT do meta, dokud není jasná.

## Kde co je

- `/index.html` — landing. Vlastní média leží v rootu repa (`hero_bali_*.mp4`,
  `bali_*.mp4`, `kristyna.jpg`, `Brother Signature.otf`).
- `/villas/` — Ananta Villas. `index.html` (EN) + `cs.html` (CZ), média ploše v adresáři.
  Složeno z repa `thepersonalresorts/ananta-villas-assets`.
- `/apartments/` — Ananta Canggu. `index.html` (EN) + `cs.html` (CZ), média ploše.
  Složeno z `thepersonalresorts/ananta-canggu-assets`. **POZOR: subpath je `/apartments`,
  ne `/canggu`** (Honzovo přání).
- Zdrojová asset repa (`ananta-villas-assets`, `ananta-canggu-assets`) = archiv/zdroj,
  **nedeployovat zvlášť**. Při změně obsahu nebo médií podstránek se musí znovu složit
  do `/villas` a `/apartments` v tomhle repu.

## Konvence (hard constraints)

- **Cesty root-absolutní** `/villas/...` a `/apartments/...`. Doménově nezávislé, jedou
  i na pages.dev. Řeší cross-reference mezi podstránkami i trailing slash.
- **Žádná doména v SEO meta** dokud není rozhodnutá: canonical, og:url, og:image,
  hreflang alternate, sitemap.xml, robots Sitemap řádek nech relativní/self nebo jako TODO.
  Doménový SEO pass uděláme jedním průchodem, až bude doména jistá.
- **Preview = noindex.** Dokud web není ostře live na finální doméně, drž
  `<meta name="robots" content="noindex">` na všech stránkách, ať se pages.dev nezaindexuje.
- **Po každé změně médií/cest otestovat KAŽDÉ video a obrázek pod subpath** (EN i CZ).
  Tady to praská nejčastěji (plné URL, absolutní cesty `/`, cross-ref mezi villas/canggu).
- **CZ:** podstránky CZ mají (`cs.html`), landing CZ zatím chybí (fast-follow). Na
  podstránkách funkční EN↔CZ přepínač, back-link z CZ vede na landing `/`.
- **SEO + lead konverze jsou důvod existence webu.** Nesahat na to, co funguje, bez důvodu;
  lead capture (Notion flaguje regresi modal → mailto, ověřit) je konverzní jádro.
- **Po každém push/deploy připiš datovaný řádek do Notion Deníku** (page ID
  `3882144dc98081608b6add12b144ddb6`), append-only na konec stránky, jen git/code fakta
  (co se reálně změnilo v kódu/gitu, commit hash, push/deploy). NE rozhodnutí ani stav.
  Status bloky na Bali stránce (ID `37f2144dc98081cbb953c31c17d9baf3`) NEEDITOVAT, ty
  píše Browser Claude (ať se nepřepisujeme).

## Kontext a odkazy

- **Notion (živý stav drž tam, ne tady):** stránka „Bali — Ananta weby",
  ID `37f2144dc98081cbb953c31c17d9baf3`. Notion sync: na začátku session srovnat volatilní
  stav s realitou (git/tree), na konci bumpnout razítko + zápis do Deníku.
- **Org:** `github.com/thepersonalresorts`, owneři David (`@olderinos`) + Honza. Sdílený
  mail `makemerich@thepersonalresorts.com` vlastní org, hosting i analytiku.
- **Lidé:** David reportuje Honzovi. Business owner Kristýna Pauly (CEO The Personal
  Resorts Bali). CZ je primární publikum (Central Europe, PR česky).
- **Plánováno:** Plausible (cookie-free) analytika, lead data přes Power Automate do
  `Ananta_Leads.xlsx`. Custom doména + DNS + Plausible až po čistém merge a CF účtu.
- **Workflow split:** Claude Code = implementace, git, deploy, pipeline. Browser Claude =
  strategie, Notion, komunikace. Potkáváme se přes Notion, ne přímo.

## Stav

Merge asset repů do `/villas` + `/apartments` hotový, běží jako preview přes Cloudflare
Pages (noindex, doména TBD). Go-live cíl pondělí 29.6.2026. Detailní a aktuální stav v Notionu.
