import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "24h";

export interface JwtClaims {
  sub: string;
  nome: string;
  email: string;
  setorId: string | null;
  role: UserRole;
}

export function signToken(claims: JwtClaims): string {
  return jwt.sign(claims, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtClaims {
  return jwt.verify(token, JWT_SECRET) as JwtClaims;
}
