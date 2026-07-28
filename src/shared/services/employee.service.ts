import { User, UserRole, TimesheetEntry } from "../../types";
import { EmployeeRepository } from "../repositories/EmployeeRepository";

export class EmployeeService {
  private repository = new EmployeeRepository();

  public getEmployees(): User[] {
    return this.repository.getAll();
  }

  public getEmployeeById(id: string): User | undefined {
    return this.repository.getById(id);
  }

  public saveEmployee(user: User): void {
    this.repository.save(user);
  }

  public deleteEmployee(id: string): void {
    this.repository.delete(id);
  }

  /**
   * Evaluates Role-Based Access Control (RBAC) permissions
   */
  public hasPermission(role: UserRole, action: string): boolean {
    const permissions: Record<UserRole, string[]> = {
      Master: ["*"], // Complete access
      Gerente: [
        "dashboard.read", "dashboard.write",
        "employees.read", "employees.write",
        "shifts.read", "shifts.write",
        "tanks.read", "tanks.write",
        "nozzles.read", "nozzles.write",
        "lmc.read", "lmc.write",
        "deliveries.read", "deliveries.write",
        "checklists.read", "checklists.write",
        "reports.read", "reports.write",
        "cash.read", "cash.write",
        "settings.read", "settings.write"
      ],
      Supervisor: [
        "dashboard.read",
        "shifts.read", "shifts.write",
        "tanks.read",
        "nozzles.read",
        "lmc.read",
        "deliveries.read", "deliveries.write",
        "checklists.read", "checklists.write",
        "reports.read",
        "cash.read"
      ],
      Frentista: [
        "dashboard.read",
        "shifts.read",
        "checklists.read", "checklists.write",
        "deliveries.read"
      ]
    };

    const userPermissions = permissions[role] || [];
    if (userPermissions.includes("*")) return true;
    return userPermissions.includes(action);
  }

  /**
   * Calculates shift duration in hours and minutes for timesheet entries
   */
  public calculateShiftHours(entry: TimesheetEntry): string {
    if (!entry.entrada || !entry.saida) return "00:00";

    try {
      const [entH, entM] = entry.entrada.split(":").map(Number);
      const [saiH, saiM] = entry.saida.split(":").map(Number);

      let totalMinutes = (saiH * 60 + saiM) - (entH * 60 + entM);

      // Handle lunch break deduction
      if (entry.intervaloInicio && entry.intervaloFim) {
        const [intIniH, intIniM] = entry.intervaloInicio.split(":").map(Number);
        const [intFimH, intFimM] = entry.intervaloFim.split(":").map(Number);
        const breakMin = (intFimH * 60 + intFimM) - (intIniH * 60 + intIniM);
        if (breakMin > 0) {
          totalMinutes -= breakMin;
        }
      }

      if (totalMinutes < 0) return "00:00";

      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      
      return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    } catch {
      return "00:00";
    }
  }
}

export const employeeService = new EmployeeService();
