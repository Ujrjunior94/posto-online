/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, Nozzle, FuelTank } from "../types";
import SubTabNavigation from "./SubTabNavigation";
import { 
  Plus, 
  Trash2, 
  ShieldAlert, 
  CheckCircle, 
  Edit, 
  Save, 
  X, 
  Activity, 
  DollarSign,
  Tag,
  Percent,
  CheckSquare,
  Square
} from "lucide-react";

interface NozzlesManagementProps {
  appState: AppState;
  userRole: string;
  onUpdateNozzles: (nozzles: Nozzle[]) => void;
  onAddAuditLog?: (actionType: string, target: string, details: string, status: string) => void;
  onClearData?: () => void;
}

export default function NozzlesManagement({ appState, userRole, onUpdateNozzles, onAddAuditLog, onClearData }: NozzlesManagementProps) {
  const { nozzles = [], tanks = [] } = appState;
  const isReadOnly = userRole === "Frentista";

  // Selection state
  const [selectedNozzleIds, setSelectedNozzleIds] = useState<string[]>([]);
  
  // Create nozzle form state
  const [numeroBico, setNumeroBico] = useState("");
  const [bombaAssociada, setBombaAssociada] = useState("");
  const [tanqueId, setTanqueId] = useState(tanks[0]?.id || "");
  const [encerranteInicial, setEncerranteInicial] = useState(100000);
  const [precoPorLitro, setPrecoPorLitro] = useState(5.89);

  // Edit price state
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState<number>(0);

  // Global price change state
  const [globalFuelType, setGlobalFuelType] = useState("");
  const [globalPrice, setGlobalPrice] = useState<number>(0);

  // Individual discount state
  const [individualDiscount, setIndividualDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // Get unique fuel types from tanks
  const uniqueFuels = Array.from(new Set((tanks || []).map((t) => t.combustivel)));

  const toggleNozzleSelection = (id: string) => {
    setSelectedNozzleIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedNozzleIds(nozzles.map(n => n.id));
    } else {
      setSelectedNozzleIds([]);
    }
  };

  const applyDiscountToSelected = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedNozzleIds.length === 0) {
      setError("Selecione ao menos um bico para aplicar o desconto.");
      return;
    }

    const updatedNozzles = nozzles.map(n => {
      if (selectedNozzleIds.includes(n.id)) {
        let finalDiscount = 0;
        if (discountType === "fixed") {
          finalDiscount = Number(individualDiscount);
        } else {
          finalDiscount = Number(n.precoPorLitro * (individualDiscount / 100));
        }
        return { ...n, desconto: Number(finalDiscount.toFixed(3)) };
      }
      return n;
    });

    onUpdateNozzles(updatedNozzles);
    if (onAddAuditLog) {
      onAddAuditLog("UPDATE", "Bicos", `Aplicou desconto de ${individualDiscount}${discountType === "percent" ? "%" : " R$"} em ${selectedNozzleIds.length} bicos.`, "Regular");
    }
    
    setSuccess(`Desconto aplicado com sucesso em ${selectedNozzleIds.length} bico(s).`);
    setIndividualDiscount(0);
    setSelectedNozzleIds([]);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleGlobalPriceChange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!globalFuelType || globalPrice <= 0) {
      setError("Selecione um combustível e informe um preço válido.");
      return;
    }

    // 1. Identify all tanks with this fuel type
    const tanksWithFuel = tanks.filter((t) => t.combustivel === globalFuelType).map((t) => t.id);
    
    // 2. Identify all nozzles associated with these tanks
    let updatedCount = 0;
    const updatedNozzles = nozzles.map((n) => {
      if (tanksWithFuel.includes(n.tanqueId)) {
        updatedCount++;
        return { ...n, precoPorLitro: Number(globalPrice) };
      }
      return n;
    });

    if (updatedCount === 0) {
      setError(`Nenhum bico encontrado para o combustível ${globalFuelType}.`);
      return;
    }

    onUpdateNozzles(updatedNozzles);
    if (onAddAuditLog) {
      onAddAuditLog("UPDATE", "Bicos", `Alteração global de preço: ${globalFuelType} para R$ ${globalPrice.toFixed(2)} (${updatedCount} bicos atualizados)`, "Regular");
    }
    
    setSuccess(`Preço de ${globalFuelType} atualizado para R$ ${globalPrice.toFixed(2)} em ${updatedCount} bico(s).`);
    setGlobalFuelType("");
    setGlobalPrice(0);
    setTimeout(() => setSuccess(""), 4000);
  };

  const handleCreateNozzle = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (isReadOnly) {
      setError("Permissão negada para cadastrar novos bicos de combustível.");
      return;
    }

    if (!numeroBico || !bombaAssociada || !tanqueId) {
      setError("Todos os campos marcados com * são obrigatórios.");
      return;
    }

    const newNozzle: Nozzle = {
      id: "b_" + Date.now(),
      numeroBico,
      bombaAssociada,
      tanqueId,
      encerranteInicial: Number(encerranteInicial),
      precoPorLitro: Number(precoPorLitro),
    };

    onUpdateNozzles([...nozzles, newNozzle]);
    setNumeroBico("");
    setSuccess("Bico de combustível cadastrado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  const handleDeleteNozzle = (id: string) => {
    if (isReadOnly) return;
    if (confirm("Tem certeza que deseja remover este bico de combustível?")) {
      const filtered = nozzles.filter((n) => n.id !== id);
      onUpdateNozzles(filtered);
      setSuccess("Bico de combustível removido!");
      setTimeout(() => setSuccess(""), 3000);
    }
  };

  const startEditPrice = (nozzle: Nozzle) => {
    setEditingPriceId(nozzle.id);
    setNewPrice(nozzle.precoPorLitro);
  };

  const savePrice = (nozzleId: string) => {
    const updated = nozzles.map((n) => {
      if (n.id === nozzleId) {
        return { ...n, precoPorLitro: Number(newPrice) };
      }
      return n;
    });
    onUpdateNozzles(updated);
    setEditingPriceId(null);
    setSuccess("Preço de combustível atualizado com sucesso!");
    setTimeout(() => setSuccess(""), 3000);
  };

  return (
    <div className="space-y-6">
      <SubTabNavigation
        title="Gerenciamento de Bicos e Bombas"
        titleIcon={<Activity className="h-5 w-5" />}
        subtitle="Cadastro de bicos, associação a tanques alimentadores e hodômetros mecânicos (encerrantes iniciais)"
        activeTab="bicos"
        onChange={() => {}}
        tabs={[
          {
            id: "bicos",
            label: "Bicos Cadastrados",
            icon: <Activity className="h-4 w-4" />,
            badge: nozzles.length,
          }
        ]}
        rightElement={
          !isReadOnly ? (
            <button
              type="button"
              onClick={() => {
                if (onClearData) {
                  onClearData();
                } else if (confirm("Deseja apagar todos os bicos cadastrados?")) {
                  onUpdateNozzles([]);
                }
              }}
              className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
              title="Limpar bicos e encerantes"
            >
              <Trash2 className="h-4 w-4 text-rose-400" />
              <span>Limpar Bicos</span>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Form */}
        {!isReadOnly ? (
          <>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit mb-6">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Plus className="text-indigo-600 h-4 w-4" />
                Cadastrar Novo Bico
              </h3>

              <form onSubmit={handleCreateNozzle} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Número / Identificação do Bico *
                  </label>
                  <input
                    type="text"
                    required
                    value={numeroBico}
                    onChange={(e) => setNumeroBico(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Bico 05 - GA"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Bomba Associada *
                  </label>
                  <input
                    type="text"
                    required
                    value={bombaAssociada}
                    onChange={(e) => setBombaAssociada(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="Ex: Bomba Principal C"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Tanque Alimentador *
                  </label>
                  <select
                    value={tanqueId}
                    onChange={(e) => setTanqueId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  >
                    <option value="" disabled>Selecione um tanque</option>
                    {tanks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.identificador} ({t.combustivel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Encerrante Inicial (L)
                    </label>
                    <input
                      type="number"
                      min="0"
                      required
                      value={encerranteInicial}
                      onChange={(e) => setEncerranteInicial(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                      Preço por Litro (R$)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={precoPorLitro}
                      onChange={(e) => setPrecoPorLitro(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl transition shadow-md shadow-indigo-500/10 cursor-pointer"
                >
                  Cadastrar Bico
                </button>
              </form>
            </div>

            {/* Global Price Update Form */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                <DollarSign className="text-amber-500 h-4 w-4" />
                Alteração de Preço por Produto
              </h3>

              <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                Use esta ferramenta para atualizar o preço de venda de <strong>todos os bicos</strong> associados a um tipo de combustível simultaneamente.
              </p>

              <form onSubmit={handleGlobalPriceChange} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Combustível / Produto
                  </label>
                  <select
                    value={globalFuelType}
                    onChange={(e) => setGlobalFuelType(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none cursor-pointer"
                  >
                    <option value="">Selecione o produto</option>
                    {uniqueFuels.map((fuel) => (
                      <option key={fuel} value={fuel}>
                        {fuel}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Novo Preço de Venda (R$)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={globalPrice || ""}
                    onChange={(e) => setGlobalPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-amber-500 focus:outline-none"
                    placeholder="0,000"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!globalFuelType || globalPrice <= 0}
                  className={`w-full py-2.5 font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    !globalFuelType || globalPrice <= 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-500/10"
                  }`}
                >
                  <Save className="h-3.5 w-3.5" />
                  Aplicar Novo Preço em Todos os Bicos
                </button>
              </form>
            </div>

            {/* Mass Discount Panel */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit">
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-4 pb-2 border-b border-slate-100 flex items-center gap-2">
                <Tag className="text-indigo-600 h-4 w-4" />
                Descontos Individualizados
              </h3>

              <p className="text-[10px] text-slate-500 mb-4 leading-relaxed">
                Selecione os bicos desejados na tabela e informe o valor do desconto a ser aplicado sobre o preço base.
              </p>

              <form onSubmit={applyDiscountToSelected} className="space-y-4">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType("fixed")}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                      discountType === "fixed" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    <DollarSign className="h-3 w-3" />
                    Valor Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer border ${
                      discountType === "percent" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200"
                    }`}
                  >
                    <Percent className="h-3 w-3" />
                    Porcentagem
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                    Valor do Desconto ({discountType === "fixed" ? "R$" : "%"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={individualDiscount || ""}
                    onChange={(e) => setIndividualDiscount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    placeholder="0,00"
                  />
                </div>

                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-700 flex items-center justify-between">
                    <span>Bicos Selecionados:</span>
                    <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-md">{selectedNozzleIds.length}</span>
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={selectedNozzleIds.length === 0 || individualDiscount <= 0}
                  className={`w-full py-2.5 font-bold text-xs rounded-xl transition shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                    selectedNozzleIds.length === 0 || individualDiscount <= 0
                      ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                      : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/10"
                  }`}
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  Aplicar Desconto nos Selecionados
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm h-fit text-center">
            <ShieldAlert className="h-8 w-8 text-amber-500 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-2">Workspace Frentista</h3>
            <p className="text-xs text-slate-500">
              Visualização de bicos, bombas e preços ativos. Alterações estruturais em hodômetros e bombas são bloqueados para o cargo de frentista.
            </p>
          </div>
        )}

        {/* List Grid */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider mb-2">Mapeamento de Bicos e Bombas ({nozzles.length})</h3>

          {nozzles.length === 0 ? (
            <div className="bg-white p-8 rounded-xl border border-slate-200 text-center text-slate-500 shadow-sm">
              Nenhum bico de bomba cadastrado no sistema ainda.
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 text-xs font-semibold uppercase border-b border-slate-200">
                      {!isReadOnly && (
                        <th className="p-4 w-10">
                          <input 
                            type="checkbox" 
                            onChange={handleSelectAll}
                            checked={selectedNozzleIds.length === nozzles.length && nozzles.length > 0}
                            className="cursor-pointer"
                          />
                        </th>
                      )}
                      <th className="p-4">Bico</th>
                      <th className="p-4">Bomba</th>
                      <th className="p-4">Tanque / Combustível</th>
                      <th className="p-4">Encerrante Inicial</th>
                      <th className="p-4">Preço (L)</th>
                      {!isReadOnly && <th className="p-4 text-center">Ações</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm text-slate-700">
                    {nozzles.map((nozzle, idx) => {
                      const associatedTank = tanks.find((t) => t.id === nozzle.tanqueId);
                      const finalPrice = nozzle.precoPorLitro - (nozzle.desconto || 0);

                      return (
                        <tr key={nozzle.id} className={`hover:bg-slate-50/50 transition ${selectedNozzleIds.includes(nozzle.id) ? "bg-indigo-50/30" : ""}`}>
                          {!isReadOnly && (
                            <td className="p-4">
                              <input 
                                type="checkbox" 
                                checked={selectedNozzleIds.includes(nozzle.id)}
                                onChange={() => toggleNozzleSelection(nozzle.id)}
                                className="cursor-pointer"
                              />
                            </td>
                          )}
                          <td className="p-4 font-bold text-slate-800">{nozzle.numeroBico}</td>
                          <td className="p-4 text-slate-600">{nozzle.bombaAssociada}</td>
                          <td className="p-4">
                            <span className="block font-semibold text-slate-800">
                              {associatedTank ? associatedTank.combustivel : "Sem Tanque"}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono block">
                              {associatedTank ? associatedTank.identificador : "N/A"}
                            </span>
                          </td>
                          <td className="p-4 font-mono text-slate-600">{nozzle.encerranteInicial.toLocaleString()} L</td>
                          <td className="p-4">
                            {editingPriceId === nozzle.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={newPrice}
                                  onChange={(e) => setNewPrice(Number(e.target.value))}
                                  className="w-16 px-1 py-0.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => savePrice(nozzle.id)}
                                  className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-500 cursor-pointer"
                                >
                                  <Save className="h-3 w-3" />
                                </button>
                                <button
                                  onClick={() => setEditingPriceId(null)}
                                  className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center gap-1">
                                  <span className={`font-semibold ${nozzle.desconto ? "text-slate-400 line-through text-xs" : "text-slate-800"}`}>
                                    R$ {nozzle.precoPorLitro.toFixed(2)}
                                  </span>
                                  {!isReadOnly && (
                                    <button
                                      onClick={() => startEditPrice(nozzle)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                      title="Alterar preço base"
                                    >
                                      <Edit className="h-3 w-3" />
                                    </button>
                                  )}
                                </div>
                                {nozzle.desconto && nozzle.desconto > 0 && (
                                  <div className="flex flex-col gap-0.5 mt-0.5">
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-md w-fit border border-rose-100">
                                      <Tag className="h-2.5 w-2.5" />
                                      DESC: - R$ {nozzle.desconto.toFixed(3)}
                                    </div>
                                    <div className="text-xs font-black text-emerald-600">
                                      LÍQUIDO: R$ {finalPrice.toFixed(3)}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          {!isReadOnly && (
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeleteNozzle(nozzle.id)}
                                className="p-1 text-slate-400 hover:text-rose-600 transition inline-flex cursor-pointer"
                                title="Excluir bico"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
