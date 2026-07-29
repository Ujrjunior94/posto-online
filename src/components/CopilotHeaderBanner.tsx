import React, { useState } from "react";
import { AppState } from "../types";
import { useOperacionalAI, ActionSuggestion } from "../hooks/useOperacionalAI";
import {
  Sparkles,
  Bot,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  RefreshCw,
  Zap,
  ArrowRight,
  Filter,
  Activity,
  Layers,
  Award,
  HelpCircle
} from "lucide-react";

interface CopilotHeaderBannerProps {
  appState: AppState;
  onNavigate: (tab: string) => void;
}

export function CopilotHeaderBanner({ appState, onNavigate }: CopilotHeaderBannerProps) {
  const { suggestions, summary, refreshAnalysis } = useOperacionalAI(appState);
  const [filterPriority, setFilterPriority] = useState<"todas" | "urgente" | "alta" | "media">("todas");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    refreshAnalysis();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const activeSuggestions = suggestions.filter((s) => !dismissedIds.includes(s.id));
  const filteredSuggestions = activeSuggestions.filter((s) => {
    if (filterPriority === "todas") return true;
    return s.priority === filterPriority;
  });

  const getHealthBadge = (score: number) => {
    if (score >= 85) {
      return {
        label: "Excelente",
        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
        ring: "border-emerald-500",
        icon: <CheckCircle2 className="h-4 w-4 text-emerald-400" />
      };
    }
    if (score >= 60) {
      return {
        label: "Atenção Moderada",
        color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
        ring: "border-amber-500",
        icon: <AlertTriangle className="h-4 w-4 text-amber-400" />
      };
    }
    return {
      label: "Risco Elevado",
      color: "text-rose-400 bg-rose-500/10 border-rose-500/30",
      ring: "border-rose-500",
      icon: <ShieldAlert className="h-4 w-4 text-rose-400 animate-pulse" />
    };
  };

  const healthBadge = getHealthBadge(summary.healthScore);

  const getPriorityBadgeStyle = (priority: ActionSuggestion["priority"]) => {
    switch (priority) {
      case "urgente":
        return "bg-rose-500/15 text-rose-400 border-rose-500/30 font-black";
      case "alta":
        return "bg-amber-500/15 text-amber-400 border-amber-500/30 font-bold";
      case "media":
        return "bg-sky-500/15 text-sky-400 border-sky-500/30 font-semibold";
      default:
        return "bg-slate-800 text-slate-300 border-slate-700 font-normal";
    }
  };

  return (
    <div className="bg-gradient-to-br from-[#12161f] via-[#161c28] to-[#10141d] rounded-3xl p-5 sm:p-6 border border-amber-500/20 shadow-2xl relative overflow-hidden text-slate-100 mb-8">
      {/* Background Ambient Glow FX */}
      <div className="absolute -top-24 -left-24 w-72 h-72 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Copilot Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-slate-800/80 relative z-10">
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-amber-400 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 shrink-0 flex items-center justify-center">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs uppercase font-black tracking-wider text-amber-400 flex items-center gap-1 font-mono">
                <Sparkles className="h-3.5 w-3.5" />
                Copiloto Operacional IA
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700/60">
                v2.6 Realtime
              </span>
            </div>
            <h2 className="text-xl font-black text-white font-display tracking-tight mt-0.5">
              {summary.headline}
            </h2>
          </div>
        </div>

        {/* Right side: Score & Control Actions */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Health Score Gauge Box */}
          <div className="flex items-center gap-3 bg-[#0d1017] px-4 py-2.5 rounded-2xl border border-slate-800 shadow-inner">
            <div className="text-right">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Saúde Operacional
              </div>
              <div className="text-xs font-mono font-bold text-slate-200">
                {summary.healthScore}/100
              </div>
            </div>
            <div className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${healthBadge.color}`}>
              {healthBadge.icon}
              <span>{healthBadge.label}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            title="Atualizar Análise IA"
            className="p-2.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl border border-slate-700/80 transition flex items-center justify-center cursor-pointer active:scale-95"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
          </button>
        </div>
      </div>

      {/* AI Synthesis Statement */}
      <div className="mt-4 bg-[#0d1017]/80 p-4 rounded-2xl border border-slate-800/90 relative z-10 flex items-start gap-3">
        <div className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5 border border-amber-500/20">
          <Zap className="h-4 w-4" />
        </div>
        <p className="text-xs text-slate-300 leading-relaxed font-medium">
          <span className="font-bold text-amber-400 mr-1 font-mono">Diagnóstico Automático:</span>
          {summary.summaryText}
        </p>
      </div>

      {/* Action Suggestions Header & Filter Pills */}
      <div className="mt-6 space-y-3 relative z-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-black text-slate-300 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-amber-400" />
              Ações Preventivas Sugeridas ({filteredSuggestions.length})
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 bg-[#0d1017] p-1 rounded-xl border border-slate-800 text-[11px]">
            <button
              type="button"
              onClick={() => setFilterPriority("todas")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPriority === "todas" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              Todas ({activeSuggestions.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterPriority("urgente")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPriority === "urgente" ? "bg-rose-500 text-white shadow-xs" : "text-slate-400 hover:text-rose-400"
              }`}
            >
              Urgentes
            </button>
            <button
              type="button"
              onClick={() => setFilterPriority("alta")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPriority === "alta" ? "bg-amber-500 text-slate-950 shadow-xs" : "text-slate-400 hover:text-amber-400"
              }`}
            >
              Altas
            </button>
            <button
              type="button"
              onClick={() => setFilterPriority("media")}
              className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer ${
                filterPriority === "media" ? "bg-sky-500 text-white shadow-xs" : "text-slate-400 hover:text-sky-400"
              }`}
            >
              Médias
            </button>
          </div>
        </div>

        {/* Suggestions Cards Grid */}
        {filteredSuggestions.length === 0 ? (
          <div className="bg-[#0d1017]/60 p-6 rounded-2xl border border-slate-800 text-center">
            <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto mb-2 opacity-80" />
            <p className="text-xs font-bold text-slate-300">
              Nenhuma pendência para este filtro de prioridade!
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Sua operação está alinhada com as recomendações de prevenção.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSuggestions.map((item) => (
              <div
                key={item.id}
                className="bg-[#0d1017] hover:bg-[#121622] p-4 rounded-2xl border border-slate-800/90 hover:border-amber-500/40 transition-all shadow-lg flex flex-col justify-between gap-3 group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-md border ${getPriorityBadgeStyle(
                        item.priority
                      )}`}
                    >
                      {item.priority}
                    </span>
                    {item.metricBadge && (
                      <span className="text-[10px] font-mono font-black text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        {item.metricBadge}
                      </span>
                    )}
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-amber-300 transition-colors flex items-center gap-1.5">
                    <span>{item.title}</span>
                  </h4>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {item.description}
                  </p>

                  <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center gap-1 text-[11px] text-slate-400 font-medium">
                    <span className="text-amber-400 font-bold">Impacto:</span>
                    <span>{item.impact}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {item.tags?.map((t) => (
                      <span
                        key={t}
                        className="text-[9px] font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md border border-slate-800"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => onNavigate(item.targetTab)}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition flex items-center gap-1 cursor-pointer shrink-0 group-hover:scale-[1.02]"
                  >
                    <span>{item.actionText}</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default CopilotHeaderBanner;
