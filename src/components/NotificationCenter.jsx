import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, CircleAlert, CircleCheck, Info, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { useNotifications } from "../contexts/NotificationContext.jsx";

function getNotificationIcon(type) {
  if (type === "success") return <CircleCheck size={18} aria-hidden="true" />;
  if (type === "error" || type === "warning") return <CircleAlert size={18} aria-hidden="true" />;
  return <Info size={18} aria-hidden="true" />;
}

function formatNotificationTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function NotificationItem({ notification, onRead, onRemove }) {
  return (
    <article className={`notification-item ${notification.type}${notification.read ? "" : " unread"}`}>
      <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
      <div className="notification-copy">
        <div className="notification-title-row">
          <strong>{notification.title}</strong>
          <time dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time>
        </div>
        {notification.message ? <p>{notification.message}</p> : null}
        {notification.actionHref && notification.actionLabel ? (
          <Link className="notification-action" to={notification.actionHref} onClick={onRead}>
            {notification.actionLabel}
          </Link>
        ) : null}
      </div>
      <button className="notification-remove" type="button" onClick={onRemove} aria-label={`Remove ${notification.title}`}>
        <X size={15} aria-hidden="true" />
      </button>
    </article>
  );
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const popoverRef = useRef(null);
  const { notifications, unreadCount, markAllRead, markRead, removeNotification, clearNotifications } = useNotifications();

  useEffect(() => {
    if (!open) return;

    const closeOnOutsideClick = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const closeOnEscape = (event) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="notification-center" ref={popoverRef}>
      <button
        className="icon-button notification-trigger"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount ? <span className="notification-badge">{unreadCount > 9 ? "9+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className="notification-popover" aria-label="Notifications">
          <div className="notification-head">
            <div>
              <strong>Notifications</strong>
              <span>{notifications.length ? `${unreadCount} unread` : "No updates yet"}</span>
            </div>
            <div className="notification-head-actions">
              <button className="icon-button small" type="button" onClick={markAllRead} aria-label="Mark all as read" disabled={!unreadCount}>
                <CheckCheck size={16} aria-hidden="true" />
              </button>
              <button className="icon-button small" type="button" onClick={clearNotifications} aria-label="Clear notifications" disabled={!notifications.length}>
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="notification-list">
            {notifications.length ? (
              notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markRead(notification.id)}
                  onRemove={() => removeNotification(notification.id)}
                />
              ))
            ) : (
              <div className="notification-empty">
                <Bell size={20} aria-hidden="true" />
                <p>Helpful app updates will appear here.</p>
              </div>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function NotificationToasts() {
  const { toastNotifications, dismissToast, markRead } = useNotifications();

  if (!toastNotifications.length) return null;

  return (
    <div className="notification-toasts" role="status" aria-live="polite">
      {toastNotifications.map((notification) => (
        <article className={`notification-toast ${notification.type}`} key={notification.id}>
          <div className="notification-icon">{getNotificationIcon(notification.type)}</div>
          <div className="notification-copy">
            <strong>{notification.title}</strong>
            {notification.message ? <p>{notification.message}</p> : null}
            {notification.actionHref && notification.actionLabel ? (
              <Link className="notification-action" to={notification.actionHref} onClick={() => markRead(notification.id)}>
                {notification.actionLabel}
              </Link>
            ) : null}
          </div>
          <button className="notification-remove" type="button" onClick={() => dismissToast(notification.id)} aria-label={`Dismiss ${notification.title}`}>
            <X size={15} aria-hidden="true" />
          </button>
        </article>
      ))}
    </div>
  );
}
