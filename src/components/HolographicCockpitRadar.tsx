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

  // Helper function to render the coin face with accurate gradients, 3D shadows, bevels, and the metallic italic logo
  const renderCoinFace = (isFront: boolean, isEdge: boolean = false) => {
    // Generate unique gradient IDs based on the side to prevent SVG cache conflicts
    const idSuffix = isFront ? "front" : isEdge ? "edge" : "back";
    
    return (
      <svg viewBox="0 0 500 500" className={`w-full h-full ${isEdge ? "opacity-80" : "drop-shadow-[0_20px_35px_rgba(0,0,0,0.7)]"}`} style={{ backfaceVisibility: "hidden" }}>
        <defs>
          {/* Metallic silver outer border gradient with continuous reflections */}
          <linearGradient id={`silver-border-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="15%" stopColor="#cbd5e1" />
            <stop offset="30%" stopColor="#f8fafc" />
            <stop offset="45%" stopColor="#64748b" />
            <stop offset="60%" stopColor="#e2e8f0" />
            <stop offset="75%" stopColor="#475569" />
            <stop offset="90%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#ffffff" />
          </linearGradient>

          {/* Inner shiny bevel border gradient */}
          <linearGradient id={`inner-bevel-${idSuffix}`} x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#1e293b" />
          </linearGradient>

          {/* Outer rim glossiness overlay */}
          <radialGradient id={`rim-shine-${idSuffix}`} cx="50%" cy="50%" r="50%" fx="30%" fy="30%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.45"/>
            <stop offset="70%" stopColor="#0f172a" stopOpacity="0"/>
            <stop offset="100%" stopColor="#020617" stopOpacity="0.6"/>
          </radialGradient>

          {/* Deep blue metallic side brushed gradient */}
          <linearGradient id={`metal-blue-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e3a8a" />
            <stop offset="30%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#1d4ed8" />
            <stop offset="100%" stopColor="#172554" />
          </linearGradient>

          {/* Deep red metallic side brushed gradient */}
          <linearGradient id={`metal-red-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#881337" />
            <stop offset="35%" stopColor="#dc2626" />
            <stop offset="70%" stopColor="#9f1239" />
            <stop offset="100%" stopColor="#4c0519" />
          </linearGradient>

          {/* Silver/steel bevel gradient for central letter 'm' */}
          <linearGradient id={`m-metal-${idSuffix}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="30%" stopColor="#cbd5e1" />
            <stop offset="60%" stopColor="#475569" />
            <stop offset="85%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#f8fafc" />
          </linearGradient>

          {/* 3D Drop shadow filter for the center logo element */}
          <filter id={`m-shadow-${idSuffix}`} x="-15%" y="-15%" width="130%" height="130%">
            <feDropShadow dx="3" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.75" />
          </filter>
        </defs>

        {/* Outer Ring: Solid Polished Silver Metal rim */}
        <circle cx="250" cy="250" r="235" fill={`url(#silver-border-${idSuffix})`} stroke="#0f172a" strokeWidth="2.5" />
        
        {isEdge ? (
          /* Edge/Side view filling - Solid high-contrast metallic slate */
          <circle cx="250" cy="250" r="226" fill="#64748b" />
        ) : (
          <>
            {/* Center core: Blue/Red background divided by elegant diagonal white stripe */}
            <g clipPath={`url(#inner-clip-${idSuffix})`}>
              <clipPath id={`inner-clip-${idSuffix}`}>
                <circle cx="250" cy="250" r="224" />
              </clipPath>

              {/* Top-left deep blue metallic canvas */}
              <rect x="0" y="0" width="500" height="500" fill={`url(#metal-blue-${idSuffix})`} />

              {/* Bottom-right rich ruby red metallic canvas */}
              <path d="M -80 580 L 580 580 L 580 230 C 420 370, 160 120, -80 340 Z" fill={`url(#metal-red-${idSuffix})`} />

              {/* Sweeping white diagonal wave separator */}
              <path d="M -80 330 C 160 110, 420 360, 580 210 L 580 238 C 420 388, 160 138, -80 358 Z" fill="#ffffff" />
            </g>

            {/* Inner rim overlay for high-end glass glow, volume, and realistic coin reflections */}
            <circle cx="250" cy="250" r="224" fill={`url(#rim-shine-${idSuffix})`} pointerEvents="none" />
            <circle cx="250" cy="250" r="224" fill="none" stroke={`url(#inner-bevel-${idSuffix})`} strokeWidth="4" strokeOpacity="0.6" />

            {/* Centered stylized lowercase metallic 'm' with dynamic depth */}
            <g filter={`url(#m-shadow-${idSuffix})`} transform="translate(0, 4)">
              {/* This is a customized, highly stylized typographic italic 'm' representing the uploaded logo with extreme accuracy */}
              <path 
                d="M 125 350 
                   L 172 165 
                   C 176 150, 202 142, 222 142 
                   C 255 142, 272 160, 268 190 
                   C 285 158, 312 142, 342 142 
                   C 382 142, 402 170, 392 210 
                   L 358 350 
                   L 310 350 
                   L 340 220 
                   C 345 200, 335 192, 318 192 
                   C 298 192, 280 215, 274 240 
                   L 248 350 
                   L 200 350 
                   L 230 220 
                   C 235 200, 225 192, 208 192 
                   C 188 192, 170 215, 164 240 
                   L 138 350 
                   Z" 
                fill={`url(#m-metal-${idSuffix})`}
                stroke="#1e293b" 
                strokeWidth="2" 
              />
            </g>
          </>
        )}
      </svg>
    );
  };

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

          {/* 3D ROTATING COIN EMBLEM HOLOGRAM */}
          <div 
            className="relative w-64 h-64 sm:w-80 sm:h-80 flex items-center justify-center transition-transform duration-300 ease-out"
            style={{
              transform: `perspective(1000px) rotateX(${tiltAngle}deg) rotateZ(${rotationAngle}deg) translateY(${levitationOffset}px)`,
              transformStyle: "preserve-3d"
            }}
          >
            {/* 3D Stacked Coin (gives a real 3D depth/thickness of 10px) */}
            <div className="relative w-full h-full" style={{ transformStyle: "preserve-3d" }}>
              {/* Back Face */}
              <div 
                className="absolute inset-0"
                style={{ 
                  transform: "translateZ(-10px) rotateY(180deg)", 
                  backfaceVisibility: "hidden" 
                }}
              >
                {renderCoinFace(false, false)}
              </div>

              {/* Edge Layers (Middle Extrusion) */}
              {[...Array(10)].map((_, idx) => (
                <div 
                  key={idx}
                  className="absolute inset-0"
                  style={{ 
                    transform: `translateZ(${-idx}px)`,
                    backfaceVisibility: "hidden"
                  }}
                >
                  {renderCoinFace(false, true)}
                </div>
              ))}

              {/* Front Face */}
              <div 
                className="absolute inset-0"
                style={{ 
                  transform: "translateZ(0px)",
                  backfaceVisibility: "hidden" 
                }}
              >
                {renderCoinFace(true, false)}
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
                    {(sec.name || "").split(" ")[0]}
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
