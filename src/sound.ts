// src/sound.ts
let _ctx: AudioContext | null = null;
function ctx() {
  if (!_ctx) _ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return _ctx!;
}

export function beep(freq = 880, durationMs = 100, volume = 0.06, type: OscillatorType = "square") {
  const ac = ctx();
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = volume;

  osc.connect(gain);
  gain.connect(ac.destination);

  const now = ac.currentTime;
  osc.start(now);
  osc.stop(now + durationMs / 1000);
}

export const clickBeep   = () => beep(1400, 60,  0.04, "square"); // คลิกปุ่ม
export const pendingBeep = () => beep( 900, 90,  0.05, "square"); // ตอนยิงออเดอร์
export const winBeep     = () => { beep(1200, 90, 0.06, "triangle"); setTimeout(()=>beep(1600, 90, 0.05, "triangle"),110); };
export const lossBeep    = () => beep( 320, 180, 0.06, "sawtooth");
export const drawBeep    = () => beep( 660, 150, 0.05, "sine");
