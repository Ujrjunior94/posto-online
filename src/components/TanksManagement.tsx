/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, FuelTank, FuelType, LmcRecord } from "../types";
import { Plus, Trash2, Fuel, ShieldAlert, CheckCircle, Edit, Save, X, Ruler, Table, TrendingUp } from "lucide-react";
import DipstickTankCalculator from "./DipstickTankCalculator";
import SubTabNavigation from "./SubTabNavigation";

interface TanksManagementProps {
  appState: AppState;
  userRole: string;
  onUpdateTanks: (tanks: FuelTank[]) => void;
  onUpdateLmc?: (lmc: LmcRecord[]) => void;
  onClearData?: () => void;
}

export const FUEL_TYPES: FuelType[] = [
  "Gasolina Comum",
  "Gasolina Aditivada",
  "Gasolina Premium",
  "Etanol",
  "Diesel S10",
  "Diesel S500",
];

export default function TanksManagement({ appState, userRole, onUpdateTanks, onUpdateLmc, onClearData }: TanksManagementProps) {
  const { tanks = [] } = appState;
  const isReadOnly = userRole === "Frentista";

  const [activeSubTab, setActiveSubTab] = useState<"tanques" | "regua" | "tudo">("regua");

  // Create form state
  const [identificador, setIdentificador] = useState("");
  const [combustivel, setCombustivel] = useState<FuelType>("Gasolina Comum");
  const [capacidadeMaxima, setCapacidadeMaxima] = useState(15000);
  const [volumeAtual, setVolumeAtual] = useState(8000);
  const [pontoCriticoAlerta, setPontoCriticoAlerta] = useState(2500);
  const [cor, setCor] = useState("bg-indigo-500");
  const [observacoes, setObservacoes] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [fullEditing, setFullEditing] = useState(false);
  
  const [editIdentificador, setEditIdentificador] = useState("");
  const [editCombustivel, setEditCombustivel] = useState<FuelType>("Gasolina Comum");
  const [editCapacidade, setEditCapacidade] = useState(0);
  const [editVolume, setEditVolume] = useState<number>(0);
  const [editPontoCritico, setEditPontoCritico] = useState(0);
  const [editCor, setEditCor] = useState("");
  const [editObservacoes, setEditObservacoes] = useState<string>("");

  const COLORS = [
    { name: "Indigo", class: "bg-indigo-500" },
    { name: "Sky", class: "bg-sky-500" },
    { name: "Emerald", class: "bg-emerald-500" },
    { name: "Amber", class: "bg-amber-500" },
    { name: "Orange", class: "bg-orange-500" },
    { name: "Rose", class: "bg-rose-500" },
    { name: "Slate", class: "bg-slate-500" },
    { name: "Purple", class: "bg-purple-500" },
    { name: "Yellow", class: "bg-yellow-400" },
    { name: "Red", class: "bg-red-600" },
  ];

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleCreateTank = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isReadOnly) {
      setError("Apenas cargos Master, Gerente ou Supervisor podem cadastrar tanques.");
      return;
    }

    if (!identificador) {
      setError("O identificador do tanque é obrigatório.");
      return;
    }

    if (volumeAtual > capacidadeMaxima) {
      setError("O volume atual não pode exceder a capacidade máxima do tanque.");
      return;
    }

    const newTank: FuelTank = {
      id: "t_" + Date.now(),
      identificador,
      combustivel,
      capacidadeMaxima: Number(capacidadeMaxima),
      volumeAtual: Number(volumeAtual),
      pontoCriticoAlerta: Number(pontoCriticoAlerta),
      cor,
      observacoes,
    };

    onUpdateTanks([...tanks, newTank]);
    setIdentificador("");
    setObservacoes("");
    setSuccess("Tanque cadastrado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDeleteTank = (id: string) => {
    if (isReadOnly) return;
    if (confirm("Deseja realmente remover este tanque de combustível do sistema?")) {
      const filtered = tanks.filter((t) => t.id !== id);
      onUpdateTanks(filtered);
      setSuccess("Tanque removido com sucesso!");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const startQuickUpdate = (tank: FuelTank) => {
    setEditingId(tank.id);
    setFullEditing(false);
    setEditVolume(tank.volumeAtual);
    setEditObservacoes(tank.observacoes || "");
  };

  const startFullUpdate = (tank: FuelTank) => {
    setEditingId(tank.id);
    setFullEditing(true);
    setEditIdentificador(tank.identificador);
    setEditCombustivel(tank.combustivel);
    setEditCapacidade(tank.capacidadeMaxima);
    setEditVolume(tank.volumeAtual);
    setEditPontoCritico(tank.pontoCriticoAlerta);
    setEditCor(tank.cor || "bg-indigo-500");
    setEditObservacoes(tank.observacoes || "");
  };

  const saveUpdate = (tankId: string) => {
    const targetTank = tanks.find(t => t.id === tankId);
    if (!targetTank) return;

    const maxCap = fullEditing ? editCapacidade : targetTank.capacidadeMaxima;

    if (editVolume > maxCap) {
      setError("O volume atualizado não pode ser maior que a capacidade máxima do tanque.");
      return;
    }

    const updated = tanks.map((t) => {
      if (t.id === tankId) {
        if (fullEditing) {
          return {
            ...t,
            identificador: editIdentificador,
            combustivel: editCombustivel,
            capacidadeMaxima: Number(editCapacidade),
            volumeAtual: Number(editVolume),
            pontoCriticoAlerta: Number(editPontoCritico),
            cor: editCor,
            observacoes: editObservacoes
          };
        }
        return { ...t, volumeAtual: Number(editVolume), observacoes: editObservacoes };
      }
      return t;
    });
    onUpdateTanks(updated);
    setEditingId(null);
    setFullEditing(false);
    setSuccess("Tanque atualizado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Controle de Estoque e Tanques"
        titleIcon={<Fuel className="h-5 w-5" />}
        subtitle="Gestão de tanques, tabelas de régua de medição (TRN) e previsão para descarga de caminhão-tanque"
        activeTab={activeSubTab}
        onChange={(tabId) => setActiveSubTab(tabId as "tanques" | "regua" | "tudo")}
        tabs={[
          {
            id: "tanques",
            label: "Tanques do Posto",
            icon: <Fuel className="h-4 w-4" />,
            badge: tanks.length,
          },
          {
            id: "regua",
            label: "Tabelas de Régua & Previsão",
            icon: <Ruler className="h-4 w-4" />,
          },
          {
            id: "tudo",
            label: "Visão Consolidada",
            icon: <Table className="h-4 w-4" />,
          },
        ]}
        rightElement={
          !isReadOnly ? (
            <button
              type="button"
              onClick={() => {
                if (onClearData) {
                  onClearData();
                } else if (window.confirm("Deseja apagar todos os tanques cadastrados?")) {
                  onUpdateTanks([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Limpar dados de tanques"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-400" />
              <span>Limpar Tanques</span>
            </button>
          ) : null
        }
      />

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-600" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600" />
          {error}
        </div>
      )}

      {/* Render Dipstick Tank Calculator Component */}
      {(activeSubTab === "regua" || activeSubTab === "tudo") && (
        <DipstickTankCalculator appState={appState} onUpdateTanks={onUpdateTanks} onUpdateLmc={onUpdateLmc} />
      )}

      {/* Render Registered Tanks Grid & Add Form */}
      {(activeSubTab === "tanques" || activeSubTab === "tudo") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
          {/* Register Tank form (Only for Master/Gerente/Supervisor) */}
          {!isReadOnly ? (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
              <Plus className="text-indigo-600 h-4 w-4" />
              Cadastrar Novo Tanque
            </h3>

            <form onSubmit={handleCreateTank} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Identificador do Tanque *
                </label>
                <input
                  type="text"
                  required
                  value={identificador}
                  onChange={(e) => setIdentificador(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="Ex: Tanque 06 - GC"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Combustível Armazenado *
                </label>
                <select
                  value={combustivel}
                  onChange={(e) => setCombustivel(e.target.value as FuelType)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                >
                  {FUEL_TYPES.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Capacidade (L)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={capacidadeMaxima}
                    onChange={(e) => setCapacidadeMaxima(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Volume Inicial (L)
                  </label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={volumeAtual}
                    onChange={(e) => setVolumeAtual(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Ponto Crítico de Alerta (L)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={pontoCriticoAlerta}
                  onChange={(e) => setPontoCriticoAlerta(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Ativa alerta vermelho se o combustível cair abaixo dessa litragem
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Cor de Identificação
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c.class}
                      type="button"
                      onClick={() => setCor(c.class)}
                      className={`h-6 rounded-lg border transition-all ${
                        cor === c.class ? "ring-2 ring-offset-1 ring-indigo-500 border-transparent scale-110" : "border-slate-200"
                      } ${c.class}`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                  Observações / Notas do Tanque
                </label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none resize-none h-20"
                  placeholder="Ex: Sensores calibrados em data X, histórico de vazamento nulo, observações de segurança, etc."
                />
              </div>

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-indigo-500/10 cursor-pointer"
              >
                Cadastrar Tanque
              </button>
            </form>
          </div>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit text-center">
            <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2">Workspace Frentista</h3>
            <p className="text-xs text-slate-500">
              Operadores frentistas possuem acesso de visualização aos tanques para verificar os níveis de abastecimento, mas não podem alterar capacidades ou criar tanques estruturais.
            </p>
          </div>
        )}

        {/* Existing Tanks Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">Tanques Cadastrados ({tanks.length})</h3>

          {tanks.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
              Nenhum tanque cadastrado no sistema ainda.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tanks.map((tank) => {
                const isCritical = tank.volumeAtual <= tank.pontoCriticoAlerta;
                const pct = Math.min(100, Math.max(0, (tank.volumeAtual / tank.capacidadeMaxima) * 100));

                let fluidBg = tank.cor || "from-indigo-500 to-indigo-600";
                
                if (isCritical) {
                  fluidBg = "from-rose-500 to-rose-600";
                } else if (!tank.cor) {
                  // Fallback to legacy logic if no color is set
                  if (pct < 40) {
                    fluidBg = "from-amber-400 to-amber-500";
                  } else if (tank.combustivel.includes("Gasolina Comum")) {
                    fluidBg = "from-yellow-400 to-amber-500";
                  } else if (tank.combustivel.includes("Gasolina Aditivada")) {
                    fluidBg = "from-orange-500 to-red-600";
                  } else if (tank.combustivel.includes("Etanol")) {
                    fluidBg = "from-sky-400 to-sky-500";
                  } else if (tank.combustivel.includes("Diesel")) {
                    fluidBg = "from-emerald-500 to-emerald-600";
                  }
                } else {
                  // Use the selected color class
                  // We need to handle the gradient part if it's just a solid color class
                  const colorBase = tank.cor.replace('bg-', '').replace('-500', '');
                  fluidBg = `from-${colorBase}-400 to-${colorBase}-600`;
                }

                return (
                  <div
                    key={tank.id}
                    className={`bg-white p-5 rounded-2xl border ${
                      isCritical ? "border-rose-300 ring-1 ring-rose-50" : "border-slate-200"
                    } shadow-sm flex gap-4 items-center hover:border-slate-300 transition relative`}
                  >
                    {/* Cylindrical Tank Shape Column */}
                    <div className="shrink-0 relative">
                      <div className="relative w-24 h-36 bg-slate-100 border-2 border-slate-300 rounded-b-[20px] overflow-hidden shadow-inner flex flex-col justify-end">
                        {/* Cylinder Top Rim */}
                        <div className="absolute top-0 left-0 right-0 h-4 bg-slate-200 border-b border-slate-300/60 rounded-full z-20 shadow-sm" />
                        
                        {/* Cylinder Glass Gloss reflection */}
                        <div className="absolute inset-y-0 left-3.5 w-2 bg-white/20 z-20 pointer-events-none" />

                        {/* Liquid Body */}
                        <div
                          className={`absolute bottom-0 left-0 right-0 rounded-b-[18px] bg-gradient-to-t ${fluidBg} transition-all duration-1000 ease-in-out`}
                          style={{ height: `${pct}%` }}
                        >
                          {/* Liquid Top Surface Oval */}
                          {pct > 0 && (
                            <div 
                              className="absolute -top-1.5 left-0 right-0 h-3 bg-white/30 rounded-full z-10"
                              style={{ borderBottom: '1px solid rgba(255,255,255,0.3)' }}
                            />
                          )}

                          {/* Liquid Wave Animation Overlay */}
                          {pct > 0 && (
                            <div className="absolute inset-0 overflow-hidden opacity-35">
                              <div className="w-[200%] h-full liquid-wave bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 1200 120%22 preserveAspectRatio=%22none%22><path d=%22M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,42.4V0Z%22 fill=%22%23ffffff%22></path></svg>')] bg-repeat-x bg-[length:300px_30px] absolute -top-1 left-0" />
                            </div>
                          )}
                        </div>

                        {/* Level overlay indicator */}
                        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none select-none">
                          <span className="text-[13px] font-black text-slate-800 bg-white/95 px-1.5 py-0.5 rounded-lg border border-slate-200/80 font-mono shadow-xs">
                            {Math.round(pct)}%
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Information & Controls Column */}
                    <div className="flex-1 w-full space-y-3 flex flex-col justify-between h-full min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-1">
                          <div className="min-w-0">
                            <span className="text-[9px] font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200 font-bold uppercase tracking-wide truncate block max-w-full">
                              {tank.identificador}
                            </span>
                            <h4 className="text-xs font-black text-slate-800 mt-1 truncate">{tank.combustivel}</h4>
                          </div>
                          {!isReadOnly && (
                            <button
                              onClick={() => handleDeleteTank(tank.id)}
                              className="p-1 text-slate-400 hover:text-rose-500 rounded-lg transition cursor-pointer"
                              title="Remover tanque"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        <div className="mt-2 space-y-0.5 text-[11px]">
                          <div className="flex justify-between">
                            <span className="text-slate-500">Volume:</span>
                            <span className={`font-mono font-bold ${isCritical ? "text-rose-600" : "text-slate-700"}`}>
                              {tank.volumeAtual.toLocaleString()} L
                            </span>
                          </div>
                          <div className="flex justify-between text-[10px] text-slate-400">
                            <span>Mín: {tank.pontoCriticoAlerta.toLocaleString()} L</span>
                            <span>Máx: {tank.capacidadeMaxima.toLocaleString()} L</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100">
                        {editingId === tank.id ? (
                          <div className="flex flex-col gap-2">
                            {fullEditing ? (
                              <div className="space-y-2 animate-fade-in">
                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Identificador:</label>
                                  <input
                                    type="text"
                                    value={editIdentificador}
                                    onChange={(e) => setEditIdentificador(e.target.value)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Combustível:</label>
                                  <select
                                    value={editCombustivel}
                                    onChange={(e) => setEditCombustivel(e.target.value as FuelType)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                  >
                                    {FUEL_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
                                  </select>
                                </div>
                                <div className="grid grid-cols-2 gap-2">
                                  <div>
                                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Capacidade:</label>
                                    <input
                                      type="number"
                                      value={editCapacidade}
                                      onChange={(e) => setEditCapacidade(Number(e.target.value))}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Ponto Crítico:</label>
                                    <input
                                      type="number"
                                      value={editPontoCritico}
                                      onChange={(e) => setEditPontoCritico(Number(e.target.value))}
                                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Cor:</label>
                                  <div className="flex flex-wrap gap-1">
                                    {COLORS.map((c) => (
                                      <button
                                        key={c.class}
                                        type="button"
                                        onClick={() => setEditCor(c.class)}
                                        className={`h-4 w-4 rounded-full border transition-all ${
                                          editCor === c.class ? "ring-2 ring-offset-1 ring-indigo-500 border-transparent scale-110" : "border-slate-200"
                                        } ${c.class}`}
                                      />
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : null}

                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex-1">
                                {!fullEditing && <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Volume:</label>}
                                <input
                                  type="number"
                                  value={editVolume}
                                  onChange={(e) => setEditVolume(Number(e.target.value))}
                                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-850 text-[11px] focus:outline-none focus:ring-1 focus:ring-indigo-500 font-bold animate-fade-in"
                                  placeholder="Litragem"
                                />
                              </div>
                              <button
                                onClick={() => saveUpdate(tank.id)}
                                className="p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 transition cursor-pointer shrink-0 self-end"
                                title="Salvar"
                              >
                                <Save className="h-3.5 w-3.5" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingId(null);
                                  setFullEditing(false);
                                }}
                                className="p-1.5 bg-slate-200 text-slate-700 rounded-lg hover:bg-slate-300 transition cursor-pointer shrink-0 self-end"
                                title="Cancelar"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div>
                              <label className="text-[9px] uppercase font-bold text-slate-400 block mb-0.5">Observações:</label>
                              <textarea
                                value={editObservacoes}
                                onChange={(e) => setEditObservacoes(e.target.value)}
                                className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 text-[10px] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none h-12"
                                placeholder="Notas ou observações do tanque..."
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              {isCritical ? (
                                <span className="text-[9px] font-bold text-rose-600 animate-pulse flex items-center gap-0.5">
                                  <ShieldAlert className="h-2.5 w-2.5" /> CRÍTICO
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-emerald-600 flex items-center gap-0.5">
                                  <CheckCircle className="h-2.5 w-2.5" /> SEGURO
                                </span>
                              )}
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startQuickUpdate(tank)}
                                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer"
                                  title="Ajuste rápido de volume"
                                >
                                  <Edit className="h-3 w-3" /> Vol
                                </button>
                                {!isReadOnly && (
                                  <button
                                    onClick={() => startFullUpdate(tank)}
                                    className="text-[10px] text-slate-600 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer border-l border-slate-200 pl-2"
                                    title="Editar todos os detalhes"
                                  >
                                    <Edit className="h-3 w-3" /> Editar
                                  </button>
                                )}
                              </div>
                            </div>
                            {tank.observacoes ? (
                              <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-slate-600 text-[10px] leading-snug italic">
                                <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold block mb-0.5">Obs:</span>
                                {tank.observacoes}
                              </div>
                            ) : (
                              <div className="text-slate-400 text-[10px] italic">Sem observações cadastradas.</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
