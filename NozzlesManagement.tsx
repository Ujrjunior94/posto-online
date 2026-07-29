/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect } from "react";
import { AppState, ShiftShortage, ShiftSchedule, User } from "../types";
import { 
  DollarSign, 
  Users, 
  Calendar, 
  Plus, 
  Trash2, 
  CheckCircle, 
  AlertCircle,
  Calculator,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  Info,
  X,
  Search,
  RefreshCw,
  Coins,
  FileText,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Filter,
  UserX,
  BellRing,
  Bell
} from "lucide-react";
import { notifyCashierShortage, getNotificationPermission, requestBrowserNotificationPermission } from "../lib/notifications";

interface CashierShortageProps {
  appState: AppState;
  userRole: string;
  onUpdateShortages: (shortages: ShiftShortage[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onClearData?: () => void;
}

const SHIFT_TYPES = [
  "Turno A (Manhã)",
  "Turno B (Tarde)",
  "Turno C (Noite)",
];

export default function CashierShortage({ 
  appState, 
  userRole, 
  onUpdateShortages,
  onAddAuditLog,
  onClearData
}: CashierShortageProps) {
  const { shortages = [], shifts = [], users = [] } = appState;
  const isReadOnly = userRole === "Frentista";

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [shiftTurn, setShiftTurn] = useState<string>(SHIFT_TYPES[0]);
  const [tipo, setTipo] = useState<"Falta" | "Sobra">("Falta");
  const [valorTotal, setValorTotal] = useState<number>(0);
  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [observacoes, setObservacoes] = useState("");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Sub-tabs for reports
  const [activeTab, setActiveTab] = useState<"acumulado" | "detalhado">("acumulado");
  const [searchEmpQuery, setSearchEmpQuery] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState<string>("");

  // 1. AUTOMATIC SCALE RETRIEVAL & EQUAL DIVISION
  // Whenever the date or shift changes, automatically pull scheduled employees
  useEffect(() => {
    const scheduledShifts = shifts.filter(s => s.data === date && s.turno === shiftTurn);
    const employees = scheduledShifts
      .map(s => s.frentistaResponsavel)
      .filter((name): name is string => typeof name === "string" && name.trim() !== "" && name !== "Evento Geral");
    
    // Auto-populate
    setSelectedEmployees(employees);
    
    // Clear any previous error and set helpful messages
    if (employees.length === 0) {
      setError("Nenhum funcionário encontrado na escala para esta data/turno. Adicione frentistas manualmente abaixo.");
    } else {
      setError("");
    }
  }, [date, shiftTurn, shifts]);

  // Determine if the current selection perfectly matches the official schedule
  const scheduledEmployees = useMemo(() => {
    const scheduledShifts = shifts.filter(s => s.data === date && s.turno === shiftTurn);
    return scheduledShifts
      .map(s => s.frentistaResponsavel)
      .filter((name): name is string => typeof name === "string" && name.trim() !== "" && name !== "Evento Geral");
  }, [date, shiftTurn, shifts]);

  const isListMatchingSchedule = useMemo(() => {
    if (selectedEmployees.length !== scheduledEmployees.length) return false;
    const sortedSelected = [...selectedEmployees].sort();
    const sortedScheduled = [...scheduledEmployees].sort();
    return sortedSelected.every((val, idx) => val === sortedScheduled[idx]);
  }, [selectedEmployees, scheduledEmployees]);

  const handleIdentifyEmployees = () => {
    if (scheduledEmployees.length === 0) {
      setError("Nenhum funcionário cadastrado na escala para este turno.");
      return;
    }
    setSelectedEmployees(scheduledEmployees);
    setError("");
  };

  const handleCreateShortage = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (valorTotal <= 0) {
      setError(`O valor da ${tipo.toLowerCase()} deve ser maior que zero.`);
      return;
    }

    if (selectedEmployees.length === 0) {
      setError("Selecione ao menos um funcionário para o registro.");
      return;
    }

    const rateio = valorTotal / selectedEmployees.length;

    const newShortage: ShiftShortage = {
      id: "sh_" + Date.now(),
      shiftId: date + "_" + shiftTurn,
      data: date,
      valorTotalFalta: Number(valorTotal),
      tipo,
      funcionariosEnvolvidos: selectedEmployees,
      rateioPorFuncionario: rateio,
      status: "Pendente",
      observacoes
    };

    onUpdateShortages([...shortages, newShortage]);
    onAddAuditLog("CREATE", "Financeiro", `Registrou ${tipo.toLowerCase()} de caixa de R$ ${valorTotal} no dia ${date} (${shiftTurn}). Rateado igualmente em R$ ${rateio.toFixed(2)} para ${selectedEmployees.join(", ")}.`, "Regular");

    // DISPARAR NOTIFICAÇÃO DO NAVEGADOR
    notifyCashierShortage({
      tipo,
      valorTotal: Number(valorTotal),
      data: date,
      shiftTurn,
      funcionariosEnvolvidos: selectedEmployees
    });

    setSuccess(`${tipo} de caixa registrada e rateada com sucesso! (Notificação enviada ao navegador)`);
    setTimeout(() => {
      setSuccess("");
      setShowAddForm(false);
      resetForm();
    }, 3000);
  };

  const handleDeleteShortage = (id: string) => {
    if (confirm("Deseja realmente excluir este registro?")) {
      const filtered = shortages.filter(s => s.id !== id);
      onUpdateShortages(filtered);
      onAddAuditLog("DELETE", "Financeiro", `Excluiu registro de diferença de caixa ID ${id}`, "Regular");
    }
  };

  const handleUpdateStatus = (id: string, newStatus: ShiftShortage["status"]) => {
    const updated = shortages.map(s => s.id === id ? { ...s, status: newStatus } : s);
    onUpdateShortages(updated);
    onAddAuditLog("UPDATE", "Financeiro", `Alterou status do registro ID ${id} para ${newStatus}`, "Regular");
  };

  const resetForm = () => {
    setValorTotal(0);
    setTipo("Falta");
    setObservacoes("");
    // Selected employees will auto-reset via useEffect based on active date/shift
  };

  // 2. CUMULATIVE VALUE TABLE CALCULATIONS
  // Compile all unique employees that exist in users database, shift schedules, or shortage history
  const allEmployees = useMemo(() => {
    const names = new Set<string>();
    
    // Add users from company
    users.forEach(u => {
      if (u.cargo === "Frentista" || u.cargo === "Supervisor" || u.cargo === "Gerente") {
        names.add(u.nomeCompleto);
      }
    });

    // Add employees who have shortage records in history
    shortages.forEach(s => {
      s.funcionariosEnvolvidos.forEach(name => {
        if (name && name.trim()) names.add(name);
      });
    });

    // Add employees who have shifts
    shifts.forEach(sh => {
      if (sh.frentistaResponsavel && sh.frentistaResponsavel !== "Evento Geral") {
        names.add(sh.frentistaResponsavel);
      }
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [users, shortages, shifts]);

  // Compute detailed accumulated stats for each frentista
  const employeeAccumulatedData = useMemo(() => {
    return allEmployees.map(name => {
      let totalFaltas = 0;
      let faltasPendentes = 0;
      let faltasPagas = 0;
      let totalSobras = 0;
      let totalLancamentos = 0;
      
      shortages.forEach(short => {
        if (short.funcionariosEnvolvidos.includes(name)) {
          totalLancamentos++;
          const share = short.rateioPorFuncionario || (short.valorTotalFalta / short.funcionariosEnvolvidos.length) || 0;
          if (short.tipo === "Falta") {
            totalFaltas += share;
            if (short.status === "Pendente") {
              faltasPendentes += share;
            } else if (short.status === "Pago" || short.status === "Descontado") {
              faltasPagas += share;
            }
          } else if (short.tipo === "Sobra") {
            totalSobras += share;
          }
        }
      });

      const saldoAcumulado = totalSobras - totalFaltas;
      const saldoPendente = totalSobras - faltasPendentes;

      return {
        nome: name,
        totalLancamentos,
        totalFaltas,
        faltasPendentes,
        faltasPagas,
        totalSobras,
        saldoAcumulado,
        saldoPendente,
      };
    });
  }, [allEmployees, shortages]);

  // Global aggregate metrics for the cards
  const globalMetrics = useMemo(() => {
    let totalFaltas = 0;
    let faltasPendentes = 0;
    let totalSobras = 0;

    shortages.forEach(s => {
      if (s.tipo === "Falta") {
        totalFaltas += s.valorTotalFalta;
        if (s.status === "Pendente") {
          faltasPendentes += s.valorTotalFalta;
        }
      } else if (s.tipo === "Sobra") {
        totalSobras += s.valorTotalFalta;
      }
    });

    return {
      totalFaltas,
      faltasPendentes,
      totalSobras,
      saldoGeral: totalSobras - totalFaltas
    };
  }, [shortages]);

  // Filtered employees for cumulative table
  const filteredAccumulatedData = useMemo(() => {
    return employeeAccumulatedData.filter(emp => 
      emp.nome.toLowerCase().includes(searchEmpQuery.toLowerCase())
    );
  }, [employeeAccumulatedData, searchEmpQuery]);

  // Filtered historical shortage records
  const filteredShortages = useMemo(() => {
    let result = shortages;
    if (employeeFilter) {
      result = result.filter(s => s.funcionariosEnvolvidos.includes(employeeFilter));
    }
    return result;
  }, [shortages, employeeFilter]);

  return (
    <div className="space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-800 flex items-center gap-2 font-display">
            <DollarSign className="text-indigo-600 h-6 w-6" />
            Diferenças de Caixa (Faltas & Sobras)
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Controle automatizado de quebras de caixa, rateio inteligente por escala e valores acumulados por funcionário
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (onClearData) {
                onClearData();
              } else if (confirm("Deseja apagar todos os registros de faltas e sobras de caixa?")) {
                onUpdateShortages([]);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl transition text-xs font-black cursor-pointer shrink-0"
            title="Limpar faltas e sobras de caixa"
          >
            <Trash2 className="h-4 w-4 text-rose-500" />
            <span>Limpar Faltas</span>
          </button>

          <button
            onClick={async () => {
              const granted = await requestBrowserNotificationPermission();
              if (granted) {
                alert("🔔 Notificações ativadas! Você receberá alertas em tempo real sobre Faltas de Caixa no navegador.");
              } else {
                alert("⚠️ Permissão de notificação não concedida no navegador.");
              }
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200/80 rounded-xl transition text-xs font-bold cursor-pointer shrink-0"
            title="Ativar Alertas no Navegador"
          >
            <Bell className="h-3.5 w-3.5 text-amber-600" />
            <span className="hidden sm:inline">Alertas do Navegador</span>
          </button>

          {!isReadOnly && (
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-2 px-4.5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition font-black text-xs uppercase tracking-wider shadow-md cursor-pointer shrink-0"
            >
              {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showAddForm ? "Cancelar" : "Lançar Diferença"}
            </button>
          )}
        </div>
      </div>

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-fade-in shadow-xs">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {error && !showAddForm && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 text-xs font-bold rounded-2xl flex items-center gap-2.5 animate-fade-in shadow-xs">
          <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* FORM TO ADD NEW DIFFERENCE (with smart auto-split) */}
      {showAddForm && (
        <div className="bg-slate-50/70 p-6 rounded-3xl border border-slate-200 shadow-xs animate-in slide-in-from-top duration-300 space-y-5">
          <div className="flex justify-between items-center pb-2 border-b border-slate-200">
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="h-4 w-4 text-indigo-600" />
              Novo Registro de Diferença de Turno
            </h3>
            <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase">
              Divisão Automática por Escala
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleCreateShortage} className="space-y-5">
            
            {/* Toggle Button for Type */}
            <div className="flex gap-2 p-1 bg-slate-200/60 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setTipo("Falta")}
                className={`px-4.5 py-2 rounded-lg text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                  tipo === "Falta" ? "bg-rose-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingDown className="h-3.5 w-3.5" />
                Falta de Caixa (Déficit)
              </button>
              <button
                type="button"
                onClick={() => setTipo("Sobra")}
                className={`px-4.5 py-2 rounded-lg text-xs font-black transition flex items-center gap-2 cursor-pointer ${
                  tipo === "Sobra" ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                Sobra de Caixa (Excesso)
              </button>
            </div>

            {/* Main Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Date Input */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">Data do Ocorrido</label>
                <div className="relative">
                  <Calendar className="absolute left-0.5 top-1.5 h-4 w-4 text-slate-400" />
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-6 pr-2 py-1 bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
                  />
                </div>
              </div>

              {/* Shift Input */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">Turno Selecionado</label>
                <select
                  value={shiftTurn}
                  onChange={(e) => setShiftTurn(e.target.value)}
                  className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer"
                >
                  {SHIFT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              {/* Total Value Input */}
              <div className="space-y-1.5 bg-white p-3.5 rounded-2xl border border-slate-200">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">
                  Valor Total da {tipo === "Falta" ? "Falta" : "Sobra"} (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-0 top-1 text-sm font-black text-slate-400">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={valorTotal || ""}
                    onChange={(e) => setValorTotal(Number(e.target.value))}
                    className={`w-full pl-6 pr-2 py-1 bg-transparent text-sm font-mono font-black text-slate-800 outline-none`}
                    placeholder="0,00"
                  />
                </div>
              </div>

            </div>

            {/* Smart Employee Split Panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <Users className="h-4.5 w-4.5 text-indigo-600" />
                  <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
                    Funcionários Responsáveis (Rateio por Escala)
                  </h4>
                </div>

                {/* Automation Badge status */}
                {selectedEmployees.length > 0 ? (
                  isListMatchingSchedule ? (
                    <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <UserCheck className="h-3 w-3" /> Escala Puxada Automaticamente
                    </span>
                  ) : (
                    <span className="bg-amber-50 text-amber-700 border border-amber-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                      <Info className="h-3 w-3" /> Ajustado Manualmente
                    </span>
                  )
                ) : (
                  <span className="bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                    <UserX className="h-3 w-3" /> Nenhum Frentista Escalado
                  </span>
                )}
              </div>

              {/* Recipient list */}
              {selectedEmployees.length > 0 ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {selectedEmployees.map((emp, idx) => (
                      <span key={idx} className="bg-slate-50 border border-slate-200 pl-3 pr-2 py-1 rounded-full text-xs font-bold text-slate-700 flex items-center gap-2 shadow-2xs">
                        {emp}
                        <button 
                          type="button"
                          onClick={() => setSelectedEmployees(prev => prev.filter(e => e !== emp))}
                          className="text-slate-400 hover:text-rose-600 transition p-0.5 cursor-pointer"
                          title="Remover frentista"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>

                  {/* Division Preview Box */}
                  <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex flex-col sm:flex-row justify-between sm:items-center gap-2 text-xs">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-medium">Rateio Igualitário ({selectedEmployees.length} frentistas):</span>
                      <p className="text-[10px] text-slate-400">
                        O valor total de R$ {valorTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} será dividido igualmente.
                      </p>
                    </div>
                    <span className={`font-black text-sm px-3 py-1.5 rounded-lg shrink-0 border ${
                      tipo === "Falta" 
                        ? "text-rose-700 bg-rose-50 border-rose-100" 
                        : "text-emerald-700 bg-emerald-50 border-emerald-100"
                    }`}>
                      R$ {(valorTotal / selectedEmployees.length || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })} por pessoa
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl space-y-2">
                  <p className="text-xs text-slate-400 italic">
                    Nenhum funcionário na escala para o {shiftTurn} no dia {date.split("-").reverse().join("/")}.
                  </p>
                  <button
                    type="button"
                    onClick={handleIdentifyEmployees}
                    className="px-3.5 py-1.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold transition cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Forçar Busca na Escala
                  </button>
                </div>
              )}

              {/* Add Frentista manually dropdown */}
              <div className="pt-2 flex items-center gap-2 text-xs">
                <span className="text-slate-400 font-bold">Adicionar outro frentista:</span>
                <select
                  onChange={(e) => {
                    if (e.target.value && !selectedEmployees.includes(e.target.value)) {
                      setSelectedEmployees([...selectedEmployees, e.target.value]);
                    }
                  }}
                  className="bg-slate-50 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold outline-none cursor-pointer"
                  value=""
                >
                  <option value="">-- Selecione para adicionar --</option>
                  {users.map(u => <option key={u.id} value={u.nomeCompleto}>{u.nomeCompleto}</option>)}
                </select>
              </div>
            </div>

            {/* Observations */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">Observações do Lançamento</label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-1 focus:ring-indigo-500 outline-none resize-none h-16"
                placeholder="Detalhes ou justificativa sobre a diferença encontrada..."
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className={`w-full py-3 text-white font-black text-xs uppercase tracking-wider rounded-xl transition shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                tipo === "Falta" 
                  ? "bg-rose-600 hover:bg-rose-700 shadow-rose-200" 
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200"
              }`}
            >
              Confirmar Registro de {tipo} e Ratear
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}

      {/* INTERACTIVE NAVIGATION TABS FOR CUMULATIVE VS HISTORICAL DETAILS */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl w-fit border border-slate-200">
        <button
          onClick={() => {
            setActiveTab("acumulado");
            setEmployeeFilter("");
          }}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === "acumulado"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <Coins className="h-4 w-4" />
          Valores Acumulados por Frentista
        </button>
        <button
          onClick={() => setActiveTab("detalhado")}
          className={`px-4 py-2 rounded-xl text-xs font-black transition flex items-center gap-2 cursor-pointer ${
            activeTab === "detalhado"
              ? "bg-white text-indigo-700 shadow-xs"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          <FileText className="h-4 w-4" />
          Histórico Detalhado de Diferenças
        </button>
      </div>

      {/* TAB 1: VALORES ACUMULADOS POR FRENTISTA (THE REQUESTED CUMULATIVE TABLE) */}
      {activeTab === "acumulado" && (
        <div className="space-y-6">
          
          {/* KPI Dashboard Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
                <TrendingDown className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Faltas Acumuladas</span>
                <p className="text-lg font-mono font-black text-rose-600 mt-0.5">
                  R$ {globalMetrics.totalFaltas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl border border-amber-100 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Faltas Pendentes</span>
                <p className="text-lg font-mono font-black text-amber-600 mt-0.5">
                  R$ {globalMetrics.faltasPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Sobras de Caixa</span>
                <p className="text-lg font-mono font-black text-emerald-600 mt-0.5">
                  R$ {globalMetrics.totalSobras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center gap-3.5">
              <div className={`p-2.5 rounded-xl border shrink-0 ${
                globalMetrics.saldoGeral >= 0 
                  ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                  : "bg-rose-50 text-rose-600 border-rose-100"
              }`}>
                <DollarSign className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Saldo Líquido Geral</span>
                <p className={`text-lg font-mono font-black mt-0.5 ${
                  globalMetrics.saldoGeral >= 0 ? "text-emerald-700" : "text-rose-700"
                }`}>
                  R$ {globalMetrics.saldoGeral.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>

          </div>

          {/* Interactive Table Container */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            
            <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-slate-50/50">
              <div>
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">Tabela de Balanço Acumulado por Funcionário</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Rateio acumulado individual de diferenças registradas no posto</p>
              </div>

              {/* Search filter */}
              <div className="relative max-w-xs w-full">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar funcionário..."
                  value={searchEmpQuery}
                  onChange={(e) => setSearchEmpQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs font-bold outline-none bg-white focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-600 font-black uppercase text-[10px] border-b border-slate-200">
                    <th className="p-4">Funcionário</th>
                    <th className="p-4 text-center">Registros</th>
                    <th className="p-4 text-right">Faltas Totais</th>
                    <th className="p-4 text-right">Faltas Pendentes</th>
                    <th className="p-4 text-right">Faltas Quitadas</th>
                    <th className="p-4 text-right">Sobras Totais</th>
                    <th className="p-4 text-right">Saldo Líquido</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccumulatedData.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-10 text-center text-slate-400 italic">
                        Nenhum funcionário encontrado.
                      </td>
                    </tr>
                  ) : (
                    filteredAccumulatedData.map((emp, idx) => (
                      <tr key={idx} className="hover:bg-indigo-50/20 transition">
                        {/* Name */}
                        <td className="p-4 font-black text-slate-800 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 flex items-center justify-center font-bold text-xs shrink-0">
                            {emp.nome.split(" ").slice(0, 2).map(n => n[0]).join("")}
                          </div>
                          <span>{emp.nome}</span>
                        </td>
                        
                        {/* Count of records */}
                        <td className="p-4 text-center font-bold text-slate-500">
                          {emp.totalLancamentos}
                        </td>

                        {/* Faltas Totais */}
                        <td className="p-4 text-right font-mono font-bold text-slate-700">
                          R$ {emp.totalFaltas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Faltas Pendentes */}
                        <td className="p-4 text-right font-mono font-black text-amber-600">
                          {emp.faltasPendentes > 0 ? (
                            <span className="bg-amber-50 px-2 py-1 rounded-lg border border-amber-100">
                              R$ {emp.faltasPendentes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-bold font-sans text-xs">Nenhuma</span>
                          )}
                        </td>

                        {/* Faltas Quitadas */}
                        <td className="p-4 text-right font-mono font-bold text-emerald-600">
                          R$ {emp.faltasPagas.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Sobras Totais */}
                        <td className="p-4 text-right font-mono font-bold text-indigo-600">
                          R$ {emp.totalSobras.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>

                        {/* Saldo Líquido */}
                        <td className="p-4 text-right">
                          <span className={`px-2 py-1 rounded-lg font-mono font-black border text-[11px] ${
                            emp.saldoAcumulado >= 0 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {emp.saldoAcumulado >= 0 ? "+" : ""}
                            R$ {emp.saldoAcumulado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Filter History button */}
                        <td className="p-4 text-center">
                          <button
                            onClick={() => {
                              setEmployeeFilter(emp.nome);
                              setActiveTab("detalhado");
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition cursor-pointer"
                            title="Filtrar histórico deste frentista"
                          >
                            <Filter className="h-3.5 w-3.5" />
                            Filtrar Histórico
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      )}

      {/* TAB 2: DETAILED LAUNCH HISTORY */}
      {activeTab === "detalhado" && (
        <div className="space-y-4">
          
          {/* Active Filter Alert / Header Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100">
                <FileText className="h-4 w-4" />
              </span>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Histórico Detalhado de Lançamentos</h4>
                {employeeFilter ? (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] text-slate-500">Filtrando por funcionário:</span>
                    <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1">
                      {employeeFilter}
                      <button 
                        onClick={() => setEmployeeFilter("")}
                        className="hover:text-rose-600 transition font-black cursor-pointer p-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-500 mt-0.5">Todos os registros de faltas e sobras de caixa lançados</p>
                )}
              </div>
            </div>

            {/* Quick manual filter list */}
            <div className="flex items-center gap-2 text-xs w-full sm:w-auto">
              <span className="text-slate-400 font-bold shrink-0">Filtrar:</span>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold outline-none cursor-pointer w-full sm:w-48 text-xs"
              >
                <option value="">-- Todos os Frentistas --</option>
                {allEmployees.map((emp, i) => <option key={i} value={emp}>{emp}</option>)}
              </select>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-500 font-black uppercase">
                    <th className="p-4">Data / Turno</th>
                    <th className="p-4">Tipo</th>
                    <th className="p-4 text-right">Valor Total</th>
                    <th className="p-4">Funcionários Escalados</th>
                    <th className="p-4 text-right">Valor Individual</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredShortages.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-10 text-center text-slate-400 italic">
                        {employeeFilter 
                          ? `Nenhum registro encontrado para o frentista "${employeeFilter}".`
                          : "Nenhum registro de quebra de caixa encontrado."}
                      </td>
                    </tr>
                  ) : (
                    filteredShortages.slice().reverse().map(short => (
                      <tr key={short.id} className="hover:bg-slate-50/50 transition">
                        {/* Date & Shift */}
                        <td className="p-4">
                          <div className="font-black text-slate-800">{short.data.split("-").reverse().join("/")}</div>
                          <div className="text-[10px] text-slate-500 font-medium">{short.shiftId.split("_")[1]}</div>
                        </td>

                        {/* Type (Falta/Sobra) */}
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase flex items-center gap-1 w-fit border ${
                            short.tipo === "Sobra" 
                              ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                              : "bg-rose-50 text-rose-700 border-rose-100"
                          }`}>
                            {short.tipo === "Sobra" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                            {short.tipo}
                          </span>
                        </td>

                        {/* Total Value */}
                        <td className={`p-4 text-right font-mono font-black ${short.tipo === "Sobra" ? "text-emerald-600" : "text-rose-600"}`}>
                          R$ {short.valorTotalFalta.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Employees Involved */}
                        <td className="p-4">
                          <div className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-black text-slate-600">{short.funcionariosEnvolvidos.length}</span>
                            <div className="group relative">
                              <Info className="h-3.5 w-3.5 text-slate-300 cursor-help" />
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl whitespace-nowrap z-50">
                                <span className="font-bold block mb-1">Funcionários no Rateio:</span>
                                {short.funcionariosEnvolvidos.join(", ")}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Individual Split */}
                        <td className="p-4 text-right font-mono font-bold text-slate-600">
                          R$ {(short.rateioPorFuncionario || (short.valorTotalFalta / short.funcionariosEnvolvidos.length)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>

                        {/* Editable Status */}
                        <td className="p-4">
                          <select
                            value={short.status}
                            disabled={isReadOnly}
                            onChange={(e) => handleUpdateStatus(short.id, e.target.value as ShiftShortage["status"])}
                            className={`text-[10px] font-black px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                              short.status === "Pago" || short.status === "Concluído"
                                ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                                : short.status === "Pendente"
                                ? "bg-amber-50 text-amber-700 border-amber-100"
                                : "bg-slate-50 text-slate-700 border-slate-100"
                            }`}
                          >
                            <option value="Pendente">Pendente</option>
                            {short.tipo === "Falta" ? (
                              <>
                                <option value="Pago">Pago</option>
                                <option value="Descontado">Descontado</option>
                              </>
                            ) : (
                              <option value="Concluído">Concluído</option>
                            )}
                          </select>
                        </td>

                        {/* Delete Action */}
                        <td className="p-4 text-center">
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteShortage(short.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-500 transition cursor-pointer"
                              title="Remover registro"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

    </div>
  );
}
