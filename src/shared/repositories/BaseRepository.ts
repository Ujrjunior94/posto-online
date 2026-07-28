import { AppState } from "../../types";

const STORAGE_KEY = "meu_posto_app_state";

export class BaseRepository {
  protected getAppState(): AppState {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      throw new Error("AppState não inicializado no localStorage.");
    }
    return JSON.parse(saved);
  }

  protected saveAppState(state: AppState): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    // Trigger window storage event or custom event so components re-render if listening
    window.dispatchEvent(new Event("storage"));
    window.dispatchEvent(new CustomEvent("appStateUpdated", { detail: state }));
  }
}
