// src/components/SoundPack.tsx
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

/** เสียงที่รองรับ — เพิ่ม equal เข้ามาด้วย */
export type Kind = "start" | "pause" | "win" | "lose" | "equal";

/** public API ของ hook */
type Ctx = {
  play: (k: Kind) => void;
  muted: boolean;
  toggle: () => void;
  mute: () => void;
  unmute: () => void;
  volume: number; // 0..1
  setVolume: (v: number) => void;
};

const KEY_MUTED = "angelbot.muted";
const KEY_VOLUME = "angelbot.volume";
const SoundCtx = createContext<Ctx | null>(null);

/** ไฟล์เสียงใน public/sounds — เปลี่ยนชื่อไฟล์ได้ตามที่มีจริง */
const DEFAULT_SRC: Record<Kind, string> = {
  start: "/sounds/start.mp3",
  pause: "/sounds/pause.mp3",
  win: "/sounds/win.mp3",
  lose: "/sounds/lose.mp3",
  equal: "/sounds/equal.mp3", // ถ้าไม่มีไฟล์นี้จะโดน catch แล้วข้ามเอง
};

function makeAudio(src: string, vol: number) {
  const a = new Audio(src);
  a.preload = "auto";
  a.volume = vol; // ใช้ค่า volume จาก state
  // ป้องกันเสียงค้าง
  a.addEventListener("ended", () => {
    try {
      a.currentTime = 0;
    } catch {}
  });
  return a;
}

/** helper: เอา value จาก localStorage แบบมี fallback */
function getLS(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setLS(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

export function SoundProvider({
  children,
  /** จะ override แผนที่ไฟล์เสียงก็ได้ เช่น { win: "/xyz.mp3" } */
  srcMap,
  /** throttle ต่อชนิดเสียง (ms) กันกดรัว ๆ */
  throttleMs = 250,
}: {
  children: React.ReactNode;
  srcMap?: Partial<Record<Kind, string>>;
  throttleMs?: number;
}) {
  const initialMuted = getLS(KEY_MUTED) === "1";
  const initialVol = Math.min(
    1,
    Math.max(0, Number(getLS(KEY_VOLUME) ?? 1))
  );

  const [muted, setMuted] = useState<boolean>(initialMuted);
  const [volume, setVolumeState] = useState<number>(initialVol);
  const unlockedRef = useRef(false); // สำหรับ autoplay policy
  const lastPlayAtRef = useRef<Record<Kind, number>>({
    start: 0,
    pause: 0,
    win: 0,
    lose: 0,
    equal: 0,
  });

  /** รวม src map ขั้นสุดท้าย */
  const finalSrcMap = useMemo(() => {
    return { ...DEFAULT_SRC, ...(srcMap || {}) };
  }, [srcMap]);

  /** โหลด bank เสียงครั้งเดียว */
  const bank = useRef<Partial<Record<Kind, HTMLAudioElement>>>({});
  useEffect(() => {
    (Object.keys(finalSrcMap) as Kind[]).forEach((k) => {
      const src = finalSrcMap[k];
      // เผื่อมีคนส่ง path ว่าง ๆ มา ให้ข้าม
      if (!src) return;
      bank.current[k] = makeAudio(src, volume);
    });
    return () => {
      Object.values(bank.current).forEach((a) => {
        if (!a) return;
        try {
          a.pause();
          // @ts-ignore
          a.src = "";
        } catch {}
      });
      bank.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalSrcMap]);

  /** sync volume ไปทุกเสียงเมื่อเปลี่ยน */
  useEffect(() => {
    Object.values(bank.current).forEach((a) => {
      if (a) a.volume = volume;
    });
  }, [volume]);

  /** unlock หลัง user interaction ครั้งแรก กัน autoplay policy */
  useEffect(() => {
    const unlock = () => {
      if (unlockedRef.current) return;
      unlockedRef.current = true;
      // พยายามเล่นแบบเงียบ ๆ สั้น ๆ เพื่อ prime audio element (บาง browser)
      const a = new Audio();
      a.muted = true;
      a.play().catch(() => {}); // แค่ trigger gesture
    };
    const evts: (keyof DocumentEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    evts.forEach((e) => document.addEventListener(e, unlock, { once: true }));
    return () => evts.forEach((e) => document.removeEventListener(e, unlock));
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      play: (k) => {
        if (muted) return;
        const now = Date.now();
        const last = lastPlayAtRef.current[k] || 0;
        if (now - last < throttleMs) return; // กันสแปม
        lastPlayAtRef.current[k] = now;

        const a = bank.current[k];
        if (!a) return; // ไม่มีไฟล์นี้ ข้าม
        try {
          a.currentTime = 0;
        } catch {}
        // Safari เก่า ๆ บางทีต้องรอ unlock
        const p = a.play();
        if (p && typeof p.catch === "function") {
          p.catch(() => {
            // เงียบ ๆ ไป ไม่โยน error ให้หน้าขาว
          });
        }
      },
      muted,
      toggle: () => {
        setMuted((m) => {
          const next = !m;
          setLS(KEY_MUTED, next ? "1" : "0");
          return next;
        });
      },
      mute: () => {
        setMuted(true);
        setLS(KEY_MUTED, "1");
      },
      unmute: () => {
        setMuted(false);
        setLS(KEY_MUTED, "0");
      },
      volume,
      setVolume: (v: number) => {
        const clamped = Math.min(1, Math.max(0, v));
        setVolumeState(clamped);
        setLS(KEY_VOLUME, String(clamped));
      },
    }),
    [muted, volume, throttleMs]
  );

  return <SoundCtx.Provider value={value}>{children}</SoundCtx.Provider>;
}

export function useSound() {
  const ctx = useContext(SoundCtx);
  if (!ctx) throw new Error("useSound must be used within <SoundProvider>");
  return ctx;
}
