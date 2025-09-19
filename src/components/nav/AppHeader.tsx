"use client";
import React, { useEffect, useState } from "react";
import DesktopNav from "./DesktopNav";
import MobileNav from "./MobileNav";

export function AppHeader() {
  const getInitial = () => {
    if (typeof window === "undefined") return null;
    return window.innerWidth >= 768;
  };

  const [isDesktop, setIsDesktop] = useState<boolean | null>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const m = window.matchMedia("(min-width: 768px)");
    const update = (ev?: MediaQueryListEvent) => setIsDesktop(ev ? ev.matches : m.matches);
    // initial
    setIsDesktop(m.matches || window.innerWidth >= 768);
    // listener
    if (m.addEventListener) m.addEventListener("change", update);
    else m.addListener(update);
    return () => {
      if (m.removeEventListener) m.removeEventListener("change", update as any);
      else m.removeListener(update as any);
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
