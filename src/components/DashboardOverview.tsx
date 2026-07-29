/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, DashboardPreferences } from "../types";
import { 
  Fuel, 
  TrendingUp, 
  ShieldAlert, 
  CheckCircle2, 
  UserCheck, 
  Droplet, 
  Thermometer, 
  HelpCircle,
  Settings,
  Eye,
  EyeOff,
  Save,
  X,
  Target,
  Sparkles,
  BookOpen,
  Calendar,
  ChevronRight,
  ArrowUpRight,
  Building2,
  FileText,
  Activity,
  ClipboardList,
  AlertTriangle,
  Package,
  PlusCircle,
  Zap,
  BarChart3,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Bot,
  Gauge,
  Clock,
  Check,
  Bell,
  Sliders,
  Users,
  AlertCircle,
  TrendingDown,
  ShieldCheck,
  RefreshCw,
  Award,
  Layers
} from "lucide-react";
import { StationManagerSVG } from "./AnimatedStationManager";
import HolographicCockpitRadar from "./HolographicCockpitRadar";
import CopilotHeaderBanner from "./CopilotHeaderBanner";

interface DashboardOverviewProps {
  appState: AppState;
  onNavigate: (tab: string) => void;
  onUpdatePreferences: (prefs: DashboardPreferences) => void;
}

export default function DashboardOverview({ appState, onNavigate, onUpdatePreferences }: DashboardOverviewProps) {
  const { 
    tanks = [], 
    shifts = [], 
    nozzleClosings = [], 
    qualityAudits = [], 
    nozzles = [],
    calibrations = [],
    dailyBalances = [],
    dashboardPreferences 
  } = appState;
  
  // States
  const [isEditing, setIsEditing] = useState(false);
  const [alertFilter, setAlertFilter] = useState<"todos" | "vermelho" | "laranja" | "amarelo" | "verde">("todos");
  const [tankCategoryFilter, setTankCategoryFilter] = useState<"todos" | "gasolina" | "etanol" | "diesel">("todos");
  const [selectedModule, setSelectedModule] = useState("todos");
  const [showAiModal, setShowAiModal] = useState(false);

  const [localPrefs, setLocalPrefs] = useState<DashboardPreferences>(dashboardPreferences || {
    visibleWidgets: {
      quickStats: true,
      fuelTanks: true,
      activeShift: true,
      qualityControl: true
    },
    dailyGoalLiters: 15000
  });

  // Active shift
  const activeShift = shifts.find((s) => s.status === "Em Andamento");

  // Sum total liters sold
  const totalLitersSold = nozzleClosings.reduce((sum, c) => sum + (c.litrosVendidos || 0), 0);
  const totalLitersAmount = nozzleClosings.reduce((sum, c) => sum + (c.valorTotalVendidos || c.valorVendidoCalculado || 0), 0);

  // Critical stock tanks check
  const criticalTanks = tanks.filter((t) => t.volumeAtual <= t.pontoCriticoAlerta);
  const lowTanks = tanks.filter((t) => t.volumeAtual > t.pontoCriticoAlerta && t.volumeAtual <= t.capacidadeMaxima * 0.35);

  // Quality conform status
  const totalAudits = qualityAudits.length;
  const compliantAudits = qualityAudits.filter((q) => q.conforme).length;
  const qualityRate = totalAudits > 0 ? Math.round((compliantAudits / totalAudits) * 100) : 100;

  // Nozzles summary
  const activeNozzles = nozzles.filter(n => n.status === "Ativo" || n.status === "Livre").length;
  const blockedNozzles = nozzles.filter(n => n.status === "Manutencao" || n.status === "Bloqueado").length;
  const totalNozzles = nozzles.length || 12;

  // Calibrations Executive Summary Calculations
  const now = new Date();
  const calibrationStatusList = (nozzles || []).map(n => {
    const nozzleCals = (calibrations || []).filter(c => c.nozzleId === n.id);
    if (nozzleCals.length === 0) {
      return { nozzleId: n.id, status: "Pendente", lastDate: null, bomba: n.bombaAssociada };
    }
    const sortedCals = [...nozzleCals].sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
    const lastCal = sortedCals[0];
    const daysDiff = (now.getTime() - new Date(lastCal.data).getTime()) / (1000 * 60 * 60 * 24);
    
    if (!lastCal.conforme) {
      return { nozzleId: n.id, status: "Reprovado", lastDate: lastCal.data, bomba: n.bombaAssociada };
    }
    if (daysDiff > 30) {
      return { nozzleId: n.id, status: "Vencido", lastDate: lastCal.data, bomba: n.bombaAssociada };
    }
    return { nozzleId: n.id, status: "Conforme", lastDate: lastCal.data, bomba: n.bombaAssociada };
  });

  const totalConforme = calibrationStatusList.filter(s => s.status === "Conforme").length;
  const totalPendente = calibrationStatusList.filter(s => s.status === "Pendente").length;
  const totalVencido = calibrationStatusList.filter(s => s.status === "Vencido").length;
  const totalReprovado = calibrationStatusList.filter(s => s.status === "Reprovado").length;

  const hasPendingOrOverdueCalibrations = totalPendente > 0 || totalVencido > 0 || totalReprovado > 0;

  const getNextAnpDate = () => {
    const conformCals = calibrationStatusList.filter(s => s.status === "Conforme" && s.lastDate);
    if (conformCals.length > 0) {
      const oldestConform = conformCals.reduce((oldest, current) => {
        if (!oldest.lastDate || !current.lastDate) return oldest;
        return new Date(current.lastDate).getTime() < new Date(oldest.lastDate).getTime() ? current : oldest;
      }, conformCals[0]);
      if (oldestConform.lastDate) {
        const nextDate = new Date(oldestConform.lastDate);
        nextDate.setDate(nextDate.getDate() + 30);
        return nextDate.toLocaleDateString("pt-BR");
      }
    }
    return "31/07/2026"; // Standard ANP Monthly compliance boundary
  };
  const proximaDataANP = getNextAnpDate();

  // Generate dynamic priority alerts
  const generateAlerts = () => {
    const list: Array<{
      id: string;
      level: "vermelho" | "laranja" | "amarelo" | "verde";
      title: string;
      description: string;
      module: string;
      time: string;
      actionLabel: string;
      targetTab: string;
    }> = [];

    // Critical Tanks (Vermelho)
    criticalTanks.forEach(t => {
      list.push({
        id: `tank-${t.id}`,
        level: "vermelho",
        title: `Nível Crítico: ${t.combustivel}`,
        description: `Volume atual de ${t.volumeAtual.toLocaleString()}L está abaixo do ponto mínimo (${t.pontoCriticoAlerta.toLocaleString()}L).`,
        module: "Tanques",
        time: "Agora",
        actionLabel: "Lançar Descarga",
        targetTab: "tanques"
      });
    });

    // Low Tanks (Laranja)
    lowTanks.forEach(t => {
      list.push({
        id: `tank-low-${t.id}`,
        level: "laranja",
        title: `Estoque Baixo: ${t.combustivel}`,
        description: `Volume em ${Math.round((t.volumeAtual / t.capacidadeMaxima) * 100)}% da capacidade. Programar compra.`,
        module: "Tanques",
        time: "Recente",
        actionLabel: "Fazer Pedido",
        targetTab: "pedidos"
      });
    });

    // Pending Shift Checklists (Laranja)
    if (activeShift) {
      const pendingItems = Object.entries(activeShift.checklist).filter(([_, val]) => !val);
      if (pendingItems.length > 0) {
        list.push({
          id: "shift-checklist",
          level: "laranja",
          title: `${pendingItems.length} Checklist(s) Pendente(s) no Turno`,
          description: `Turno de ${activeShift.frentistaResponsavel} possui verificações de segurança pendentes.`,
          module: "Escalas & Turnos",
          time: "Turno Atual",
          actionLabel: "Concluir Checklist",
          targetTab: "escalas"
        });
      }
    } else {
      list.push({
        id: "no-shift",
        level: "amarelo",
        title: "Nenhum Turno Aberto no Momento",
        description: "Não há frentista registrado como responsável pelo turno ativo de pista.",
        module: "Escalas & Turnos",
        time: "Atenção",
        actionLabel: "Abrir Turno",
        targetTab: "escalas"
      });
    }

    // Quality Audit Reminders (Amarelo / Verde)
    if (qualityAudits.length === 0) {
      list.push({
        id: "qa-missing",
        level: "amarelo",
        title: "Teste de Qualidade ANP Pendente Hoje",
        description: "Regulamentação exige teste de proveta e densidade diário para cada combustível.",
        module: "Qualidade ANP",
        time: "Pendente",
        actionLabel: "Registrar Teste",
        targetTab: "qualidade"
      });
    } else {
      list.push({
        id: "qa-ok",
        level: "verde",
        title: "Testes ANP Conformes",
        description: `${compliantAudits} amostras verificadas com densidade e aspecto aprovados.`,
        module: "Qualidade ANP",
        time: "Hoje",
        actionLabel: "Ver Laudos",
        targetTab: "qualidade"
      });
    }

    // Calibration (Aferição de Bicos) (Amarelo)
    list.push({
      id: "afericao-bicos",
      level: "amarelo",
      title: "Próxima Aferição de Medidores ANP",
      description: "Aferição de volume dos bicos de abastecimento agendada para este mês.",
      module: "Bombas",
      time: "Agendado",
      actionLabel: "Verificar Bicos",
      targetTab: "bicos"
    });

    return list;
  };

  const alerts = generateAlerts();
  const filteredAlerts = alertFilter === "todos" ? alerts : alerts.filter(a => a.level === alertFilter);

  const handleToggleWidget = (widget: keyof DashboardPreferences["visibleWidgets"]) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleWidgets: {
        ...prev.visibleWidgets,
        [widget]: !prev.visibleWidgets[widget]
      }
    }));
  };

  const DEFAULT_CARD_ORDER = ["quickStats", "alertsCenter", "aiAssistant", "fuelTanks", "activeShift", "qualityControl"];

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    if (dashboardPreferences?.cardOrder && dashboardPreferences.cardOrder.length > 0) {
      return dashboardPreferences.cardOrder;
    }
    return DEFAULT_CARD_ORDER;
  });

  const handleMoveCard = (id: string, direction: "up" | "down") => {
    const currentIndex = cardOrder.indexOf(id);
    if (currentIndex === -1) return;
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= cardOrder.length) return;

    const newOrder = [...cardOrder];
    const [removed] = newOrder.splice(currentIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setCardOrder(newOrder);
    const updatedPrefs = { ...localPrefs, cardOrder: newOrder };
    setLocalPrefs(updatedPrefs);
    onUpdatePreferences(updatedPrefs);
  };

  const handleSavePreferences = () => {
    onUpdatePreferences({ ...localPrefs, cardOrder });
    setIsEditing(false);
  };

  const dailyGoal = localPrefs.dailyGoalLiters;
  const progressPercent = Math.min(100, Math.round((totalLitersSold / dailyGoal) * 100));

  return (
    <div className="space-y-6 pb-12">

      {/* 0. COPILOTO OPERACIONAL IA BANNER */}
      <CopilotHeaderBanner appState={appState} onNavigate={onNavigate} />

      {/* 1. RADAR HOLOGRÁFICO 3D (COCKPIT OPERACIONAL 360°) */}
      <HolographicCockpitRadar appState={appState} onNavigate={onNavigate} />
      
      {/* 2. TOP CORPORATE BAR: QUICK ACTIONS TOOLBAR */}
      <div className="bg-[#191c22] border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 rounded-xl font-bold shadow-md shadow-amber-500/20">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-wider text-white font-display">
                  Ações Rápidas de Pista & Operação
                </h2>
                <span className="bg-amber-400/10 text-amber-300 border border-amber-400/30 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest">
                  PRO
                </span>
              </div>
              <p className="text-xs text-slate-400">Comandos diretos de lançamento com salvamento na nuvem</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-xl border border-slate-700"
            >
              <Settings className="h-3.5 w-3.5 text-amber-400" />
              <span>Personalizar Painel</span>
            </button>
          </div>
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Action 1: Registrar Bico */}
          <button
            onClick={() => onNavigate("bicos")}
            className="p-3 bg-[#13151a] hover:bg-[#1f232b] border border-slate-800 hover:border-amber-500/50 rounded-xl transition text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg group-hover:scale-110 transition">
                <ClipboardList className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
            </div>
            <span className="text-xs font-bold text-white block truncate">Leitura de Bicos</span>
            <span className="text-[10px] text-slate-400 block truncate">Medição de encerrantes</span>
          </button>

          {/* Action 2: Lançar Falta de Caixa */}
          <button
            onClick={() => onNavigate("caixa")}
            className="p-3 bg-[#13151a] hover:bg-[#1f232b] border border-slate-800 hover:border-amber-500/50 rounded-xl transition text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg group-hover:scale-110 transition">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
            </div>
            <span className="text-xs font-bold text-white block truncate">Falta de Caixa</span>
            <span className="text-[10px] text-slate-400 block truncate">Registrar divergência</span>
          </button>

          {/* Action 3: Registrar Descarga */}
          <button
            onClick={() => onNavigate("tanques")}
            className="p-3 bg-[#13151a] hover:bg-[#1f232b] border border-slate-800 hover:border-amber-500/50 rounded-xl transition text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg group-hover:scale-110 transition">
                <Fuel className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
            </div>
            <span className="text-xs font-bold text-white block truncate">Registrar Descarga</span>
            <span className="text-[10px] text-slate-400 block truncate">Entrada de combustível</span>
          </button>

          {/* Action 4: Teste ANP */}
          <button
            onClick={() => onNavigate("qualidade")}
            className="p-3 bg-[#13151a] hover:bg-[#1f232b] border border-slate-800 hover:border-amber-500/50 rounded-xl transition text-left group cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg group-hover:scale-110 transition">
                <Thermometer className="h-4 w-4" />
              </div>
              <ArrowUpRight className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 group-hover:translate-x-0.5 transition" />
            </div>
            <span className="text-xs font-bold text-white block truncate">Teste de Qualidade</span>
            <span className="text-[10px] text-slate-400 block truncate">Densidade & Proveta</span>
          </button>

          {/* Action 5: Novo Pedido */}
          <button
            onClick={() => onNavigate("pedidos")}
            className="p-3 bg-[#13151a] hover:bg-[#1f232b] border border-slate-800 hover:border-amber-500/50 rounded-xl transition text-left group cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg group-hover:scale-110 transition">
                <Package className="h-4 w-4" />
              </div>
              <PlusCircle className="h-3.5 w-3.5 text-slate-500 group-hover:text-amber-400 transition" />
            </div>
            <span className="text-xs font-bold text-white block truncate">Adicionar Pedido</span>
            <span className="text-[10px] text-slate-400 block truncate">Insumos & Produtos</span>
          </button>
        </div>
      </div>

      {/* PAINEL DE CONFIGURAÇÃO DO DASHBOARD (SE EXPANDIDO) */}
      {isEditing && (
        <div className="bg-[#191c22] p-6 rounded-2xl border border-amber-500/30 shadow-2xl text-white space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center pb-3 border-b border-slate-800">
            <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-400" />
              Personalização de Visualização & Widgets
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider block">
              Módulos Visíveis
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "quickStats", label: "Métricas Principais" },
                { id: "alertsCenter", label: "Central de Alertas" },
                { id: "aiAssistant", label: "IA Operacional" },
                { id: "fuelTanks", label: "Tanques de Combustível" },
                { id: "activeShift", label: "Operação de Turno" },
                { id: "qualityControl", label: "Controle ANP" }
              ].map((w) => {
                const key = w.id as keyof DashboardPreferences["visibleWidgets"];
                const isVis = localPrefs.visibleWidgets[key] !== false;
                return (
                  <button
                    key={w.id}
                    onClick={() => handleToggleWidget(key)}
                    className={`p-3 rounded-xl text-xs font-bold border text-left flex items-center justify-between cursor-pointer transition ${
                      isVis ? "bg-amber-500/10 border-amber-500/50 text-amber-300" : "bg-slate-900 border-slate-800 text-slate-500"
                    }`}
                  >
                    <span>{w.label}</span>
                    {isVis ? <Eye className="h-4 w-4 text-amber-400" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
              <Target className="h-4 w-4 text-amber-400" />
              <span>Meta Diária de Vendas (Litros):</span>
            </div>
            <input
              type="number"
              value={localPrefs.dailyGoalLiters}
              onChange={(e) => setLocalPrefs(prev => ({ ...prev, dailyGoalLiters: Number(e.target.value) }))}
              className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-mono font-bold w-36 text-white outline-none focus:border-amber-400"
            />
            <button
              onClick={handleSavePreferences}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 rounded-xl text-xs font-extrabold transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar Ajustes
            </button>
          </div>
        </div>
      )}

      {/* 2. RESUMO OPERACIONAL (KPI CARDS CORPORATIVOS) */}
      {localPrefs.visibleWidgets.quickStats !== false && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Card 1: Volume Vendido */}
          <div className="bg-gradient-to-br from-[#191c22] to-[#13161b] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-amber-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono tracking-wider font-bold text-[10px] uppercase">
                VOLUME VENDIDO (HOJE)
              </span>
              <div className="p-2 bg-amber-400/10 text-amber-400 rounded-xl border border-amber-400/20">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="text-white text-2xl sm:text-3xl font-black font-display tracking-tight">
              {totalLitersSold.toLocaleString("pt-BR")}<span className="text-xs font-bold text-amber-400 ml-1">L</span>
            </div>
            <div className="text-xs text-slate-400 mt-1 font-mono">
              R$ {totalLitersAmount.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
            </div>
            <div className="mt-3 space-y-1">
              <div className="flex justify-between text-[11px] font-semibold">
                <span className="text-slate-400">Meta: {dailyGoal.toLocaleString("pt-BR")}L</span>
                <span className="text-amber-400 font-bold">{progressPercent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div 
                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-700 rounded-full" 
                  style={{ width: `${progressPercent}%` }} 
                />
              </div>
            </div>
          </div>

          {/* Card 2: Bombas & Bicos */}
          <div className="bg-gradient-to-br from-[#191c22] to-[#13161b] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-cyan-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono tracking-wider font-bold text-[10px] uppercase">
                STATUS DAS BOMBAS & BICOS
              </span>
              <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-xl border border-cyan-500/20">
                <Gauge className="h-4 w-4" />
              </div>
            </div>
            <div className="text-white text-2xl sm:text-3xl font-black font-display tracking-tight">
              {activeNozzles}<span className="text-xs font-bold text-slate-400 ml-1">/ {totalNozzles} bicos ativos</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold rounded-md">
                {activeNozzles} Operacionais
              </span>
              {blockedNozzles > 0 ? (
                <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[10px] font-bold rounded-md">
                  {blockedNozzles} Manutenção
                </span>
              ) : (
                <span className="px-2 py-0.5 bg-slate-800 text-slate-400 text-[10px] font-bold rounded-md">
                  0 Bloqueios
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <Activity className="h-3 w-3 text-cyan-400" />
              <span>Encerrantes validados no turno</span>
            </div>
          </div>

          {/* Card 3: Reservatórios & Tanques */}
          <div className="bg-gradient-to-br from-[#191c22] to-[#13161b] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono tracking-wider font-bold text-[10px] uppercase">
                ESTOQUE TOTAL EM TANQUES
              </span>
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Fuel className="h-4 w-4" />
              </div>
            </div>
            <div className="text-white text-2xl sm:text-3xl font-black font-display tracking-tight">
              {tanks.reduce((sum, t) => sum + t.volumeAtual, 0).toLocaleString("pt-BR")}<span className="text-xs font-bold text-slate-400 ml-1">L</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              Monitorando {tanks.length} reservatórios ANP
            </p>
            <div className="mt-3">
              {criticalTanks.length > 0 ? (
                <span className="text-rose-400 text-[11px] font-bold flex items-center gap-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1 rounded-lg">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {criticalTanks.length} tanque(s) em nível crítico
                </span>
              ) : (
                <span className="text-emerald-400 text-[11px] font-bold flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-lg">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Todos os tanques em nível seguro
                </span>
              )}
            </div>
          </div>

          {/* Card 4: Conformidade ANP & Qualidade */}
          <div className="bg-gradient-to-br from-[#191c22] to-[#13161b] p-5 rounded-2xl border border-slate-800 shadow-xl relative overflow-hidden group hover:border-purple-500/40 transition-all duration-300">
            <div className="flex items-center justify-between mb-2">
              <span className="text-slate-400 font-mono tracking-wider font-bold text-[10px] uppercase">
                CONFORMIDADE AUDITORIA ANP
              </span>
              <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                <Award className="h-4 w-4" />
              </div>
            </div>
            <div className="text-white text-2xl sm:text-3xl font-black font-display tracking-tight">
              {qualityRate}%<span className="text-xs font-bold text-purple-400 ml-1">aprovado</span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {compliantAudits} de {totalAudits} testes de densidade OK
            </p>
            <div className="mt-3 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Livro LMC:</span>
              <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Atualizado
              </span>
            </div>
          </div>

        </div>
      )}

      {/* 3. CENTRAL DE ALERTAS INTELIGENTE (PRIORITY ALERT CENTER) */}
      {localPrefs.visibleWidgets.alertsCenter !== false && (
        <div className="bg-[#191c22] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl border border-rose-500/20">
                <Bell className="h-5 w-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white font-display">
                    Central de Alertas & Conformidade Operacional
                  </h3>
                  <span className="bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {alerts.length} Notificação(ões)
                  </span>
                </div>
                <p className="text-xs text-slate-400">Priorização automática de ocorrências por grau de gravidade</p>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {[
                { id: "todos", label: "Todos", count: alerts.length },
                { id: "vermelho", label: "Críticos", count: alerts.filter(a => a.level === "vermelho").length, color: "text-rose-400" },
                { id: "laranja", label: "Alertas", count: alerts.filter(a => a.level === "laranja").length, color: "text-orange-400" },
                { id: "amarelo", label: "Atenção", count: alerts.filter(a => a.level === "amarelo").length, color: "text-amber-400" },
                { id: "verde", label: "OK", count: alerts.filter(a => a.level === "verde").length, color: "text-emerald-400" }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAlertFilter(f.id as any)}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                    alertFilter === f.id 
                      ? "bg-slate-800 text-white shadow-sm border border-slate-700" 
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <span>{f.label}</span>
                  {f.count > 0 && (
                    <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-950 ${f.color || "text-slate-300"}`}>
                      {f.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Alert List */}
          <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {filteredAlerts.length > 0 ? (
              filteredAlerts.map((alert) => {
                let badgeClass = "bg-slate-800 text-slate-300 border-slate-700";
                let iconColor = "text-slate-400";
                
                if (alert.level === "vermelho") {
                  badgeClass = "bg-rose-500/10 text-rose-400 border-rose-500/30";
                  iconColor = "text-rose-400";
                } else if (alert.level === "laranja") {
                  badgeClass = "bg-orange-500/10 text-orange-400 border-orange-500/30";
                  iconColor = "text-orange-400";
                } else if (alert.level === "amarelo") {
                  badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/30";
                  iconColor = "text-amber-400";
                } else if (alert.level === "verde") {
                  badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
                  iconColor = "text-emerald-400";
                }

                return (
                  <div 
                    key={alert.id}
                    className="p-3.5 bg-[#13151a] border border-slate-800 hover:border-slate-700 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`p-2 rounded-xl border shrink-0 ${badgeClass}`}>
                        <AlertTriangle className={`h-4 w-4 ${iconColor}`} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-white truncate">{alert.title}</span>
                          <span className={`text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${badgeClass}`}>
                            {alert.module}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{alert.description}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => onNavigate(alert.targetTab)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold rounded-xl border border-slate-700 hover:border-amber-400/40 transition flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>{alert.actionLabel}</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-500 text-xs">
                Nenhum alerta registrado nesta categoria de prioridade.
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. IA OPERACIONAL ASSISTENTE & GERENTE MARCOS */}
      {localPrefs.visibleWidgets.aiAssistant !== false && (
        <div className="bg-gradient-to-r from-[#181d26] via-[#141820] to-[#0f1d26] rounded-2xl p-5 text-white shadow-2xl border border-amber-500/30 relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center gap-5 relative z-10">
            {/* Station Manager SVG Avatar */}
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-slate-950 p-1 border-2 border-amber-400/40 shadow-2xl relative shrink-0">
              <StationManagerSVG
                expression="happy"
                isBlinking={false}
                isSpeaking={false}
                isWaving={true}
              />
              <span className="absolute -bottom-1 -right-1 bg-emerald-500 border-2 border-slate-900 w-4 h-4 rounded-full"></span>
            </div>

            <div className="flex-1 text-center md:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                <h3 className="font-black text-base sm:text-lg text-white font-display">
                  Assistente de IA Operacional • Gerente Marcos
                </h3>
                <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  Preditivo ANP
                </span>
              </div>
              
              <div className="bg-[#0c0e12]/80 border border-slate-800 p-3.5 rounded-xl text-xs text-slate-200 leading-relaxed font-mono">
                {criticalTanks.length > 0 ? (
                  <p className="text-amber-300">
                    ⚠️ <strong className="text-white font-sans">Diagnóstico IA:</strong> Identifiquei que o {criticalTanks[0]?.combustivel} está com {criticalTanks[0]?.volumeAtual}L (nível crítico). Recomendo lançar a ordem de descarga antes do fechamento do próximo turno.
                  </p>
                ) : (
                  <p className="text-emerald-300">
                    💡 <strong className="text-white font-sans">Diagnóstico IA:</strong> Operação estável. Os tanques possuem autonomia para 48h. A taxa de conformidade ANP está em 100%. Lembre-se de conferir a medição de bicos ao final da jornada.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
                <button
                  onClick={() => {
                    const event = new CustomEvent("OPEN_GERENTE_MARCOS");
                    window.dispatchEvent(event);
                  }}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-500 hover:to-amber-700 text-slate-950 font-black text-xs rounded-xl transition shadow-lg flex items-center gap-2 cursor-pointer"
                >
                  <Bot className="w-4 h-4" />
                  Conversar com Gerente Marcos
                </button>

                <button
                  onClick={() => onNavigate("tanques")}
                  className="px-3.5 py-2 bg-slate-800/90 hover:bg-slate-700 text-slate-200 font-bold text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Fuel className="w-3.5 h-3.5 text-amber-400" />
                  Ver Tanques ({tanks.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. MONITORAMENTO DE TANQUES (FUEL TANKS GAUGES WITH CATEGORICAL GROUPING) */}
      {localPrefs.visibleWidgets.fuelTanks !== false && (
        <div className="bg-[#191c22] p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl border border-emerald-500/20">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wide">
                  Nível Volumétrico por Família de Combustível
                </h3>
                <p className="text-xs text-slate-400">Leitura automatizada com agrupamento categórico de tanques</p>
              </div>
            </div>

            {/* Category Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 p-1.5 rounded-xl border border-slate-800">
              {[
                { id: "todos", label: "Todos os Tanques", count: tanks.length },
                { id: "gasolina", label: "Gasolinas", count: tanks.filter(t => t.combustivel.toLowerCase().includes("gasolina")).length, color: "text-amber-400" },
                { id: "etanol", label: "Etanol", count: tanks.filter(t => t.combustivel.toLowerCase().includes("etanol")).length, color: "text-cyan-400" },
                { id: "diesel", label: "Diesel", count: tanks.filter(t => t.combustivel.toLowerCase().includes("diesel")).length, color: "text-emerald-400" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setTankCategoryFilter(cat.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition cursor-pointer flex items-center gap-1.5 ${
                    tankCategoryFilter === cat.id
                      ? "bg-amber-400 text-slate-950 shadow-md font-black"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <span>{cat.label}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${tankCategoryFilter === cat.id ? "bg-slate-950 text-amber-300" : "bg-slate-800 text-slate-300"}`}>
                    {cat.count}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => onNavigate("tanques")}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <span>Gestão Completa</span>
              <ArrowUpRight className="h-4 w-4 text-amber-400" />
            </button>
          </div>

          {/* Categorized Summary Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                title: "Gasolinas (Comum / Aditivada / Premium)",
                color: "border-amber-500/30 bg-amber-500/5 text-amber-300",
                tanksGroup: tanks.filter(t => t.combustivel.toLowerCase().includes("gasolina"))
              },
              {
                title: "Etanol (Hidratado / Aditivado)",
                color: "border-cyan-500/30 bg-cyan-500/5 text-cyan-300",
                tanksGroup: tanks.filter(t => t.combustivel.toLowerCase().includes("etanol"))
              },
              {
                title: "Diesel (S10 / S500)",
                color: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
                tanksGroup: tanks.filter(t => t.combustivel.toLowerCase().includes("diesel"))
              }
            ].map((grp, idx) => {
              const currentVol = grp.tanksGroup.reduce((a, b) => a + b.volumeAtual, 0);
              const maxVol = grp.tanksGroup.reduce((a, b) => a + b.capacidadeMaxima, 0) || 1;
              const pct = Math.round((currentVol / maxVol) * 100);

              return (
                <div key={idx} className={`p-3 rounded-xl border ${grp.color} flex items-center justify-between`}>
                  <div>
                    <span className="text-[10px] font-mono uppercase font-bold text-slate-400 block">{grp.title}</span>
                    <span className="text-sm font-black font-display text-white">
                      {currentVol.toLocaleString("pt-BR")}L <span className="text-[10px] font-normal text-slate-400">({pct}% estocado)</span>
                    </span>
                  </div>
                  <span className="text-xs font-mono font-black px-2 py-1 bg-slate-950/80 rounded-lg border border-slate-800">
                    {grp.tanksGroup.length} Reservatório(s)
                  </span>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
            {tanks
              .filter((t) => {
                if (tankCategoryFilter === "gasolina") return t.combustivel.toLowerCase().includes("gasolina");
                if (tankCategoryFilter === "etanol") return t.combustivel.toLowerCase().includes("etanol");
                if (tankCategoryFilter === "diesel") return t.combustivel.toLowerCase().includes("diesel");
                return true;
              })
              .map((tank) => {
              const pct = Math.min(100, Math.max(0, (tank.volumeAtual / tank.capacidadeMaxima) * 100));
              const isCritical = tank.volumeAtual <= tank.pontoCriticoAlerta;
              
              let fluidBg = "from-emerald-500 to-emerald-700";
              let borderColor = "border-slate-800";
              
              if (isCritical) {
                fluidBg = "from-rose-500 to-rose-700";
                borderColor = "border-rose-500/40 bg-rose-500/5";
              } else if (pct < 35) {
                fluidBg = "from-amber-400 to-amber-600";
                borderColor = "border-amber-500/40 bg-amber-500/5";
              } else if (tank.combustivel.includes("Gasolina Comum")) {
                fluidBg = "from-amber-400 to-amber-600";
              } else if (tank.combustivel.includes("Gasolina Aditivada")) {
                fluidBg = "from-rose-500 to-rose-700";
              } else if (tank.combustivel.includes("Etanol")) {
                fluidBg = "from-cyan-400 to-cyan-600";
              } else if (tank.combustivel.includes("Diesel")) {
                fluidBg = "from-emerald-500 to-emerald-700";
              }

              return (
                <div key={tank.id} className={`p-4 rounded-2xl border ${borderColor} flex flex-col items-center bg-[#13151a] shadow-md transition hover:border-slate-700`}>
                  <div className="text-center w-full">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold bg-slate-900 text-slate-400 px-2.5 py-0.5 rounded-full border border-slate-800 uppercase">
                        ID: {tank.identificador}
                      </span>
                      <span className="text-[9px] font-mono font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/30">
                        {tank.combustivel.split(" ")[0]}
                      </span>
                    </div>
                    <h4 className="text-xs font-extrabold text-white mt-2 uppercase truncate">
                      {tank.combustivel}
                    </h4>
                  </div>

                  <div className="w-20 h-32 bg-slate-950 border-2 border-slate-800 rounded-b-2xl relative overflow-hidden my-4 shadow-inner flex flex-col justify-end">
                    <div className="absolute top-0 left-0 right-0 h-3 bg-slate-900 border-b border-slate-800 rounded-full z-20" />
                    
                    <div
                      className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fluidBg} transition-all duration-1000 ease-in-out`}
                      style={{ height: `${pct}%` }}
                    >
                      {pct > 0 && <div className="absolute -top-1 left-0 right-0 h-2 bg-white/30 rounded-full z-10" />}
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center font-extrabold text-xs text-white z-20 bg-slate-950/80 backdrop-blur-xs h-fit w-fit mx-auto px-2 py-0.5 rounded-md shadow-2xs border border-slate-800 font-mono">
                      {Math.round(pct)}%
                    </div>
                  </div>

                  <div className="w-full text-center space-y-1">
                    <p className="text-xs text-white font-mono font-extrabold">
                      {tank.volumeAtual.toLocaleString()}L / {tank.capacidadeMaxima.toLocaleString()}L
                    </p>
                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                      <div className={`h-full bg-gradient-to-r ${fluidBg}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. OPERAÇÃO DE TURNO & QUALIDADE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Active Shift Card */}
        {localPrefs.visibleWidgets.activeShift !== false && (
          <div className="bg-[#191c22] p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-400/10 text-amber-400 rounded-xl border border-amber-400/20">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">
                    Operação de Turno Atual
                  </h3>
                  <p className="text-xs text-slate-400">Responsável pela pista e fechamento de caixa</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate("escalas")}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Ver Escalas</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {activeShift ? (
              <div className="space-y-4">
                <div className="bg-[#13151a] p-4 rounded-xl border border-slate-800 flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Frentista Responsável</p>
                    <p className="text-sm font-extrabold text-white">{activeShift.frentistaResponsavel}</p>
                  </div>
                  <span className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black px-3 py-1 rounded-full uppercase">
                    {activeShift.turno}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Conformidade do Checklist de Pista</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { label: "Limpeza de Pistas", status: activeShift.checklist.limpezaPistas },
                      { label: "Uso de EPIs", status: activeShift.checklist.usoEPIs },
                      { label: "Equipamentos ANP", status: activeShift.checklist.afericaoEquipamentosSeguranca },
                      { label: "Teste do Gerador", status: activeShift.checklist.testeGerador }
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 bg-[#13151a] rounded-xl border border-slate-800 text-xs font-semibold text-slate-300">
                        <span>{item.label}</span>
                        {item.status ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <ShieldAlert className="h-4 w-4 text-rose-400" />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <HelpCircle className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-xs font-bold text-slate-400">Nenhum turno registrado em andamento neste momento</p>
                <button
                  onClick={() => onNavigate("escalas")}
                  className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer"
                >
                  Abrir Novo Turno
                </button>
              </div>
            )}
          </div>
        )}

        {/* ANP Quality Control */}
        {localPrefs.visibleWidgets.qualityControl !== false && (
          <div className="bg-[#191c22] p-6 rounded-2xl border border-slate-800 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 text-purple-400 rounded-xl border border-purple-500/20">
                  <Thermometer className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">
                    Controle de Qualidade ANP
                  </h3>
                  <p className="text-xs text-slate-400">Inspeções de temperatura e densidade</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate("qualidade")}
                className="text-xs font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Ver Laudos</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {qualityAudits.length > 0 ? (
              <div className="space-y-3">
                {qualityAudits.slice(-3).reverse().map((audit) => (
                  <div key={audit.id} className="p-3 bg-[#13151a] rounded-xl border border-slate-800 flex justify-between items-center text-xs">
                    <div>
                      <p className="font-extrabold text-white">{audit.combustivel}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {audit.temperatura}°C | Densidade: {audit.densidade} g/cm³
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${audit.conforme ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"}`}>
                      {audit.conforme ? "CONFORME" : "REPROVADO"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <p className="text-xs font-bold text-slate-400">Sem ensaios de densidade efetuados hoje</p>
                <button
                  onClick={() => onNavigate("qualidade")}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                >
                  Registrar Teste Prova Rápida ANP
                </button>
              </div>
            )}
          </div>
        )}

        {/* Resumo Executivo de Aferições (ANP Calibration Summary) */}
        <div className="bg-[#191c22] p-6 rounded-2xl border border-slate-800 shadow-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
                  <Gauge className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wide">
                    Aferições de Vazão (ANP)
                  </h3>
                  <p className="text-xs text-slate-400">Resumo de conformidade dos bicos</p>
                </div>
              </div>

              <button
                onClick={() => onNavigate("qualidade")}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <span>Painel ANP</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Status das calibrações */}
            <div className="mt-4 space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status das Calibrações</span>
              <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold font-mono">
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-2.5 rounded-xl">
                  <span className="block text-base font-black font-sans">{totalConforme}</span>
                  <span className="text-[9px] uppercase font-sans">Em dia</span>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 p-2.5 rounded-xl">
                  <span className="block text-base font-black font-sans">{totalVencido + totalReprovado}</span>
                  <span className="text-[9px] uppercase font-sans">Vencidos</span>
                </div>
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-xl">
                  <span className="block text-base font-black font-sans">{totalPendente}</span>
                  <span className="text-[9px] uppercase font-sans">Pendentes</span>
                </div>
              </div>
            </div>

            {/* Próxima data de aferição exigida pela ANP */}
            <div className="mt-4 flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Próxima Exigência ANP:</span>
              <span className="text-xs text-amber-300 font-black bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 rounded-lg font-mono">
                {proximaDataANP}
              </span>
            </div>
          </div>

          {/* Alerta visual caso alguma bomba esteja com aferição pendente */}
          <div className="mt-4">
            {hasPendingOrOverdueCalibrations ? (
              <div className="p-3 bg-rose-500/15 border border-rose-500/30 rounded-xl flex items-start gap-2.5 text-xs text-rose-300 font-bold animate-pulse">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400 mt-0.5" />
                <div>
                  <span className="block font-black uppercase text-[10px] tracking-wider text-rose-200">Atenção! Bomba Pendente</span>
                  <span className="text-[10px] font-medium text-slate-400 leading-snug block mt-0.5">
                    Existem bicos de abastecimento sem aferição válida ou fora do prazo regulamentar.
                  </span>
                </div>
              </div>
            ) : (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2.5 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                <span className="text-[10px]">Todas as bombas em total conformidade ANP.</span>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
