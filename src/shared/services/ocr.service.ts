import { EscalaPattern } from "../../types";

export class OcrService {
  /**
   * Mock OCR text parser for roster timesheet spreadsheets (escalas)
   */
  public parseScheduleRosterOCR(rawText: string): Partial<EscalaPattern>[] {
    const patterns: Partial<EscalaPattern>[] = [];
    const lines = rawText.split("\n");

    lines.forEach((line, index) => {
      // Look for employee names or patterns
      if (line.trim().length > 3 && (line.includes("6x1") || line.includes("12x36") || line.includes("Turno"))) {
        const parts = line.split(/[;,\t]/);
        const name = parts[0] || `Frentista Autodetectado ${index}`;
        const type = line.includes("12x36") ? "12x36" : "6x1";

        patterns.push({
          id: `ocr_pattern_${Date.now()}_${index}`,
          funcionario: name.trim(),
          tipoEscala: type,
          sequenciaTurnos: ["Turno A (Manhã)"],
          diasTurno: type === "12x36" ? 1 : 6,
          diasFolga: type === "12x36" ? 1 : 1,
          historicoEscalasCount: 1,
          ultimaAtualizacao: new Date().toISOString().split("T")[0],
          confiancaIA: Math.floor(Math.random() * 15) + 85, // Generates 85% to 100% confidence
        });
      }
    });

    return patterns;
  }
}

export const ocrService = new OcrService();
