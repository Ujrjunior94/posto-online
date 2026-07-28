import { useState, useCallback } from "react";
import { ChecklistRepository } from "../repositories/ChecklistRepository";

export function useChecklist() {
  const [repository] = useState(() => new ChecklistRepository());

  const getChecklists = useCallback(() => {
    return repository.getAllChecklists();
  }, [repository]);

  const updateChecklist = useCallback((shiftId: string, checklist: any) => {
    repository.saveChecklist(shiftId, checklist);
  }, [repository]);

  return {
    getChecklists,
    updateChecklist,
  };
}
