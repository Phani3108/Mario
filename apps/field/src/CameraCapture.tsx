import { useEffect, useRef, useState } from 'react';
import { getGeo } from './lib';

type Props = {
  onCapture: (blob: Blob, meta: { lat: number; lng: number; capturedAt: string }) => void;
  onCancel: () => void;
  task: { id: string; title: string; location: string };
  mode?: 'proof' | 'selfie';
  referenceImageUrl?: string | null;
};

const MAX_EDGE_PX = 1280;
const BLUR_THRESHOLD = 100; // empirical Laplacian variance threshold

/**
 * In-app camera capture. getUserMedia → draw to canvas → blur-check → downscale → blob.
 * Watermark is burned in on the client; server re-watermarks the canonical version.
 */
export function CameraCapture({ onCapture, onCancel, task, mode = 'proof', referenceImageUrl }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [geo, setGeo] = useState<GeolocationPosition | null>(null);
  const [busy, setBusy] = useState(false);
  const [blurWarn, setBlurWarn] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const geoP = getGeo().catch((e) => { throw new Error('GPS: ' + e.message); });
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: mode === 'selfie' ? 'user' : 'environment' },
            width: { ideal: 1920 }, height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setGeo(await geoP);
      } catch (e: any) {
        setErr(e.message ?? 'camera/gps failed');
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  async function snap() {
    if (!videoRef.current || !geo) return;
    setBusy(true);
    setBlurWarn(null);
    try {
      const v = videoRef.current;
      const srcW = v.videoWidth, srcH = v.videoHeight;
      // Scale to max edge MAX_EDGE_PX preserving aspect ratio.
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(srcW, srcH));
      const w = Math.round(srcW * scale);
      const h = Math.round(srcH * scale);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(v, 0, 0, w, h);

      // Blur check: sample a small grayscale tile and compute Laplacian variance.
      const variance = laplacianVariance(ctx, w, h);
      if (variance < BLUR_THRESHOLD && mode === 'proof') {
        setBlurWarn(`Photo looks blurry (sharpness ${variance.toFixed(0)}). Please retake.`);
        return;
      }

      drawWatermark(ctx, w, h, {
        taskId: task.id,
        title: task.title,
        location: task.location,
        lat: geo.coords.latitude,
        lng: geo.coords.longitude,
        ts: new Date(),
      });
      const blob: Blob = await new Promise((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.85),
      );
      onCapture(blob, {
        lat: geo.coords.latitude,
        lng: geo.coords.longitude,
        capturedAt: new Date().toISOString(),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      <div className="p-3 text-xs text-amber-400 font-bold tracking-widest flex items-center gap-3">
        CAPTURE PROOF
        <span className="text-slate-400 font-mono">#{task.id.slice(0, 8)}</span>
        <button onClick={onCancel} className="ml-auto text-slate-300">✕ Cancel</button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
        {/* corner brackets */}
        <div className="absolute inset-6 pointer-events-none">
          <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-amber-400" />
          <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-amber-400" />
          <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-amber-400" />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-amber-400" />
        </div>
        {/* reference image overlay (top-right) */}
        {referenceImageUrl && (
          <button
            onClick={() => setShowRef((s) => !s)}
            className="absolute top-3 right-3 bg-black/70 border-2 border-amber-400 rounded overflow-hidden shadow-lg"
            style={{ width: 110, height: 80 }}
          >
            <img src={referenceImageUrl} alt="reference" className="w-full h-full object-cover" />
            <div className="absolute bottom-0 inset-x-0 text-[9px] font-bold bg-amber-400 text-slate-900 tracking-wider">
              REFERENCE
            </div>
          </button>
        )}
        {showRef && referenceImageUrl && (
          <div
            onClick={() => setShowRef(false)}
            className="absolute inset-0 bg-black/85 grid place-items-center cursor-pointer z-10"
          >
            <img src={referenceImageUrl} alt="reference" className="max-w-full max-h-full" />
            <div className="absolute top-3 right-3 text-amber-300 text-xs font-bold">tap to close</div>
          </div>
        )}
        {/* HUD */}
        <div className="absolute bottom-3 left-3 right-3 text-[11px] font-mono text-amber-300 bg-black/60 rounded p-2">
          {geo ? (
            <>
              GPS {geo.coords.latitude.toFixed(5)}, {geo.coords.longitude.toFixed(5)} · ±{Math.round(geo.coords.accuracy)}m<br />
              {task.location} · {new Date().toLocaleTimeString()}
            </>
          ) : 'waiting for GPS…'}
        </div>
        {err && <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-red-600 text-white p-3 rounded">{err}</div>}
        {blurWarn && (
          <div className="absolute top-20 left-3 right-3 bg-red-600 text-white p-3 rounded text-sm font-semibold flex items-center gap-2">
            <span>⚠</span>
            <span className="flex-1">{blurWarn}</span>
            <button onClick={() => setBlurWarn(null)} className="text-white/80 text-xs">dismiss</button>
          </div>
        )}
      </div>

      <div className="p-4 grid grid-cols-3 gap-3">
        <div />
        <button
          disabled={!geo || busy}
          onClick={snap}
          className="aspect-square rounded-full btn-amber text-lg disabled:opacity-50"
        >
          {busy ? '…' : '●'}
        </button>
        <div />
      </div>
    </div>
  );
}

/**
 * Approximate Laplacian-of-Gaussian variance on a downsampled grayscale tile.
 * Higher variance ⇒ sharper image. Below ~100 typically means motion blur or out-of-focus.
 */
function laplacianVariance(ctx: CanvasRenderingContext2D, w: number, h: number): number {
  const TILE = 200;
  const tw = Math.min(TILE, w), th = Math.min(TILE, h);
  const sx = Math.floor((w - tw) / 2);
  const sy = Math.floor((h - th) / 2);
  const data = ctx.getImageData(sx, sy, tw, th).data;
  const gray = new Float32Array(tw * th);
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = 0.299 * (data[i] ?? 0) + 0.587 * (data[i + 1] ?? 0) + 0.114 * (data[i + 2] ?? 0);
  }
  let sum = 0, sumSq = 0, n = 0;
  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const c = gray[y * tw + x]!;
      const lap = 4 * c
        - gray[(y - 1) * tw + x]!
        - gray[(y + 1) * tw + x]!
        - gray[y * tw + x - 1]!
        - gray[y * tw + x + 1]!;
      sum += lap;
      sumSq += lap * lap;
      n++;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  meta: { taskId: string; title: string; location: string; lat: number; lng: number; ts: Date },
) {
  const pad = Math.round(w * 0.015);
  const fontSize = Math.round(w * 0.022);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - fontSize * 4 - pad * 2, w, fontSize * 4 + pad * 2);
  ctx.fillStyle = '#F59E0B';
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillText(`Mario · ${meta.title}`, pad, h - fontSize * 3 + pad);
  ctx.fillStyle = '#fff';
  ctx.font = `${fontSize}px ui-monospace, monospace`;
  ctx.fillText(`task #${meta.taskId.slice(0, 8)} · ${meta.location}`, pad, h - fontSize * 2 + pad);
  ctx.fillText(`GPS ${meta.lat.toFixed(5)}, ${meta.lng.toFixed(5)}`, pad, h - fontSize + pad);
  ctx.fillText(meta.ts.toISOString(), pad, h - pad);
}
