import bcrypt from "bcryptjs";

/** OS-003 §12: senhas armazenadas com bcrypt (cost = 12). */
export const BCRYPT_SALT_ROUNDS = 12;

export function hashPassword(senha: string): Promise<string> {
  return bcrypt.hash(senha, BCRYPT_SALT_ROUNDS);
}

export function verifyPassword(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
