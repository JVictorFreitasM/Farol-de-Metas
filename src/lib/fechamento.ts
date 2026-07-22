import { UserRole } from "@prisma/client";
import { prisma } from "./prisma";
import { conflict } from "./errors";
import { MESES, MesKey } from "./metasCalc";

const MES_NOME_COMPLETO: Record<MesKey, string> = {
  Jan: "janeiro",
  Fev: "fevereiro",
  Mar: "março",
  Abr: "abril",
  Mai: "maio",
  Jun: "junho",
  Jul: "julho",
  Ago: "agosto",
  Set: "setembro",
  Out: "outubro",
  Nov: "novembro",
  Dez: "dezembro",
};

export async function obterDiaLimite(): Promise<number> {
  const config = await prisma.configuracaoSistema.findFirstOrThrow();
  return config.diaLimitePreenchimento;
}

/** Um mês/ano está fechado quando: (a) é anterior ao mês corrente, (b) já passou do dia-limite
 * configurado (só se aplica ao mês imediatamente anterior — meses mais antigos estão sempre
 * fechados, já passaram do próprio dia-limite deles em algum momento do passado) e (c) o setor
 * não tem um desbloqueio pontual ativo para aquele mês/ano. */
export async function mesEstaFechado(setorId: string, ano: number, mes: MesKey, hoje = new Date()): Promise<boolean> {
  const mesNumero = MESES.indexOf(mes) + 1;
  const anoMesAlvo = ano * 12 + (mesNumero - 1);
  const anoMesAtual = hoje.getFullYear() * 12 + hoje.getMonth();

  // Mês corrente ou futuro nunca fecha por essa regra.
  if (anoMesAlvo >= anoMesAtual) return false;

  // Mês imediatamente anterior: só fecha depois do dia-limite deste mês corrente.
  if (anoMesAlvo === anoMesAtual - 1) {
    const diaLimite = await obterDiaLimite();
    if (hoje.getDate() <= diaLimite) return false;
  }

  const desbloqueio = await prisma.desbloqueioPreenchimento.findUnique({
    where: { setorId_ano_mes: { setorId, ano, mes: mesNumero } },
  });
  return !desbloqueio;
}

/** Lança 409 se algum dos meses informados estiver fechado para o setor/ano, com mensagem
 * indicando o mês e o prazo configurado. `admin` nunca é bloqueado — a checagem é pulada
 * inteiramente para esse perfil. Não faz nada se a lista de meses estiver vazia. */
export async function garantirMesesAbertos(
  usuario: { role: UserRole },
  setorId: string,
  ano: number,
  meses: MesKey[],
  hoje = new Date()
): Promise<void> {
  if (usuario.role === "admin" || meses.length === 0) return;

  for (const mes of meses) {
    if (await mesEstaFechado(setorId, ano, mes, hoje)) {
      const diaLimite = await obterDiaLimite();
      throw conflict(
        `Preenchimento de ${MES_NOME_COMPLETO[mes]}/${ano} está encerrado (prazo: até dia ${diaLimite}). ` +
          "Peça ao administrador para liberar este setor/mês."
      );
    }
  }
}
