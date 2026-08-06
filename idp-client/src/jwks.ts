import { createPublicKey, type JsonWebKey, type KeyObject } from "crypto";

interface Jwk extends JsonWebKey {
  kid: string;
}

interface CachedKey {
  kid: string;
  keyObject: KeyObject;
}

// Cache do JWKS do IdP (OS 07, secao 3.5): busca uma vez, reaproveita por
// `ttlMs`, e busca de novo se aparecer um `kid` que o cache atual nao tem -
// e assim que uma rotacao de chave no IdP se propaga sem exigir reiniciar
// o sistema cliente manualmente.
export class JwksCache {
  private keys: CachedKey[] = [];
  private lastFetchedAt = 0;
  private pendingFetch: Promise<void> | null = null;

  constructor(
    private readonly idpUrl: string,
    private readonly ttlMs: number
  ) {}

  async getKey(kid: string): Promise<KeyObject> {
    const isFresh = Date.now() - this.lastFetchedAt < this.ttlMs;
    const cached = this.keys.find((k) => k.kid === kid);
    if (cached && isFresh) {
      return cached.keyObject;
    }

    await this.refresh();

    const found = this.keys.find((k) => k.kid === kid);
    if (!found) {
      throw new Error(`Chave com kid="${kid}" nao encontrada no JWKS do IdP`);
    }
    return found.keyObject;
  }

  // Varias requisicoes concorrentes com cache frio nao devem disparar N
  // fetches simultaneos ao IdP - todas aguardam o mesmo fetch em andamento.
  private refresh(): Promise<void> {
    if (!this.pendingFetch) {
      this.pendingFetch = this.doFetch().finally(() => {
        this.pendingFetch = null;
      });
    }
    return this.pendingFetch;
  }

  private async doFetch(): Promise<void> {
    const res = await fetch(`${this.idpUrl}/.well-known/jwks.json`);
    if (!res.ok) {
      throw new Error(`Falha ao buscar JWKS do IdP (HTTP ${res.status})`);
    }
    const body = (await res.json()) as { keys: Jwk[] };

    this.keys = body.keys.map((jwk) => ({
      kid: jwk.kid,
      keyObject: createPublicKey({ key: jwk, format: "jwk" }),
    }));
    this.lastFetchedAt = Date.now();
  }
}
