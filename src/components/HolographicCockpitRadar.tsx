/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Users, 
  Gauge, 
  Fuel, 
  Truck, 
  ClipboardCheck, 
  AlertOctagon, 
  RotateCw, 
  Sparkles, 
  ChevronRight, 
  Maximize2, 
  Activity, 
  ShieldCheck, 
  ArrowUpRight,
  Zap,
  Info,
  CheckCircle2,
  Play,
  Pause
} from "lucide-react";
import { AppState } from "../types";

interface HolographicCockpitRadarProps {
  appState: AppState;
  onNavigate: (tab: string) => void;
}

export default function HolographicCockpitRadar({ appState, onNavigate }: HolographicCockpitRadarProps) {
  const { tanks = [], shifts = [], nozzles = [], qualityAudits = [] } = appState;

  // Active shift & metrics
  const activeShift = shifts.find((s) => s.status === "Em Andamento");
  const activeNozzlesCount = nozzles.filter(n => n.status === "Ativo" || n.status === "Livre" || !n.status).length;
  const totalNozzlesCount = nozzles.length || 12;
  const criticalTanks = tanks.filter(t => t.volumeAtual <= t.pontoCriticoAlerta);
  const totalFuelLiters = tanks.reduce((acc, t) => acc + t.volumeAtual, 0);
  const maxCapacityLiters = tanks.reduce((acc, t) => acc + t.capacidadeMaxima, 0) || 1;
  const fuelOverallPct = Math.min(100, Math.round((totalFuelLiters / maxCapacityLiters) * 100));

  // Active sector selection
  const [activeSector, setActiveSector] = useState<"equipe" | "bombas" | "tanques" | "descargas" | "checklists" | "ocorrencias">("tanques");
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(25);

  // Auto rotation and levitation effect
  const [tiltAngle, setTiltAngle] = useState<number>(55);
  const [rotationSpeed, setRotationSpeed] = useState<number>(0.8);
  const [levitationOffset, setLevitationOffset] = useState<number>(0);

  useEffect(() => {
    if (!isAutoRotating) return;
    let time = 0;
    const interval = setInterval(() => {
      time += 0.05;
      setRotationAngle((prev) => (prev + rotationSpeed) % 360);
      setLevitationOffset(Math.sin(time) * 8); // Levitation floating offset in pixels
    }, 40);
    return () => clearInterval(interval);
  }, [isAutoRotating, rotationSpeed]);

  // Sector Data mapping
  const sectors = [
    {
      id: "equipe" as const,
      name: "Equipe & Escala",
      color: "emerald",
      badgeColor: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
      ringColor: "#10b981",
      icon: Users,
      count: activeShift ? 1 : 0,
      metricText: activeShift ? `Responsável: ${activeShift.frentistaResponsavel}` : "Sem turno ativo",
      subtitle: activeShift ? `Turno: ${activeShift.turno}` : "Aguardando frentista",
      priority: activeShift ? "Normal" : "Atenção",
      targetTab: "escalas",
      angleOffset: 0
    },
    {
      id: "bombas" as const,
      name: "Bombas & Bicos",
      color: "cyan",
      badgeColor: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
      ringColor: "#06b6d4",
      icon: Gauge,
      count: activeNozzlesCount,
      metricText: `${activeNozzlesCount}/${totalNozzlesCount} bicos ativos`,
      subtitle: "Medição de encerrantes ok",
      priority: "Normal",
      targetTab: "bicos",
      angleOffset: 60
    },
    {
      id: "tanques" as const,
      name: "Tanques & Volume",
      color: "amber",
      badgeColor: "bg-amber-500/10 text-amber-300 border-amber-500/30",
      ringColor: "#e5c158",
      icon: Fuel,
      count: tanks.length,
      metricText: `${fuelOverallPct}% da capacidade total`,
      subtitle: `${totalFuelLiters.toLocaleString("pt-BR")} Litros estocados`,
      priority: criticalTanks.length > 0 ? "Crítico" : "Seguro",
      targetTab: "tanques",
      angleOffset: 120
    },
    {
      id: "descargas" as const,
      name: "Descargas ANP",
      color: "purple",
      badgeColor: "bg-purple-500/10 text-purple-400 border-purple-500/30",
      ringColor: "#a855f7",
      icon: Truck,
      count: qualityAudits.length,
      metricText: "2 notas fiscais prontas",
      subtitle: "Conferência de densidade ok",
      priority: "Normal",
      targetTab: "qualidade",
      angleOffset: 180
    },
    {
      id: "checklists" as const,
      name: "Checklists & EPIs",
      color: "orange",
      badgeColor: "bg-orange-500/10 text-orange-400 border-orange-500/30",
      ringColor: "#f97316",
      icon: ClipboardCheck,
      count: activeShift ? Object.values(activeShift.checklist).filter(v => v).length : 0,
      metricText: activeShift ? `${Object.values(activeShift.checklist).filter(v => v).length}/4 verificações` : "Pendente",
      subtitle: "Inspeção de segurança de pista",
      priority: activeShift ? "Em Dia" : "Pendente",
      targetTab: "escalas",
      angleOffset: 240
    },
    {
      id: "ocorrencias" as const,
      name: "Ocorrências & Caixa",
      color: "rose",
      badgeColor: "bg-rose-500/10 text-rose-400 border-rose-500/30",
      ringColor: "#f43f5e",
      icon: AlertOctagon,
      count: criticalTanks.length,
      metricText: criticalTanks.length > 0 ? `${criticalTanks.length} Alertas Ativos` : "Zero Falhas",
      subtitle: criticalTanks.length > 0 ? `${criticalTanks[0]?.combustivel} em nível crítico` : "Sistemas 100% estabilizados",
      priority: criticalTanks.length > 0 ? "Urgente" : "Ok",
      targetTab: "caixa",
      angleOffset: 300
    }
  ];

  const currentSectorData = sectors.find(s => s.id === activeSector) || sectors[2];

  return (
    <div className="bg-gradient-to-br from-[#161920] via-[#121418] to-[#0e1014] rounded-3xl p-5 sm:p-7 border border-slate-800 shadow-2xl relative overflow-hidden space-y-6">
      
      {/* Background Volumetric Glow & Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(229,193,88,0.08),transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f242d_1px,transparent_1px),linear-gradient(to_bottom,#1f242d_1px,transparent_1px)] bg-[size:2rem_2rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />

      {/* Cockpit Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 relative z-10 pb-4 border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-lg shadow-amber-500/20 font-black">
            <Activity className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-white font-display uppercase tracking-wide">
                Cockpit Operacional 360° • Radar Holográfico
              </h2>
              <span className="bg-amber-400/20 text-amber-300 border border-amber-400/40 text-[9px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                AO VIVO
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Visão espacial em tempo real do posto de combustíveis</p>
          </div>
        </div>

        {/* Rotation & Tilt Controls */}
        <div className="flex flex-wrap items-center gap-2 bg-[#0d0f12] p-1.5 rounded-2xl border border-slate-800">
          {/* Tilt selector */}
          <div className="flex items-center gap-1 px-2 py-1 bg-slate-900 rounded-xl border border-slate-800 text-[10px] text-slate-400 font-mono">
            <span>Inclinação:</span>
            {[
              { angle: 35, label: "35°" },
              { angle: 55, label: "55°" },
              { angle: 75, label: "75°" }
            ].map((t) => (
              <button
                key={t.angle}
                onClick={() => setTiltAngle(t.angle)}
                className={`px-1.5 py-0.5 rounded cursor-pointer font-bold transition ${
                  tiltAngle === t.angle ? "bg-amber-400 text-slate-950" : "hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Auto rotate toggle */}
          <button
            onClick={() => setIsAutoRotating(!isAutoRotating)}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              isAutoRotating 
                ? "bg-amber-400/20 text-amber-300 border border-amber-400/40" 
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            {isAutoRotating ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span>{isAutoRotating ? "Giro 3D" : "Pausado"}</span>
          </button>

          <button
            onClick={() => setRotationAngle((prev) => (prev + 45) % 360)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition cursor-pointer"
            title="Girar 45°"
          >
            <RotateCw className="h-4 w-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* COCKPIT MAIN CONTENT: RADAR CANVAS & SECTOR DISPLAY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10 py-2">
        
        {/* 3D RADAR HOLOGRAPHIC CONTAINER (LEFT / CENTER) */}
        <div className="lg:col-span-7 flex flex-col items-center justify-center relative min-h-[400px] sm:min-h-[460px]">
          
          {/* Hologram Pulse Base Concentric Rings */}
          <div className="absolute w-[300px] h-[300px] sm:w-[380px] sm:h-[380px] rounded-full border border-amber-400/20 animate-ping opacity-20 pointer-events-none" />
          <div className="absolute w-[250px] h-[250px] sm:w-[320px] sm:h-[320px] rounded-full border border-cyan-500/20 pointer-events-none" />
          <div className="absolute w-[190px] h-[190px] sm:w-[240px] sm:h-[240px] rounded-full border border-purple-500/20 pointer-events-none" />

          {/* Laser Scanner Line Rotation Effect */}
          <div 
            className="absolute w-[280px] h-[280px] sm:w-[350px] sm:h-[350px] rounded-full pointer-events-none opacity-40"
            style={{
              background: `conic-gradient(from ${rotationAngle * 2}deg, rgba(229,193,88,0.3) 0deg, transparent 60deg, transparent 360deg)`
            }}
          />

          {/* Projector Base Ring Emitter */}
          <div className="absolute w-44 h-44 sm:w-56 sm:h-56 rounded-full border-2 border-dashed border-amber-400/40 bg-amber-500/5 shadow-[0_0_30px_rgba(229,193,88,0.2)] animate-spin opacity-50 pointer-events-none" style={{ animationDuration: "20s" }} />

          {/* 3D ISOMETRIC MINIATURE FUEL POST HOLOGRAM */}
          <div 
            className="relative w-72 h-72 sm:w-96 sm:h-96 flex items-center justify-center transition-transform duration-300 ease-out"
            style={{
              transform: `perspective(1000px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) translateY(${levitationOffset}px)`,
              transformStyle: "preserve-3d"
            }}
          >
            {/* Ground Plate Hologram (Base Flutuante do Posto) */}
            <div 
              className="absolute inset-2 bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-cyan-500/10 rounded-3xl border-2 border-amber-400/40 shadow-[0_0_60px_rgba(229,193,88,0.3)] flex flex-col items-center justify-center relative overflow-hidden backdrop-blur-md"
              style={{ transformStyle: "preserve-3d" }}
            >
              
              {/* Ground Grid lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5c15815_1px,transparent_1px),linear-gradient(to_bottom,#e5c15815_1px,transparent_1px)] bg-[size:1.5rem_1.5rem] pointer-events-none" />

              {/* 4 Corner Pylons with Laser Beacons */}
              {[
                "top-2 left-2",
                "top-2 right-2",
                "bottom-2 left-2",
                "bottom-2 right-2"
              ].map((pos, idx) => (
                <div key={idx} className={`absolute ${pos} w-3 h-3 bg-slate-950 border border-amber-400 rounded-sm flex items-center justify-center shadow-[0_0_10px_#e5c158]`}>
                  <div className="w-1.5 h-1.5 bg-amber-300 rounded-full animate-ping" />
                </div>
              ))}

              {/* CANOPY STRUCTURE (Cobertura de Pista com Colunas 3D) */}
              <div 
                className="w-56 h-40 bg-gradient-to-br from-slate-900/90 via-[#181d28]/95 to-amber-950/40 rounded-2xl border-2 border-amber-400/60 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col items-center justify-between p-3 relative group"
                style={{ transform: "translateZ(50px)", transformStyle: "preserve-3d" }}
              >
                {/* Roof Brand Sign & Glowing Edge */}
                <div className="w-full bg-slate-950/90 border border-amber-400/50 rounded-xl py-1 px-3 flex items-center justify-between shadow-lg">
                  <span className="text-[9px] font-black tracking-widest text-amber-300 uppercase font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    MEU POSTO NEXT
                  </span>
                  <span className="text-[8px] font-mono text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-400/30">
                    ANP OK
                  </span>
                </div>
                
                {/* PUMP ISLANDS & PUMPS (4 Bombas de Combustível com Ilhas) */}
                <div className="grid grid-cols-2 gap-5 w-full px-1 relative z-10">
                  {[
                    { id: "B01", label: "Gasolina", color: "border-cyan-400 text-cyan-300 bg-cyan-950/60" },
                    { id: "B02", label: "G. Aditivada", color: "border-emerald-400 text-emerald-300 bg-emerald-950/60" },
                    { id: "B03", label: "Etanol", color: "border-amber-400 text-amber-300 bg-amber-950/60" },
                    { id: "B04", label: "Diesel S10", color: "border-purple-400 text-purple-300 bg-purple-950/60" }
                  ].map((p, pIdx) => (
                    <div 
                      key={pIdx} 
                      className={`p-1.5 rounded-xl border ${p.color} backdrop-blur-md shadow-lg flex flex-col justify-between relative overflow-hidden`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[8px] font-mono font-black">{p.id}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      </div>
                      <div className="text-[7px] font-mono truncate text-slate-300 mt-0.5">
                        {p.label}
                      </div>
                      {/* Active Meter Simulation */}
                      <div className="mt-1 bg-slate-950 px-1 py-0.5 rounded text-[7px] font-mono text-emerald-400 flex justify-between border border-emerald-500/30">
                        <span>LITROS:</span>
                        <span className="font-bold">48.2L</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 4 Pillars connecting roof to ground (Colunas 3D da Cobertura) */}
                <div className="absolute -bottom-3 left-3 w-2.5 h-10 bg-gradient-to-b from-amber-400 to-slate-800 rounded-sm shadow-md" />
                <div className="absolute -bottom-3 right-3 w-2.5 h-10 bg-gradient-to-b from-amber-400 to-slate-800 rounded-sm shadow-md" />

                {/* MINIATURE VEHICLES AT THE PUMPS (Carros Abastecendo) */}
                <div className="absolute -left-7 top-10 bg-cyan-500/20 border border-cyan-400/80 rounded-lg px-2 py-1 flex items-center gap-1 shadow-lg backdrop-blur-md">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[7px] font-black text-cyan-200 uppercase font-mono">Carro 01 • Abastecendo</span>
                </div>

              </div>

              {/* MINIATURE FUEL TANKER TRUCK (Caminhão Tanque de Unloading) */}
              <div 
                className="absolute top-3 right-3 bg-gradient-to-r from-purple-900/90 to-slate-950 p-1.5 rounded-xl border border-purple-400/60 shadow-xl flex items-center gap-2"
                style={{ transform: "translateZ(25px)" }}
              >
                <Truck className="h-4 w-4 text-purple-300 shrink-0" />
                <div>
                  <div className="text-[8px] font-black text-purple-200 uppercase font-mono">Descarga Ativa</div>
                  <div className="text-[7px] text-purple-300 font-mono">S10 • 15.000 L</div>
                </div>
              </div>

              {/* UNDERGROUND STORAGE TANKS VAULT (Tanques Subterrâneos Holográficos em 3D) */}
              <div 
                className="absolute bottom-2 inset-x-4 bg-slate-950/95 border-2 border-amber-500/50 p-2 rounded-2xl shadow-[0_0_30px_rgba(229,193,88,0.25)] flex items-center justify-around"
                style={{ transform: "translateZ(-25px)" }}
              >
                {tanks.map((t, idx) => {
                  const fillPct = Math.min(100, Math.round((t.volumeAtual / t.capacidadeMaxima) * 100));
                  const isCrit = t.volumeAtual <= t.pontoCriticoAlerta;

                  return (
                    <div key={idx} className="flex flex-col items-center gap-1 group/tank cursor-pointer">
                      <div className="text-[7px] font-mono font-bold text-amber-300 bg-slate-900 px-1 py-0.5 rounded border border-amber-500/30">
                        {fillPct}%
                      </div>
                      
                      {/* Cylindrical 3D Tank */}
                      <div className="w-7 h-11 bg-slate-900 border-2 border-slate-700 rounded-lg relative overflow-hidden shadow-inner flex flex-col justify-end">
                        <div 
                          className={`w-full transition-all duration-1000 ${
                            isCrit 
                              ? "bg-gradient-to-t from-rose-600 via-rose-500 to-rose-400 animate-pulse" 
                              : "bg-gradient-to-t from-amber-600 via-amber-400 to-amber-300"
                          }`}
                          style={{ height: `${fillPct}%` }}
                        >
                          <div className="w-full h-1 bg-white/40 animate-pulse" />
                        </div>
                      </div>

                      <span className="text-[7px] font-mono text-slate-300 truncate max-w-[50px]">
                        {t.combustivel.split(" ")[0]}
                      </span>
                    </div>
                  );
                })}
              </div>

            </div>
          </div>

          {/* SURROUNDING 6 RADAR CIRCULAR SECTOR BUTTONS */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {sectors.map((sec, idx) => {
              const angleRad = ((sec.angleOffset + rotationAngle) * Math.PI) / 180;
              const radius = 140; // distance from center
              const x = Math.cos(angleRad) * radius;
              const y = Math.sin(angleRad) * radius;

              const isSelected = activeSector === sec.id;
              const IconComp = sec.icon;

              return (
                <button
                  key={sec.id}
                  onClick={() => {
                    setActiveSector(sec.id);
                    setIsAutoRotating(false);
                  }}
                  className={`absolute pointer-events-auto transition-all duration-300 cursor-pointer p-2.5 rounded-2xl border shadow-xl flex items-center gap-2 group ${
                    isSelected
                      ? "bg-amber-400 text-slate-950 border-white scale-110 shadow-[0_0_25px_rgba(229,193,88,0.6)] font-black z-30"
                      : "bg-[#16181f]/90 hover:bg-[#1f232d] text-slate-200 border-slate-800 hover:border-amber-400/50 backdrop-blur-md z-20"
                  }`}
                  style={{
                    transform: `translate(${x}px, ${y}px)`
                  }}
                >
                  <div className={`p-1.5 rounded-xl ${isSelected ? "bg-slate-950 text-amber-400" : "bg-slate-900 text-slate-300 group-hover:text-amber-400"}`}>
                    <IconComp className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-extrabold uppercase font-mono hidden sm:inline-block pr-1">
                    {sec.name.split(" ")[0]}
                  </span>
                </button>
              );
            })}
          </div>

        </div>

        {/* ACTIVE SECTOR DETAIL TELEMETRY CARD (RIGHT) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-[#121418] border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4 relative overflow-hidden">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <span className={`p-2 rounded-xl border ${currentSectorData.badgeColor}`}>
                  <currentSectorData.icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-white font-display uppercase tracking-wide">
                    {currentSectorData.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 font-mono">Telemetria de Campo ANP</span>
                </div>
              </div>

              <span className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-full border ${currentSectorData.badgeColor}`}>
                {currentSectorData.priority}
              </span>
            </div>

            {/* Sector Primary Metrics */}
            <div className="space-y-3">
              <div className="bg-[#0b0c0f] p-4 rounded-xl border border-slate-800/80 space-y-1">
                <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">
                  Status Operacional
                </span>
                <p className="text-base font-black text-white font-display">
                  {currentSectorData.metricText}
                </p>
                <p className="text-xs text-amber-400 font-mono">
                  {currentSectorData.subtitle}
                </p>
              </div>

              {/* Quick AI Insight for selected sector */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
                <Zap className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold text-amber-300">Recomendação IA:</strong>
                  {activeSector === "tanques" && " Mantenha a régua de medição atualizada antes do recebimento do caminhão tanque."}
                  {activeSector === "bombas" && " Faça a aferição com balde de 20L de manhã para evitar autuações ANP."}
                  {activeSector === "equipe" && " Certifique-se de que o responsável pelo turno registrou o ponto biométrico."}
                  {activeSector === "descargas" && " Verifique se o laudo de densidade e proveta coincide com a NF."}
                  {activeSector === "checklists" && " Os itens de segurança de pista devem ser validados a cada 6h."}
                  {activeSector === "ocorrencias" && " Registre eventuais diferenças de sangria de caixa no módulo financeiro."}
                </div>
              </div>
            </div>

            {/* Action Button */}
            <button
              onClick={() => onNavigate(currentSectorData.targetTab)}
              className="w-full py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-lg transition flex items-center justify-center gap-2 cursor-pointer uppercase tracking-wider"
            >
              <span>Abrir Módulo {currentSectorData.name}</span>
              <ArrowUpRight className="h-4 w-4" />
            </button>

          </div>
        </div>

      </div>

    </div>
  );
}
