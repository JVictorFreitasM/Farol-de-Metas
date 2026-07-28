import { Decimal } from "@prisma/client/runtime/library";
import { Indicador, Meta, TipoAgregacaoMeta, TipoAgregacaoReal } from "@prisma/client";
import { MESES, MesKey, MetaComIndicador, campoMeta, campoReal } from "../../src/lib/metasCalc";

/** Fábricas de MetaComIndicador/Meta sintéticos para os testes de metasCalc — evita repetir os
 * ~40 campos do Meta/Indicador do Prisma (a maioria irrelevante pra lógica de acumulado) em
 * cada teste; cada caso só passa o que de fato varia. */

let contador = 0;
function proximoId(prefixo: string): string {
  contador += 1;
  return `${prefixo}-${contador}`;
}

export function dec(valor: number | string | null | undefined): Decimal | null {
  return valor == null ? null : new Decimal(valor);
}

/** Monta os 36 campos meta{Mes}/real{Mes}/status{Mes} a partir de mapas parciais por mês,
 * usando campoMeta/campoReal (as mesmas funções que metasCalc.ts usa para ler esses campos) —
 * garante que a chave gerada aqui bate com a que o código de produção lê. */
function construirCamposMensais(
  meses?: Partial<Record<MesKey, number | null>>,
  reais?: Partial<Record<MesKey, number | null>>
): Record<string, Decimal | null> {
  const campos: Record<string, Decimal | null> = {};
  for (const mes of MESES) {
    campos[campoMeta(mes)] = dec(meses?.[mes]);
    campos[campoReal(mes)] = dec(reais?.[mes]);
    campos[`status${mes}`] = null; // gerado pelo banco (StatusMeta) — não usado por calcularAcumulado*
  }
  return campos;
}

export interface OverridesIndicador {
  icIv?: "IC" | "IV";
  unidade?: string;
  agregaIvs?: boolean;
  tipoAcumuladoMeta?: string;
  tipoAcumuladoReal?: string;
  tipoAgregacaoMeta?: TipoAgregacaoMeta;
  tipoAgregacaoReal?: TipoAgregacaoReal;
  realManualAcum?: number | null;
}

export function criarIndicador(overrides: OverridesIndicador = {}): Indicador {
  const agora = new Date();
  return {
    id: proximoId("indicador"),
    setorId: "setor-1",
    nome: "Indicador de teste",
    icIv: overrides.icIv ?? "IV",
    unidade: overrides.unidade ?? "%",
    paiId: null,
    produtoId: null,
    agregaIvs: overrides.agregaIvs ?? false,
    tipoAcumuladoMeta: overrides.tipoAcumuladoMeta ?? "soma",
    tipoAcumuladoReal: overrides.tipoAcumuladoReal ?? "soma",
    tipoAgregacaoMeta: overrides.tipoAgregacaoMeta ?? "soma",
    tipoAgregacaoReal: overrides.tipoAgregacaoReal ?? "soma",
    realManualAcum: dec(overrides.realManualAcum),
    ativo: true,
    criadoEm: agora,
    atualizadoEm: agora,
  } as unknown as Indicador;
}

export interface OverridesMeta {
  tipoMeta?: "maior_melhor" | "menor_melhor";
  acumMetaManual?: number | null;
  acumRealManual?: number | null;
  meta?: Partial<Record<MesKey, number | null>>;
  real?: Partial<Record<MesKey, number | null>>;
  indicador?: OverridesIndicador;
  /** Acumulado/meta anual já calculados da linha — usados nos testes de recalcularAgregadoIC,
   * que agregam o acumMeta/acumReal/metaAno já resolvido dos IVs (não recalcula a partir dos
   * meses deles). */
  acumMeta?: number | null;
  acumReal?: number | null;
  metaAno?: number | null;
  /** OS-018: acúmulo restrito a um intervalo de meses por lado, independente entre Meta e Real.
   * Default acumuloEspecifico=false (e os 4 campos null) — testes existentes da OS-017 não
   * passam esses overrides e devem continuar se comportando exatamente como antes. */
  acumuloEspecifico?: boolean;
  acumMetaMesInicio?: MesKey | null;
  acumMetaMesFim?: MesKey | null;
  acumRealMesInicio?: MesKey | null;
  acumRealMesFim?: MesKey | null;
}

export function criarMeta(overrides: OverridesMeta = {}): MetaComIndicador {
  const agora = new Date();
  const indicador = criarIndicador(overrides.indicador);

  const base = {
    id: proximoId("meta"),
    setorId: indicador.setorId,
    ano: 2025,
    indicadorId: indicador.id,
    ordem: 0,
    responsavel: "Responsável Teste",
    tipoMeta: overrides.tipoMeta ?? "maior_melhor",
    metaManualAcum: null,
    acumMetaManual: dec(overrides.acumMetaManual),
    acumRealManual: dec(overrides.acumRealManual),
    metaAno: dec(overrides.metaAno),
    acumMeta: dec(overrides.acumMeta),
    acumReal: dec(overrides.acumReal),
    statusAcum: null,
    criadoEm: agora,
    atualizadoEm: agora,
    atualizadoPor: null,
    inativadoEm: null,
    inativadoPor: null,
    ativo: true,
    acumuloEspecifico: overrides.acumuloEspecifico ?? false,
    acumMetaMesInicio: overrides.acumMetaMesInicio ?? null,
    acumMetaMesFim: overrides.acumMetaMesFim ?? null,
    acumRealMesInicio: overrides.acumRealMesInicio ?? null,
    acumRealMesFim: overrides.acumRealMesFim ?? null,
    ...construirCamposMensais(overrides.meta, overrides.real),
  } as unknown as Meta;

  return { ...base, indicador };
}

/** Fábrica de um IV "cru" (sem `indicador`) — usada nos testes de recalcularAgregadoIC, que
 * recebe `Meta[]` (os IVs) direto, sem precisar do Indicador relacionado. */
export function criarIv(overrides: Omit<OverridesMeta, "indicador"> = {}): Meta {
  const { indicador, ...meta } = criarMeta(overrides);
  void indicador;
  return meta;
}
