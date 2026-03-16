import jwt from 'jsonwebtoken';

export function krevAuth(req, res, next) {
  const token = req.cookies?.pm_token;
  if (!token) {
    return res.status(401).json({ feil: 'Ikke innlogget' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ feil: 'Ugyldig sesjon — logg inn på nytt' });
  }
}

export function krevRolle(...roller) {
  return (req, res, next) => {
    if (!roller.includes(req.user?.rolle)) {
      return res.status(403).json({ feil: 'Ingen tilgang' });
    }
    next();
  };
}
