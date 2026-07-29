import { DailyBalance } from "../../types";
import { ReportRepository } from "../repositories/ReportRepository";

export class ReportService {
  private repository = new ReportRepository();

  public getBalances(): DailyBalance[] {
    return this.repository.getDailyBalances();
  }

  public saveBalance(balance: DailyBalance): void {
    this.repository.saveDailyBalance(balance);
  }

  public deleteBalance(id: string): void {
    this.repository.deleteDailyBalance(id);
  }

  /**
   * Filters daily balances based on date range and operator limits
   */
  public filterBalances(balances: DailyBalance[], filters: { startDate?: string; endDate?: string; closedBy?: string }): DailyBalance[] {
    return balances.filter((b) => {
      if (filters.startDate && b.data < filters.startDate) return false;
      if (filters.endDate && b.data > filters.endDate) return false;
      if (filters.closedBy && filters.closedBy !== "" && b.fechadoPor !== filters.closedBy) return false;
      return true;
    });
  }

  /**
   * Aggregates financial balances and calculates core KPIs
   */
  public getFinancialKPIs(balances: DailyBalance[]): {
    totalSales: number;
    totalExpenses: number;
    netProfit: number;
    averageSalesPerDay: number;
    paymentMethodDistribution: { name: string; value: number }[];
  } {
    if (balances.length === 0) {
      return { totalSales: 0, totalExpenses: 0, netProfit: 0, averageSalesPerDay: 0, paymentMethodDistribution: [] };
    }

    let totalFuelSales = 0;
    let totalLubesSales = 0;
    let totalOtherSales = 0;
    let totalExpenses = 0;

    let totalCash = 0;
    let totalCredit = 0;
    let totalDebit = 0;
    let totalPix = 0;
    let totalTerm = 0;

    balances.forEach((b) => {
      totalFuelSales += b.vendaCombustivel || 0;
      totalLubesSales += b.vendaLubrificantes || 0;
      totalOtherSales += b.outrasReceitas || 0;
      totalExpenses += b.totalDespesas || 0;

      if (b.metodosPagamento) {
        totalCash += b.metodosPagamento.dinheiro || 0;
        totalCredit += b.metodosPagamento.cartaoCredito || 0;
        totalDebit += b.metodosPagamento.cartaoDebito || 0;
        totalPix += b.metodosPagamento.pix || 0;
        totalTerm += b.metodosPagamento.prazo || 0;
      }
    });

    const totalSales = totalFuelSales + totalLubesSales + totalOtherSales;
    const netProfit = totalSales - totalExpenses;

    return {
      totalSales,
      totalExpenses,
      netProfit,
      averageSalesPerDay: parseFloat((totalSales / balances.length).toFixed(2)),
      paymentMethodDistribution: [
        { name: "Dinheiro", value: parseFloat(totalCash.toFixed(2)) },
        { name: "Crédito", value: parseFloat(totalCredit.toFixed(2)) },
        { name: "Débito", value: parseFloat(totalDebit.toFixed(2)) },
        { name: "PIX", value: parseFloat(totalPix.toFixed(2)) },
        { name: "A Prazo", value: parseFloat(totalTerm.toFixed(2)) },
      ],
    };
  }
}

export const reportService = new ReportService();
