---
name: gdpr
description: |
  GDPR/personvern-regler for OLKV. Les denne FØR enhver kodeendring som
  berører brukerdata, API-endepunkter, logging, lagring eller sletting.
  Gjelder backend (Node/Express/Firebase) og frontend.
---

# OLKV — GDPR & Personvern

## Kontekst
Norsk webapp under personopplysningsloven (GDPR).
Brukere: lærlinger (16–20 år), bedrifter, admin.
PII som behandles: navn, epost, telefon, CV, video, avatar, søknader, chatmeldinger.

## FORBUDT
- `console.log` med PII (navn, epost, uid, telefon, IP-adresse)
- Lagre passord, tokens eller hemmeligheter i Firestore
- Returnere feltene `epost`, `telefon`, `uid` i API-responses der mottaker ikke trenger dem
- Sende PII til tredjepart (analytics, logging-tjenester) uten eksplisitt grunn
- Hardkode brukerdata i kode eller kommentarer
- `makePublic()` på CV-filer eller private vedlegg i Storage

## Slett-konto (GDPR Art. 17)

Rekkefølge er viktig:

1. `auth.revokeRefreshTokens(uid)` — ALLTID FØR `deleteUser`
2. Firestore (bruk batch, maks 500 docs per batch):
   - `users/{uid}` og alle subcollections (`profilData`, `varsler`)
   - `soknader` der `lærling_uid == uid` eller `bedrift_uid == uid`
   - `chat_meldinger` der `sender_uid == uid`
   - `rate_limits/{uid}`
3. Storage:
   - `avatarer/{uid}`
   - `cv/{uid}/`
   - `videoer/{uid}/`
   - `vedlegg/{uid}/`
4. `auth.deleteUser(uid)`

Husk: Legg til nye collections/Storage-paths her når de opprettes.

## Dataportabilitet (GDPR Art. 20)

Endepunkt: `GET /api/auth/eksport` (kun for innlogget bruker selv).

Returner JSON med:
- `profil`: `users/{uid}`
- `profilData`: `users/{uid}/profilData/main`
- `soknader`: alle der `lærling_uid == uid`
- `chatmeldinger`: alle der `sender_uid == uid`
- `varsler`: `users/{uid}/varsler`

Ikke inkluder interne felt som `rate_limits` eller Firebase-tokens.

## Samtykke

- `samtykkeVersjon` lagres på `users/{uid}` ved registrering
- `samtykkeTidspunkt` (ISO-timestamp) lagres ved siden av
- Ved ny versjon av personvernerklæringen: sett et flagg `kreverNyttSamtykke: true` på brukerdokumentet, og krev bekreftelse ved neste innlogging
- Aldri forutsett samtykke — bruker må aktivt bekrefte

## Logging-regler

**OK å logge:**
- Handlingstype (`søknad_opprettet`, `profil_oppdatert`)
- Tidspunkt
- Anonymisert feilinfo (`Firestore-feil ved lagring`)

**ALDRI logg (i produksjon):**
- Epost, navn, telefon
- UID (bruk anonymisert referanse i produksjonslogs)
- Filinnhold, søknadstekst, chatmeldinger
- Stack traces med brukerdata

Bruk strukturert logging: `{ level: 'error', action: '...', error: err.message }`.

## API-response-regler

- Returner **kun feltene mottakeren trenger** — ikke hele Firestore-dokumentet
- Bedrift ser **ikke** lærlingens epost/telefon med mindre det finnes en aktiv søknad
- Admin ser alt, men logg admin-tilgang til sensitive felt: `{ level: 'info', action: 'admin_leser_sensitiv_data', ressurs: '...' }`
- Aldri returner interne felt (`_intern`, `passordHash`, tokens) til klienten
- Feilmeldinger til klient: generiske (`Noe gikk galt`) — ikke stack traces eller filstier

## Mindreårige (under 18)

Lærlinger er 16–20 år — mange er under 18.

- Foresattes samtykke er **ikke** nødvendig (behandlingen er nødvendig for lærlingavtalen)
- Vær ekstra forsiktig med hva bedrifter kan se om mindreårige
- Del **ikke** kontaktinfo til lærling med bedrift uten aktiv søknad/avtale
- Ikke eksponer fødselsår eller alder direkte i API-responses til bedrift

## Firebase-spesifikke regler

- Firestore Security Rules: gi klienten **minst mulig direkte tilgang** — bruk backend-API for sensitiv data
- Storage Rules: CV, video og vedlegg skal kreve autentisering for lesing
- Signed URLs for nedlasting av private filer (kort levetid, maks 15 min)
- Bruk alltid `firebase-admin` på backend for å omgå Security Rules kontrollert

## Sjekkliste før commit

- Ingen `console.log` med PII
- Nye API-endepunkter har korrekt autorisasjonssjekk
- Slett-konto-rutinen er oppdatert hvis ny collection eller Storage-path er lagt til
- Ingen sensitiv data i feilmeldinger til klient
- Nye felt som lagres i Firestore er dokumentert og nødvendige
- Samtykke-versjon er oppdatert hvis personvernerklæringen er endret
