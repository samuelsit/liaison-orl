import { Comfortaa, Inter, Lato, Montserrat, Nunito } from "next/font/google";
import type { FontChoice } from "@/lib/schemas/organization";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const comfortaa = Comfortaa({ subsets: ["latin"], variable: "--font-comfortaa", display: "swap", weight: ["400", "500", "600", "700"] });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito", display: "swap", preload: false });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-montserrat", display: "swap", preload: false });
const lato = Lato({ subsets: ["latin"], variable: "--font-lato", display: "swap", weight: ["400", "700"], preload: false });

export const fontVariables = [inter, comfortaa, nunito, montserrat, lato].map((f) => f.variable).join(" ");

export const FONT_CSS_VAR: Record<FontChoice, string> = {
  Inter: "var(--font-inter)",
  Comfortaa: "var(--font-comfortaa)",
  Nunito: "var(--font-nunito)",
  Montserrat: "var(--font-montserrat)",
  Lato: "var(--font-lato)",
};
