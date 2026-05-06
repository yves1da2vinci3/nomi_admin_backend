import "express";

declare global {
  namespace Express {
    interface Request {
      /** Présent lorsque l’auth Bearer est un JWT admin valide */
      adminAuth?: { sub: string; email: string };
    }
  }
}

export {};
