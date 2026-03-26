import { adminAuth, adminDB } from '../firebase/config.js';

/**
 * Verifiserer Firebase ID-token fra Authorization-header.
 * Putter { uid, navn, epost, rolle, ...resten av Firestore-profil } på req.user.
 */
export async function krevAuth(req, res, next) {
  const token = req.headers.authorization?.split('Bearer ')[1];
  if (!token) {
    return res.status(401).json({ feil: 'Ikke innlogget' });
  }

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const userDoc = await adminDB.collection('users').doc(decoded.uid).get();

    if (!userDoc.exists) {
      return res.status(403).json({ feil: 'Brukerprofil ikke funnet' });
    }

    const userData = userDoc.data();

    // Bedrifter som ikke er godkjent blokkeres
    if (userData.rolle === 'bedrift' && userData.godkjent === false) {
      return res.status(403).json({ feil: 'Kontoen venter godkjenning fra Opplæringskontoret' });
    }

    // Sjekk e-postverifisering (hopp over for Google-brukere)
    const firebaseUser = await adminAuth.getUser(decoded.uid);
    const erGoogle = firebaseUser.providerData?.some(p => p.providerId === 'google.com');
    if (!erGoogle && userData.epostVerifisert !== true) {
      return res.status(403).json({ feil: 'Du må verifisere e-posten din først.' });
    }

    req.user = { uid: decoded.uid, ...userData };
    next();
  } catch {
    return res.status(401).json({ feil: 'Ugyldig sesjon — logg inn på nytt' });
  }
}

/**
 * Krever at innlogget bruker har en av de angitte rollene.
 * Må brukes etter krevAuth.
 */
export function krevRolle(...roller) {
  return (req, res, next) => {
    if (!roller.includes(req.user?.rolle)) {
      return res.status(403).json({ feil: 'Ingen tilgang' });
    }
    next();
  };
}
