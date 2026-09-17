import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const NotificationContext = createContext(null);
const NOTIFICATION_KEY = "hachi_notifications";
const MAX_NOTIFICATIONS = 25;
const TOAST_DURATION = 5200;

function readNotifications() {
  try {
    const saved = JSON.parse(localStorage.getItem(NOTIFICATION_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(0, MAX_NOTIFICATIONS) : [];
  } catch {
    return [];
  }
}

function createNotification(notification) {
  return {
    id: notification.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`),
    type: notification.type || "info",
    title: notification.title || "Hachi",
    message: notification.message || "",
    createdAt: notification.createdAt || new Date().toISOString(),
    read: Boolean(notification.read),
    actionLabel: notification.actionLabel || "",
    actionHref: notification.actionHref || ""
  };
}

export function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState(readNotifications);
  const [toastIds, setToastIds] = useState([]);

  useEffect(() => {
    localStorage.setItem(NOTIFICATION_KEY, JSON.stringify(notifications.slice(0, MAX_NOTIFICATIONS)));
  }, [notifications]);

  const dismissToast = useCallback((id) => {
    setToastIds((current) => current.filter((toastId) => toastId !== id));
  }, []);

  const notify = useCallback(
    (notification) => {
      const nextNotification = createNotification(notification);
      setNotifications((current) => [nextNotification, ...current.filter((item) => item.id !== nextNotification.id)].slice(0, MAX_NOTIFICATIONS));
      setToastIds((current) => [nextNotification.id, ...current.filter((id) => id !== nextNotification.id)].slice(0, 3));

      window.setTimeout(() => dismissToast(nextNotification.id), notification.duration || TOAST_DURATION);
      return nextNotification.id;
    },
    [dismissToast]
  );

  useEffect(() => {
    const handleNotifyEvent = (event) => {
      if (!event.detail) return;
      notify(event.detail);
    };

    window.addEventListener("hachi:notify", handleNotifyEvent);
    return () => window.removeEventListener("hachi:notify", handleNotifyEvent);
  }, [notify]);

  const markAllRead = useCallback(() => {
    setNotifications((current) => current.map((notification) => ({ ...notification, read: true })));
  }, []);

  const markRead = useCallback((id) => {
    setNotifications((current) => current.map((notification) => (notification.id === id ? { ...notification, read: true } : notification)));
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
    dismissToast(id);
  }, [dismissToast]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setToastIds([]);
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      toastNotifications: toastIds.map((id) => notifications.find((notification) => notification.id === id)).filter(Boolean),
      unreadCount: notifications.filter((notification) => !notification.read).length,
      notify,
      markAllRead,
      markRead,
      removeNotification,
      clearNotifications,
      dismissToast
    }),
    [clearNotifications, dismissToast, markAllRead, markRead, notifications, notify, removeNotification, toastIds]
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used inside NotificationProvider.");
  }
  return context;
}
