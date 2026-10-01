"use client";

import { useEffect, useRef } from "react";

interface MetricTrackerProps {
  articleId: string;
}

export function MetricTracker({ articleId }: MetricTrackerProps) {
  const activeSeconds = useRef(0);
  const isTabActive = useRef(true);
  const reached75Percent = useRef(false);
  const hasSentInitialView = useRef(false);

  useEffect(() => {
    // 1. Registrér indledende visning
    if (!hasSentInitialView.current) {
      hasSentInitialView.current = true;
      try {
        fetch("/api/metrics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            articleId,
            isNewView: true,
            secondsSpent: 0,
            reached75: false,
          }),
        }).catch(() => {});
      } catch {}
    }

    // 2. Følg aktiv opmærksomhedstid (kun når fanen er synlig)
    const handleVisibilityChange = () => {
      isTabActive.current = document.visibilityState === "visible";
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Tæl aktive sekunder hvert sekund, hvis brugeren har fokus
    const timer = setInterval(() => {
      if (isTabActive.current) {
        activeSeconds.current += 1;
      }
    }, 1000);

    // 3. Følg scroll-dybde (tjekker om brugeren når 75%)
    const handleScroll = () => {
      if (reached75Percent.current) return;
      const scrollY = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        const percent = (scrollY / docHeight) * 100;
        if (percent >= 70) {
          reached75Percent.current = true;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });

    // 4. Send akkumulerede metrikker via sendBeacon ved afslutning
    const sendMetrics = () => {
      if (activeSeconds.current === 0 && !reached75Percent.current) return;
      const payload = JSON.stringify({
        articleId,
        isNewView: false,
        secondsSpent: activeSeconds.current,
        reached75: reached75Percent.current,
      });

      if (navigator.sendBeacon) {
        const blob = new Blob([payload], { type: "application/json" });
        navigator.sendBeacon("/api/metrics/track", blob);
      } else {
        fetch("/api/metrics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
    };

    window.addEventListener("pagehide", sendMetrics);
    window.addEventListener("beforeunload", sendMetrics);

    // Send også en delvis opdatering hvert 25. sekund
    const intervalSync = setInterval(() => {
      if (activeSeconds.current >= 5) {
        sendMetrics();
        activeSeconds.current = 0; // Nulstil buffer
      }
    }, 25000);

    return () => {
      clearInterval(timer);
      clearInterval(intervalSync);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", sendMetrics);
      window.removeEventListener("beforeunload", sendMetrics);
      sendMetrics();
    };
  }, [articleId]);

  return null;
}
