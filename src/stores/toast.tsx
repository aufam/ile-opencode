import { createContext, createSignal, type ParentProps, useContext } from "solid-js";
import { uuid } from "../lib/id";

export interface Toast {
  id: string;
  message: string;
  tone: "info" | "success" | "error";
}

const [toasts, setToasts] = createSignal<Toast[]>([]);

export function pushToast(message: string, tone: Toast["tone"] = "info"): void {
  const id = uuid();
  setToasts((t) => [...t.slice(-3), { id, message, tone }]);
  window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
}

interface ToastContextValue {
  toasts: () => Toast[];
}

const ToastContext = createContext<ToastContextValue>({ toasts });

export function ToastProvider(props: ParentProps) {
  return <ToastContext.Provider value={{ toasts }}>{props.children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
