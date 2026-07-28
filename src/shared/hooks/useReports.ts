import { useState, useCallback } from "react";
import { DailyBalance } from "../../types";
import { reportService } from "../services/report.service";

export function useReports(initialBalances: DailyBalance[] = []) {
  const [balances, setBalances] = useState<DailyBalance[]>(initialBalances);

  const getFilteredBalances = useCallback((filters: { startDate?: string; endDate?: string; closedBy?: string }) => {
    return reportService.filterBalances(balances, filters);
  }, [balances]);

  const getKPIStats = useCallback((balancesList: DailyBalance[]) => {
    return reportService.getFinancialKPIs(balancesList);
  }, []);

  return {
    balances,
    setBalances,
    getFilteredBalances,
    getKPIStats,
  };
}
