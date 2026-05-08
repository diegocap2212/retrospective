interface StorageHelper {
  get(key: string, isGlobal?: boolean): Promise<{ value: string }>;
  set(key: string, value: string, isGlobal?: boolean): Promise<void>;
  delete(key: string, isGlobal?: boolean): Promise<void>;
}

interface FirestoreHelpers {
  getActionPlan(): Promise<{ lessons: string[]; actions: { id: string; text: string; owner: string; done: boolean }[] }>;
  saveActionPlan(lessons: string[], actions: { id: string; text: string; owner: string; done: boolean }[]): Promise<void>;
  getHistory(): Promise<{ id: string; archivedAt: number; name: string; participants: number; created: string }[]>;
  getHistoryEntry(id: string): Promise<Record<string, unknown>>;
}

interface Window {
  storage: StorageHelper;
  firestoreHelpers: FirestoreHelpers;
}
