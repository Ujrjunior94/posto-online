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
  Heart,
  Copy,
  BookOpen,
  Calendar,
  Share2,
  ChevronDown,
  ArrowUpRight,
  Bookmark,
  Check,
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
  Move
} from "lucide-react";

interface DashboardOverviewProps {
  appState: AppState;
  onNavigate: (tab: string) => void;
  onUpdatePreferences: (prefs: DashboardPreferences) => void;
}

export default function DashboardOverview({ appState, onNavigate, onUpdatePreferences }: DashboardOverviewProps) {
  const { tanks = [], shifts = [], nozzleClosings = [], qualityAudits = [], dashboardPreferences } = appState;
  
  // States
  const [isEditing, setIsEditing] = useState(false);
  const [heroTab, setHeroTab] = useState<"ARA" | "NVI" | "KJV">("ARA");
  const [copiedQuote, setCopiedQuote] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showReflection, setShowReflection] = useState(false);
  const [showAiAnalysis, setShowAiAnalysis] = useState(false);
  const [selectedModule, setSelectedModule] = useState("todos");

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

  // Critical stock tanks check
  const criticalTanks = tanks.filter((t) => t.volumeAtual <= t.pontoCriticoAlerta);

  // Quality conform status
  const totalAudits = qualityAudits.length;
  const compliantAudits = qualityAudits.filter((q) => q.conforme).length;
  const qualityRate = totalAudits > 0 ? Math.round((compliantAudits / totalAudits) * 100) : 100;

  const handleToggleWidget = (widget: keyof DashboardPreferences["visibleWidgets"]) => {
    setLocalPrefs(prev => ({
      ...prev,
      visibleWidgets: {
        ...prev.visibleWidgets,
        [widget]: !prev.visibleWidgets[widget]
      }
    }));
  };

  const DEFAULT_CARD_ORDER = ["quickStats", "fuelTanks", "activeShift", "qualityControl"];

  const [cardOrder, setCardOrder] = useState<string[]>(() => {
    if (dashboardPreferences?.cardOrder && dashboardPreferences.cardOrder.length > 0) {
      return dashboardPreferences.cardOrder;
    }
    return DEFAULT_CARD_ORDER;
  });

  const [draggedCardId, setDraggedCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);

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

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedCardId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverCardId !== id) {
      setDragOverCardId(id);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData("text/plain") || draggedCardId;
    if (!sourceId || sourceId === targetId) {
      setDraggedCardId(null);
      setDragOverCardId(null);
      return;
    }

    const sourceIndex = cardOrder.indexOf(sourceId);
    const targetIndex = cardOrder.indexOf(targetId);
    if (sourceIndex === -1 || targetIndex === -1) return;

    const newOrder = [...cardOrder];
    const [removed] = newOrder.splice(sourceIndex, 1);
    newOrder.splice(targetIndex, 0, removed);

    setCardOrder(newOrder);
    setDraggedCardId(null);
    setDragOverCardId(null);

    const updatedPrefs = { ...localPrefs, cardOrder: newOrder };
    setLocalPrefs(updatedPrefs);
    onUpdatePreferences(updatedPrefs);
  };

  const handleSavePreferences = () => {
    onUpdatePreferences({ ...localPrefs, cardOrder });
    setIsEditing(false);
  };

  const quotesMap = {
    ARA: "A excelência na gestão do posto se conquista no acompanhamento diário rigoroso de estoques, auditoria de caixa e cumprimento transparente de todas as normas ANP.",
    NVI: "O fechamento preciso de bicos e o batimento diário de caixa garantem a integridade financeira e previnem divergências no balanço de combustíveis.",
    KJV: "A conformidade do livro LMC e a auditoria em tempo real asseguram total transparência fiscal e operacional perante a fiscalização da ANP."
  };

  const currentQuote = quotesMap[heroTab];

  const handleCopyQuote = () => {
    navigator.clipboard.writeText(currentQuote);
    setCopiedQuote(true);
    setTimeout(() => setCopiedQuote(false), 2000);
  };

  const dailyGoal = localPrefs.dailyGoalLiters;
  const progressPercent = Math.min(100, Math.round((totalLitersSold / dailyGoal) * 100));

  return (
    <div className="space-y-6">
      
      {/* 1. BARRA DE AÇÕES RÁPIDAS (PRINCIPAIS TAREFAS OPERACIONAIS) */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg">
              <Zap className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 font-display">
              Ações Rápidas de Operação
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:inline">
              Acesso Direto
            </span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-xl border border-slate-200"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              <span>Configurar Painel</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Ação 1: Registrar Leitura de Bico */}
          <button
            onClick={() => onNavigate("caixa")}
            className="p-3.5 bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-xl shadow-md shadow-emerald-900/10 transition flex items-center justify-between gap-3 cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/20 rounded-lg shrink-0 group-hover:scale-110 transition">
                <ClipboardList className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold block truncate">Registrar Leitura de Bico</span>
                <span className="text-[10px] text-emerald-100 block truncate">Medição de encerrantes</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-emerald-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </button>

          {/* Ação 2: Lançar Falta de Caixa */}
          <button
            onClick={() => onNavigate("faltas")}
            className="p-3.5 bg-gradient-to-br from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl shadow-md shadow-amber-900/10 transition flex items-center justify-between gap-3 cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/20 rounded-lg shrink-0 group-hover:scale-110 transition">
                <AlertTriangle className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold block truncate">Lançar Falta de Caixa</span>
                <span className="text-[10px] text-amber-100 block truncate">Registrar divergência de caixa</span>
              </div>
            </div>
            <ArrowUpRight className="h-4 w-4 shrink-0 text-amber-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition" />
          </button>

          {/* Ação 3: Adicionar Pedido */}
          <button
            onClick={() => onNavigate("pedidos")}
            className="p-3.5 bg-gradient-to-br from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl shadow-md shadow-indigo-900/10 transition flex items-center justify-between gap-3 cursor-pointer group text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="p-2 bg-white/20 rounded-lg shrink-0 group-hover:scale-110 transition">
                <Package className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-xs font-extrabold block truncate">Adicionar Pedido</span>
                <span className="text-[10px] text-indigo-100 block truncate">Solicitar materiais de pista</span>
              </div>
            </div>
            <PlusCircle className="h-4 w-4 shrink-0 text-indigo-200 group-hover:scale-110 transition" />
          </button>
        </div>

        {/* Atalhos Complementares */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Outros Módulos:</span>
          {[
            { label: "Balanço Diário", tab: "balanco", icon: BarChart3 },
            { label: "Escalas & Checklists", tab: "escalas", icon: Calendar },
            { label: "Qualidade ANP", tab: "qualidade", icon: Thermometer },
            { label: "Livro LMC (ANP)", tab: "lmc", icon: BookOpen },
          ].map((m, idx) => {
            const IconC = m.icon;
            return (
              <button
                key={idx}
                onClick={() => onNavigate(m.tab)}
                className="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200/80 rounded-lg text-slate-700 font-semibold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <IconC className="h-3 w-3 text-slate-500" />
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>



      {/* PAINEL DE CONFIGURAÇÃO (SE EXPANDIDO) */}
      {isEditing && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-md text-[#0F172A] space-y-4 animate-in fade-in duration-300">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-sm font-extrabold text-[#0F172A] uppercase flex items-center gap-2">
              <Settings className="h-4 w-4 text-[#00B880]" />
              Personalização do Dashboard
            </h3>
            <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Visibilidade dos Módulos
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: "quickStats", label: "Métricas Principais" },
                { id: "fuelTanks", label: "Reservatórios de Combustível" },
                { id: "activeShift", label: "Operação de Turno" },
                { id: "qualityControl", label: "Controle de Qualidade ANP" }
              ].map((w) => {
                const key = w.id as keyof DashboardPreferences["visibleWidgets"];
                const isVis = localPrefs.visibleWidgets[key];
                return (
                  <button
                    key={w.id}
                    onClick={() => handleToggleWidget(key)}
                    className={`p-3 rounded-xl text-xs font-bold border text-left flex items-center justify-between cursor-pointer transition ${
                      isVis ? "bg-emerald-50 border-[#00B880] text-[#00B880]" : "bg-slate-50 border-slate-200 text-slate-500"
                    }`}
                  >
                    <span>{w.label}</span>
                    {isVis ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider block">
              Prioridade / Ordem de Exibição dos Cards (Drag-and-Drop ou Botões)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {cardOrder.map((cardId, idx) => {
                const cardLabels: Record<string, string> = {
                  quickStats: "Métricas Principais (Volume, Estoque, ANP)",
                  fuelTanks: "Status dos Reservatórios de Combustível",
                  activeShift: "Operação de Turno Atual & Checklists",
                  qualityControl: "Inspeção de Qualidade & Testes ANP"
                };

                return (
                  <div
                    key={cardId}
                    className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 text-xs font-bold text-slate-700"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-5 h-5 rounded-full bg-emerald-100 text-[#00B880] text-[10px] font-black flex items-center justify-center shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="truncate">{cardLabels[cardId] || cardId}</span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleMoveCard(cardId, "up")}
                        disabled={idx === 0}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Mover para cima"
                      >
                        <ArrowUp className="h-3.5 w-3.5 text-slate-600" />
                      </button>
                      <button
                        onClick={() => handleMoveCard(cardId, "down")}
                        disabled={idx === cardOrder.length - 1}
                        className="p-1 hover:bg-slate-200 rounded disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                        title="Mover para baixo"
                      >
                        <ArrowDown className="h-3.5 w-3.5 text-slate-600" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
              <Target className="h-4 w-4 text-[#00B880]" />
              <span>Meta Diária de Litros:</span>
            </div>
            <input
              type="number"
              value={localPrefs.dailyGoalLiters}
              onChange={(e) => setLocalPrefs(prev => ({ ...prev, dailyGoalLiters: Number(e.target.value) }))}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold w-36 outline-none focus:border-[#00B880]"
            />
            <button
              onClick={handleSavePreferences}
              className="px-4 py-2 bg-[#00B880] hover:bg-[#05C480] text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar
            </button>
          </div>
        </div>
      )}

      {/* 2. SEÇÃO BIBLIOTECA TEMÁTICA (BIBLIOTECA DE MÓDULOS) */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        
        {/* Cabeçalho Interno */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#00B880] flex items-center justify-center font-bold shrink-0">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-[#0F172A]">Biblioteca de Módulos & Filtro de Operação</h3>
            <p className="text-xs text-[#64748B] font-medium">Selecione o módulo ou período de referência operacional</p>
          </div>
        </div>

        {/* Controles: Select & Botão HOJE */}
        <div className="flex items-center gap-2.5">
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-[#0F172A] text-xs font-bold rounded-xl px-3.5 py-2 outline-none focus:ring-2 focus:ring-[#00B880]/30 cursor-pointer"
          >
            <option value="todos">Todos os Módulos ERP</option>
            <option value="lmc">Livro LMC & Fiscal</option>
            <option value="tanques">Gestão de Tanques & Medição</option>
            <option value="caixa">Fechamento de Bicos & Caixa</option>
            <option value="escalas">Escalas & Frentistas</option>
          </select>

          <button
            onClick={() => setSelectedModule("todos")}
            className="bg-[#00B880] hover:bg-[#05C480] text-white font-black text-xs px-3.5 py-2 rounded-xl transition cursor-pointer shadow-2xs uppercase tracking-wider"
          >
            HOJE
          </button>
        </div>
      </div>

      {/* 3. CARDS REORGANIZÁVEIS POR DRAG-AND-DROP */}
      <div className="space-y-6">
        {cardOrder.map((cardId, index) => {
          if (!localPrefs.visibleWidgets[cardId as keyof DashboardPreferences["visibleWidgets"]]) {
            return null;
          }

          const isOver = dragOverCardId === cardId;
          const isDraggingThis = draggedCardId === cardId;

          const renderDragHeader = (title: string, icon: React.ReactNode) => (
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 select-none">
              <div className="flex items-center gap-2">
                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, cardId)}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded cursor-grab active:cursor-grabbing transition"
                  title="Clique e arraste para reordenar este card"
                >
                  <GripVertical className="h-4 w-4" />
                </div>
                <span className="text-[10px] font-black bg-emerald-100 text-[#00B880] px-2 py-0.5 rounded-full uppercase tracking-wider">
                  #{index + 1}
                </span>
                <h3 className="text-sm font-extrabold text-[#0F172A] flex items-center gap-2 uppercase tracking-wide">
                  {icon}
                  {title}
                </h3>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveCard(cardId, "up")}
                  disabled={index === 0}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                  title="Mover para cima"
                >
                  <ArrowUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => handleMoveCard(cardId, "down")}
                  disabled={index === cardOrder.length - 1}
                  className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 disabled:opacity-20 cursor-pointer"
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );

          return (
            <div
              key={cardId}
              onDragOver={(e) => handleDragOver(e, cardId)}
              onDrop={(e) => handleDrop(e, cardId)}
              className={`transition-all duration-200 rounded-2xl ${
                isOver ? "ring-2 ring-[#00B880] ring-offset-2 scale-[1.005]" : ""
              } ${isDraggingThis ? "opacity-40" : ""}`}
            >
              {cardId === "quickStats" && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
                  {renderDragHeader("Métricas Principais de Vendas e ANP", <TrendingUp className="text-[#00B880] h-5 w-5" />)}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
                    {/* Card 1: Volume Vendido */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden group hover:shadow-xs transition-all duration-300">
                      <span className="text-[#64748B] font-mono tracking-wider font-bold text-[10px] uppercase block">
                        VOLUME VENDIDO (HOJE)
                      </span>
                      <div className="text-[#0F172A] text-2xl sm:text-3xl font-extrabold font-display mt-1">
                        {totalLitersSold.toLocaleString("pt-BR")}<span className="text-xs font-bold text-slate-400 ml-1">L</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] font-medium mt-1">
                        Meta: {dailyGoal.toLocaleString("pt-BR")}L ({progressPercent}%)
                      </p>
                      <div className="h-1.5 w-full bg-slate-200/80 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-[#00B880] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
                      </div>
                    </div>

                    {/* Card 2: Litros Estocados */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden group hover:shadow-xs transition-all duration-300">
                      <span className="text-[#64748B] font-mono tracking-wider font-bold text-[10px] uppercase block">
                        ESTOQUE DE COMBUSTÍVEL
                      </span>
                      <div className="text-[#0F172A] text-2xl sm:text-3xl font-extrabold font-display mt-1">
                        {tanks.reduce((sum, t) => sum + t.volumeAtual, 0).toLocaleString("pt-BR")}<span className="text-xs font-bold text-slate-400 ml-1">L</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] font-medium mt-1">
                        distribuído em {tanks.length} tanques monitorados
                      </p>
                    </div>

                    {/* Card 3: Alertas Críticos */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden group hover:shadow-xs transition-all duration-300">
                      <span className="text-[#64748B] font-mono tracking-wider font-bold text-[10px] uppercase block">
                        ALERTAS CRÍTICOS
                      </span>
                      <div className={`text-2xl sm:text-3xl font-extrabold font-display mt-1 ${criticalTanks.length > 0 ? "text-rose-600" : "text-[#00B880]"}`}>
                        {criticalTanks.length}<span className="text-xs font-bold text-slate-400 ml-1">alerta(s)</span>
                      </div>
                      <p className="text-[11px] text-[#64748B] font-medium mt-1">
                        {criticalTanks.length > 0 ? "nível baixo em reservatórios" : "tanques em nível seguro"}
                      </p>
                    </div>

                    {/* Card 4: Conformidade ANP */}
                    <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 shadow-2xs relative overflow-hidden group hover:shadow-xs transition-all duration-300">
                      <span className="text-[#64748B] font-mono tracking-wider font-bold text-[10px] uppercase block">
                        CONFORMIDADE ANP
                      </span>
                      <div className="text-[#0F172A] text-2xl sm:text-3xl font-extrabold font-display mt-1">
                        {qualityRate}%
                      </div>
                      <p className="text-[11px] text-[#64748B] font-medium mt-1">
                        {compliantAudits} de {totalAudits} testes aprovados
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {cardId === "fuelTanks" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  {renderDragHeader("Status de Reservatórios & Nível Volumétrico", <Fuel className="text-[#00B880] h-5 w-5" />)}
                  
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                    <p className="text-xs text-[#64748B]">Medição em tempo real de tanques de armazenamento</p>
                    <button
                      onClick={() => onNavigate("tanques")}
                      className="px-3 py-1.5 bg-slate-50 hover:bg-emerald-50 text-[#0F172A] hover:text-[#00B880] rounded-xl text-xs font-bold transition flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                    >
                      <span>Gerenciamento de Tanques</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-1">
                    {tanks.map((tank) => {
                      const pct = Math.min(100, Math.max(0, (tank.volumeAtual / tank.capacidadeMaxima) * 100));
                      const isCritical = tank.volumeAtual <= tank.pontoCriticoAlerta;
                      
                      let fluidBg = "from-[#00B880] to-emerald-600";
                      let borderColor = "border-slate-200/80";
                      
                      if (isCritical) {
                        fluidBg = "from-rose-500 to-rose-600";
                        borderColor = "border-rose-200 bg-rose-50/20";
                      } else if (pct < 40) {
                        fluidBg = "from-amber-400 to-amber-500";
                        borderColor = "border-amber-200 bg-amber-50/20";
                      } else if (tank.combustivel.includes("Gasolina Comum")) {
                        fluidBg = "from-amber-400 to-amber-600";
                      } else if (tank.combustivel.includes("Gasolina Aditivada")) {
                        fluidBg = "from-rose-500 to-rose-700";
                      } else if (tank.combustivel.includes("Etanol")) {
                        fluidBg = "from-sky-400 to-sky-600";
                      } else if (tank.combustivel.includes("Diesel")) {
                        fluidBg = "from-emerald-500 to-emerald-700";
                      }

                      return (
                        <div key={tank.id} className={`p-4 rounded-2xl border ${borderColor} flex flex-col items-center bg-white shadow-2xs`}>
                          <div className="text-center w-full">
                            <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full border border-slate-200 uppercase">
                              ID: {tank.identificador}
                            </span>
                            <h4 className="text-xs font-extrabold text-[#0F172A] mt-2 uppercase truncate">
                              {tank.combustivel}
                            </h4>
                          </div>

                          <div className="w-20 h-32 bg-slate-100 border-2 border-slate-200 rounded-b-2xl relative overflow-hidden my-4 shadow-inner flex flex-col justify-end">
                            <div className="absolute top-0 left-0 right-0 h-3 bg-slate-200/80 border-b border-slate-300/50 rounded-full z-20" />
                            
                            <div
                              className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${fluidBg} transition-all duration-1000 ease-in-out`}
                              style={{ height: `${pct}%` }}
                            >
                              {pct > 0 && <div className="absolute -top-1 left-0 right-0 h-2 bg-white/20 rounded-full z-10" />}
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center font-extrabold text-xs text-[#0F172A] z-20 bg-white/80 backdrop-blur-2xs h-fit w-fit mx-auto px-2 py-0.5 rounded-md shadow-2xs">
                              {Math.round(pct)}%
                            </div>
                          </div>

                          <div className="w-full text-center space-y-1">
                            <p className="text-xs text-[#0F172A] font-mono font-extrabold">
                              {tank.volumeAtual.toLocaleString()}L / {tank.capacidadeMaxima.toLocaleString()}L
                            </p>
                            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                              <div className={`h-full bg-gradient-to-r ${fluidBg}`} style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {cardId === "activeShift" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  {renderDragHeader("Operação de Turno Atual", <UserCheck className="text-[#00B880] h-5 w-5" />)}

                  {activeShift ? (
                    <div className="space-y-4 pt-1">
                      <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100 flex justify-between items-center">
                        <div>
                          <p className="text-[10px] font-bold text-[#00B880] uppercase tracking-wider">Frentista Responsável</p>
                          <p className="text-sm font-extrabold text-[#0F172A]">{activeShift.frentistaResponsavel}</p>
                        </div>
                        <span className="bg-[#00B880] text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase shadow-2xs">
                          {activeShift.turno}
                        </span>
                      </div>

                      <div className="space-y-2">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Verificação de Checklists</p>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { label: "Limpeza de Pistas", status: activeShift.checklist.limpezaPistas },
                            { label: "Uso de EPIs", status: activeShift.checklist.usoEPIs },
                            { label: "Equipamentos ANP", status: activeShift.checklist.afericaoEquipamentosSeguranca },
                            { label: "Teste do Gerador", status: activeShift.checklist.testeGerador }
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200/60 text-xs font-semibold text-slate-700">
                              <span>{item.label}</span>
                              {item.status ? (
                                <CheckCircle2 className="h-4 w-4 text-[#00B880]" />
                              ) : (
                                <ShieldAlert className="h-4 w-4 text-rose-500" />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-3">
                      <HelpCircle className="h-10 w-10 text-slate-300 mx-auto" />
                      <p className="text-xs font-bold text-slate-500">Nenhum turno em andamento no momento</p>
                      <button
                        onClick={() => onNavigate("escalas")}
                        className="px-4 py-2 bg-[#00B880] hover:bg-[#05C480] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        Abrir Novo Turno
                      </button>
                    </div>
                  )}
                </div>
              )}

              {cardId === "qualityControl" && (
                <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  {renderDragHeader("Inspeção de Qualidade & Testes ANP", <Thermometer className="text-[#00B880] h-5 w-5" />)}

                  {qualityAudits.length > 0 ? (
                    <div className="space-y-3 pt-1">
                      {qualityAudits.slice(-3).reverse().map((audit) => (
                        <div key={audit.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex justify-between items-center text-xs">
                          <div>
                            <p className="font-extrabold text-[#0F172A]">{audit.combustivel}</p>
                            <p className="text-[11px] text-[#64748B] font-mono mt-0.5">
                              {audit.temperatura}°C | Densidade: {audit.densidade} g/cm³
                            </p>
                          </div>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${audit.conforme ? "bg-emerald-100 text-[#00B880]" : "bg-rose-100 text-rose-600"}`}>
                            {audit.conforme ? "CONFORME" : "REPROVADO"}
                          </span>
                        </div>
                      ))}
                      
                      <button
                        onClick={() => onNavigate("qualidade")}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold text-xs rounded-xl transition cursor-pointer"
                      >
                        Ver Histórico de Qualidade
                      </button>
                    </div>
                  ) : (
                    <div className="py-8 text-center space-y-3">
                      <p className="text-xs font-bold text-slate-500">Sem testes de qualidade efetuados hoje</p>
                      <button
                        onClick={() => onNavigate("qualidade")}
                        className="px-4 py-2 bg-[#00B880] hover:bg-[#05C480] text-white text-xs font-bold rounded-xl shadow-xs transition cursor-pointer"
                      >
                        Registrar Teste Prova Rápida ANP
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
