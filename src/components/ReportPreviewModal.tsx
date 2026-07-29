import React, { useState } from "react";
import { X, Download, Eye, Settings2, FileText, Check, Upload, Image as ImageIcon } from "lucide-react";
import { AppState } from "../types";
import { ReportType, computeLitersMetrics } from "../utils/reportExporter";

interface ReportPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appState: AppState;
  onUpdateReportCustomization?: (customs: Partial<AppState>) => void;
  reportType: ReportType;
  selectedTypes?: ReportType[];
  onExportPDF: () => void;
  onExportCSV: () => void;
  title: string;
  subtitle?: string;
}

export default function ReportPreviewModal({
  isOpen,
  onClose,
  appState,
  onUpdateReportCustomization,
  reportType,
  selectedTypes,
  onExportPDF,
  onExportCSV,
  title,
  subtitle
}: ReportPreviewModalProps) {
  const [activeTab, setActiveTab] = useState<"preview" | "settings">("preview");

  // Form states for quick customizations inside the preview modal
  const [compName, setCompName] = useState(appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO");
  const [cnpj, setCnpj] = useState(appState.reportHeaderCnpj || "12.345.678/0001-99");
  const [address, setAddress] = useState(appState.reportHeaderAddress || "Av. Brasil, 1500 - Centro, São José dos Campos - SP");
  const [logo, setLogo] = useState(appState.reportHeaderLogo || "");
  const [sigName, setSigName] = useState(appState.reportSignatureName || "Carlos Eduardo de Oliveira");
  const [sigRole, setSigRole] = useState(appState.reportSignatureRole || "Gerente Geral / Representante Legal");
  const [sigEnabled, setSigEnabled] = useState(appState.reportSignatureEnabled ?? true);
  const [sigBase64, setSigBase64] = useState(appState.reportSignatureBase64 || "");

  const [hasChanges, setHasChanges] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const b64 = event.target?.result as string;
      setLogo(b64);
      setHasChanges(true);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveChanges = () => {
    if (onUpdateReportCustomization) {
      onUpdateReportCustomization({
        reportHeaderCompanyName: compName,
        reportHeaderCnpj: cnpj,
        reportHeaderAddress: address,
        reportHeaderLogo: logo,
        reportSignatureName: sigName,
        reportSignatureRole: sigRole,
        reportSignatureEnabled: sigEnabled,
        reportSignatureBase64: sigBase64,
      });
      setHasChanges(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    }
  };

  // Theme color styling based on report type
  const getThemeColors = () => {
    switch (reportType) {
      case "lmc":
      case "financial":
        return {
          primary: "bg-emerald-600 hover:bg-emerald-500",
          border: "border-emerald-500",
          text: "text-emerald-600",
          lightBg: "bg-emerald-50",
          lineColor: "bg-emerald-500",
          accentText: "text-emerald-700",
        };
      case "anp":
      case "afericao":
        return {
          primary: "bg-slate-900 hover:bg-slate-800",
          border: "border-slate-900",
          text: "text-slate-900",
          lightBg: "bg-slate-100",
          lineColor: "bg-slate-900",
          accentText: "text-slate-800",
        };
      case "litrage":
        return {
          primary: "bg-indigo-600 hover:bg-indigo-500",
          border: "border-indigo-500",
          text: "text-indigo-600",
          lightBg: "bg-indigo-50",
          lineColor: "bg-indigo-500",
          accentText: "text-indigo-700",
        };
      case "consolidated":
      default:
        return {
          primary: "bg-blue-600 hover:bg-blue-500",
          border: "border-blue-500",
          text: "text-blue-600",
          lightBg: "bg-blue-50",
          lineColor: "bg-blue-600",
          accentText: "text-blue-700",
        };
    }
  };

  const colors = getThemeColors();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <span className={`p-1 rounded ${colors.lightBg} ${colors.text}`}>
                <FileText className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-slate-900">Pré-visualização do Relatório</h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verifique a formatação do cabeçalho e da assinatura antes de efetuar a exportação final.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-100/50 grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Left Column: Form Adjustments or Instructions */}
          <div className="lg:col-span-5 flex flex-col gap-4">
            
            {/* Tab selection */}
            <div className="flex bg-slate-200/60 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab("preview")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "preview" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Eye className="h-3.5 w-3.5" />
                Estrutura do Layout
              </button>
              <button
                onClick={() => setActiveTab("settings")}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeTab === "settings" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-950"
                }`}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Ajustar Cabeçalho & Assinatura
              </button>
            </div>

            {activeTab === "preview" ? (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4 shadow-xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Instruções de Conformidade</h3>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Este assistente gera relatórios alinhados com os padrões regulatórios de combustíveis da ANP e auditorias gerenciais.
                  </p>
                </div>

                <div className="border-t border-slate-100 pt-3">
                  <h4 className="text-xs font-bold text-slate-700">Verificação de Elementos:</h4>
                  <ul className="text-xs text-slate-600 mt-1.5 space-y-2">
                    <li className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${logo ? "bg-emerald-500" : "bg-amber-400"}`}></span>
                      <span>Logo da Empresa: <strong>{logo ? "Configurada" : "Ausente (Usará Texto)"}</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      <span>Dados do Cabeçalho: <strong>Definidos</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${sigEnabled ? "bg-emerald-500" : "bg-slate-300"}`}></span>
                      <span>Assinatura Digital: <strong>{sigEnabled ? "Habilitada" : "Desabilitada"}</strong></span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${sigBase64 ? "bg-emerald-500" : "bg-amber-400"}`}></span>
                      <span>Assinatura Digitalizada: <strong>{sigBase64 ? "Carregada" : "Sem Imagem (Somente Nome)"}</strong></span>
                    </li>
                  </ul>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-800">
                  <h5 className="text-[11px] font-bold">Dica de Produtividade</h5>
                  <p className="text-[10.5px] mt-0.5 leading-relaxed">
                    Você pode alterar os dados temporariamente ou salvá-los permanentemente no sistema usando a aba de ajuste ao lado.
                  </p>
                </div>

                <div className="mt-2 flex flex-col gap-2">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Ações Rápidas:</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={onExportPDF}
                      className={`py-2 px-3 text-white text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer ${colors.primary}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      Baixar PDF
                    </button>
                    <button
                      onClick={onExportCSV}
                      className="py-2 px-3 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                    >
                      <Download className="h-3.5 w-3.5 text-emerald-600" />
                      Planilha (CSV)
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-3 shadow-xs max-h-[550px] overflow-y-auto">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Edição Rápida</h3>
                  <p className="text-[11px] text-slate-500">As alterações aplicam-se ao documento em tempo real.</p>
                </div>

                {/* Company Name */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">Razão Social / Nome Fantasia</label>
                  <input
                    type="text"
                    value={compName}
                    onChange={(e) => { setCompName(e.target.value); setHasChanges(true); }}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="MEU POSTO LTDA"
                  />
                </div>

                {/* CNPJ */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => { setCnpj(e.target.value); setHasChanges(true); }}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                    placeholder="12.345.678/0001-99"
                  />
                </div>

                {/* Address */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">Endereço Completo</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => { setAddress(e.target.value); setHasChanges(true); }}
                    className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium"
                    placeholder="Av. Principal, 100"
                  />
                </div>

                {/* Logo Image Upload */}
                <div>
                  <label className="block text-[10.5px] font-bold text-slate-700 uppercase tracking-wider mb-1">Logo da Empresa</label>
                  <div className="flex items-center gap-3">
                    {logo ? (
                      <div className="relative border border-slate-200 p-1 rounded-lg bg-slate-50 h-10 w-10 flex items-center justify-center">
                        <img src={logo} alt="Logo" className="max-h-8 max-w-8 object-contain" referrerPolicy="no-referrer" />
                        <button
                          type="button"
                          onClick={() => { setLogo(""); setHasChanges(true); }}
                          className="absolute -top-1.5 -right-1.5 h-4.5 w-4.5 bg-red-500 hover:bg-red-600 rounded-full text-white flex items-center justify-center text-[8px]"
                          title="Remover Logo"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed border-slate-200 rounded-lg h-10 w-10 flex items-center justify-center text-slate-400 bg-slate-50">
                        <ImageIcon className="h-5 w-5" />
                      </div>
                    )}
                    <label className="flex-1 py-1.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-[11px] rounded-lg cursor-pointer text-center transition">
                      Alterar Logo
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>

                {/* Signature Config */}
                <div className="border-t border-slate-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10.5px] font-bold text-slate-700 uppercase tracking-wider">Habilitar Assinatura</span>
                    <input
                      type="checkbox"
                      checked={sigEnabled}
                      onChange={(e) => { setSigEnabled(e.target.checked); setHasChanges(true); }}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
                    />
                  </div>

                  {sigEnabled && (
                    <div className="space-y-2.5">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nome do Signatário</label>
                        <input
                          type="text"
                          value={sigName}
                          onChange={(e) => { setSigName(e.target.value); setHasChanges(true); }}
                          className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Nome do Responsável"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cargo / Função</label>
                        <input
                          type="text"
                          value={sigRole}
                          onChange={(e) => { setSigRole(e.target.value); setHasChanges(true); }}
                          className="w-full text-xs px-3 py-1.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          placeholder="Cargo ou Função"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button
                    onClick={handleSaveChanges}
                    disabled={!hasChanges}
                    className={`w-full py-2 px-3 text-xs font-bold rounded-lg transition text-center ${
                      hasChanges
                        ? "bg-slate-900 text-white hover:bg-slate-800 cursor-pointer shadow-sm"
                        : "bg-slate-100 text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    Salvar no Sistema
                  </button>

                  {saveSuccess && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 flex items-center gap-1.5 text-[10.5px] text-emerald-800">
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Configurações salvas permanentemente!</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Visual Mockup (A4 representation) */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <span className="text-[11px] text-slate-400 font-bold mb-1.5 uppercase tracking-widest">Modelo do Documento Final (A4)</span>
            
            <div className="w-full max-w-[480px] aspect-[1/1.4] bg-white border border-slate-300 rounded-sm shadow-lg p-5 flex flex-col justify-between select-none relative overflow-hidden">
              
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-[6px] ${colors.lineColor}`}></div>

              {/* Header Box */}
              <div>
                <div className="flex items-start justify-between border-b border-slate-100 pb-2 mb-3">
                  <div className="flex items-center gap-2.5 max-w-[70%]">
                    {logo ? (
                      <img src={logo} alt="Header Logo" className="h-8 w-8 object-contain rounded-xs" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-8 w-8 rounded bg-slate-100 flex items-center justify-center text-slate-500 text-xs font-bold">
                        {compName.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="leading-tight">
                      <h4 className="text-[10px] font-bold text-slate-900 truncate uppercase">{compName}</h4>
                      <p className="text-[8px] text-slate-500 font-mono mt-0.5">CNPJ: {cnpj}</p>
                      {address && <p className="text-[7px] text-slate-400 truncate mt-0.5">{address}</p>}
                    </div>
                  </div>
                  <div className="text-right leading-tight max-w-[30%]">
                    <span className={`inline-block text-[6.5px] px-1 py-0.5 rounded font-extrabold uppercase ${colors.lightBg} ${colors.accentText}`}>
                      {reportType.toUpperCase()}
                    </span>
                    <p className="text-[7px] text-slate-500 font-bold mt-1">EMISSÃO DIÁRIA</p>
                    <p className="text-[6.5px] text-slate-400 font-medium">{new Date().toLocaleDateString("pt-BR")}</p>
                  </div>
                </div>

                {/* Subtitle / Report Title Banner */}
                <div className="bg-slate-50 border border-slate-100 p-2 rounded text-center mb-3">
                  <h5 className="text-[9px] font-extrabold text-slate-800 uppercase tracking-wide">
                    {title}
                  </h5>
                  {subtitle && <p className="text-[7.5px] text-slate-500 mt-0.5 italic">{subtitle}</p>}
                </div>

                {/* Dummy Mockup Data based on Report Type */}
                <div className="space-y-2 mt-4">
                  {reportType === "financial" && (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-slate-50/80 border border-slate-100 p-1.5 rounded text-center">
                          <p className="text-[6px] text-slate-400 font-bold uppercase">Faturamento</p>
                          <p className="text-[9px] font-extrabold text-emerald-600">R$ 48.250,00</p>
                        </div>
                        <div className="bg-slate-50/80 border border-slate-100 p-1.5 rounded text-center">
                          <p className="text-[6px] text-slate-400 font-bold uppercase">Despesas</p>
                          <p className="text-[9px] font-extrabold text-rose-600">R$ 12.140,00</p>
                        </div>
                        <div className="bg-slate-50/80 border border-slate-100 p-1.5 rounded text-center">
                          <p className="text-[6px] text-slate-400 font-bold uppercase">Rend. Líquido</p>
                          <p className="text-[9px] font-extrabold text-indigo-600">R$ 36.110,00</p>
                        </div>
                      </div>
                      <div className="border border-slate-100 rounded overflow-hidden mt-3">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Categoria</th>
                              <th className="p-1">Part. %</th>
                              <th className="p-1 text-right">Valor</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-medium">Vendas de Combustíveis</td>
                              <td className="p-1">72%</td>
                              <td className="p-1 text-right">R$ 34.740,00</td>
                            </tr>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-medium">Loja de Conveniência</td>
                              <td className="p-1">18%</td>
                              <td className="p-1 text-right">R$ 8.685,00</td>
                            </tr>
                            <tr className="text-[6px] text-slate-500">
                              <td className="p-1 font-medium">Serviços Gerais pista</td>
                              <td className="p-1">10%</td>
                              <td className="p-1 text-right">R$ 4.825,00</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {reportType === "afericao" && (
                    <>
                      <div className="bg-slate-50 p-1.5 rounded flex justify-between items-center text-[7px] border border-slate-100">
                        <span className="font-bold text-slate-700">Equipamento de Teste:</span>
                        <span className="text-slate-500">Balde de Ensaio Volumétrico 20L Calibrado (Inmetro)</span>
                      </div>
                      <div className="border border-slate-100 rounded overflow-hidden mt-2">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Bico</th>
                              <th className="p-1">Combustível</th>
                              <th className="p-1 text-center">Desvio (mL)</th>
                              <th className="p-1 text-right">Laudo Geral</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Bico 01</td>
                              <td className="p-1">Gasolina Comum</td>
                              <td className="p-1 text-center text-emerald-600">+10 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">APROVADO</td>
                            </tr>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Bico 02</td>
                              <td className="p-1">Etanol Comum</td>
                              <td className="p-1 text-center text-rose-500">-25 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">APROVADO</td>
                            </tr>
                            <tr className="text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Bico 03</td>
                              <td className="p-1">Diesel S10</td>
                              <td className="p-1 text-center text-emerald-600">0 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">APROVADO</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {reportType === "anp" && (
                    <>
                      <div className="bg-slate-50 p-1.5 rounded flex justify-between items-center text-[7px] border border-slate-100">
                        <span className="font-bold text-slate-700">Responsável Químico:</span>
                        <span className="text-slate-500">Dr. Roberto Mendes CRQ-IV SP</span>
                      </div>
                      <div className="border border-slate-100 rounded overflow-hidden mt-2">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Bico</th>
                              <th className="p-1">Combustível</th>
                              <th className="p-1 text-center">Desvio</th>
                              <th className="p-1 text-right">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1">Bico 01</td>
                              <td className="p-1">Gasolina Comum</td>
                              <td className="p-1 text-center text-rose-500">-15 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">CONFORME</td>
                            </tr>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1">Bico 02</td>
                              <td className="p-1">Etanol Comum</td>
                              <td className="p-1 text-center text-emerald-600">+5 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">CONFORME</td>
                            </tr>
                            <tr className="text-[6px] text-slate-500">
                              <td className="p-1">Bico 03</td>
                              <td className="p-1">Diesel S10</td>
                              <td className="p-1 text-center text-emerald-600">0 mL</td>
                              <td className="p-1 text-right text-emerald-600 font-bold">CONFORME</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {reportType === "lmc" && (
                    <>
                      <div className="border border-slate-100 rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Produto</th>
                              <th className="p-1">Abertura</th>
                              <th className="p-1">Vendas</th>
                              <th className="p-1 text-right">Físico</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Gasolina C.</td>
                              <td className="p-1">15.420 L</td>
                              <td className="p-1">2.340 L</td>
                              <td className="p-1 text-right">13.080 L</td>
                            </tr>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Etanol Comum</td>
                              <td className="p-1">9.800 L</td>
                              <td className="p-1">1.120 L</td>
                              <td className="p-1 text-right">8.680 L</td>
                            </tr>
                            <tr className="text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Diesel S10</td>
                              <td className="p-1">22.400 L</td>
                              <td className="p-1">4.200 L</td>
                              <td className="p-1 text-right">18.200 L</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {reportType === "litrage" && (
                    <>
                      <div className="border border-slate-100 rounded overflow-hidden">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Combustível</th>
                              <th className="p-1 text-center">Est. Teórico</th>
                              <th className="p-1 text-center">Est. Medido</th>
                              <th className="p-1 text-right">Diferença (L)</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr className="border-b border-slate-50 text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Gasolina Aditivada</td>
                              <td className="p-1 text-center">8.245 L</td>
                              <td className="p-1 text-center">8.232 L</td>
                              <td className="p-1 text-right text-rose-500">-13 L (-0.15%)</td>
                            </tr>
                            <tr className="text-[6px] text-slate-500">
                              <td className="p-1 font-bold">Diesel S500</td>
                              <td className="p-1 text-center">12.450 L</td>
                              <td className="p-1 text-center">12.455 L</td>
                              <td className="p-1 text-right text-emerald-600">+5 L (+0.04%)</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {(reportType === "deliveries" || reportType === "consolidated") && (
                    <>
                      <div className="border border-slate-100 rounded overflow-hidden mt-2">
                        <div className="bg-slate-100 px-2 py-1 font-bold text-[7px] text-slate-700 uppercase">
                          Descarregamentos de Combustível (Entregas NF-e)
                        </div>
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-slate-50 text-[6.5px] font-bold text-slate-600 border-b border-slate-100">
                              <th className="p-1">Data</th>
                              <th className="p-1">NF-e</th>
                              <th className="p-1">Combustível</th>
                              <th className="p-1 text-right">Vol. Recebido</th>
                              <th className="p-1 text-center">Placa</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(appState.deliveries && appState.deliveries.length > 0) ? (
                              appState.deliveries.slice(0, 5).map((d) => (
                                <tr key={d.id} className="border-b border-slate-50 text-[6px] text-slate-500">
                                  <td className="p-1 font-bold">{(d.data || d.date || "-").split("-").reverse().join("/")}</td>
                                  <td className="p-1 font-mono">{d.nfe || d.invoiceNumber || "-"}</td>
                                  <td className="p-1 font-bold text-slate-700">{d.combustivel || d.fuelType || "Gasolina"}</td>
                                  <td className="p-1 text-right font-bold text-emerald-700">{(Number(d.volumeRecebido || d.volume) || 0).toLocaleString("pt-BR")} L</td>
                                  <td className="p-1 text-center uppercase">{d.placaCaminhao || d.truckPlate || "-"}</td>
                                </tr>
                              ))
                            ) : (
                              <tr className="text-[6px] text-slate-400 italic">
                                <td colSpan={5} className="p-1 text-center font-normal py-2">Nenhum descarregamento registrado.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  {(reportType === "dre" || reportType === "consolidated") && (() => {
                    const dates = (appState.lmc || []).map((r) => r.date).sort();
                    const minDate = dates.length > 0 ? dates[0].substring(0, 10) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10);
                    const maxDate = dates.length > 0 ? dates[dates.length - 1].substring(0, 10) : new Date().toISOString().substring(0, 10);
                    const m = computeLitersMetrics(appState, minDate, maxDate);

                    return (
                      <div className="border border-slate-100 rounded overflow-hidden mt-2">
                        <div className="bg-slate-800 text-white px-2 py-1 font-bold text-[7px] uppercase flex justify-between">
                          <span>Demonstrativo de Resultado de Litragem (DRE de Litragem)</span>
                          <span>Margem Média: R$ {m.averageMarginPerLiter.toFixed(2)}/L</span>
                        </div>
                        <table className="w-full text-left border-collapse text-[5.5px]">
                          <tbody>
                            {/* Section 1 */}
                            <tr className="bg-slate-100 font-bold border-b border-slate-200">
                              <td className="p-1">1. VOLUME DE VENDAS E FATURAMENTO BRUTO</td>
                              <td className="p-1 text-right">{m.totalLitersSold.toLocaleString("pt-BR")} L</td>
                              <td className="p-1 text-right text-emerald-700 font-bold">R$ {m.totalFaturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-1 text-right font-normal">100.0%</td>
                            </tr>
                            {m.byFuel.slice(0, 3).map((f) => {
                              const pct = m.totalLitersSold > 0 ? (f.litersSold / m.totalLitersSold) * 100 : 0;
                              return (
                                <tr key={`f-${f.fuel}`} className="border-b border-slate-50 text-slate-500">
                                  <td className="p-1 pl-3">Venda - {f.fuel}</td>
                                  <td className="p-1 text-right">{f.litersSold.toLocaleString("pt-BR")} L</td>
                                  <td className="p-1 text-right">R$ {f.faturamento.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right">{pct.toFixed(1)}%</td>
                                </tr>
                              );
                            })}

                            {/* Section 2 */}
                            <tr className="bg-rose-50/50 font-bold border-b border-slate-200 text-rose-950">
                              <td className="p-1">2. CUSTO DE AQUISIÇÃO DAS MERCADORIAS (CMV)</td>
                              <td className="p-1 text-right">{m.totalLitersSold.toLocaleString("pt-BR")} L</td>
                              <td className="p-1 text-right text-rose-700 font-bold">R$ {m.totalCusto.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-1 text-right font-normal">{m.totalFaturamento > 0 ? ((m.totalCusto/m.totalFaturamento)*100).toFixed(1) : 0}%</td>
                            </tr>
                            {m.byFuel.slice(0, 3).map((f) => {
                              const pct = m.totalFaturamento > 0 ? (f.custo / m.totalFaturamento) * 100 : 0;
                              return (
                                <tr key={`c-${f.fuel}`} className="border-b border-slate-50 text-slate-500">
                                  <td className="p-1 pl-3">CMV - {f.fuel}</td>
                                  <td className="p-1 text-right">{f.litersSold.toLocaleString("pt-BR")} L</td>
                                  <td className="p-1 text-right">R$ {f.custo.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                  <td className="p-1 text-right">{pct.toFixed(1)}%</td>
                                </tr>
                              );
                            })}

                            {/* Section 3 */}
                            <tr className="bg-emerald-50 font-bold text-emerald-950 border-b border-emerald-100">
                              <td className="p-1">3. APURAÇÃO DA MARGEM DE CONTRIBUIÇÃO</td>
                              <td className="p-1 text-right">{m.totalLitersSold.toLocaleString("pt-BR")} L</td>
                              <td className="p-1 text-right text-emerald-700 font-bold">R$ {m.totalMargem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                              <td className="p-1 text-right text-[6px]">{m.totalFaturamento > 0 ? ((m.totalMargem/m.totalFaturamento)*100).toFixed(1) : 0}%</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Bottom Signature & Footer Box */}
              <div>
                {sigEnabled && (
                  <div className="flex flex-col items-center mt-5">
                    
                    {/* Signature Image or Placeholder box */}
                    {sigBase64 ? (
                      <div className="h-8 max-w-[120px] flex items-center justify-center overflow-hidden mb-1">
                        <img src={sigBase64} alt="Digital Signature" className="max-h-8 max-w-[120px] object-contain" referrerPolicy="no-referrer" />
                      </div>
                    ) : (
                      <div className="h-8 w-32 border border-dashed border-slate-200 flex items-center justify-center rounded text-[6px] text-slate-300 italic mb-1">
                        Assinatura Sem Imagem
                      </div>
                    )}

                    <div className="w-40 border-t border-slate-300"></div>
                    <p className="text-[8px] font-bold text-slate-700 mt-1 uppercase text-center truncate w-48">{sigName}</p>
                    <p className="text-[6.5px] text-slate-400 font-medium text-center truncate w-48">{sigRole}</p>
                  </div>
                )}

                {/* Micro footer line */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 mt-4 text-[6px] text-slate-400 font-medium">
                  <span>Gerado via Meu Posto ERP</span>
                  <span>Página 1 de 1</span>
                </div>
              </div>

            </div>
          </div>

        </div>

        {/* Modal Footer Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition cursor-pointer"
          >
            Fechar Janela
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onExportCSV}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <Download className="h-3.5 w-3.5 text-emerald-600" />
              Exportar Planilha (CSV)
            </button>
            <button
              onClick={onExportPDF}
              className={`px-4 py-2 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-md cursor-pointer ${colors.primary}`}
            >
              <Download className="h-3.5 w-3.5" />
              Confirmar & Exportar PDF
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
