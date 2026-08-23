"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";

type NotifType = "success" | "error" | "info" | "";

type Notif = {
  id: number;
  message: string;
  type: NotifType;
  link?: string;
};

type NotifCtx = {
  showNotification: (message: string, type?: NotifType, link?: string) => void;
};

const NotifContext = createContext<NotifCtx>({ showNotification: () => {} });

export function useNotification() {
  return useContext(NotifContext);
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const counter = useRef(0);

  const showNotification = useCallback((message: string, type: NotifType = "", link?: string) => {
    const id = ++counter.current;
    setNotifs((prev) => {
      const updated = prev.length >= 3 ? prev.slice(1) : prev;
      return [...updated, { id, message, type, link }];
    });
    setTimeout(() => setNotifs((prev) => prev.filter((n) => n.id !== id)), 5000);
  }, []);

  const dismiss = (id: number) => setNotifs((prev) => prev.filter((n) => n.id !== id));

  const icon = (type: NotifType) => {
    if (type === "success") return <i className="fa-solid fa-circle-check text-green-500" />;
    if (type === "error")   return <i className="fa-solid fa-circle-exclamation text-red-500" />;
    if (type === "info")    return <i className="fa-solid fa-circle-info text-yellow-500" />;
    return <i className="fa-solid fa-circle-info text-blue-400" />;
  };

  return (
    <NotifContext.Provider value={{ showNotification }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
        {notifs.map((n) => (
          <div
            key={n.id}
            onClick={() => !n.link && dismiss(n.id)}
            className="slide-up flex items-center gap-2 bg-[color:var(--white-smoker)] border rounded-xl shadow-xl px-3 py-2 max-w-xs select-none cursor-pointer"
          >
            <div className="shrink-0">{icon(n.type)}</div>
            <div className="flex-1">
              {n.link ? (
                <a href={n.link} target="_blank" rel="noopener noreferrer" className="btn-text text-xs text-primary font-normal line-clamp-1">
                  {n.message}
                </a>
              ) : (
                <p className="text-xs font-normal line-clamp-1">{n.message}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </NotifContext.Provider>
  );
}
