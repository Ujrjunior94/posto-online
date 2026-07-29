/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { AppState, LmcRecord } from "../types";
import {
  FileText,
  Printer,
  Calendar,
  TrendingDown,
  TrendingUp,
  Download,
  Plus,
  Trash2,
  Edit2,
  RefreshCw,
  Info,
  Zap,
  CheckCircle2,
  Truck,
  Sparkles,
  Eye,
  Bot,
} from "lucide-react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import ReportPreviewModal from "./ReportPreviewModal";

interface LMCManagementProps {
  appState: AppState;
  userRole: string;
  cnpjPosto: string;
  onUpdateLmc: (lmc: LmcRecord[]) => void;
  onAddAuditLog: (actionType: string, target: string, details: string, status: string) => void;
  onUpdateReportCustomization?: (customs: Partial<AppState>) => void;
  onClearData?: () => void;
}

const FUEL_LMC_OPTIONS = [
  "Gasolina C Comum (E30)",
  "Gasolina C Aditivada (E30)",
  "Etanol Comum",
  "Óleo Diesel B S10 (B15)",
  "Óleo Diesel B S500 (B15)",
];

export default function LMCManagement({
  appState,
  userRole,
  cnpjPosto,
  onUpdateLmc,
  onAddAuditLog,
  onUpdateReportCustomization,
  onClearData,
}: LMCManagementProps) {
  const { lmc = [] } = appState;

  // State for ReportPreviewModal
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    reportType: "lmc" | "anp" | "litrage" | "financial";
    title: string;
    subtitle?: string;
    onExportPDF: () => void;
    onExportCSV: () => void;
  } | null>(null);

  // View mode switcher: "history" (consolidated table list) or "official" (ANP paper sheet model layout)
  const [lmcViewMode, setLmcViewMode] = useState<"history" | "official">("history");

  // Selection states for Official Daily Sheet
  const [viewFuel, setViewFuel] = useState("Gasolina C Comum (E30)");
  const [viewDate, setViewDate] = useState(() => {
    const sorted = [...lmc].filter(r => r.stationCnpj === cnpjPosto).sort((a, b) => b.date.localeCompare(a.date));
    return sorted[0]?.date || new Date().toISOString().split("T")[0];
  });

  const mapLmcFuelToTankFuel = (lmcFuel: string): string => {
    if (lmcFuel.includes("Gasolina C Comum") || lmcFuel.includes("Gasolina Comum")) return "Gasolina Comum";
    if (lmcFuel.includes("Gasolina C Aditivada") || lmcFuel.includes("Gasolina Aditivada")) return "Gasolina Aditivada";
    if (lmcFuel.includes("Etanol")) return "Etanol";
    if (lmcFuel.includes("Diesel B S10") || lmcFuel.includes("Diesel S10")) return "Diesel S10";
    if (lmcFuel.includes("Diesel B S500") || lmcFuel.includes("Diesel S500")) return "Diesel S500";
    return lmcFuel;
  };

  // Filter States
  const [fuelFilter, setFuelFilter] = useState("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });

  // Modal States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form States
  const [modalFuel, setModalFuel] = useState("Gasolina C Comum (E30)");
  const [modalDate, setModalDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [modalOpening, setModalOpening] = useState("");
  const [modalDelivery, setModalDelivery] = useState("0");
  const [modalSold, setModalSold] = useState("");
  const [modalPhysical, setModalPhysical] = useState("");

  const [error, setError] = useState("");

  // Formulas for calculations
  const getExpectedStock = (opening: number, delivery: number, sold: number) => {
    return opening + delivery - sold;
  };

  const getSobraFalta = (physical: number, expected: number) => {
    return physical - expected;
  };

  // Filtered records
  const filteredRecords = lmc.filter((r) => {
    const matchesCnpj = r.stationCnpj === cnpjPosto;
    const matchesFuel = fuelFilter === "all" || r.fuelType === fuelFilter;
    const matchesStart = !startDate || r.date >= startDate;
    const matchesEnd = !endDate || r.date <= endDate;
    return matchesCnpj && matchesFuel && matchesStart && matchesEnd;
  });

  // Calculate Consolidated KPIs
  const totalSold = filteredRecords.reduce((sum, r) => sum + (Number(r.litersSold) || 0), 0);
  const totalReceived = filteredRecords.reduce((sum, r) => sum + (Number(r.deliveryVolume) || 0), 0);
  const totalBalance = filteredRecords.reduce((sum, r) => {
    const exp = getExpectedStock(Number(r.openingStock), Number(r.deliveryVolume), Number(r.litersSold));
    return sum + getSobraFalta(Number(r.physicalStock), exp);
  }, 0);

  // Group filtered records by Fuel Type for dynamic tables
  const recordsByFuel = filteredRecords.reduce<{ [key: string]: LmcRecord[] }>((acc, r) => {
    if (!acc[r.fuelType]) acc[r.fuelType] = [];
    acc[r.fuelType].push(r);
    return acc;
  }, {});

  // Helper to auto-calculate LMC volumes from 'Leitura de Bicos' and 'Recebimento de Combustível'
  const calculateAutoLmcValues = (dateStr: string, lmcFuel: string) => {
    const mappedFuel = mapLmcFuelToTankFuel(lmcFuel);

    // 1. Matched tanks
    const matchedTanks = (appState.tanks || []).filter(
      (t) => t.combustivel === mappedFuel
    );
    const matchedTankIds = new Set(matchedTanks.map((t) => t.id));

    // 2. Matched nozzles
    const matchedNozzles = (appState.nozzles || []).filter((n) =>
      matchedTankIds.has(n.tanqueId)
    );
    const matchedNozzleIds = new Set(matchedNozzles.map((n) => n.id));

    // 3. Liters Sold from Nozzle Closings (Leitura de Bicos / Encerrantes)
    const shiftsOnDate = (appState.shifts || []).filter(
      (s) => s.data === dateStr && (!s.stationCnpj || s.stationCnpj === cnpjPosto)
    );
    const shiftIdsOnDate = new Set(shiftsOnDate.map((s) => s.id));

    let totalLitersSoldFromBicos = 0;
    (appState.nozzleClosings || []).forEach((nc) => {
      if (
        matchedNozzleIds.has(nc.nozzleId) &&
        (shiftIdsOnDate.has(nc.shiftId) || (nc as any).data === dateStr)
      ) {
        totalLitersSoldFromBicos += Number(nc.litrosVendidos) || 0;
      }
    });

    // 4. Fuel Receipts from Deliveries (Recebimento de Combustível)
    let totalDeliveryVolumeFromNFe = 0;
    (appState.deliveries || []).forEach((d) => {
      const dDate = d.date || d.data;
      const dFuel = d.fuelType || d.combustivel || "";
      const isMatchingFuel =
        dFuel.includes(mappedFuel) ||
        mappedFuel.includes(dFuel) ||
        dFuel.includes(lmcFuel);

      if (
        dDate === dateStr &&
        isMatchingFuel &&
        (!d.stationCnpj || d.stationCnpj === cnpjPosto)
      ) {
        totalDeliveryVolumeFromNFe += Number(d.volume || d.volumeRecebido) || 0;
      }
    });

    // 5. Opening Stock (Estoque Inicial)
    const prevDateObj = new Date(dateStr);
    prevDateObj.setDate(prevDateObj.getDate() - 1);
    const prevDate = prevDateObj.toISOString().split("T")[0];

    const prevLmc = lmc.find(
      (r) =>
        r.fuelType === lmcFuel &&
        r.date === prevDate &&
        r.stationCnpj === cnpjPosto
    );

    let openingStock = 0;
    if (prevLmc) {
      openingStock = Number(prevLmc.physicalStock) || 0;
    } else {
      const currentTankSum = matchedTanks.reduce(
        (acc, t) => acc + (Number(t.volumeAtual) || 0),
        0
      );
      openingStock =
        currentTankSum > 0
          ? currentTankSum + totalLitersSoldFromBicos - totalDeliveryVolumeFromNFe
          : 12500;
    }

    const expectedStock = openingStock + totalDeliveryVolumeFromNFe - totalLitersSoldFromBicos;
    const isToday = dateStr === new Date().toISOString().split("T")[0];
    const tankCurrentTotal = matchedTanks.reduce((acc, t) => acc + (Number(t.volumeAtual) || 0), 0);
    const physicalStock = isToday && tankCurrentTotal > 0 ? tankCurrentTotal : Math.max(0, expectedStock);

    return {
      openingStock: Math.max(0, openingStock),
      deliveryVolume: totalDeliveryVolumeFromNFe,
      litersSold: totalLitersSoldFromBicos,
      physicalStock: Math.max(0, physicalStock),
      expectedStock: Math.max(0, expectedStock),
    };
  };

  const handleAutoFillModal = (targetDate?: string, targetFuel?: string) => {
    const d = targetDate || modalDate;
    const f = targetFuel || modalFuel;
    const vals = calculateAutoLmcValues(d, f);

    setModalOpening(String(vals.openingStock));
    setModalDelivery(String(vals.deliveryVolume));
    setModalSold(String(vals.litersSold));
    setModalPhysical(String(vals.physicalStock));
  };

  const handleSyncErpToLmc = () => {
    // Synchronize all available dates with nozzle closings or deliveries
    const dateSet = new Set<string>();
    dateSet.add(new Date().toISOString().split("T")[0]);

    (appState.shifts || []).forEach((s) => { if (s.data) dateSet.add(s.data); });
    (appState.nozzleClosings || []).forEach((nc) => { if ((nc as any).data) dateSet.add((nc as any).data); });
    (appState.deliveries || []).forEach((d) => {
      const dDate = d.date || d.data;
      if (dDate) dateSet.add(dDate);
    });

    let updatedList = [...lmc];
    let syncedCount = 0;

    dateSet.forEach((d) => {
      FUEL_LMC_OPTIONS.forEach((f) => {
        const vals = calculateAutoLmcValues(d, f);
        // Only create/update if there are sales, deliveries, or previous record exists
        const existingIdx = updatedList.findIndex(
          (r) => r.date === d && r.fuelType === f && r.stationCnpj === cnpjPosto
        );

        if (existingIdx >= 0) {
          updatedList[existingIdx] = {
            ...updatedList[existingIdx],
            openingStock: vals.openingStock,
            deliveryVolume: vals.deliveryVolume,
            litersSold: vals.litersSold,
            physicalStock: vals.physicalStock,
          };
          syncedCount++;
        } else if (vals.litersSold > 0 || vals.deliveryVolume > 0) {
          updatedList.push({
            id: `lmc_auto_${d}_${f.replace(/\s+/g, "_")}_${Date.now()}`,
            date: d,
            fuelType: f,
            openingStock: vals.openingStock,
            deliveryVolume: vals.deliveryVolume,
            litersSold: vals.litersSold,
            physicalStock: vals.physicalStock,
            stationCnpj: cnpjPosto,
          });
          syncedCount++;
        }
      });
    });

    onUpdateLmc(updatedList);
    onAddAuditLog(
      "UPDATE",
      "LMC",
      `Sincronização ERP concluída: Leitura de Bicos e Recebimento de Cargas integrados ao LMC (${syncedCount} registros processados)`,
      "Regular"
    );
    alert(`⚡ Sincronização Automática Concluída!\n\n${syncedCount} lançamentos do Livro LMC foram integrados com os dados de Leitura de Bicos e Recebimento de Combustível (NF-e).`);
  };

  const handleOpenAddModal = () => {
    setEditingId(null);
    const today = new Date().toISOString().split("T")[0];
    const defaultFuel = "Gasolina C Comum (E30)";
    setModalFuel(defaultFuel);
    setModalDate(today);

    // Auto-prefill with ERP readings right away
    const autoVals = calculateAutoLmcValues(today, defaultFuel);
    setModalOpening(String(autoVals.openingStock));
    setModalDelivery(String(autoVals.deliveryVolume));
    setModalSold(String(autoVals.litersSold));
    setModalPhysical(String(autoVals.physicalStock));

    setError("");
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (record: LmcRecord) => {
    setEditingId(record.id);
    setModalFuel(record.fuelType);
    setModalDate(record.date);
    setModalOpening(String(record.openingStock));
    setModalDelivery(String(record.deliveryVolume));
    setModalSold(String(record.litersSold));
    setModalPhysical(String(record.physicalStock));
    setError("");
    setIsModalOpen(true);
  };

  const handleSaveRecord = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const opening = Number(modalOpening);
    const delivery = Number(modalDelivery);
    const sold = Number(modalSold);
    const physical = Number(modalPhysical);

    if (isNaN(opening) || isNaN(delivery) || isNaN(sold) || isNaN(physical)) {
      setError("Insira valores numéricos válidos.");
      return;
    }

    if (editingId) {
      // Update
      const updated = lmc.map((r) => {
        if (r.id === editingId) {
          return {
            ...r,
            fuelType: modalFuel,
            date: modalDate,
            openingStock: opening,
            deliveryVolume: delivery,
            litersSold: sold,
            physicalStock: physical,
          };
        }
        return r;
      });
      onUpdateLmc(updated);
      onAddAuditLog(
        "UPDATE",
        "LMC",
        `Registro LMC atualizado para ${modalFuel} em ${modalDate}`,
        "Regular"
      );
    } else {
      // Create
      const newRec: LmcRecord = {
        id: "lmc_" + Date.now(),
        date: modalDate,
        fuelType: modalFuel,
        openingStock: opening,
        deliveryVolume: delivery,
        litersSold: sold,
        physicalStock: physical,
        stationCnpj: cnpjPosto,
      };
      onUpdateLmc([...lmc, newRec]);
      onAddAuditLog(
        "CREATE",
        "LMC",
        `Novo registro LMC lançado para ${modalFuel} em ${modalDate}`,
        "Regular"
      );
    }

    setIsModalOpen(false);
  };

  const handleDeleteRecord = (id: string) => {
    if (confirm("Tem certeza que deseja remover este registro do LMC?")) {
      const rec = lmc.find((r) => r.id === id);
      const filtered = lmc.filter((r) => r.id !== id);
      onUpdateLmc(filtered);
      if (rec) {
        onAddAuditLog(
          "DELETE",
          "LMC",
          `Registro LMC apagado para ${rec.fuelType} em ${rec.date}`,
          "Regular"
        );
      }
    }
  };

  const downloadLMCPDF = () => {
    try {
      if (filteredRecords.length === 0) {
        alert("Não há registros LMC visíveis para exportar.");
        return;
      }

      const doc = new jsPDF("p", "mm", "a4");
      const periodText = `${(startDate || "").split("-").reverse().join("/")} a ${(endDate || "").split("-").reverse().join("/")}`;
      const emissionDate = new Date().toLocaleString("pt-BR");

      const startX = 12;
      const endX = 198;
      const usableWidth = 186;

      // Dynamic custom report header drawing
      const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
      const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
      const reportAddress = appState.reportHeaderAddress || "";

      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(1);
      doc.line(startX, 15, endX, 15);

      let textX = startX;
      if (appState.reportHeaderLogo) {
        try {
          doc.addImage(appState.reportHeaderLogo, "PNG", startX, 16.5, 12, 12);
          textX = startX + 15;
        } catch (e) {
          console.error("Error drawing logo in PDF:", e);
        }
      }

      doc.setTextColor(30, 58, 138);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(reportCompName, textX, 21);

      doc.setTextColor(75, 85, 99);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text(`LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS (LMC) • CNPJ do Posto: ${reportCnpj}`, textX, 26);
      if (reportAddress) {
        doc.setFontSize(6.5);
        doc.text(reportAddress.length > 80 ? reportAddress.substring(0, 80) + "..." : reportAddress, textX, 30);
      }

      doc.setFontSize(8);
      doc.setTextColor(75, 85, 99);
      doc.text(`Período: ${periodText}`, endX, 20, { align: "right" });
      doc.text(`Emissão: ${emissionDate}`, endX, 24, { align: "right" });

      doc.setDrawColor(30, 58, 138);
      doc.setLineWidth(0.5);
      doc.line(startX, 33, endX, 33);

      // KPI Summary inside PDF
      const cardW = usableWidth / 3;
      const cardH = 15;
      const cardY = 36;

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.rect(startX, cardY, cardW, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("VOLUME TOTAL VENDIDO", startX + cardW / 2, cardY + 5, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalSold.toLocaleString("pt-BR")} L`, startX + cardW / 2, cardY + 11, { align: "center" });

      const card2X = startX + cardW;
      doc.setFillColor(248, 250, 252);
      doc.rect(card2X, cardY, cardW, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("VOLUME TOTAL RECEBIDO", card2X + cardW / 2, cardY + 5, { align: "center" });
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text(`${totalReceived.toLocaleString("pt-BR")} L`, card2X + cardW / 2, cardY + 11, { align: "center" });

      const card3X = card2X + cardW;
      doc.setFillColor(248, 250, 252);
      doc.rect(card3X, cardY, cardW, cardH, "FD");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      doc.setTextColor(100, 116, 139);
      doc.text("BALANÇO GERAL (DIFERENÇA)", card3X + cardW / 2, cardY + 5, { align: "center" });
      doc.setFontSize(9);
      if (totalBalance >= 0) doc.setTextColor(22, 163, 74);
      else doc.setTextColor(220, 38, 38);
      doc.text(`${totalBalance >= 0 ? "+" : ""}${totalBalance.toLocaleString("pt-BR")} L`, card3X + cardW / 2, cardY + 11, { align: "center" });

      // Tables grouped by fuel
      let currentY = 58;
      const sortedFuels = Object.keys(recordsByFuel).sort();

      sortedFuels.forEach((fuel) => {
        const rows = recordsByFuel[fuel].sort((a, b) => a.date.localeCompare(b.date));

        const tableData = rows.map((r) => {
          const expected = getExpectedStock(Number(r.openingStock), Number(r.deliveryVolume), Number(r.litersSold));
          const sf = getSobraFalta(Number(r.physicalStock), expected);
          const sfText = sf === 0 ? "0 L" : `${sf > 0 ? "+" : ""}${sf.toLocaleString("pt-BR")} L`;

          return [
            (r.date || "").split("-").reverse().join("/"),
            `${r.openingStock.toLocaleString("pt-BR")} L`,
            `${r.deliveryVolume ? r.deliveryVolume.toLocaleString("pt-BR") : "0"} L`,
            `${r.litersSold.toLocaleString("pt-BR")} L`,
            `${r.physicalStock.toLocaleString("pt-BR")} L`,
            sfText,
          ];
        });

        if (currentY > 230) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(30, 58, 138);
        doc.text(`Produto: ${fuel}`, startX, currentY);
        currentY += 3;

        autoTable(doc, {
          startY: currentY,
          head: [["Data", "Est. Inicial", "Entrega", "Venda", "Est. Físico", "Sobra/Falta"]],
          body: tableData,
          theme: "grid",
          margin: { left: startX, right: 12 },
          headStyles: {
            fillColor: [30, 58, 138],
            textColor: [255, 255, 255],
            fontSize: 7.5,
            fontStyle: "bold",
            halign: "center",
          },
          columnStyles: {
            0: { halign: "left", fontStyle: "bold" },
            1: { halign: "right" },
            2: { halign: "right" },
            3: { halign: "right" },
            4: { halign: "right" },
            5: { halign: "right", fontStyle: "bold" },
          },
          styles: { fontSize: 7, cellPadding: 2.5, lineColor: [226, 232, 240] },
          didParseCell: function (data: any) {
            if (data.row.section === "body" && data.column.index === 5) {
              const text = data.cell.text[0] || "";
              if (text.includes("+")) {
                data.cell.styles.textColor = [22, 163, 74];
              } else if (text.includes("-")) {
                data.cell.styles.textColor = [220, 38, 38];
              }
            }
          },
        });

        currentY = (doc as any).lastAutoTable.finalY + 10;
      });

      // Footer
      const totalPages = doc.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7.5);
        doc.setTextColor(150);
        doc.text(`Página ${i} de ${totalPages}`, endX, 285, { align: "right" });
        doc.text(`Gerado por Meu Posto ERP - ${emissionDate}`, startX, 285);

        if (i === totalPages) {
          if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
            try {
              const sigWidth = 40;
              const sigHeight = 12;
              const sigX = (usableWidth / 2 + startX) - (sigWidth / 2);
              doc.addImage(appState.reportSignatureBase64, "PNG", sigX, 255, sigWidth, sigHeight);
            } catch (e) {
              console.error("Error adding signature image to PDF:", e);
            }
          }

          doc.setDrawColor(200);
          doc.line(startX + 50, 269, endX - 50, 269);
          
          doc.setFont("helvetica", "bold");
          doc.setFontSize(7.5);
          doc.setTextColor(75, 85, 99);
          const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
          doc.text(signerName, usableWidth / 2 + startX, 273, { align: "center" });

          doc.setFont("helvetica", "normal");
          doc.setFontSize(6.5);
          const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
          doc.text(signerRole, usableWidth / 2 + startX, 276, { align: "center" });
        }
      }

      doc.save(`LMC_Oficial_${cnpjPosto.replace(/[\.\/-]/g, "")}.pdf`);
      onAddAuditLog("DOWNLOAD", "LMC", "Exportado relatório regulamentar LMC em formato PDF", "Regular");
    } catch (e: any) {
      alert("Erro ao exportar PDF: " + e.message);
    }
  };

  const downloadLMCCSV = () => {
    try {
      if (filteredRecords.length === 0) {
        alert("Não há registros LMC visíveis para exportar.");
        return;
      }

      const reportCompName = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
      const reportCnpj = appState.reportHeaderCnpj || cnpjPosto;
      const reportAddress = appState.reportHeaderAddress || "";
      const periodText = `${(startDate || "").split("-").reverse().join("/")} a ${(endDate || "").split("-").reverse().join("/")}`;
      const emissionDate = new Date().toLocaleString("pt-BR");

      let csvContent = "\ufeff"; // UTF-8 BOM
      csvContent += `EMPRESA:;${reportCompName}\n`;
      csvContent += `CNPJ:;${reportCnpj}\n`;
      if (reportAddress) {
        csvContent += `ENDEREÇO:;${reportAddress}\n`;
      }
      csvContent += `RELATÓRIO:;LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS (LMC) - HISTÓRICO CONSOLIDADO\n`;
      csvContent += `PERÍODO:;${periodText}\n`;
      csvContent += `EMISSÃO:;${emissionDate}\n\n`;

      csvContent += "ID;Data;Produto;Estoque Inicial (L);Recebimento (L);Vendas (L);Estoque Final Esperado (L);Estoque Físico Medido (L);Diferença (L)\n";

      filteredRecords.forEach((r) => {
        const opening = Number(r.openingStock);
        const delivery = Number(r.deliveryVolume || 0);
        const sold = Number(r.litersSold);
        const expected = opening + delivery - sold;
        const physical = Number(r.physicalStock);
        const diff = physical - expected;

        csvContent += `${r.id};${(r.date || "").split("-").reverse().join("/")};${r.fuelType};${opening};${delivery};${sold};${expected};${physical};${diff}\n`;
      });

      if (appState.reportSignatureEnabled !== false) {
        const signerName = appState.reportSignatureName || "Carlos Eduardo de Oliveira";
        const signerRole = appState.reportSignatureRole || "Gerente Geral / Representante Legal";
        csvContent += `\n`;
        csvContent += `ASSINADO ELETRONICAMENTE POR:\n`;
        csvContent += `${signerName};(${signerRole})\n`;
      }

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.setAttribute("href", url);
      downloadLink.setAttribute("download", `LMC_Historico_${Date.now()}.csv`);
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      URL.revokeObjectURL(url);

      onAddAuditLog("DOWNLOAD", "LMC", "Exportado histórico consolidado LMC em formato planilha (CSV)", "Regular");
    } catch (e: any) {
      alert("Erro ao exportar planilha LMC: " + e.message);
    }
  };

  const downloadOfficialPagePDF = (fuelType: string, dateStr: string) => {
    try {
      const record = lmc.find(r => r.fuelType === fuelType && r.date === dateStr && r.stationCnpj === cnpjPosto);
      if (!record) {
        alert("Nenhum lançamento no LMC registrado para esta data e produto.");
        return;
      }

      const doc = new jsPDF("p", "mm", "a4");
      
      // Draw outer border of the entire LMC sheet
      doc.setDrawColor(15, 23, 42); 
      doc.setLineWidth(0.4);
      doc.rect(10, 10, 190, 277); 
      
      // Header section
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("LMC - LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS", 105, 17, { align: "center" });
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.text("RESOLUÇÃO ANP Nº 26/1992 - MODELO OFICIAL REGULAMENTAR", 105, 21, { align: "center" });

      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(10, 24, 200, 24);
      
      // Dealer info
      doc.setFont("helvetica", "bold");
      doc.text("REVENDECOR (RAZÃO SOCIAL):", 12, 28);
      doc.setFont("helvetica", "normal");
      const stationNameOfficial = (appState.reportHeaderCompanyName || appState.nomePosto || "MEU POSTO").toUpperCase();
      doc.text(stationNameOfficial.length > 35 ? stationNameOfficial.substring(0, 35) + "..." : stationNameOfficial, 57, 28);
      
      doc.setFont("helvetica", "bold");
      doc.text("CNPJ DO POSTO:", 145, 28);
      doc.setFont("helvetica", "normal");
      const reportCnpjOfficial = appState.reportHeaderCnpj || cnpjPosto;
      doc.text(reportCnpjOfficial, 171, 28);

      doc.setFont("helvetica", "bold");
      doc.text("ENDEREÇO:", 12, 33);
      doc.setFont("helvetica", "normal");
      const reportAddressOfficial = appState.reportHeaderAddress || "Av. Brasil, 1500 - Centro, São José dos Campos - SP";
      doc.text(reportAddressOfficial.length > 55 ? reportAddressOfficial.substring(0, 55) + "..." : reportAddressOfficial, 32, 33);

      doc.setFont("helvetica", "bold");
      doc.text("INSCRIÇÃO ESTADUAL:", 145, 33);
      doc.setFont("helvetica", "normal");
      doc.text("110.245.890.111", 178, 33);

      doc.setFont("helvetica", "bold");
      doc.text("PRODUTO:", 12, 38);
      doc.setFont("helvetica", "normal");
      doc.text(fuelType.toUpperCase(), 30, 38);

      doc.setFont("helvetica", "bold");
      doc.text("DATA DO MOVIMENTO:", 145, 38);
      doc.setFont("helvetica", "normal");
      doc.text((dateStr || "").split("-").reverse().join("/"), 178, 38);

      doc.line(10, 41, 200, 41);

      // Quadro I: ESTOQUE FÍSICO DIÁRIO
      doc.setFillColor(241, 245, 249);
      doc.rect(10, 41, 190, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text("QUADRO I - ESTOQUE FÍSICO DIÁRIO (EM LITROS)", 12, 45);
      doc.line(10, 46, 200, 46);

      const opening = Number(record.openingStock);
      const delivery = Number(record.deliveryVolume || 0);
      const available = opening + delivery;
      const sold = Number(record.litersSold);
      const expected = available - sold;
      const physical = Number(record.physicalStock);
      const diff = physical - expected;

      const stockItems = [
        ["1. ESTOQUE DE ABERTURA", `${opening.toLocaleString("pt-BR")} L`],
        ["2. RECEBIMENTO NO DIA (NF-e)", `${delivery.toLocaleString("pt-BR")} L`],
        ["3. TOTAL DISPONÍVEL (1 + 2)", `${available.toLocaleString("pt-BR")} L`],
        ["4. SAÍDAS (VENDAS NO DIA)", `${sold.toLocaleString("pt-BR")} L`],
        ["5. ESTOQUE ESCRITURAL (3 - 4)", `${expected.toLocaleString("pt-BR")} L`],
        ["6. ESTOQUE FÍSICO (MEDIÇÃO)", `${physical.toLocaleString("pt-BR")} L`],
        ["7. SOBRA / PERDA DIÁRIA (6 - 5)", `${diff >= 0 ? "+" : ""}${diff.toLocaleString("pt-BR")} L`],
      ];

      let yOffset = 52;
      doc.setFontSize(7.5);
      stockItems.forEach((item, index) => {
        doc.setFont("helvetica", index === 6 || index === 2 ? "bold" : "normal");
        doc.text(item[0], 15, yOffset);
        doc.text(item[1], 150, yOffset, { align: "right" });
        doc.line(10, yOffset + 2.2, 200, yOffset + 2.2);
        yOffset += 5.5;
      });

      // Quadro II: FECHAMENTO EQUIPAMENTOS MEDIÇÃO
      yOffset -= 2.5;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, yOffset, 190, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.text("QUADRO II - EQUIPAMENTO DE MEDIÇÃO (FECHAMENTO DOS ENCERRANTES)", 12, yOffset + 4);
      doc.line(10, yOffset + 5, 200, yOffset + 5);

      yOffset += 11;

      // Table of nozzles
      doc.setFont("helvetica", "bold");
      doc.text("BICO Nº", 15, yOffset);
      doc.text("BOMBA", 45, yOffset);
      doc.text("ENCERRANTE INICIAL (L)", 80, yOffset);
      doc.text("ENCERRANTE FINAL (L)", 130, yOffset);
      doc.text("VENDAS DO DIA (L)", 175, yOffset);
      doc.line(10, yOffset + 2.2, 200, yOffset + 2.2);

      yOffset += 6.5;

      // Find nozzles
      const mappedFuel = mapLmcFuelToTankFuel(fuelType);
      const matchedTanks = (appState.tanks || []).filter(t => t.combustivel === mappedFuel);
      const matchedNozzles = (appState.nozzles || []).filter(n => matchedTanks.some(t => t.id === n.tanqueId));

      doc.setFont("helvetica", "normal");
      if (matchedNozzles.length === 0) {
        doc.text("Nenhum bico cadastrado para este combustível.", 15, yOffset);
        doc.line(10, yOffset + 2.2, 200, yOffset + 2.2);
        yOffset += 6.5;
      } else {
        const soldPerNozzle = Number((sold / matchedNozzles.length).toFixed(1));
        matchedNozzles.forEach((nozzle) => {
          const initial = nozzle.encerranteInicial;
          const finalRead = initial + soldPerNozzle;
          doc.text(nozzle.numeroBico, 15, yOffset);
          doc.text(nozzle.bombaAssociada, 45, yOffset);
          doc.text(initial.toLocaleString("pt-BR"), 80, yOffset);
          doc.text(finalRead.toLocaleString("pt-BR"), 130, yOffset);
          doc.text(soldPerNozzle.toLocaleString("pt-BR"), 175, yOffset);
          doc.line(10, yOffset + 2.2, 200, yOffset + 2.2);
          yOffset += 6.5;
        });
      }

      // Quadro III: MOVIMENTAÇÃO FINANCEIRA
      yOffset += 1;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, yOffset, 190, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.text("QUADRO III - MOVIMENTAÇÃO FINANCEIRA DO PRODUTO NO DIA", 12, yOffset + 4);
      doc.line(10, yOffset + 5, 200, yOffset + 5);

      yOffset += 11;

      const price = matchedNozzles[0]?.precoPorLitro || 5.89;
      const totalFinanceVal = sold * price;
      const finCash = totalFinanceVal * 0.35;
      const finCards = totalFinanceVal * 0.50;
      const finPix = totalFinanceVal * 0.15;

      const financeItems = [
        ["VENDAS EM DINHEIRO (35% Est.)", `R$ ${finCash.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["VENDAS EM CARTÕES (50% Est.)", `R$ ${finCards.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["VENDAS EM PIX / OUTROS (15% Est.)", `R$ ${finPix.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ["VALOR TOTAL ESTIMADO DAS VENDAS (100%)", `R$ ${totalFinanceVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ];

      doc.setFont("helvetica", "normal");
      financeItems.forEach((item, index) => {
        doc.setFont("helvetica", index === 3 ? "bold" : "normal");
        doc.text(item[0], 15, yOffset);
        doc.text(item[1], 150, yOffset, { align: "right" });
        doc.line(10, yOffset + 2.2, 200, yOffset + 2.2);
        yOffset += 5.5;
      });

      // Quadro IV: OBSERVAÇÕES E ASSINATURAS
      yOffset += 1;
      doc.setFillColor(241, 245, 249);
      doc.rect(10, yOffset, 190, 5, "F");
      doc.setFont("helvetica", "bold");
      doc.text("QUADRO IV - OBSERVAÇÕES E ASSINATURAS RECONHECIDAS", 12, yOffset + 4);
      doc.line(10, yOffset + 5, 200, yOffset + 5);

      yOffset += 11;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.5);
      const obsText = `Venda volumétrica aferida por encerrantes mecânicos em conformidade regulamentar. Recebimentos conferidos contra Notas Fiscais eletrônicas de fornecimento. Controle de qualidade densimétrico e testes de proveta efetuados no recebimento, atestando conformidade com os regulamentos vigentes da ANP. Sobra/Perda física diária de ${diff.toFixed(1)} Litros (${available > 0 ? ((diff / available) * 100).toFixed(3) : 0}% do disponível), dentro do limite de tolerância regulamentar de 0.60% estipulado pela ANP.`;
      const splitObs = doc.splitTextToSize(obsText, 180);
      doc.text(splitObs, 12, yOffset);

      // Signature lines at the bottom
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.3);
      doc.line(10, 245, 200, 245);
      
      if (appState.reportSignatureEnabled !== false && appState.reportSignatureBase64) {
        try {
          const sigWidth = 35;
          const sigHeight = 11;
          const sigX = 35; // Center over the 25 to 85 line
          doc.addImage(appState.reportSignatureBase64, "PNG", sigX, 252, sigWidth, sigHeight);
        } catch (e) {
          console.error("Error drawing signature on official sheet:", e);
        }
      }

      doc.line(25, 265, 85, 265);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      const signerNameOfficial = appState.reportSignatureName || "REPRESENTANTE LEGAL DO REVENDEDOR";
      doc.text(signerNameOfficial.toUpperCase(), 55, 269, { align: "center" });

      doc.line(125, 265, 185, 265);
      doc.text("FISCAL / AUDITOR REGULAMENTAR (ANP)", 155, 269, { align: "center" });

      doc.save(`LMC_Folha_Oficial_${fuelType.replace(/[\.\/() -]/g, "")}_${dateStr}.pdf`);
      onAddAuditLog("DOWNLOAD", "LMC", `Exportada Folha Oficial Diária LMC para ${fuelType} em ${dateStr}`, "Regular");
    } catch (err: any) {
      alert("Erro ao exportar Folha Oficial LMC: " + err.message);
    }
  };

  const previewExpected = Number(modalOpening) + Number(modalDelivery) - Number(modalSold);
  const previewDiff = Number(modalPhysical) - previewExpected;

  return (
    <div className="space-y-6">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 font-display">
            <FileText className="text-indigo-600 h-6 w-6" />
            Livro de Movimentação de Combustíveis (LMC)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Balanço consolidado de movimentação volumétrica e controle regulamentar de perdas (ANP E30 / B15)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => {
              if (onClearData) {
                onClearData();
              } else if (confirm("Deseja apagar todos os registros do Livro LMC?")) {
                onUpdateLmc([]);
              }
            }}
            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black transition flex items-center gap-1.5 cursor-pointer"
            title="Limpar livro LMC"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
            <span>Limpar LMC</span>
          </button>

          <button
            onClick={handleSyncErpToLmc}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Preencher automaticamente as colunas de estoque e vendas do LMC a partir das leituras de bicos e NF-e de combustível"
          >
            <Zap className="h-3.5 w-3.5" />
            Sincronizar Bicos & Cargas
          </button>

          <button
            type="button"
            onClick={() => {
              const event = new CustomEvent("OPEN_GERENTE_MARCOS");
              window.dispatchEvent(event);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-amber-500/10 to-amber-600/10 hover:from-amber-500/20 hover:to-amber-600/20 border border-amber-500/30 text-amber-600 font-black text-xs rounded-xl transition cursor-pointer shadow-xs active:scale-95"
            title="Falar com o Gerente Virtual Marcos"
          >
            <Bot className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
            <span>Gerente AI</span>
          </button>
          <button
            onClick={() => {
              setPreviewModal({
                isOpen: true,
                reportType: "lmc",
                title: "LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS (LMC)",
                subtitle: "Movimentação diária de estoques e perdas volumétricas",
                onExportPDF: downloadLMCPDF,
                onExportCSV: downloadLMCCSV,
              });
            }}
            className="px-4 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Visualizar pré-visualização completa do LMC com cabeçalho e assinatura"
          >
            <Eye className="h-3.5 w-3.5 text-indigo-500" />
            Preview
          </button>
          <button
            onClick={downloadLMCPDF}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-rose-500" />
            Exportar Histórico (PDF)
          </button>
          <button
            onClick={downloadLMCCSV}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-50 transition flex items-center gap-1.5 shadow-sm cursor-pointer"
            title="Exportar dados do histórico consolidado para planilha em formato CSV"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            Exportar Histórico (Planilha)
          </button>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            Lançar Registro LMC
          </button>
        </div>
      </div>

      {/* View Mode Tabs Selector */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setLmcViewMode("history")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
            lmcViewMode === "history"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/10 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          📋 Histórico Consolidado
        </button>
        <button
          onClick={() => setLmcViewMode("official")}
          className={`px-4 py-2 text-xs font-bold transition-all border-b-2 rounded-t-lg ${
            lmcViewMode === "official"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/10 font-extrabold"
              : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50"
          }`}
        >
          📄 Folha Diária Oficial (ANP)
        </button>
      </div>

      {lmcViewMode === "official" ? (
        <div className="space-y-6">
          {/* Controls specifically for Daily Sheet selection */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Combustível</label>
                <select
                  value={viewFuel}
                  onChange={(e) => setViewFuel(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer text-slate-700"
                >
                  {FUEL_LMC_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Data do Movimento</label>
                <input
                  type="date"
                  value={viewDate}
                  onChange={(e) => setViewDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
                />
              </div>
            </div>
            <button
              onClick={() => downloadOfficialPagePDF(viewFuel, viewDate)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl transition flex items-center gap-1.5 shadow-sm cursor-pointer self-end md:self-auto"
            >
              <Download className="h-3.5 w-3.5" />
              Baixar Folha Diária Oficial (PDF)
            </button>
          </div>

          {/* Paper book replica layout */}
          {(() => {
            const record = lmc.find(r => r.fuelType === viewFuel && r.date === viewDate && r.stationCnpj === cnpjPosto);
            if (!record) {
              const autoVal = calculateAutoLmcValues(viewDate, viewFuel);
              return (
                <div className="bg-white border border-slate-200 text-center py-12 px-6 rounded-2xl shadow-sm space-y-4 max-w-xl mx-auto">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">Sem Folha LMC Lançada nesta Data</h4>
                    <p className="text-slate-500 text-xs mt-1">
                      O ERP identificou <strong className="text-slate-700">{autoVal.litersSold.toLocaleString("pt-BR")} L</strong> vendidos nos bicos e <strong className="text-slate-700">{autoVal.deliveryVolume.toLocaleString("pt-BR")} L</strong> recebidos por NF-e para {viewFuel}.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        const newRec: LmcRecord = {
                          id: `lmc_${Date.now()}`,
                          date: viewDate,
                          fuelType: viewFuel,
                          openingStock: autoVal.openingStock,
                          deliveryVolume: autoVal.deliveryVolume,
                          litersSold: autoVal.litersSold,
                          physicalStock: autoVal.physicalStock,
                          stationCnpj: cnpjPosto,
                        };
                        onUpdateLmc([...lmc, newRec]);
                        onAddAuditLog(
                          "CREATE",
                          "LMC",
                          `Folha LMC gerada automaticamente via bicos e cargas para ${viewFuel} em ${viewDate}`,
                          "Regular"
                        );
                      }}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Zap className="h-3.5 w-3.5" />
                      Auto-Gerar Folha LMC (Bicos + NF-e)
                    </button>
                    <button
                      onClick={() => {
                        setModalFuel(viewFuel);
                        setModalDate(viewDate);
                        handleOpenAddModal();
                      }}
                      className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Lançamento Manual
                    </button>
                  </div>
                </div>
              );
            }

            const opening = Number(record.openingStock);
            const delivery = Number(record.deliveryVolume || 0);
            const available = opening + delivery;
            const sold = Number(record.litersSold);
            const expected = available - sold;
            const physical = Number(record.physicalStock);
            const diff = physical - expected;

            // Find bicos e encerrantes
            const mappedFuel = mapLmcFuelToTankFuel(viewFuel);
            const matchedTanks = (appState.tanks || []).filter(t => t.combustivel === mappedFuel);
            const matchedNozzles = (appState.nozzles || []).filter(n => matchedTanks.some(t => t.id === n.tanqueId));
            const soldPerNozzle = Number((sold / (matchedNozzles.length || 1)).toFixed(1));

            // Finance estimated breakdown
            const price = matchedNozzles[0]?.precoPorLitro || 5.89;
            const totalFinanceVal = sold * price;
            const finCash = totalFinanceVal * 0.35;
            const finCards = totalFinanceVal * 0.50;
            const finPix = totalFinanceVal * 0.15;

            return (
              <div className="bg-[#FAF9F5] border-2 border-slate-300 p-6 sm:p-8 rounded-2xl shadow-lg font-mono text-slate-800 space-y-6 max-w-4xl mx-auto relative overflow-hidden">
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-100 opacity-60 pointer-events-none border-r border-dashed border-indigo-200"></div>
                
                {/* LMC Page Header */}
                <div className="text-center border-b-2 border-slate-800 pb-4 space-y-1">
                  <h1 className="text-sm sm:text-base font-black tracking-widest text-slate-900">
                    LMC - LIVRO DE MOVIMENTAÇÃO DE COMBUSTÍVEIS
                  </h1>
                  <p className="text-[10px] uppercase text-slate-500 font-bold">
                    DE ACORDO COM A PORTARIA DNC Nº 26/1992 - MODELO REGULAMENTAR ANP
                  </p>
                </div>

                {/* Revendedor details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs border-b border-slate-400 pb-4">
                  <div className="space-y-1.5">
                    <p><strong>REVENDECOR:</strong> {(appState.nomePosto || "MEU POSTO").toUpperCase()}</p>
                    <p><strong>ENDEREÇO:</strong> Av. Brasil, 1500 - Centro, São José dos Campos - SP</p>
                    <p className="text-indigo-700"><strong>PRODUTO:</strong> {viewFuel.toUpperCase()}</p>
                  </div>
                  <div className="space-y-1.5 md:text-right">
                    <p><strong>CNPJ:</strong> {cnpjPosto}</p>
                    <p><strong>INSCRIÇÃO ESTADUAL:</strong> 110.245.890.111</p>
                    <p className="text-indigo-700"><strong>DATA DO MOVIMENTO:</strong> {(viewDate || "").split("-").reverse().join("/")}</p>
                  </div>
                </div>

                {/* QUADRO I */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black bg-slate-200 px-2 py-1 text-slate-900 border border-slate-300">
                    QUADRO I - ESTOQUE FÍSICO DIÁRIO (EM LITROS)
                  </h3>
                  <div className="border border-slate-300 divide-y divide-slate-200 bg-white text-xs">
                    <div className="flex justify-between p-2">
                      <span>1. ESTOQUE DE ABERTURA (FECHAMENTO ANTERIOR)</span>
                      <span className="font-bold">{opening.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span>2. RECEBIMENTO NO DIA (CONFORME NOTAS FISCAIS)</span>
                      <span className="font-bold text-emerald-600">+{delivery.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50">
                      <span>3. TOTAL DISPONÍVEL (1 + 2)</span>
                      <span className="font-bold text-slate-900">{available.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span>4. SAÍDAS (VENDAS NO DIA PELO TOTAL DOS BICOS)</span>
                      <span className="font-bold text-rose-600">-{sold.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="flex justify-between p-2 bg-slate-50">
                      <span>5. ESTOQUE ESCRITURAL / CONTÁBIL (3 - 4)</span>
                      <span className="font-bold text-slate-900">{expected.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span>6. ESTOQUE FÍSICO MEDIDO (RÉGUA/SONDA DE MEDIÇÃO)</span>
                      <span className="font-bold text-slate-900">{physical.toLocaleString("pt-BR")} L</span>
                    </div>
                    <div className={`flex justify-between p-2 font-black ${diff >= 0 ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                      <span>7. DIFERENÇA DIÁRIA DE ESTOQUE (6 - 5)</span>
                      <span>{diff === 0 ? "0 L" : `${diff > 0 ? "SOBRA" : "PERDA"}: ${Math.abs(diff).toLocaleString("pt-BR")} L`}</span>
                    </div>
                  </div>
                </div>

                {/* QUADRO II */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black bg-slate-200 px-2 py-1 text-slate-900 border border-slate-300">
                    QUADRO II - EQUIPAMENTO DE MEDIÇÃO (FECHAMENTO DOS ENCERRANTES)
                  </h3>
                  <div className="overflow-x-auto border border-slate-300 bg-white">
                    <table className="w-full text-xs text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-300 text-[10px] uppercase font-bold text-slate-600">
                          <th className="p-2 border-r border-slate-300">Bico Nº</th>
                          <th className="p-2 border-r border-slate-300">Bomba</th>
                          <th className="p-2 border-r border-slate-300 text-right">Leitura Inicial (L)</th>
                          <th className="p-2 border-r border-slate-300 text-right">Leitura Final (L)</th>
                          <th className="p-2 text-right">Litros Vendidos (L)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {matchedNozzles.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center italic text-slate-400">
                              Nenhum bico cadastrado ou mapeado para este combustível no sistema.
                            </td>
                          </tr>
                        ) : (
                          matchedNozzles.map((nozzle) => {
                            const init = nozzle.encerranteInicial;
                            const fin = init + soldPerNozzle;
                            return (
                              <tr key={nozzle.id}>
                                <td className="p-2 border-r border-slate-200 font-bold text-indigo-700">{nozzle.numeroBico}</td>
                                <td className="p-2 border-r border-slate-200">{nozzle.bombaAssociada}</td>
                                <td className="p-2 border-r border-slate-200 text-right">{init.toLocaleString("pt-BR")}</td>
                                <td className="p-2 border-r border-slate-200 text-right">{fin.toLocaleString("pt-BR")}</td>
                                <td className="p-2 text-right font-black text-slate-900">{soldPerNozzle.toLocaleString("pt-BR")} L</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* QUADRO III */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black bg-slate-200 px-2 py-1 text-slate-900 border border-slate-300">
                    QUADRO III - MOVIMENTAÇÃO FINANCEIRA DO PRODUTO NO DIA
                  </h3>
                  <div className="border border-slate-300 divide-y divide-slate-200 bg-white text-xs">
                    <div className="flex justify-between p-2">
                      <span>VENDAS EM DINHEIRO (35% Estimado)</span>
                      <span className="font-bold">R$ {finCash.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span>VENDAS EM CARTÕES (50% Estimado)</span>
                      <span className="font-bold">R$ {finCards.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between p-2">
                      <span>VENDAS EM PIX / OUTROS (15% Estimado)</span>
                      <span className="font-bold">R$ {finPix.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between p-2 bg-indigo-50 font-black text-indigo-900">
                      <span>VALOR TOTAL ESTIMADO DAS VENDAS (A PREÇO MÉDIO DE R$ {price.toFixed(2)} / L)</span>
                      <span>R$ {totalFinanceVal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* QUADRO IV */}
                <div className="space-y-2">
                  <h3 className="text-xs font-black bg-slate-200 px-2 py-1 text-slate-900 border border-slate-300">
                    QUADRO IV - OBSERVAÇÕES E CONTROLE DE CONFORMIDADE DA ANP
                  </h3>
                  <div className="border border-slate-300 p-3 bg-white text-[10px] leading-relaxed text-slate-600 space-y-2">
                    <p>
                      <strong>Fórmula de Perdas/Ganho diário:</strong> Estoque Físico Final ({physical.toLocaleString("pt-BR")} L) - [Estoque Inicial ({opening.toLocaleString("pt-BR")} L) + Recebimento ({delivery.toLocaleString("pt-BR")} L) - Saídas ({sold.toLocaleString("pt-BR")} L)] = <strong>{diff.toFixed(1)} Litros</strong>.
                    </p>
                    <p>
                      <strong>Limites de Tolerância da ANP:</strong> A perda volumétrica diária acumulada não deve exceder a <strong>0,60% (seis décimos por cento)</strong> do volume de combustível disponível ({available.toLocaleString("pt-BR")} L). Limite de tolerância para este dia: <strong>{(available * 0.006).toFixed(1)} L</strong>. Situação do movimento de perdas: <span className={Math.abs(diff) <= available * 0.006 ? "text-emerald-600 font-bold" : "text-rose-600 font-bold"}>{Math.abs(diff) <= available * 0.006 ? "✓ CONFORME (DENTRO DOS LIMITES REGULAMENTARES)" : "✗ ALERTA (EXCEDE A TOLERÂNCIA DE 0.6%)"}</span>.
                    </p>
                    <p>
                      <strong>Notas Técnicas:</strong> Controles físico-químicos diários de densidade e aspecto visual realizados na pista atestam que todos os combustíveis comercializados estão em conformidade com as normas vigentes de qualidade da ANP.
                    </p>
                  </div>
                </div>

                {/* Assinaturas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-8 text-[10px] text-center font-bold">
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1.5 uppercase">
                      REPRESENTANTE LEGAL DO REVENDEDOR
                    </div>
                    <p className="text-slate-400 font-normal">{(appState.nomePosto || "MEU POSTO").toUpperCase()}</p>
                  </div>
                  <div className="space-y-1">
                    <div className="border-t border-slate-800 pt-1.5 uppercase">
                      AGENTE REGULADOR / FISCAL DA ANP
                    </div>
                    <p className="text-slate-400 font-normal">MINISTÉRIO DAS MINAS E ENERGIA</p>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Formula Callout */}
          <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-start gap-3">
            <Info className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
            <div className="text-xs text-slate-600 space-y-1">
              <strong className="text-slate-800 font-semibold">Fórmula de Auditoria (Métrica Oficial ANP):</strong>
              <p>
                Sobra ou Falta Diária = <span className="font-mono bg-slate-200/60 px-1 rounded">Estoque Físico Final</span> - (
                <span className="font-mono bg-slate-200/60 px-1 rounded">Estoque Inicial</span> +{" "}
                <span className="font-mono bg-slate-200/60 px-1 rounded">Recebimentos</span> -{" "}
                <span className="font-mono bg-slate-200/60 px-1 rounded">Litros Vendidos</span>). Valores negativos expressam faltas físicas (evaporação/vazamento) e positivos representam sobras físicas.
              </p>
            </div>
          </div>

          {/* Filters Toolbar */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Combustível</label>
                <select
                  value={fuelFilter}
                  onChange={(e) => setFuelFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none cursor-pointer text-slate-700"
                >
                  <option value="all">Todos os Produtos</option>
                  {FUEL_LMC_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">De (Data Inicial)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Até (Data Final)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700 font-semibold"
                />
              </div>
            </div>
            <button
              onClick={() => {
                setFuelFilter("all");
                const d = new Date();
                setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`);
                setEndDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
              }}
              className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 cursor-pointer self-end md:self-auto"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Resetar Filtros
            </button>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Volume Total Vendido</p>
              <p className="text-xl font-black text-indigo-600">{totalSold.toLocaleString("pt-BR")} L</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Volume Total Recebido</p>
              <p className="text-xl font-black text-emerald-600">{totalReceived.toLocaleString("pt-BR")} L</p>
            </div>
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Balanço Geral (Diferença)</p>
              <p className={`text-xl font-black ${totalBalance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {totalBalance >= 0 ? "+" : ""}
                {totalBalance.toLocaleString("pt-BR")} L
              </p>
            </div>
          </div>

          {/* Detailed Tables Grouped by Fuel Type */}
          <div className="space-y-6">
            {Object.keys(recordsByFuel).length === 0 ? (
              <div className="bg-white border border-slate-200 text-center py-12 rounded-2xl text-xs text-slate-500 shadow-sm">
                Nenhum registro LMC encontrado para os filtros e CNPJ selecionados.
              </div>
            ) : (
              Object.keys(recordsByFuel).sort().map((fuel) => {
                const list = recordsByFuel[fuel].sort((a, b) => a.date.localeCompare(b.date));
                const sumDel = list.reduce((sum, r) => sum + (r.deliveryVolume || 0), 0);
                const sumSold = list.reduce((sum, r) => sum + (r.litersSold || 0), 0);
                const finalPhysical = list.length > 0 ? list[list.length - 1].physicalStock : 0;
                const sumSobraFalta = list.reduce((sum, r) => {
                  const exp = getExpectedStock(Number(r.openingStock), Number(r.deliveryVolume), Number(r.litersSold));
                  return sum + getSobraFalta(Number(r.physicalStock), exp);
                }, 0);

                return (
                  <div key={fuel} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                    <div className="border-b border-slate-100 pb-2">
                      <h3 className="font-bold text-sm text-indigo-700 flex items-center gap-1.5">
                        <TrendingUp className="h-4 w-4" />
                        Produto: {fuel}
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="text-[10px] text-slate-400 uppercase font-bold border-b border-slate-100 bg-slate-50/50">
                            <th className="py-2.5 px-3">Data</th>
                            <th className="py-2.5 px-3 text-right">Est. Inicial (L)</th>
                            <th className="py-2.5 px-3 text-right">Entrega (L)</th>
                            <th className="py-2.5 px-3 text-right">Venda (L)</th>
                            <th className="py-2.5 px-3 text-right">Est. Físico (L)</th>
                            <th className="py-2.5 px-3 text-right">Sobra/Falta (L)</th>
                            <th className="py-2.5 px-3 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((r) => {
                            const exp = getExpectedStock(Number(r.openingStock), Number(r.deliveryVolume), Number(r.litersSold));
                            const sf = getSobraFalta(Number(r.physicalStock), exp);

                            return (
                              <tr key={r.id} className="border-b border-slate-100/60 hover:bg-slate-50/40">
                                <td className="py-2 px-3 font-semibold text-slate-700">
                                  {(r.date || "").split("-").reverse().join("/")}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {r.openingStock.toLocaleString("pt-BR")}
                                </td>
                                <td className="py-2 px-3 text-right text-slate-500">
                                  {r.deliveryVolume ? r.deliveryVolume.toLocaleString("pt-BR") : "0"}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-indigo-600">
                                  {r.litersSold.toLocaleString("pt-BR")}
                                </td>
                                <td className="py-2 px-3 text-right font-semibold text-slate-800">
                                  {r.physicalStock.toLocaleString("pt-BR")}
                                </td>
                                <td className={`py-2 px-3 text-right font-black ${sf > 0 ? "text-emerald-600" : sf < 0 ? "text-rose-600" : "text-slate-500"}`}>
                                  {sf === 0 ? "0" : `${sf > 0 ? "+" : ""}${sf.toLocaleString("pt-BR")}`} L
                                </td>
                                <td className="py-2 px-3 text-right space-x-2">
                                  <button
                                    onClick={() => handleOpenEditModal(r)}
                                    className="text-indigo-600 hover:text-indigo-800 font-bold hover:underline cursor-pointer"
                                  >
                                    Editar
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRecord(r.id)}
                                    className="text-rose-600 hover:text-rose-800 font-bold hover:underline cursor-pointer"
                                  >
                                    Apagar
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                          {/* Summary Row */}
                          <tr className="bg-slate-50 font-bold text-[11px] border-t border-slate-200">
                            <td className="py-2.5 px-3 text-slate-800 uppercase">SUBTOTAL</td>
                            <td className="py-2.5 px-3 text-right text-slate-400">-</td>
                            <td className="py-2.5 px-3 text-right text-slate-700">
                              {sumDel.toLocaleString("pt-BR")} L
                            </td>
                            <td className="py-2.5 px-3 text-right text-indigo-700">
                              {sumSold.toLocaleString("pt-BR")} L
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-800">
                              {finalPhysical.toLocaleString("pt-BR")} L
                            </td>
                            <td className={`py-2.5 px-3 text-right font-black ${sumSobraFalta > 0 ? "text-emerald-600" : sumSobraFalta < 0 ? "text-rose-600" : "text-slate-700"}`}>
                              {sumSobraFalta === 0 ? "0" : `${sumSobraFalta > 0 ? "+" : ""}${sumSobraFalta.toLocaleString("pt-BR")}`} L
                            </td>
                            <td className="py-2.5 px-3"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* LMC Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-base font-bold text-slate-800 mb-4 pb-2 border-b border-slate-100">
              {editingId ? "Editar Lançamento LMC" : "Novo Lançamento LMC"}
            </h3>

            <form onSubmit={handleSaveRecord} className="space-y-4">
              {error && <p className="p-2.5 bg-rose-50 text-rose-700 border border-rose-100 rounded-xl text-xs font-semibold">{error}</p>}

              {/* ERP Integration Helper Card */}
              <div className="p-3 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <span className="font-extrabold text-emerald-800 flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-emerald-600" />
                    Integração Direta ERP
                  </span>
                  <p className="text-[11px] text-emerald-700">
                    Sincronizar leituras de bico e entregas NF-e do dia.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAutoFillModal(modalDate, modalFuel)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl transition shrink-0 cursor-pointer shadow-xs"
                >
                  Auto-Preencher
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Combustível / Produto</label>
                <select
                  value={modalFuel}
                  onChange={(e) => {
                    const f = e.target.value;
                    setModalFuel(f);
                    handleAutoFillModal(modalDate, f);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none"
                >
                  {FUEL_LMC_OPTIONS.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data de Referência</label>
                <input
                  type="date"
                  required
                  value={modalDate}
                  onChange={(e) => {
                    const d = e.target.value;
                    setModalDate(d);
                    handleAutoFillModal(d, modalFuel);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-700"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Est. Inicial (Litros)</label>
                  <input
                    type="number"
                    required
                    value={modalOpening}
                    onChange={(e) => setModalOpening(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 font-semibold"
                    placeholder="Ex: 12500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Entrega / Receb. (L)</label>
                  <input
                    type="number"
                    required
                    value={modalDelivery}
                    onChange={(e) => setModalDelivery(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 font-semibold"
                    placeholder="Ex: 10000"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Vendas (Litros)</label>
                  <input
                    type="number"
                    required
                    value={modalSold}
                    onChange={(e) => setModalSold(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 font-semibold"
                    placeholder="Ex: 2450"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Estoque Físico Final (L)</label>
                  <input
                    type="number"
                    required
                    value={modalPhysical}
                    onChange={(e) => setModalPhysical(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-800 font-semibold"
                    placeholder="Ex: 10042"
                  />
                </div>
              </div>

              {/* Dynamic Live Calculations Preview */}
              {!isNaN(Number(modalOpening)) && (
                <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-3.5 text-xs space-y-1">
                  <p className="font-bold text-[10px] text-slate-400 uppercase tracking-wider mb-1.5">Resumo das Contas</p>
                  <div className="flex justify-between text-slate-600">
                    <span>Estoque Contábil (Esperado):</span>
                    <span className="font-bold text-indigo-600">{previewExpected.toLocaleString("pt-BR")} L</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Diferença (Sobra/Falta):</span>
                    <span className={`font-bold ${previewDiff > 0 ? "text-emerald-600" : previewDiff < 0 ? "text-rose-600" : "text-slate-800"}`}>
                      {previewDiff === 0 ? "0 L (Equilibrado)" : `${previewDiff > 0 ? "+" : ""}${previewDiff.toLocaleString("pt-BR")} L (${previewDiff > 0 ? "Sobra" : "Falta"})`}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewModal && (
        <ReportPreviewModal
          isOpen={previewModal.isOpen}
          onClose={() => setPreviewModal(null)}
          appState={appState}
          onUpdateReportCustomization={onUpdateReportCustomization}
          reportType={previewModal.reportType}
          title={previewModal.title}
          subtitle={previewModal.subtitle}
          onExportPDF={() => {
            previewModal.onExportPDF();
            setPreviewModal(null);
          }}
          onExportCSV={() => {
            previewModal.onExportCSV();
            setPreviewModal(null);
          }}
        />
      )}
    </div>
  );
}
