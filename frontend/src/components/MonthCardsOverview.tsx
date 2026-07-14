import { Meta, MESES, MESES_LABEL, Mes, StatusMeta } from "../types";

interface MesCard {
  mes: Mes;
  label: string;
  meta_acum: number;
  real_acum: number;
  status_acum: StatusMeta | null;
  ics_ok: number;
  ics_total: number;
}

interface Props {
  metas: Meta[];
  mesSelecionado: Mes;
  onMesSelecionado: (mes: Mes) => void;
}

function formatarNumero(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function MonthCardsOverview({ metas, mesSelecionado, onMesSelecionado }: Props) {
  const ics = metas.filter((m) => m.ic_iv === "IC");

  const mesCards: MesCard[] = MESES.map((mes) => {
    const idxMes = MESES.indexOf(mes);

    const metasAteEMes = ics.filter((ic) => {
      for (let i = 0; i <= idxMes; i++) {
        if (ic.meses[MESES[i]].real !== null) return true;
      }
      return false;
    });

    const meta_acum = metasAteEMes.reduce((sum, ic) => {
      const val = Number(ic.meses[mes].meta ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    const real_acum = metasAteEMes.reduce((sum, ic) => {
      const val = Number(ic.meses[mes].real ?? 0);
      return sum + (isNaN(val) ? 0 : val);
    }, 0);

    let status_acum: StatusMeta | null = null;
    if (metasAteEMes.length > 0) {
      status_acum = real_acum >= meta_acum ? "ok" : "nok";
    }

    const ics_ok = ics.filter((ic) => ic.meses[mes].status === "ok").length;
    const ics_total = ics.filter((ic) => ic.meses[mes].real !== null).length;

    return {
      mes,
      label: MESES_LABEL[mes],
      meta_acum,
      real_acum,
      status_acum,
      ics_ok,
      ics_total,
    };
  });

  return (
    <div className="month-cards-section">
      <div className="month-cards-container">
        {mesCards.map((card) => (
          <div
            key={card.mes}
            className={`month-card ${mesSelecionado === card.mes ? "selected" : ""}`}
            onClick={() => onMesSelecionado(card.mes)}
          >
            <div className="month-card-label">{card.label}</div>
            <div className="month-card-value">
              {card.ics_ok}/{card.ics_total}
            </div>
            <div className="month-card-acumulado">
              Meta: {formatarNumero(card.meta_acum)}
              <br />
              Real: {formatarNumero(card.real_acum)}
            </div>
            <div className={`month-card-status ${card.status_acum ?? "null"}`}>
              {card.status_acum ? card.status_acum.toUpperCase() : "-"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
