import { badRequest } from "./errors";
import { MESES, MesKey } from "./metasCalc";

// OS-018: mapa mês minúsculo ("jan") -> MesKey ("Jan"), mesmo padrão usado em metas.routes.ts
// (mesLowerParaMesKey) — duplicado aqui pra manter esta validação sem depender de routes.ts
// (que importa Express/Prisma e não deve ser importado por um módulo de lib puro).
const mesLowerParaMesKey: Record<string, MesKey> = Object.fromEntries(MESES.map((mes) => [mes.toLowerCase(), mes]));

export interface CamposAcumuloEspecifico {
  acumulo_especifico?: boolean;
  acum_meta_mes_inicio?: string;
  acum_meta_mes_fim?: string;
  acum_real_mes_inicio?: string;
  acum_real_mes_fim?: string;
}

export interface IndicadorParaValidacaoAcumulo {
  tipoAcumuladoMeta: string;
  tipoAcumuladoReal: string;
  agregaIvs: boolean;
}

/** Valida e resolve os campos de "Acúmulo específico" (OS-018) para o `data` de um
 * create/update do Prisma em Meta, dado o indicador da linha (precisa de tipo_acumulado_meta/
 * real e agrega_ivs pra validar incompatibilidades). Compartilhado entre POST /metas (criar) e
 * PUT /metas/:id/meta (editar) — ver src/routes/metas.routes.ts.
 *
 * - `acumulo_especifico` ausente no payload: não mexe na configuração já salva (retorna {}) —
 *   uma edição de outro campo (ex: meta_ano) não deve apagar acúmulo específico já configurado.
 * - `acumulo_especifico=false`: limpa os 4 campos de intervalo (null), pra não deixar
 *   configuração "fantasma" que confunda uma leitura futura do banco.
 * - `acumulo_especifico=true`: exige os 4 campos, exige mes_fim >= mes_inicio em cada par, e
 *   rejeita se tipo_acumulado_meta/real="manual" no mesmo lado ou se o indicador agrega IVs (um
 *   IC que agrega herda o acumulado já calculado dos IVs configurados — não precisa de janela
 *   própria; permitir aqui criaria uma configuração que o recálculo do IC sobrescreve em
 *   silêncio sempre que um IV mudar, o mesmo tipo de inconsistência que motivou esta OS).
 */
export function resolverAcumuloEspecifico(body: CamposAcumuloEspecifico, indicador: IndicadorParaValidacaoAcumulo) {
  if (body.acumulo_especifico === undefined) return {};

  if (!body.acumulo_especifico) {
    return {
      acumuloEspecifico: false,
      acumMetaMesInicio: null,
      acumMetaMesFim: null,
      acumRealMesInicio: null,
      acumRealMesFim: null,
    };
  }

  const { acum_meta_mes_inicio, acum_meta_mes_fim, acum_real_mes_inicio, acum_real_mes_fim } = body;
  if (!acum_meta_mes_inicio || !acum_meta_mes_fim || !acum_real_mes_inicio || !acum_real_mes_fim) {
    throw badRequest(
      "acumulo_especifico=true requer os 4 campos: acum_meta_mes_inicio, acum_meta_mes_fim, acum_real_mes_inicio e acum_real_mes_fim"
    );
  }
  if (indicador.agregaIvs) {
    throw badRequest("Este indicador agrega os valores dos IVs — acúmulo específico deve ser configurado nos IVs, não no IC");
  }
  if (indicador.tipoAcumuladoMeta === "manual") {
    throw badRequest(
      "acumulo_especifico não pode ser combinado com tipo_acumulado_meta='manual' — escolha uma das duas configurações para o lado Meta"
    );
  }
  if (indicador.tipoAcumuladoReal === "manual") {
    throw badRequest(
      "acumulo_especifico não pode ser combinado com tipo_acumulado_real='manual' — escolha uma das duas configurações para o lado Real"
    );
  }

  const metaMesInicio = mesLowerParaMesKey[acum_meta_mes_inicio];
  const metaMesFim = mesLowerParaMesKey[acum_meta_mes_fim];
  const realMesInicio = mesLowerParaMesKey[acum_real_mes_inicio];
  const realMesFim = mesLowerParaMesKey[acum_real_mes_fim];

  if (MESES.indexOf(metaMesFim) < MESES.indexOf(metaMesInicio)) {
    throw badRequest("acum_meta_mes_fim não pode vir antes de acum_meta_mes_inicio");
  }
  if (MESES.indexOf(realMesFim) < MESES.indexOf(realMesInicio)) {
    throw badRequest("acum_real_mes_fim não pode vir antes de acum_real_mes_inicio");
  }

  return {
    acumuloEspecifico: true,
    acumMetaMesInicio: metaMesInicio,
    acumMetaMesFim: metaMesFim,
    acumRealMesInicio: realMesInicio,
    acumRealMesFim: realMesFim,
  };
}
