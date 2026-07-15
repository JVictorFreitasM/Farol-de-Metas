import { useState } from "react";
import { useAuth } from "./useAuth";

export const SETOR_SESSION_KEY = "farol_setor_selecionado";

/** Setor selecionado nos filtros das telas de Metas/Dashboard.
 * Responsável usa sempre o próprio setor. Gerente/admin têm a seleção
 * fixada em sessionStorage até trocarem manualmente ou fazerem logout. */
export function useSetorSelecionado() {
  const { usuario } = useAuth();

  const [setorId, setSetorIdState] = useState<string | undefined>(() => {
    if (usuario?.role === "responsavel") return usuario.setor_id ?? undefined;
    const salvo = sessionStorage.getItem(SETOR_SESSION_KEY);
    return salvo ?? undefined;
  });

  const setSetorId = (novoSetorId: string | undefined) => {
    if (novoSetorId) sessionStorage.setItem(SETOR_SESSION_KEY, novoSetorId);
    else sessionStorage.removeItem(SETOR_SESSION_KEY);
    setSetorIdState(novoSetorId);
  };

  return [setorId, setSetorId] as const;
}
