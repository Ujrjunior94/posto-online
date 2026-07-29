import { AppState, FuelTank, ShiftSchedule } from "../../types";

export class DashboardService {
  /**
   * Aggregates total fuel inventory and capacity statistics
   */
  public getInventorySummary(tanks: FuelTank[]): {
    totalLiters: number;
    totalCapacity: number;
    averageFillPercentage: number;
    criticalTanksCount: number;
  } {
    if (tanks.length === 0) {
      return { totalLiters: 0, totalCapacity: 0, averageFillPercentage: 0, criticalTanksCount: 0 };
    }

    const totalLiters = tanks.reduce((acc, t) => acc + (t.volumeAtual || 0), 0);
    const totalCapacity = tanks.reduce((acc, t) => acc + (t.capacidadeMaxima || 1), 0);
    const criticalTanksCount = tanks.filter((t) => t.volumeAtual <= t.pontoCriticoAlerta).length;

    return {
      totalLiters,
      totalCapacity,
      averageFillPercentage: Math.round((totalLiters / totalCapacity) * 100),
      criticalTanksCount,
    };
  }

  /**
   * Evaluates active shifts compliance and checklists completion
   */
  public getActiveShiftSummary(shifts: ShiftSchedule[]): {
    activeShiftName: string;
    responsibleFrentista: string;
    checklistCompletionRate: number;
    pendingCount: number;
  } {
    const active = shifts.find((s) => s.status === "Em Andamento");
    if (!active) {
      return { activeShiftName: "Nenhum", responsibleFrentista: "Ninguém", checklistCompletionRate: 0, pendingCount: 0 };
    }

    const checklistItems = Object.values(active.checklist || {});
    const total = checklistItems.length;
    const completed = checklistItems.filter(Boolean).length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      activeShiftName: active.turno,
      responsibleFrentista: active.frentistaResponsavel,
      checklistCompletionRate: completionRate,
      pendingCount: total - completed,
    };
  }

  /**
   * Formulates urgent warning alerts for critical levels or deviations
   */
  public getOperationalAlerts(state: AppState): { id: string; type: "CRITICAL" | "WARNING" | "INFO"; message: string }[] {
    const alerts: { id: string; type: "CRITICAL" | "WARNING" | "INFO"; message: string }[] = [];

    // 1. Tanks level check
    const tanks = state.tanks || [];
    tanks.forEach((t) => {
      if (t.volumeAtual <= t.pontoCriticoAlerta) {
        alerts.push({
          id: `tank-crit-${t.id}`,
          type: "CRITICAL",
          message: `O ${t.identificador} (${t.combustivel}) atingiu nível crítico de reabastecimento (${t.volumeAtual}L)!`,
        });
      } else if (t.volumeAtual / t.capacidadeMaxima <= 0.2) {
        alerts.push({
          id: `tank-warn-${t.id}`,
          type: "WARNING",
          message: `Nível de combustível baixo no ${t.identificador} (${Math.round((t.volumeAtual / t.capacidadeMaxima) * 100)}%).`,
        });
      }
    });

    // 2. Shortages / Quebra de caixa check
    const shortages = state.shortages || [];
    const pendingShortages = shortages.filter((s) => s.status === "Pendente");
    if (pendingShortages.length > 0) {
      alerts.push({
        id: "shortages-pending",
        type: "WARNING",
        message: `Existem ${pendingShortages.length} ocorrências de quebra de caixa pendentes de conciliação.`,
      });
    }

    // 3. Unsynchronized database check
    if (navigator.onLine === false) {
      alerts.push({
        id: "offline-mode",
        type: "INFO",
        message: "Você está trabalhando em Modo Offline. Alterações serão enviadas ao Firestore assim que recuperar conexão.",
      });
    }

    return alerts;
  }
}

export const dashboardService = new DashboardService();
