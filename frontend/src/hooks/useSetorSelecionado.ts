import { useState } from "react";
import { useAuth } from "./useAuth";

export const SETOR_SESSION_KEY = "farol_setor_selecionado";

/** Setor selecionado nas telas de Metas/Dashboard.
 * Responsável e gerente com setor fixo usam sempre o próprio setor
 * (não há seleção manual). Admin/gerente sem setor têm a última
 * escolha fixada em sessionStorage até trocarem ou fazerem logout. */
export function useSetorSelecionado() {
  const { usuario } = useAuth();
  const setorFixo = usuario?.role === "responsavel" || (usuario?.role === "gerente" && !!usuario.setor_id);

  const [setorId, setSetorIdState] = useState<string | undefined>(() => {
    if (setorFixo) return usuario?.setor_id ?? undefined;
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
