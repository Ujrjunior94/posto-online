/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { User, AppState } from "../types";
import {
  Sparkles,
  Building2,
  Settings,
  Fuel,
  ClipboardList,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  X,
  ShieldCheck,
  Activity,
  AlertTriangle,
  Award,
  BookOpen,
  DollarSign
} from "lucide-react";

interface WelcomeOnboardingProps {
  currentUser: User;
  appState: AppState;
  onUpdateStationDetails: (nomePosto: string, cnpjPosto: string, securePassword?: string) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onClose: () => void;
}

export default function WelcomeOnboarding({
  currentUser,
  appState,
  onUpdateStationDetails,
  onAddAuditLog,
  onClose
}: WelcomeOnboardingProps) {
  const [step, setStep] = useState(1);
  const [stationName, setStationName] = useState(appState.nomePosto || "Meu Posto Estrela");
  const [cnpj, setCnpj] = useState(currentUser.cnpjPosto || "12.345.678/0001-99");
  const [password, setPassword] = useState(appState.securePassword || "adm001");
  const [error, setError] = useState("");

  const formatCnpj = (value: string) => {
    // Basic mask CNPJ: XX.XXX.XXX/XXXX-XX
    const cleanValue = value.replace(/\D/g, "");
    if (cleanValue.length <= 2) return cleanValue;
    if (cleanValue.length <= 5) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2)}`;
    if (cleanValue.length <= 8) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5)}`;
    if (cleanValue.length <= 12) return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8)}`;
    return `${cleanValue.slice(0, 2)}.${cleanValue.slice(2, 5)}.${cleanValue.slice(5, 8)}/${cleanValue.slice(8, 12)}-${cleanValue.slice(12, 14)}`;
  };

  const handleCnpjChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCnpj(e.target.value);
    setCnpj(formatted);
  };

  const handleNext = () => {
    setError("");
    if (step === 2) {
      if (!stationName.trim()) {
        setError("O nome do posto não pode ficar vazio.");
        return;
      }
      const cleanCnpj = cnpj.replace(/\D/g, "");
      if (cleanCnpj.length !== 14) {
        setError("O CNPJ deve conter exatamente 14 dígitos.");
        return;
      }
      if (!password || password.length < 4) {
        setError("A senha master de segurança deve ter pelo menos 4 caracteres.");
        return;
      }

      // Save configurations intermediate or final
      onUpdateStationDetails(stationName.trim(), cnpj, password);
      onAddAuditLog("UPDATE", "Configuração", `Configuração inicial realizada pelo assistente de Onboarding: ${stationName.trim()} (CNPJ: ${cnpj})`, "Regular");
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setError("");
    setStep((prev) => prev - 1);
  };

  const handleFinish = () => {
    // Persist finalized settings
    onUpdateStationDetails(stationName.trim(), cnpj, password);
    onAddAuditLog("CREATE", "Sistema", `Onboarding concluído com sucesso por ${currentUser.nomeCompleto}`, "Regular");
    
    // Save onboarding completed in local storage
    localStorage.setItem(`meu_posto_onboarding_completed_${currentUser.id}`, "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        id="onboarding-modal-card"
        className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-300 flex flex-col my-8"
      >
        {/* Banner Pattern background */}
        <div className="bg-gradient-to-r from-slate-900 to-[#0A192F] p-6 text-white relative shrink-0">
          <div className="absolute right-4 top-4 text-[#00B880]/15 pointer-events-none">
            <Building2 className="h-28 w-28 stroke-[1]" />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-[#00B880] flex items-center justify-center text-white font-bold shadow-lg shadow-[#00B880]/20 shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[10px] text-[#00B880] font-black uppercase tracking-widest block font-mono">
                Assistente de Boas-Vindas
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight font-display">
                Configurando o {stationName || "Seu Posto"}
              </h2>
            </div>
          </div>
          
          {/* Progress Indicators */}
          <div className="flex items-center gap-1.5 mt-6">
            {[1, 2, 3, 4].map((s) => (
              <div 
                key={s} 
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  s === step 
                    ? "w-10 bg-[#00B880]" 
                    : s < step 
                    ? "w-4 bg-[#00B880]/60" 
                    : "w-4 bg-slate-700"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="p-6 sm:p-8 flex-1 overflow-y-auto space-y-6">
          
          {/* STEP 1: WELCOME INTRO */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-800 font-display">
                  Olá, {currentUser.nomeCompleto.split(" ")[0]}! Seja muito bem-vindo ao Meu Posto ERP.
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Desenvolvemos este sistema para simplificar toda a rotina operacional e financeira do seu posto de combustíveis. 
                  Chega de planilhas complexas ou relatórios em papel. Aqui, você gerencia tudo de forma centralizada e sincronizada em tempo real.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">Operação Simplificada</h4>
                    <p className="text-[11px] text-slate-400">Escalas de trabalho, batimento de ponto digital e checklists de conformidade de pista.</p>
                  </div>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex items-start gap-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-slate-800">Conformidade e Regras</h4>
                    <p className="text-[11px] text-slate-400">Controles exigidos pela ANP, auditoria em tempo real e Livro de Movimentação de Combustíveis (LMC).</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-[#E8F7EE] border border-[#00B880]/30 rounded-2xl text-xs text-slate-600 leading-relaxed">
                <span className="font-bold text-[#00B880] block mb-1">💡 Modo Offline Integrado</span>
                Você pode utilizar o sistema mesmo sem conexão com a internet. Suas ações ficam salvas no navegador e são sincronizadas automaticamente com a nuvem assim que a conexão for restabelecida.
              </div>
            </div>
          )}

          {/* STEP 2: STATION INITIAL SETUP */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 font-display flex items-center gap-2">
                  <Settings className="text-[#00B880] h-5 w-5" />
                  Configuração Inicial do Posto
                </h3>
                <p className="text-xs text-slate-500">
                  Preencha as informações principais do seu estabelecimento. Elas serão exibidas nos relatórios, LMC e folhas de ponto dos funcionários.
                </p>
              </div>

              {error && (
                <div className="p-3 bg-rose-50 border border-rose-100 text-rose-800 text-xs font-bold rounded-xl flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                {/* Station Name */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">Nome Fantasia do Posto</label>
                  <input
                    type="text"
                    value={stationName}
                    onChange={(e) => setStationName(e.target.value)}
                    placeholder="Ex: Auto Posto Estrela Ltda"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                {/* CNPJ */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">CNPJ do Posto</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={handleCnpjChange}
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-mono font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>

                {/* Master Security Password */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-wide">Senha Master de Segurança</label>
                    <span className="text-[9px] text-[#00B880] font-bold">Usada para aprovar alterações críticas</span>
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres (Ex: adm001)"
                    className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-extrabold text-slate-800 outline-none focus:ring-1 focus:ring-emerald-500 shadow-2xs"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: MAIN FEATURES PRESENTATION */}
          {step === 3 && (
            <div className="space-y-5 animate-in fade-in duration-300">
              <div className="space-y-1">
                <h3 className="text-lg font-black text-slate-800 font-display flex items-center gap-2">
                  <Award className="text-[#00B880] h-5 w-5" />
                  Funcionalidades Principais
                </h3>
                <p className="text-xs text-slate-500">
                  Veja as principais ferramentas que você tem disponíveis a partir de agora na sua barra lateral:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[300px] overflow-y-auto pr-1">
                {/* Feature 1 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-3.5 items-start">
                  <div className="p-2.5 bg-sky-50 text-sky-600 rounded-xl border border-sky-100 shrink-0">
                    <Activity className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">Leitura de Bicos & Fechamentos</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Registro ágil dos encerrantes mecânicos ao fim de cada turno, calculando a litragem exata vendida.</p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-3.5 items-start">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100 shrink-0">
                    <ClipboardList className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">Escalas & Checklists</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Criação simplificada de turnos para os frentistas e checklists digitais de segurança na pista.</p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-3.5 items-start">
                  <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 shrink-0">
                    <DollarSign className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">Diferenças e Faltas de Caixa</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Cálculo e rateio automático inteligente de eventuais faltas ou sobras de caixa entre os escalados.</p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 flex gap-3.5 items-start">
                  <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 shrink-0">
                    <Fuel className="h-4.5 w-4.5" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-xs font-black text-slate-800">Controle de Tanques & LMC</h4>
                    <p className="text-[11px] text-slate-400 leading-relaxed">Acompanhamento de volume físico, recebimento de cargas e preenchimento automatizado do Livro LMC.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: CONCLUSION */}
          {step === 4 && (
            <div className="space-y-5 text-center py-4 animate-in fade-in duration-300">
              <div className="inline-flex p-4.5 bg-emerald-50 text-emerald-600 rounded-full border-2 border-emerald-200 animate-bounce mb-2">
                <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
              </div>

              <div className="space-y-2">
                <h3 className="text-xl font-black text-slate-800 font-display">
                  Tudo pronto para começar!
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  As configurações do <span className="font-extrabold text-slate-800">{stationName}</span> foram aplicadas com sucesso. 
                  Você já pode acessar o painel de bicos, criar sua primeira escala ou fazer o batimento de ponto.
                </p>
              </div>

              {/* Summary recap box */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left max-w-md mx-auto text-xs space-y-2">
                <span className="font-black text-slate-400 uppercase tracking-wider text-[9px] block">Resumo do Estabelecimento</span>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">Posto:</span>
                  <span className="font-black text-slate-700">{stationName}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100">
                  <span className="text-slate-400 font-bold">CNPJ cadastrado:</span>
                  <span className="font-mono font-bold text-slate-700">{cnpj}</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-400 font-bold">Senha de segurança:</span>
                  <span className="font-mono font-bold text-slate-700">•••••••• (adm001)</span>
                </div>
              </div>

              <p className="text-[10px] text-slate-400 italic">
                Você pode reajustar essas informações a qualquer momento em "Sistemas & Segurança" na barra lateral.
              </p>
            </div>
          )}

        </div>

        {/* Modal Actions Footer */}
        <div className="p-6 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          {/* Back button */}
          {step > 1 ? (
            <button
              onClick={handleBack}
              className="flex items-center gap-1.5 px-4.5 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-black transition cursor-pointer"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </button>
          ) : (
            <div />
          )}

          {/* Next or Finish button */}
          {step < 4 ? (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#00B880] hover:bg-[#05C480] text-white rounded-xl text-xs font-black transition cursor-pointer shadow-md shadow-[#00B880]/10 ml-auto"
            >
              Avançar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleFinish}
              className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition cursor-pointer shadow-lg shadow-indigo-100 ml-auto uppercase tracking-wider"
            >
              Iniciar Operação
              <CheckCircle2 className="h-4.5 w-4.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
