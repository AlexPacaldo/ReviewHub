export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return;

  window.addEventListener("load", () => {
    const serviceWorkerUrl = `${import.meta.env.BASE_URL}service-worker.js`;
    navigator.serviceWorker
      .register(serviceWorkerUrl)
      .then((registration) => {
        if (registration.waiting) {
          window.dispatchEvent(new Event("reviewhub:update-ready"));
        }

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              window.dispatchEvent(new Event("reviewhub:update-ready"));
            }
          });
        });
      })
      .catch((error) => {
        console.warn("Service worker registration failed.", error);
      });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.dispatchEvent(new Event("reviewhub:update-ready"));
    });
  });
}
