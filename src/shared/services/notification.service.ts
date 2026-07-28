import { ActivityLog } from "../../types";
import { NotificationRepository } from "../repositories/NotificationRepository";

export class NotificationService {
  private repository = new NotificationRepository();

  public getLogs(): ActivityLog[] {
    return this.repository.getAllLogs();
  }

  /**
   * Dispatches a new system activity and audits audit logs securely
   */
  public logActivity(
    actionType: "CREATE" | "UPDATE" | "DELETE" | "SYSTEM" | "SYNC",
    target: string,
    details: string,
    operatorName: string,
    cnpj: string,
    complianceStatus: "Regular" | "Alerta" | "Crítico" = "Regular"
  ): void {
    const today = new Date();
    const date = today.toISOString().split("T")[0];
    const time = today.toTimeString().split(" ")[0].substring(0, 5);

    const log: ActivityLog = {
      id: `audit_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      date,
      time,
      actionType,
      target,
      details,
      operator: operatorName,
      complianceStatus,
      stationCnpj: cnpj,
    };

    this.repository.addLog(log);
  }
}

export const notificationService = new NotificationService();
