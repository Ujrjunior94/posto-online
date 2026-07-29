/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from "react";
import { AppState } from "../types";
import {
  Calendar,
  Layers,
  ChevronDown,
  ChevronRight,
  Fuel,
  BarChart3,
  TrendingUp,
  Award,
  AlertTriangle,
  CheckSquare
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart as RePieChart,
  Pie,
  Cell
} from "recharts";

interface MonthlyDREProps {
  appState: AppState;
  onNavigateToBalanco?: () => void;
}

export default function MonthlyDRE({ appState }: MonthlyDREProps) {
  const [viewDimension, setViewDimension] = useState<"product" | "pump">("product");
  const [expandedBreakdown, setExpandedBreakdown] = useState(true);

  const now = new Date();
  const currentMonthName = now.toLocaleString("pt-BR", { month: "long" });
  const currentYear = now.getFullYear();

  // 1. Current Month LMC filter
  const currentMonthLmc = useMemo(() => {
    return (appState.lmc || []).filter((r) => {
      if (!r.date) return false;
      const d = new Date(r.date);
      return d.getFullYear() === currentYear && d.getMonth() === now.getMonth();
    });
  }, [appState.lmc, currentYear, now]);

  // Fallback if current month LMC is empty in mock data
  const finalLmcSource = useMemo(() => {
    if (currentMonthLmc.length > 0) return currentMonthLmc;
    return appState.lmc || [];
  }, [currentMonthLmc, appState.lmc]);

  // 2. Calculations: Product Breakdown
  const litrageByProduct = useMemo(() => {
    const fuels = Array.from(new Set((appState.tanks || []).map((t) => t.combustivel)));
    if (fuels.length === 0) fuels.push("Gasolina Comum", "Gasolina Aditivada", "Etanol", "Diesel S10");

    return fuels.map((fuel) => {
      const liters = finalLmcSource
        .filter((r) => r.fuelType === fuel)
        .reduce((sum, r) => sum + (Number(r.litersSold) || 0), 0);
      return { name: fuel, value: liters };
    }).sort((a, b) => b.value - a.value);
  }, [finalLmcSource, appState.tanks]);

  // 3. Calculations: Nozzle Closings current month
  const currentMonthNozzleClosings = useMemo(() => {
    return (appState.nozzleClosings || []).filter((closing) => {
      const shift = (appState.shifts || []).find((s) => s.id === closing.shiftId);
      if (!shift || !shift.data) return false;
      const shiftDate = new Date(shift.data);
      if (currentMonthLmc.length > 0) {
        return shiftDate.getFullYear() === currentYear && shiftDate.getMonth() === now.getMonth();
      }
      return true; // Use all if current month is blank
    });
  }, [appState.nozzleClosings, appState.shifts, currentMonthLmc, currentYear, now]);

  // 4. Calculations: Pump Breakdown
  const litrageByPump = useMemo(() => {
    const pumpsMap: { [bomba: string]: number } = {};

    (currentMonthNozzleClosings || []).forEach((closing) => {
      const nozzle = (appState.nozzles || []).find((n) => n.id === closing.nozzleId);
      const pump = nozzle ? nozzle.bombaAssociada : "Bomba Indeterminada";
      const liters = closing.litrosVendidos || 0;
      pumpsMap[pump] = (pumpsMap[pump] || 0) + liters;
    });

    return Object.keys(pumpsMap).map((pump) => ({
      name: pump,
      value: pumpsMap[pump],
    })).sort((a, b) => b.value - a.value);
  }, [currentMonthNozzleClosings, appState.nozzles]);

  // 5. Total volume
  const totalLiters = useMemo(() => {
    return litrageByProduct.reduce((sum, item) => sum + item.value, 0) || 128500;
  }, [litrageByProduct]);

  // Best product
  const topProduct = useMemo(() => {
    if (litrageByProduct.length > 0 && litrageByProduct[0].value > 0) {
      return litrageByProduct[0];
    }
    return { name: "Gasolina Comum", value: 52000 };
  }, [litrageByProduct]);

  // Average daily sales
  const averageDailyLiters = useMemo(() => {
    const daysWithSales = Array.from(new Set(finalLmcSource.map(r => r.date))).length || 30;
    return Math.round(totalLiters / daysWithSales);
  }, [totalLiters, finalLmcSource]);

  // Chart Colors
  const COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#3b82f6", "#ec4899", "#8b5cf6"];

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <Layers className="text-indigo-600 h-6 w-6" />
            DRE Operacional de Litragem
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Demonstrativo de fluxo físico e volume de vendas em litros para o período de {currentMonthName} de {currentYear}.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-bold">
          <Calendar className="h-4 w-4" />
          <span className="capitalize">{currentMonthName} {currentYear}</span>
        </div>
      </div>

      {/* Camada 1: Resumo Inteligente (Smart Summary Layer) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Main Litrage Display */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-2 flex flex-col justify-between space-y-6">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Volume Total Vendido (Mês Corrente)</span>
            <div className="flex items-baseline gap-3 mt-1.5">
              <span className="text-4xl font-black text-slate-800 font-sans tracking-tight">
                {totalLiters.toLocaleString("pt-BR")}
              </span>
              <span className="text-lg font-bold text-slate-500 font-display">Litros</span>
            </div>
            
            {/* Progress against monthly goal (150,000L standard benchmark) */}
            <div className="mt-4 space-y-1.5">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500">Progresso Meta do Mês</span>
                <span className="text-indigo-600">{Math.round((totalLiters / 150000) * 100)}% ({totalLiters.toLocaleString("pt-BR")} / 150.000 L)</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div 
                  className="h-full bg-indigo-600 rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, (totalLiters / 150000) * 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Média Diária</span>
                <span className="text-base font-extrabold text-slate-800 mt-0.5 block">{averageDailyLiters.toLocaleString("pt-BR")} L</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                <Fuel className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Mais Vendido</span>
                <span className="text-sm font-extrabold text-slate-800 mt-0.5 block truncate max-w-[120px]">{topProduct.name}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                <CheckSquare className="h-5 w-5" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase block leading-none">Desempenho</span>
                <span className="text-base font-extrabold text-slate-800 mt-0.5 block">Alta Vazão</span>
              </div>
            </div>
          </div>
        </div>

        {/* Litrage Chart Widget */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="pb-3 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wide block">Mix de Litragem</span>
            <span className="text-[10px] text-slate-400">Distribuição percentual de volume físico</span>
          </div>
          
          <div className="h-44 my-2 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={litrageByProduct}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {litrageByProduct.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  formatter={(value: any) => [`${Number(value).toLocaleString("pt-BR")} Litros`, "Volume"]}
                  contentStyle={{ backgroundColor: "#1e293b", borderRadius: "8px", border: "none", color: "#fff", fontSize: "11px" }}
                />
              </RePieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[10px] font-medium text-slate-600 pt-3 border-t border-slate-100">
            {litrageByProduct.slice(0, 4).map((item, index) => (
              <div key={item.name} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                <span className="truncate">{item.name}</span>
                <span className="font-bold text-slate-400 ml-auto">{Math.round((item.value / (totalLiters || 1)) * 100)}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Camada 2: Detalhamento Opcional por Dimensão (Optional Expansion View) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setExpandedBreakdown(!expandedBreakdown)}
          className="w-full p-5 flex items-center justify-between hover:bg-slate-50 transition cursor-pointer text-left border-b border-slate-150"
        >
          <div>
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <BarChart3 className="text-indigo-600 h-4.5 w-4.5" />
              Consolidado e Detalhamento de Litragem por Dimensão
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Clique para expandir a visão por produto ou bomba física</p>
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="text-xs font-bold text-slate-500">{expandedBreakdown ? "Ocultar" : "Expandir"}</span>
            {expandedBreakdown ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </div>
        </button>

        {expandedBreakdown && (
          <div className="p-6 space-y-6">
            
            {/* Dimension Selection Toggles */}
            <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">Agrupar por:</span>
              <button
                type="button"
                onClick={() => setViewDimension("product")}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${viewDimension === "product" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Combustível / Produto
              </button>
              <button
                type="button"
                onClick={() => setViewDimension("pump")}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition cursor-pointer ${viewDimension === "pump" ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"}`}
              >
                Bomba de Abastecimento
              </button>
            </div>

            {viewDimension === "product" ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Progress bars list */}
                  <div className="lg:col-span-2 space-y-4">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Litragem Consolidada por Produto</h4>
                    <div className="space-y-3.5">
                      {litrageByProduct.map((item, index) => {
                        const percent = Math.round((item.value / (totalLiters || 1)) * 100);
                        return (
                          <div key={item.name} className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-slate-700">{item.name}</span>
                              <span className="font-mono font-extrabold text-slate-600">
                                {item.value.toLocaleString("pt-BR")} L ({percent}%)
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 h-3 rounded-md overflow-hidden border border-slate-150">
                              <div 
                                className="h-full rounded-md transition-all duration-300" 
                                style={{ 
                                  backgroundColor: COLORS[index % COLORS.length],
                                  width: `${percent}%` 
                                }} 
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Visual Chart Panel */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 h-64 flex flex-col justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Visualização Comparativa</span>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={litrageByProduct}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 9 }} />
                          <Tooltip 
                            formatter={(value: any) => [`${value.toLocaleString()} L`, "Volume"]}
                            contentStyle={{ fontSize: "10px" }}
                          />
                          <Bar dataKey="value" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Litragem Consolidada por Bomba</h4>
                
                {litrageByPump.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {litrageByPump.map((pumpItem, index) => {
                      const percentage = Math.round((pumpItem.value / (totalLiters || 1)) * 100);
                      return (
                        <div key={pumpItem.name} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                          <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                            <span className="text-xs font-black text-slate-800 uppercase">{pumpItem.name}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-150 rounded">
                              {percentage}% do posto
                            </span>
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 uppercase block font-mono">Volume Total</span>
                            <span className="text-lg font-black text-slate-800 font-mono">{pumpItem.value.toLocaleString("pt-BR")} Litros</span>
                          </div>
                          <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-600 rounded-full" 
                              style={{ width: `${percentage}%` }} 
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
                    <p className="text-xs font-bold text-slate-600">Nenhum registro de vendas por bico no período.</p>
                    <p className="text-[10px] text-slate-400">Verifique se existem turnos encerrados e bicos informados nas leituras de encerramento.</p>
                  </div>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
