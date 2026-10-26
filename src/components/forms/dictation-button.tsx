"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type RecognitionCtor = new () => SpeechRecognitionLike;

function getRecognition(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Dictée vocale du navigateur (Web Speech API), en français. */
export function DictationButton({ onText, onEnd, label = "Dicter" }: { onText: (text: string) => void; onEnd?: () => void; label?: string }) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const rec = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setSupported(Boolean(getRecognition())));
    return () => {
      cancelAnimationFrame(id);
      rec.current?.stop();
    };
  }, []);

  if (!supported) return null;

  function toggle() {
    if (listening) {
      rec.current?.stop();
      return;
    }
    const Ctor = getRecognition();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "fr-FR";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i]!.isFinal) text += e.results[i]![0].transcript;
      if (text.trim()) onText(text.trim());
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Autorisez l'accès au micro pour dicter.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("La dictée a été interrompue.");
    };
    r.onend = () => {
      setListening(false);
      onEnd?.();
    };
    rec.current = r;
    r.start();
    setListening(true);
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={toggle} aria-pressed={listening} className={cn("h-9 gap-1.5", listening && "border-destructive text-destructive")}>
      {listening ? <MicOff aria-hidden /> : <Mic aria-hidden />}
      {listening ? "Arrêter" : label}
      {listening ? <span className="size-2 animate-pulse rounded-full bg-destructive" aria-hidden /> : null}
    </Button>
  );
}
