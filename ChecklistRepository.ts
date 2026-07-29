import { useState, useCallback } from "react";
import { User, TimesheetEntry } from "../../types";
import { employeeService } from "../services/employee.service";

export function useEmployees(initialUsers: User[] = []) {
  const [users, setUsers] = useState<User[]>(initialUsers);

  const calculateHours = useCallback((entry: TimesheetEntry) => {
    return employeeService.calculateShiftHours(entry);
  }, []);

  return {
    users,
    setUsers,
    calculateHours,
  };
}
