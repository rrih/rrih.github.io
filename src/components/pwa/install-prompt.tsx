"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if app is already installed
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)"
    ).matches;
    const isInWebapp =
      (window.navigator as { standalone?: boolean }).standalone === true;

    if (isStandalone || isInWebapp) {
      setIsInstalled(true);
      return;
    }

    // Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      setDeferredPrompt(promptEvent);

      // Show install prompt after a short delay
      setTimeout(() => {
        const hasSeenPrompt = localStorage.getItem("pwa-install-prompt-seen");
        const lastPromptTime = localStorage.getItem("pwa-install-prompt-time");
        const now = Date.now();

        // Show prompt if never seen, or if it's been more than 24 hours since last dismiss
        if (
          !hasSeenPrompt ||
          (lastPromptTime &&
            now - Number.parseInt(lastPromptTime) > 24 * 60 * 60 * 1000)
        ) {
          setShowInstallPrompt(true);
        }
      }, 2000);
    };

    // Listen for app installed event
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowInstallPrompt(false);
      setDeferredPrompt(null);
      localStorage.setItem("pwa-install-prompt-seen", "true");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;

    if (choiceResult.outcome === "accepted") {
      setIsInstalled(true);
    }

    setShowInstallPrompt(false);
    setDeferredPrompt(null);
    localStorage.setItem("pwa-install-prompt-seen", "true");
    localStorage.setItem("pwa-install-prompt-time", Date.now().toString());
  };

  const handleDismiss = () => {
    setShowInstallPrompt(false);
    localStorage.setItem("pwa-install-prompt-seen", "true");
    localStorage.setItem("pwa-install-prompt-time", Date.now().toString());
  };

  // Don't show if already installed or no prompt available
  if (isInstalled || !deferredPrompt || !showInstallPrompt) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:w-96 bg-white dark:bg-card-dark border border-border-light dark:border-border-dark rounded-lg shadow-lg p-4 z-50">
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Close install prompt"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-accent/10 p-2">
          <Download className="h-5 w-5 text-accent" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-sm mb-1">Install ToolForge</h3>
          <p className="text-xs text-foreground-light-secondary dark:text-foreground-dark-secondary mb-3">
            Install as an app for faster access and offline support
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleInstallClick}
              className="rounded-lg bg-accent px-3 py-2 text-white text-xs font-medium hover:bg-accent-dark transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="rounded-lg border border-border-light dark:border-border-dark px-3 py-2 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Not now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
