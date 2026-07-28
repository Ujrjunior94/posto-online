/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  AppState,
  NozzleClosing,
  ShiftReconciliation,
  CashTransaction,
} from "../types";
import {
  Activity,
  AlertOctagon,
  CheckCircle2,
  Gauge,
  ListCollapse,
  Layers,
  Sparkles,
  PenTool,
  X,
  FileCheck2,
  Trash2,
} from "lucide-react";
import SignaturePad from "./SignaturePad";

interface CashManagementProps {
  appState: AppState;
  userRole: string;
  onUpdateTransactions: (transactions: CashTransaction[]) => void;
  onUpdateClosings: (closings: NozzleClosing[]) => void;
  onUpdateReconciliations: (reconciliations: ShiftReconciliation[]) => void;
  onClearData?: () => void;
}

export default function CashManagement({
  appState,
  userRole,
  onUpdateTransactions,
  onUpdateClosings,
  onUpdateReconciliations,
  onClearData,
}: CashManagementProps) {
  const { nozzles = [], shifts = [], nozzleClosings = [] } = appState;

  // Selected shift for real-time litrage overview
  const [selectedShiftId, setSelectedShiftId] = useState(shifts[1]?.id || shifts[0]?.id || "");
  const [selectedNozzleId, setSelectedNozzleId] = useState("");
  const [encerranteFinal, setEncerranteFinal] = useState(124650);
  const [capturedSignature, setCapturedSignature] = useState<string | null>(null);
  const [previewSignatureModal, setPreviewSignatureModal] = useState<{ open: boolean; url?: string; title?: string }>({ open: false });

  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const activeAndClosedShifts = shifts.filter((s) => s.status !== "Planejado");

  // Handle Nozzle Turn Closing (Leitura final de bico)
  const handleCreateNozzleClosing = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!selectedShiftId || !selectedNozzleId) {
      setError("Selecione o turno e o bico correspondente.");
      return;
    }

    const nozzle = nozzles.find((n) => n.id === selectedNozzleId);
    if (!nozzle) return;

    // Check if closing is lower than initial mechanical reading
    if (encerranteFinal < nozzle.encerranteInicial) {
      setError(
        `O encerrante final (${encerranteFinal.toLocaleString()} L) não pode ser menor que o encerrante inicial (${nozzle.encerranteInicial.toLocaleString()} L).`
      );
      return;
    }

    const litrosVendidos = encerranteFinal - nozzle.encerranteInicial;
    const valorVendidoCalculado = litrosVendidos * nozzle.precoPorLitro;

    // Check if already closed for this shift
    const alreadyClosed = nozzleClosings.some(
      (nc) => nc.shiftId === selectedShiftId && nc.nozzleId === selectedNozzleId
    );
    if (alreadyClosed) {
      setError("Este bico já foi fechado para o turno selecionado.");
      return;
    }

    const newClosing: NozzleClosing = {
      id: "nc_" + Date.now(),
      shiftId: selectedShiftId,
      nozzleId: selectedNozzleId,
      encerranteFinal: Number(encerranteFinal),
      litrosVendidos,
      valorVendidoCalculado,
      assinaturaDigital: capturedSignature || undefined,
    };

    onUpdateClosings([...nozzleClosings, newClosing]);

    setSuccess(
      `Bico fechado com sucesso! Volume registrado: ${litrosVendidos.toLocaleString()} L vendidos.${
        capturedSignature ? " (Assinatura digital validada)" : ""
      }`
    );
    setTimeout(() => setSuccess(""), 4000);
  };

  // Helper to filter closings by shift
  const currentClosings = nozzleClosings.filter((nc) => nc.shiftId === selectedShiftId);
  const totalLitersInShift = currentClosings.reduce((sum, nc) => sum + nc.litrosVendidos, 0);

  // Group liters sold in shift by fuel type
  const litersByFuelType: { [key: string]: number } = {};
  currentClosings.forEach((nc) => {
    const nozzle = nozzles.find((n) => n.id === nc.nozzleId);
    if (nozzle) {
      const fuelName = nozzle.numeroBico.includes("GC") ? "Gasolina Comum" :
                       nozzle.numeroBico.includes("GA") ? "Gasolina Aditivada" :
                       nozzle.numeroBico.includes("ET") ? "Etanol" :
                       nozzle.numeroBico.includes("DS10") ? "Diesel S10" : "Combustível";
      litersByFuelType[fuelName] = (litersByFuelType[fuelName] || 0) + nc.litrosVendidos;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <Gauge className="text-indigo-600 h-6 w-6 animate-pulse" />
            Controle de Litragem e Encerramento de Bicos
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Lance leituras mecânicas finais, calcule volumes reais vendidos e analise a litragem consolidada por turno
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            if (onClearData) {
              onClearData();
            } else if (confirm("Deseja apagar todos os registros de caixa e encerramento de bicos?")) {
              onUpdateTransactions([]);
              onUpdateClosings([]);
              onUpdateReconciliations([]);
            }
          }}
          className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
          title="Limpar dados do caixa"
        >
          <Trash2 className="h-4 w-4 text-rose-500" />
          <span>Limpar Caixa</span>
        </button>
      </div>

      {success && (
        <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {success}
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-sm rounded-xl flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-rose-600" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Step 1: Nozzle closing mechanical input */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <Activity className="text-indigo-600 h-4 w-4" />
            1. Leitura do Encerrante Final
          </h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Frentistas devem lançar a leitura mecânica do hodômetro no final do seu turno para computar as vendas reais de combustível em litros.
          </p>

          <form onSubmit={handleCreateNozzleClosing} className="space-y-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Turno Correspondente</label>
              <select
                value={selectedShiftId}
                onChange={(e) => {
                  setSelectedShiftId(e.target.value);
                  if (selectedNozzleId) {
                    const n = nozzles.find((nozzle) => nozzle.id === selectedNozzleId);
                    if (n) setEncerranteFinal(n.encerranteInicial + 100);
                  }
                }}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="">Selecione o Turno</option>
                {activeAndClosedShifts.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.data} - {s.turno}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Bico / Bomba</label>
              <select
                value={selectedNozzleId}
                onChange={(e) => {
                  setSelectedNozzleId(e.target.value);
                  const n = nozzles.find((nozzle) => nozzle.id === e.target.value);
                  if (n) {
                    setEncerranteFinal(n.encerranteInicial + 150); // realistic increment
                  }
                }}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="">Selecione o Bico</option>
                {nozzles.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.numeroBico} (Inicial: {n.encerranteInicial.toLocaleString()} L)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Leitura Final do Encerrante (L)</label>
              <input
                type="number"
                value={encerranteFinal}
                onChange={(e) => setEncerranteFinal(Number(e.target.value))}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs font-mono focus:ring-1 focus:ring-indigo-500 focus:outline-none"
              />
              {selectedNozzleId && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Volume Vendido = Encerrante Final - Inicial
                </p>
              )}
            </div>

            {/* Captura de Assinatura Digital do Operador */}
            <div className="pt-2 border-t border-slate-100">
              <SignaturePad
                onSignatureChange={(url) => setCapturedSignature(url)}
                label="Validação por Assinatura Digital"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition cursor-pointer shadow-sm flex items-center justify-center gap-2"
            >
              <FileCheck2 className="h-4 w-4" />
              Registrar Fechamento de Bico
            </button>
          </form>
        </div>

        {/* Step 2: Liters Sold Analysis per Shift */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 lg:col-span-2">
          <h3 className="text-xs font-semibold text-slate-800 uppercase tracking-wider pb-2 border-b border-slate-100 flex items-center gap-2">
            <Layers className="text-indigo-600 h-4 w-4" />
            2. Consolidação de Volume do Turno Selecionado
          </h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Acompanhe o acumulado de litragem de todos os bicos fechados para o turno ativo.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex flex-col justify-center">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">Total Vendido no Turno</span>
              <span className="text-3xl font-black text-indigo-700 font-mono mt-1">
                {totalLitersInShift.toLocaleString()} L
              </span>
              <span className="text-[10px] text-slate-500 mt-1">
                Soma de bicos com leitura final registrada
              </span>
            </div>

            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/60 space-y-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block border-b border-slate-200 pb-1">
                Metricas por Combustível
              </span>
              {Object.keys(litersByFuelType).length === 0 ? (
                <p className="text-xs text-slate-400 italic pt-2">Nenhuma leitura neste turno.</p>
              ) : (
                <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                  {Object.entries(litersByFuelType).map(([fuel, liters]) => (
                    <div key={fuel} className="flex justify-between text-xs font-mono">
                      <span className="text-slate-600 truncate max-w-[120px]">{fuel}:</span>
                      <span className="font-bold text-slate-800">{liters.toLocaleString()} L</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Historical logs of Nozzle Closings */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          <ListCollapse className="h-4 w-4 text-indigo-600" /> Histórico Geral de Leituras de Bicos
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                <th className="py-2 px-3">Data/Turno</th>
                <th className="py-2 px-3">Identificador do Bico</th>
                <th className="py-2 px-3">Leitura Inicial (L)</th>
                <th className="py-2 px-3">Leitura Final (L)</th>
                <th className="py-2 px-3 text-right">Volume Vendido</th>
                <th className="py-2 px-3 text-center">Assinatura Digital</th>
              </tr>
            </thead>
            <tbody>
              {nozzleClosings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                    Nenhum encerramento de bico registrado.
                  </td>
                </tr>
              ) : (
                nozzleClosings
                  .slice()
                  .reverse()
                  .map((nc) => {
                    const nozzle = nozzles.find((n) => n.id === nc.nozzleId);
                    const shift = shifts.find((s) => s.id === nc.shiftId);
                    return (
                      <tr key={nc.id} className="border-b border-slate-100 hover:bg-slate-50/40">
                        <td className="py-2.5 px-3">
                          <div className="font-semibold text-slate-700">{shift ? shift.data : ""}</div>
                          <div className="text-[10px] text-slate-400">{shift ? shift.turno : ""}</div>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {nozzle ? nozzle.numeroBico : "Bico Geral"}
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {nozzle ? nozzle.encerranteInicial.toLocaleString() : "0"} L
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-500">
                          {nc.encerranteFinal.toLocaleString()} L
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-600">
                          {nc.litrosVendidos.toLocaleString()} L
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {nc.assinaturaDigital ? (
                            <button
                              onClick={() => setPreviewSignatureModal({
                                open: true,
                                url: nc.assinaturaDigital,
                                title: `Assinatura: ${nozzle ? nozzle.numeroBico : "Bico"} (${shift ? shift.data : ""})`
                              })}
                              className="inline-flex items-center gap-1.5 px-2 py-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-[10px] font-bold transition cursor-pointer"
                              title="Clique para ampliar a assinatura"
                            >
                              <img src={nc.assinaturaDigital} alt="Assinatura" className="h-4 w-12 object-contain bg-white rounded border border-slate-200" />
                              <span>Ver</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Pendente</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Zoom Preview da Assinatura Digital */}
      {previewSignatureModal.open && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5 space-y-4 border border-slate-200 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-800 font-extrabold text-xs">
                <PenTool className="h-4 w-4 text-emerald-600" />
                <span>{previewSignatureModal.title || "Assinatura Digital Validadora"}</span>
              </div>
              <button
                onClick={() => setPreviewSignatureModal({ open: false })}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-center min-h-[140px]">
              {previewSignatureModal.url ? (
                <img
                  src={previewSignatureModal.url}
                  alt="Assinatura ampliada"
                  className="max-h-32 object-contain bg-white p-2 rounded-lg border border-slate-200 shadow-xs"
                />
              ) : (
                <span className="text-xs text-slate-400 italic">Assinatura não disponível</span>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setPreviewSignatureModal({ open: false })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
