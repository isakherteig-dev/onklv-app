# SKILL: Perfect Match — Auth, Sikkerhet & Norsk UX

## Hva denne skilen gjør
Når Claude Code skal bygge auth-system, skjemaer, eller brukergrensesnitt
for Perfect Match, les denne filen. Definerer sikkerhetskrav og norsk UX-tone.

---

## Autentisering — Slik skal det bygges

### Backend (server.js / routes/auth.js)

```javascript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET; // Aldri hardkod denne

// Registrering
export async function registerUser(email, password, role) {
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  // lagre i DB: email, hash, role
}

// Innlogging
export async function loginUser(email, password, res) {
  const user = await getUserByEmail(email);
  if (!user) throw new Error('Feil e-post eller passord');
  
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) throw new Error('Feil e-post eller passord');

  const token = jwt.sign(
    { id: user.id, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  // Lagre i httpOnly cookie — IKKE localStorage
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 dager
  });
}
```

### Middleware

```javascript
// middleware/auth.js
import jwt from 'jsonwebtoken';

export function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Du må logge inn først' });

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesjonen er utløpt. Logg inn på nytt.' });
  }
}

export function requireRole(role) {
  return (req, res, next) => {
    if (req.user?.role !== role) {
      return res.status(403).json({ error: 'Du har ikke tilgang til denne siden' });
    }
    next();
  };
}
```

---

## Filhåndtering (CV-opplasting)

```javascript
import multer from 'multer';
import path from 'path';

const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    // Aldri bruk originalfilnavn direkte — sanitize det
    const safe = `${req.user.id}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, safe);
  }
});

export const uploadCV = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // maks 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Kun PDF og Word-filer er tillatt'));
  }
});
```

---

## Norsk UX-regler

### Tone og språk
- Bruk **du-form** (ikke "brukeren" eller "man")
- Feilmeldinger skal være **hjelpsomme**, ikke tekniske
- Bekreftelsesmeldinger skal være **positive og korte**
- Knapper på norsk: "Søk nå", "Lagre profil", "Send søknad", "Logg inn"

### Eksempel på feilmeldinger (RIKTIG vs FEIL)

| ❌ Teknisk | ✅ Norsk og vennlig |
|---|---|
| `Error 422: Validation failed` | `Fyll ut alle påkrevde felter` |
| `JWT expired` | `Du har vært borte en stund — logg inn på nytt` |
| `File type not allowed` | `Kun PDF og Word-filer kan lastes opp` |
| `Internal server error` | `Noe gikk galt. Prøv igjen om litt.` |

### CSS-design-prinsipper for denne appen

```css
:root {
  /* Norsk / tillitsvekkende fargeprofil */
  --farge-hoved: #1a56db;      /* Blå — trygg, offisiell */
  --farge-aksent: #0ea5e9;     /* Lysere blå */
  --farge-suksess: #16a34a;    /* Grønn — godkjent, positivt */
  --farge-advarsel: #d97706;   /* Oransje */
  --farge-feil: #dc2626;       /* Rød */
  --farge-bakgrunn: #f8fafc;
  --farge-tekst: #0f172a;
  --radius: 10px;
  --skygge: 0 2px 8px rgba(0,0,0,0.08);
}

/* Mobiloptimalisert — lærlinger bruker telefon */
body {
  font-size: 16px; /* Aldri under 16px på mobil */
  line-height: 1.6;
}

input, button {
  min-height: 48px; /* Tommelvennlig touch-target */
  font-size: 1rem;
}
```

---

## Rollebasert navigasjon

```javascript
// public/app.js — etter innlogging, redirect basert på rolle
async function handleLogin(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  if (!res.ok) {
    const { error } = await res.json();
    visFeilmelding(error); // norsk feilmelding fra server
    return;
  }

  const { role } = await res.json();
  const sider = {
    laerling: '/laerling/dashboard.html',
    bedrift: '/bedrift/dashboard.html',
    admin: '/admin/dashboard.html'
  };
  window.location.href = sider[role] || '/';
}
```

---

## GDPR-minimum for norsk app

- Vis cookie-banner ved første besøk
- Lenke til personvernerklæring i footer
- Brukere kan slette sin egen konto (DELETE /api/users/meg)
- Ikke send unødvendig persondata til tredjeparts-tjenester
- Logg ikke søk eller atferd uten samtykke

---

## .env variabler som trengs

```
ANTHROPIC_API_KEY=sk-ant-...
JWT_SECRET=en-lang-tilfeldig-streng-minst-32-tegn
PORT=3000
NODE_ENV=development
DATABASE_URL=./db/perfectmatch.db
```

Generer JWT_SECRET med: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
