import { User } from "../../types";
import { employeeService } from "./employee.service";

export class AuthService {
  /**
   * Simulates authentication verification for employees
   */
  public authenticate(email: string, passwordCrypted: string): User | null {
    const employees = employeeService.getEmployees();
    const user = employees.find((u) => u.email === email);
    
    if (user && user.senhaCriptografada === passwordCrypted) {
      return user;
    }
    return null;
  }

  /**
   * Standardizes station CNPJ format by cleaning non-numeric characters
   */
  public sanitizeCnpj(cnpj: string): string {
    return cnpj.replace(/\D/g, "") || "12345678000199";
  }

  /**
   * Persists active session local states safely
   */
  public saveActiveSession(user: User): void {
    localStorage.setItem("meu_posto_logged_user", JSON.stringify(user));
  }

  public clearActiveSession(): void {
    localStorage.removeItem("meu_posto_logged_user");
  }
}

export const authService = new AuthService();
