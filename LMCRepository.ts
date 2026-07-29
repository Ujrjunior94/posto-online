import { useState, useCallback } from "react";
import { ActivityLog } from "../../types";
import { notificationService } from "../services/notification.service";

export function useNotifications(initialLogs: ActivityLog[] = []) {
  const [logs, setLogs] = useState<ActivityLog[]>(initialLogs);

  const dispatchLog = useCallback((
    actionType: "CREATE" | "UPDATE" | "DELETE" | "SYSTEM" | "SYNC",
    target: string,
    details: string,
    operator: string,
    cnpj: string,
    complianceStatus?: "Regular" | "Alerta" | "Crítico"
  ) => {
    notificationService.logActivity(actionType, target, details, operator, cnpj, complianceStatus);
  }, []);

  return {
    logs,
    setLogs,
    dispatchLog,
  };
}
