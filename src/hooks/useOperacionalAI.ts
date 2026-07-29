import { useMemo, useState } from "react";
import { AppState, FuelTank, ShiftSchedule, ANPQualityAudit, Nozzle } from "../types";

export type SuggestionCategory = "tanques" | "checklists" | "qualidade" | "bicos" | "financeiro" | "geral";
export type SuggestionPriority = "urgente" | "alta" | "media" | "info";

export interface ActionSuggestion {
  id: string;
  category: SuggestionCategory;
  priority: SuggestionPriority;
  title: string;
  description: string;
  impact: string;
  actionText: string;
  targetTab: string;
  timestamp: string;
  metricBadge?: string;
  tags?: string[];
}

export interface CopilotSummary {
  healthScore: number; // 0 to 100
  headline: string;
  summaryText: string;
  criticalTankCount: number;
  lowTankCount: number;
  pendingChecklistsCount: number;
  unclosedShiftsCount: number;
  activeShiftName?: string;
  frentistaInCharge?: string;
  pendingANPAudits: boolean;
  blockedNozzlesCount: number;
  lastUpdated: string;
}

export function useOperacionalAI(appState: AppState) {
  const [refreshKey, setRefreshKey] = useState(0);

  const analysis = useMemo(() => {
    const {
      tanks = [],
      shifts = [],
      qualityAudits = [],
      nozzles = [],
      dailyBalances = [],
      nozzleClosings = []
    } = appState;

    const suggestions: ActionSuggestion[] = [];

    // 1. ANALYZE FUEL TANKS
    const criticalTanks = tanks.filter((t) => t.volumeAtual <= (t.pontoCriticoAlerta || 1500));
    const lowTanks = tanks.filter(
      (t) => t.volumeAtual > (t.pontoCriticoAlerta || 1500) && t.volumeAtual <= t.capacidadeMaxima * 0.35
    );

    criticalTanks.forEach((t) => {
      const pct = Math.round((t.volumeAtual / t.capacidadeMaxima) * 100);
      suggestions.push({
        id: `critical-tank-${t.id}`,
        category: "tanques",
        priority: "urgente",
        title: `Nível Crítico: ${t.combustivel} (${t.identificador})`,
        description: `O volume de ${t.volumeAtual.toLocaleString("pt-BR")}L (${pct}% do tanque) atingiu o limite crítico. Alto risco de entrada de ar nas bombas!`,
        impact: "Risco de paralisia na ilha de abastecimento",
        actionText: "Lançar Descarga / Pedido",
        targetTab: "tanques",
        timestamp: "Tempo Real",
        metricBadge: `${pct}% Restante`,
        tags: ["Nível Mínimo", "Descarga Urgente"]
      });
    });

    lowTanks.forEach((t) => {
      const pct = Math.round((t.volumeAtual / t.capacidadeMaxima) * 100);
      suggestions.push({
        id: `low-tank-${t.id}`,
        category: "tanques",
        priority: "alta",
        title: `Estoque em Alerta: ${t.combustivel}`,
        description: `Reservatório com ${t.volumeAtual.toLocaleString("pt-BR")}L (${pct}%). É recomendado acionar a distribuidora para reprogramação de carga.`,
        impact: "Prevenção contra desabastecimento em horários de pico",
        actionText: "Abrir Pedido de Suprimento",
        targetTab: "pedidos",
        timestamp: "Acompanhamento",
        metricBadge: `${pct}% Capacidade`,
        tags: ["Programação de Carga"]
      });
    });

    // 2. ANALYZE SHIFTS & CHECKLISTS
    const activeShift = shifts.find((s) => s.status === "Em Andamento");
    let pendingChecklistsCount = 0;

    if (activeShift) {
      const checklistItems = activeShift.checklist || {};
      const pendingKeys = Object.entries(checklistItems).filter(([_, val]) => !val);
      pendingChecklistsCount = pendingKeys.length;

      if (pendingChecklistsCount > 0) {
        const itemNamesMap: Record<string, string> = {
          limpezaPistas: "Limpeza das Pistas",
          usoEPIs: "Conferência de EPIs dos Frentistas",
          afericaoEquipamentosSeguranca: "Extintores e Caixas Separadoras",
          testeGerador: "Verificação e Teste do Gerador"
        };

        const pendingListNames = pendingKeys
          .map(([k]) => itemNamesMap[k] || k)
          .join(", ");

        suggestions.push({
          id: `checklist-shift-${activeShift.id}`,
          category: "checklists",
          priority: "alta",
          title: `Checklist de Pista Pendente (${activeShift.frentistaResponsavel})`,
          description: `Existem ${pendingChecklistsCount} verificação(ões) de segurança não concluídas no turno ativo: ${pendingListNames}.`,
          impact: "Auditoria interna e prevenção de acidentes ambientais/trabalhistas",
          actionText: "Concluir Vistoria de Pista",
          targetTab: "escalas",
          timestamp: "Turno Atual",
          metricBadge: `${pendingChecklistsCount} Pendência(s)`,
          tags: ["Conformidade de Pista", "Segurança"]
        });
      }

      // Check shift occurrences
      if (activeShift.occurrences && activeShift.occurrences.length > 0) {
        const lastOcc = activeShift.occurrences[activeShift.occurrences.length - 1];
        suggestions.push({
          id: `occ-shift-${lastOcc.id}`,
          category: "checklists",
          priority: "media",
          title: `Ocorrência no Turno: ${lastOcc.tipo}`,
          description: `Registrado no turno atual: "${lastOcc.descricao}".`,
          impact: "Registro no livro de ocorrências do posto",
          actionText: "Ver Ocorrências do Turno",
          targetTab: "escalas",
          timestamp: lastOcc.dataHora || "Turno Atual",
          tags: ["Ocorrência de Pista"]
        });
      }
    } else {
      suggestions.push({
        id: "no-active-shift",
        category: "checklists",
        priority: "alta",
        title: "Nenhum Turno Aberto na Pista",
        description: "Não há frentista registrado como responsável pelo turno em andamento neste momento.",
        impact: "Descontrole na prestação de contas dos caixas de pista",
        actionText: "Iniciar Turno de Frentista",
        targetTab: "escalas",
        timestamp: "Atenção",
        tags: ["Abertura de Turno"]
      });
    }

    // 3. ANALYZE ANP QUALITY CONTROL
    const hasQualityAudits = qualityAudits && qualityAudits.length > 0;
    const nonCompliantAudits = qualityAudits.filter((q: any) => q.conforme === false);

    if (!hasQualityAudits) {
      suggestions.push({
        id: "anp-quality-missing",
        category: "qualidade",
        priority: "alta",
        title: "Teste ANP 20L / Provetas Pendente",
        description: "A legislação da ANP exige teste diário de proveta, temperatura e densidade para todos os combustíveis comercializados.",
        impact: "Evitar autuações e multas regulatórias de fiscalização ANP",
        actionText: "Emitir Laudo Químico ANP",
        targetTab: "qualidade",
        timestamp: "Regulatório",
        metricBadge: "ANP Obrigatório",
        tags: ["Portaria ANP", "Laudo Químico"]
      });
    } else if (nonCompliantAudits.length > 0) {
      suggestions.push({
        id: "anp-quality-alert",
        category: "qualidade",
        priority: "urgente",
        title: `${nonCompliantAudits.length} Amostra(s) Fora dos Padrões ANP!`,
        description: "Foram detectadas medições de densidade/aspecto fora da faixa de conformidade regulatória da ANP.",
        impact: "Risco de interdição de bicos e contaminação de veículos",
        actionText: "Inspecionar Laudos e Tanque",
        targetTab: "qualidade",
        timestamp: "Alerta Crítico",
        metricBadge: "Não Conforme",
        tags: ["Não Conformidade", "Interdição"]
      });
    } else {
      suggestions.push({
        id: "anp-quality-ok",
        category: "qualidade",
        priority: "info",
        title: "Laudos ANP Atualizados e Conformes",
        description: "Todas as amostras coletadas cumprem integralmente as especificações da ANP.",
        impact: "Garantia de qualidade para o consumidor final",
        actionText: "Consultar Histórico ANP",
        targetTab: "qualidade",
        timestamp: "Hoje",
        metricBadge: "100% Aprovado",
        tags: ["Qualidade Selada"]
      });
    }

    // 4. ANALYZE NOZZLES & PUMPS
    const blockedNozzles = nozzles.filter(
      (n) => n.status === "Manutencao" || n.status === "Bloqueado"
    );
    if (blockedNozzles.length > 0) {
      suggestions.push({
        id: "nozzles-blocked",
        category: "bicos",
        priority: "media",
        title: `${blockedNozzles.length} Bico(s) de Abastecimento Inoperante(s)`,
        description: `Bicos (${blockedNozzles.map((b) => b.numeroBico).join(", ")}) estão marcados como manutenção ou bloqueados.`,
        impact: "Perda da velocidade de atendimento em filas nos horários de pico",
        actionText: "Gerenciar Bicos e Manutenção",
        targetTab: "bicos",
        timestamp: "Operacional",
        metricBadge: `${blockedNozzles.length} Parado(s)`,
        tags: ["Manutenção de Pista"]
      });
    }

    // 5. FINANCIAL / DAILY BALANCE
    if (dailyBalances.length === 0 && nozzleClosings.length > 0) {
      suggestions.push({
        id: "daily-balance-pending",
        category: "financeiro",
        priority: "info",
        title: "Fechamento Volumétrico Pendente",
        description: "Encerrantes dos bicos foram registrados, mas o balanço volumétrico/financeiro diário ainda não foi consolidado.",
        impact: "Acompanhamento preciso de margem de lucro e sobra/falta física",
        actionText: "Gerar Balanço Diário",
        targetTab: "balanco",
        timestamp: "Diário",
        tags: ["Fechamento Financeiro"]
      });
    }

    // 6. HEALTH SCORE CALCULATION
    let healthScore = 100;
    healthScore -= criticalTanks.length * 25;
    healthScore -= lowTanks.length * 10;
    if (pendingChecklistsCount > 0) healthScore -= 15;
    if (!activeShift) healthScore -= 10;
    if (!hasQualityAudits) healthScore -= 15;
    if (nonCompliantAudits.length > 0) healthScore -= 25;
    if (blockedNozzles.length > 0) healthScore -= 10;

    healthScore = Math.max(15, Math.min(100, healthScore));

    // Headline generation
    let headline = "Operação Estável e Totalmente Conforme";
    if (healthScore < 50) {
      headline = "Atenção Crítica: Ações Preventivas Urgentes Necessárias";
    } else if (healthScore < 80) {
      headline = "Operação Sob Controle com Pontos de Atenção";
    }

    // Synthesized AI Insight Text
    let summaryText = "";
    if (criticalTanks.length > 0) {
      summaryText += `Atenção prioritária nos tanques: ${criticalTanks.map((t) => t.combustivel).join(", ")} estão em nível crítico. `;
    }
    if (pendingChecklistsCount > 0) {
      summaryText += `O turno ativo de ${activeShift?.frentistaResponsavel || "pista"} possui ${pendingChecklistsCount} verificações de segurança pendentes. `;
    }
    if (!hasQualityAudits) {
      summaryText += `Lembre-se de registrar o laudo de aferição ANP 20L de hoje. `;
    }
    if (summaryText === "") {
      summaryText = "Todos os indicadores operacionais (estoque de tanques, checklists de pista, aferição ANP e bombas) apresentam índices normais de funcionamento.";
    }

    const lastUpdated = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const summary: CopilotSummary = {
      healthScore,
      headline,
      summaryText,
      criticalTankCount: criticalTanks.length,
      lowTankCount: lowTanks.length,
      pendingChecklistsCount,
      unclosedShiftsCount: shifts.filter((s) => s.status === "Em Andamento").length,
      activeShiftName: activeShift?.turno,
      frentistaInCharge: activeShift?.frentistaResponsavel,
      pendingANPAudits: !hasQualityAudits,
      blockedNozzlesCount: blockedNozzles.length,
      lastUpdated
    };

    return {
      suggestions,
      summary
    };
  }, [appState, refreshKey]);

  const refreshAnalysis = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return {
    suggestions: analysis.suggestions,
    summary: analysis.summary,
    refreshAnalysis
  };
}

export default useOperacionalAI;
