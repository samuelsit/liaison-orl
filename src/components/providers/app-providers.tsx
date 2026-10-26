"use client";

import { MotionConfig } from "motion/react";
import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange nonce={nonce}>
      <TooltipProvider delayDuration={300}>
        {/* Les animations respectent « réduire les animations » du système. */}
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
        {/* Sur mobile, les notifications passent au-dessus des barres d'action et de la barre d'onglets. */}
        <Toaster position="bottom-right" closeButton mobileOffset={{ bottom: "calc(5rem + env(safe-area-inset-bottom))" }} />
      </TooltipProvider>
    </ThemeProvider>
  );
}
