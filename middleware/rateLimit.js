// Enkel in-memory rate limiter per bruker (uid)
// Teller kall per tidsvindu — resettes automatisk etter windowMs

const vinduer = new Map();

/**
 * Lager en rate-limiting middleware.
 * @param {number} maks   - Maks antall kall per vindu
 * @param {number} vindusMs - Tidsvindu i millisekunder
 */
export function rateLimiter(maks = 10, vindusMs = 60_000) {
  return (req, res, next) => {
    const uid = req.user?.uid;
    if (!uid) return next(); // krevAuth håndterer manglende bruker

    const na = Date.now();
    const post = vinduer.get(uid) || { antall: 0, start: na };

    if (na - post.start > vindusMs) {
      // Nytt tidsvindu
      vinduer.set(uid, { antall: 1, start: na });
      return next();
    }

    if (post.antall >= maks) {
      return res.status(429).json({
        feil: 'For mange forespørsler. Vent litt og prøv igjen.'
      });
    }

    post.antall++;
    vinduer.set(uid, post);
    next();
  };
}
