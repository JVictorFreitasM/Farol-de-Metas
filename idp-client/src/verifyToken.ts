import jwt from "jsonwebtoken";
import type { JwksCache } from "./jwks";
import type { IdpUser } from "./types";

export class TokenVerificationError extends Error {}

// Valida o access_token localmente (assinatura via JWKS + exp), sem chamar
// o IdP - o ganho central do padrao JWKS (OS 05/07). `audience: clientId` e
// obrigatorio aqui, nao opcional: e o que impede um token valido de um
// sistema ser aceito por outro que confie na mesma chave publica do IdP
// (OS 05 secao 4, OS 07 secao 3.3).
export async function verifyAccessToken(
  token: string,
  jwks: JwksCache,
  clientId: string,
  issuer?: string
): Promise<IdpUser> {
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded || typeof decoded.payload === "string" || !decoded.header.kid) {
    throw new TokenVerificationError("Token sem kid no header");
  }

  const keyObject = await jwks.getKey(decoded.header.kid);
  const publicKeyPem = keyObject.export({ type: "spki", format: "pem" }) as string;

  let payload: jwt.JwtPayload;
  try {
    payload = jwt.verify(token, publicKeyPem, {
      algorithms: ["RS256"],
      audience: clientId,
      issuer,
    }) as jwt.JwtPayload;
  } catch (err) {
    throw new TokenVerificationError(err instanceof Error ? err.message : "Token invalido");
  }

  if (typeof payload.sub !== "string" || typeof payload.email !== "string" || typeof payload.system !== "string") {
    throw new TokenVerificationError("Claims obrigatorias ausentes no token");
  }

  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : "",
    role: typeof payload.role === "string" ? payload.role : null,
    system: payload.system,
  };
}
