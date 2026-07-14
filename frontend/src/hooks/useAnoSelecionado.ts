import { useState } from "react";

export const ANO_SESSION_KEY = "farol_ano_selecionado";

export function gerarOpcoesAno(anosPassado = 5, anosFuturo = 1): number[] {
  const anoAtual = new Date().getFullYear();
  const opcoes: number[] = [];
  for (let a = anoAtual + anosFuturo; a >= anoAtual - anosPassado; a--) opcoes.push(a);
  return opcoes;
}

/** Ano selecionado nos filtros das telas de Metas/Dashboard/Relatórios.
 * Fica fixo (persistido em sessionStorage) até o fim da sessão (logout). */
export function useAnoSelecionado() {
  const [ano, setAnoState] = useState<number>(() => {
    const salvo = sessionStorage.getItem(ANO_SESSION_KEY);
    const anoSalvo = salvo ? Number(salvo) : NaN;
    return Number.isFinite(anoSalvo) ? anoSalvo : new Date().getFullYear();
  });

  const setAno = (novoAno: number) => {
    sessionStorage.setItem(ANO_SESSION_KEY, String(novoAno));
    setAnoState(novoAno);
  };

  return [ano, setAno] as const;
}
