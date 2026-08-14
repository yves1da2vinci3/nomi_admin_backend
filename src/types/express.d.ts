import "express";
import type { PortalRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      /** Présent lorsque l’auth Bearer est un JWT admin valide */
      adminAuth?: { sub: string; email: string };
      /** Présent sous `/api/v1/partner/*` lorsque le JWT portail est valide */
      partnerAuth?: {
        sub: string;
        email: string;
        companyId: string;
        role: PortalRole;
      };
    }
  }
}

export {};
