'use client';

import { isValidBarcode, normalizeBarcode } from '@calorya/core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Field, inputClass } from './ui';

/**
 * Barcode scanner for the web app.
 *
 * Uses the built-in BarcodeDetector where the browser has it (Chrome, Edge,
 * Android WebView). Safari and Firefox do not, and rather than shipping a
 * ~300 KB WASM decoder to every visitor for a feature most will use once, the
 * unsupported path falls back to typing the digits printed under the barcode.
 * That fallback also covers the cases a camera cannot: a torn label, a dark
 * warung, a desktop with no camera at all.
 */

// Not in lib.dom yet.
interface DetectedBarcode {
  rawValue: string;
  format: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e'];

function getDetectorCtor(): BarcodeDetectorCtor | null {
  if (typeof window === 'undefined') return null;
  const ctor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
    .BarcodeDetector;
  return typeof ctor === 'function' ? ctor : null;
}

type CameraState = 'idle' | 'starting' | 'scanning' | 'denied' | 'unavailable';

export function BarcodeScanner({
  onDetected,
  onCancel,
  busy = false,
}: {
  onDetected: (barcode: string) => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [camera, setCamera] = useState<CameraState>('idle');
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Releasing the camera on unmount is not optional: a forgotten track leaves
  // the recording indicator on, which users read as the app spying on them.
  useEffect(() => stop, [stop]);

  const start = useCallback(async () => {
    const Detector = getDetectorCtor();
    if (!Detector || !navigator.mediaDevices?.getUserMedia) {
      setCamera('unavailable');
      return;
    }

    setCamera('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      setCamera('scanning');

      const detector = new Detector({ formats: FORMATS });

      const tick = async () => {
        if (doneRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const hit = found.find((b) => isValidBarcode(b.rawValue));
          if (hit) {
            doneRef.current = true;
            stop();
            onDetected(normalizeBarcode(hit.rawValue));
            return;
          }
        } catch {
          // A single failed frame is normal while focusing; keep going.
        }
        rafRef.current = requestAnimationFrame(() => void tick());
      };

      rafRef.current = requestAnimationFrame(() => void tick());
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      setCamera(name === 'NotAllowedError' ? 'denied' : 'unavailable');
      stop();
    }
  }, [onDetected, stop]);

  function submitManual(event: React.FormEvent) {
    event.preventDefault();
    const code = normalizeBarcode(manual);
    if (!isValidBarcode(code)) {
      // Check digit, not just length — catches a mistyped digit before we
      // waste a network round-trip and show a misleading "not found".
      setManualError('Angka barcode tidak valid. Periksa lagi digitnya.');
      return;
    }
    setManualError(null);
    onDetected(code);
  }

  return (
    <div className="space-y-4">
      {camera === 'scanning' || camera === 'starting' ? (
        <div className="relative overflow-hidden rounded-2xl bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            className="h-56 w-full object-cover"
            aria-label="Pratinjau kamera untuk memindai barcode"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-xl border-2 border-brand-400/80"
          />
          <p className="absolute inset-x-0 bottom-2 text-center text-xs text-white/80">
            {camera === 'starting' ? 'Menyalakan kamera…' : 'Arahkan ke barcode kemasan'}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-ink-800 p-5 text-center">
          <p className="text-sm text-ink-300">
            {camera === 'denied'
              ? 'Akses kamera ditolak.'
              : camera === 'unavailable'
                ? 'Browser ini tidak mendukung pemindaian barcode.'
                : 'Pindai barcode pada kemasan.'}
          </p>
          <p className="mx-auto mt-1 max-w-xs text-xs text-ink-500">
            {camera === 'denied'
              ? 'Izinkan kamera lewat ikon gembok di address bar, atau ketik angkanya di bawah.'
              : camera === 'unavailable'
                ? 'Ketik saja angka di bawah barcode — hasilnya sama.'
                : 'Butuh koneksi HTTPS dan izin kamera.'}
          </p>
          {camera === 'idle' && (
            <Button type="button" onClick={() => void start()} className="mt-4">
              Nyalakan kamera
            </Button>
          )}
        </div>
      )}

      <form onSubmit={submitManual} className="space-y-3">
        <Field label="Atau ketik angka barcode" error={manualError ?? undefined}>
          <input
            inputMode="numeric"
            autoComplete="off"
            value={manual}
            onChange={(e) => {
              setManual(e.target.value);
              setManualError(null);
            }}
            placeholder="8998866200189"
            className={inputClass}
          />
        </Field>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Batal
          </Button>
          <Button type="submit" disabled={busy || manual.trim().length === 0} className="flex-1">
            {busy ? 'Mencari…' : 'Cari'}
          </Button>
        </div>
      </form>
    </div>
  );
}
