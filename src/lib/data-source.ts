import { useSyncExternalStore } from "react";

export type DataSource = "real" | "demo";
let source: DataSource = "real";
const listeners = new Set<() => void>();
export const getDataSource = () => source;
export function setDataSource(next: DataSource) {
  source = next;
  listeners.forEach((listener) => listener());
}
export function useDataSource() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getDataSource,
    () => "real" as DataSource,
  );
}
