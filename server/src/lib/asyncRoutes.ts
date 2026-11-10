// Express 4 does not forward errors from async handlers (rejected promises) to the error middleware.
// Patch the router layer once so `async (req, res) => { ... throw notFound() }` behaves like a sync handler.
// (Static import so the serverless bundler includes this file.)
import Layer from 'express/lib/router/layer.js';

const proto = (Layer as any).prototype;
if (!proto.handle_request.__asyncPatched) {
  proto.handle_request = function handle(req: any, res: any, next: (e?: unknown) => void) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const out = fn(req, res, next);
      if (out && typeof out.then === 'function') out.then(undefined, next);
    } catch (err) { next(err); }
  };
  proto.handle_request.__asyncPatched = true;
}
