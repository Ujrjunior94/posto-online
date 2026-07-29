/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { AppState, ActivityLog } from "../types";
import { History, Trash2, Search, Calendar, Filter, Sparkles } from "lucide-react";

interface AuditorLogProps {
  appState: AppState;
  cnpjPosto: string;
  onUpdateAudits: (audits: ActivityLog[]) => void;
  onClearData?: () => void;
}

export default function AuditorLog({ appState, cnpjPosto, onUpdateAudits, onClearData }: AuditorLogProps) {
  const { audits = [] } = appState;

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setActionFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleClearLogs = () => {
    if (onClearData) {
      onClearData();
    } else if (confirm("Tem certeza que deseja apagar todo o livro de auditoria do posto? Esta ação é irreversível.")) {
      onUpdateAudits([]);
    }
  };

  const filteredLogs = audits.filter((aud) => {
    const matchesCnpj = aud.stationCnpj === cnpjPosto;
    const matchesSearch =
      aud.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aud.operator.toLowerCase().includes(searchTerm.toLowerCase()) ||
      aud.target.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActionType = typeFilter === "all" || aud.actionType === typeFilter;
    const matchesStart = !startDate || aud.date >= startDate;
    const matchesEnd = !endDate || aud.date <= endDate;
    return matchesCnpj && matchesSearch && matchesActionType && matchesStart && matchesEnd;
  });

  const uniqueActionTypes = Array.from(new Set(audits.filter(a => a.stationCnpj === cnpjPosto).map((a) => a.actionType)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <History className="text-indigo-600 h-6 w-6" />
            Livro de Auditoria e Conformidade
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Histórico consolidado de todas as operações efetuadas por gerentes e frentistas no sistema
          </p>
        </div>
        <button
          onClick={handleClearLogs}
          disabled={filteredLogs.length === 0}
          className="px-4 py-2 bg-rose-50 border border-rose-100 hover:bg-rose-100/60 text-rose-700 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Limpar Todos os Logs
        </button>
      </div>

      {/* Filter Box */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-indigo-500" />
          Filtros de Auditoria
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400 h-4 w-4" />
            <input
              type="text"
              placeholder="Buscar por descrição ou operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div>
            <select
              value={typeFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 cursor-pointer"
            >
              <option value="all">Todos os Eventos</option>
              {uniqueActionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              placeholder="De"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
            />
          </div>

          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="Até"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
            />
          </div>
        </div>
      </div>

      {/* Main Timeline Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-800 mb-6 flex items-center gap-1.5">
          <History className="text-indigo-600 h-4 w-4" />
          Histórico Temporal de Atividades
        </h3>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs italic">
            Nenhum registro de auditoria encontrado para as condições especificadas.
          </div>
        ) : (
          <div className="space-y-6 relative border-l border-slate-200 pl-6 ml-4">
            {filteredLogs.map((log) => {
              const isLogin = log.actionType === "LOGIN";
              const isDelete = log.actionType === "DELETE" || log.actionType === "EXCLUSAO";
              const isUpdate = log.actionType === "UPDATE";
              const isCreate = log.actionType === "CREATE" || log.actionType === "CADASTRO";

              let dotColor = "bg-slate-400";
              if (isLogin) dotColor = "bg-indigo-500";
              else if (isDelete) dotColor = "bg-rose-500";
              else if (isUpdate) dotColor = "bg-amber-500";
              else if (isCreate) dotColor = "bg-emerald-500";

              return (
                <div key={log.id} className="relative group">
                  {/* Point of the timeline */}
                  <span className={`absolute -left-[31px] top-1.5 h-3.5 w-3.5 rounded-full ${dotColor} border-2 border-white ring-4 ring-indigo-50/20 group-hover:scale-110 transition duration-150`} />

                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black uppercase text-indigo-700 tracking-wider">
                        {log.actionType} • {log.target}
                      </span>
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                        log.complianceStatus === "Regular" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                      }`}>
                        {log.complianceStatus}
                      </span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {log.date.split("-").reverse().join("/")} às {log.time}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{log.details}</p>

                  <div className="mt-2 flex items-center gap-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador:</span>
                    <span className="text-[10px] bg-slate-100 border border-slate-200/50 text-slate-700 font-semibold px-2 py-0.5 rounded-full font-mono">
                      {log.operator}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
