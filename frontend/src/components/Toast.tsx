import { useEffect, useState } from "react";

type ToastType = "success" | "error" | "info";

let showToastGlobal: (message: string, type?: ToastType) => void = () => {};

export function toast(message: string, type: ToastType = "info") {
  showToastGlobal(message, type);
}

export default function ToastContainer() {
  const [toasts, setToasts] = useState<{ id: number; message: string; type: ToastType }[]>([]);

  useEffect(() => {
    let nextId = 0;
    showToastGlobal = (message, type = "info") => {
      const id = nextId++;
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
