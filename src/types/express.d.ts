import { UserRole } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        nome: string;
        email: string;
        setorId: string | null;
        role: UserRole;
      };
    }
  }
}

export {};
