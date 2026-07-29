import { useCallback } from "react";
import { UserRole } from "../../types";
import { employeeService } from "../services/employee.service";

export function usePermissions(role: UserRole) {
  const checkPermission = useCallback((action: string) => {
    return employeeService.hasPermission(role, action);
  }, [role]);

  return {
    checkPermission,
    isAdmin: role === "Master",
    isGerente: role === "Gerente" || role === "Master",
    isSupervisor: role === "Supervisor" || role === "Gerente" || role === "Master",
    isFrentista: role === "Frentista",
  };
}
