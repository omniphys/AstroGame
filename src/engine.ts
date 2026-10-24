// Thin TS wrapper around the global StelWebEngine() loader exposed by
// /public/engine/stellarium-web-engine.js (built from the Stellarium Web
// Engine C/WASM sources). See README.md for how that file is produced.

import { assetUrl } from './base-url'

export interface StelWebEngineOptions {
  wasmFile: string;
  canvas: HTMLCanvasElement;
  translateFn?: (domain: string, str: string) => string;
  onReady: (stel: StelInstance) => void;
}

// The engine's JS API is dynamically generated from the C core, so we keep
// this loose rather than hand-maintaining a full type surface.
export type StelInstance = any;

declare global {
  interface Window {
    StelWebEngine: (opts: StelWebEngineOptions) => void;
  }
}

export function initStelEngine(
  canvas: HTMLCanvasElement,
  translateFn: (domain: string, str: string) => string = (_domain, str) => str,
): Promise<StelInstance> {
  if (typeof window.StelWebEngine !== 'function') {
    return Promise.reject(
      new Error(
        'StelWebEngine is not defined. Make sure /engine/stellarium-web-engine.js ' +
          'is built and served, and loaded via a <script> tag before main.ts runs.'
      )
    );
  }

  return new Promise((resolve) => {
    window.StelWebEngine({
      wasmFile: assetUrl('/engine/stellarium-web-engine.wasm'),
      canvas,
      translateFn,
      onReady: (stel) => resolve(stel),
    });
  });
}
