import { BaseRepository } from "./BaseRepository";
import { User } from "../../types";

export class EmployeeRepository extends BaseRepository {
  public getAll(): User[] {
    return this.getAppState().users || [];
  }

  public getById(id: string): User | undefined {
    return this.getAll().find((u) => u.id === id);
  }

  public save(user: User): void {
    const state = this.getAppState();
    const users = [...(state.users || [])];
    const index = users.findIndex((u) => u.id === user.id);

    if (index >= 0) {
      users[index] = user;
    } else {
      users.push(user);
    }

    this.saveAppState({ ...state, users, updatedAt: Date.now() });
  }

  public delete(id: string): void {
    const state = this.getAppState();
    const users = (state.users || []).filter((u) => u.id !== id);
    this.saveAppState({ ...state, users, updatedAt: Date.now() });
  }
}
