"use client";
import React, { useEffect, useState } from "react";
import DesktopNav from "./DesktopNav";
import MobileNav from "./MobileNav";

// Compatibilité Safari: MediaQueryList historique avec addListener/removeListener
type MQLegacy = MediaQueryList & {
  addListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
  removeListener?: (listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void) => void;
};

export function AppHeader() {
  const getInitial = () => {
    if (typeof window === "undefined") return null;
    return window.innerWidth >= 768;
  };

  const [isDesktop, setIsDesktop] = useState<boolean | null>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(min-width: 768px)");

    const onChange: (ev: MediaQueryListEvent) => void = (ev) => {
      setIsDesktop(ev.matches);
    };

    // Initial
    setIsDesktop(m.matches || window.innerWidth >= 768);

    // Écouteurs suivant l'API disponible
    if (typeof m.addEventListener === "function") m.addEventListener("change", onChange);
    else if ((m as MQLegacy).addListener) (m as MQLegacy).addListener!(onChange);

    return () => {
      if (typeof m.removeEventListener === "function") m.removeEventListener("change", onChange);
      else if ((m as MQLegacy).removeListener) (m as MQLegacy).removeListener!(onChange);
    };
  }, []);

  if (isDesktop === null) {
    return (
      <header>
        <div className="h-14 flex items-center px-3">{/* placeholder */}</div>
      </header>
    );
  }

  return (
    <header>
      {isDesktop ? <DesktopNav /> : <MobileNav />}
    </header>
  );
}

export default AppHeader;
