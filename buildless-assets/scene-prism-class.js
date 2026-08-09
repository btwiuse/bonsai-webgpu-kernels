// PrismScene — the main class for the landing prism scene.
//
// Methods are composed from three mixin modules by topic:
//   - scene-prism-init.js         (constructor and init* family)
//   - scene-prism-trace-methods.js (trace, castRay, sheet writers)
//   - scene-prism-update.js       (per-column and per-frame updates)
//   - scene-prism-frame.js        (drag, resize, animate)

import { N_COL } from "./scene-prism-optics.js";
import { PrismInitMethods } from "./scene-prism-init.js";
import { PrismTraceMethods } from "./scene-prism-trace-methods.js";
import { PrismUpdateMethods } from "./scene-prism-update.js";
import { PrismFrameMethods } from "./scene-prism-frame.js";

export class PrismScene {
  constructor() {
    this.N_COL = N_COL;
    this.initRenderer();
    this.initPrismGeometry();
    this.initGlassAndEdges();
    this.initBeams();
    this.initSheets();
    this.initTraceState();
    this.initSprites();
    this.initPulses();
    this.initInteractionState();
    this.wireInteraction();
    this.wireResize();
    this.initOpticsState();
    this.initTiming();
    this.startLoop();
    // Expose a dispose hook so the loader can tear down on stage transition.
    window.App._disposeLanding = () => {
      try {
        this.renderer.dispose();
      } catch {}
    };
  }
}

// Compose method groups onto the prototype (single allocation per group).
Object.assign(PrismScene.prototype, PrismInitMethods);
Object.assign(PrismScene.prototype, PrismTraceMethods);
Object.assign(PrismScene.prototype, PrismUpdateMethods);
Object.assign(PrismScene.prototype, PrismFrameMethods);

// Convenience boot entry used by `scene-prism-index.js`.
export function bootPrismScene() {
  if (window.App._landingBooted) return;
  window.App._landingBooted = true;
  try {
    new PrismScene();
  } catch (err) {
    console.error(err);
  }
}