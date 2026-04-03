import { adminDB } from '../firebase/config.js';

const rateLimitCol = () => adminDB.collection('rate_limits');

/**
 * Firestore-basert rate limiter per bruker (uid).
 * Fungerer på tvers av Cloud Functions-instanser.
 * @param {number} maks   - Maks antall kall per vindu
 * @param {number} vindusMs - Tidsvindu i millisekunder
 */
export function rateLimiter(maks = 10, vindusMs = 60_000) {
  return async (req, res, next) => {
    const uid = req.user?.uid;
    if (!uid) return next();

    const docId = `${uid}_${maks}_${vindusMs}`;

    try {
      const ref = rateLimitCol().doc(docId);
      const now = Date.now();

      const result = await adminDB.runTransaction(async (t) => {
        const doc = await t.get(ref);
        const data = doc.exists ? doc.data() : null;

        // Nytt vindu eller utløpt vindu
        if (!data || now - data.start > vindusMs) {
          t.set(ref, { uid, antall: 1, start: now });
          return { ok: true };
        }

        // Sjekk om grensen er nådd
        if (data.antall >= maks) {
          return { ok: false };
        }

        // Inkrementer teller
        t.update(ref, { antall: data.antall + 1 });
        return { ok: true };
      });

      if (!result.ok) {
        return res.status(429).json({
          feil: 'For mange forespørsler. Vent litt og prøv igjen.'
        });
      }

      next();
    } catch (err) {
      console.error('Rate limiter feil:', err.message);
      // Ved feil: la requesten gå gjennom (fail open) — bedre enn å blokkere alt
      next();
    }
  };
}
