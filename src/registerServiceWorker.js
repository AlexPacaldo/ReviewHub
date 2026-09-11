export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
      console.warn("Service worker registration failed.", error);
    });
  });
}
