// Standalone Worker for the account API, for hosting it on workers.dev while the game itself stays on
// GitHub Pages. It reuses the Pages Function as-is: /api/<route> is handed to onRequest.
import { onRequest } from '../functions/api/[[route]]';

type Env = Parameters<typeof onRequest>[0]['env'];

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const m = url.pathname.match(/^\/api\/?(.*)$/);
    if (!m) return new Response('PARRY CUBE API', { headers: { 'content-type': 'text/plain; charset=utf-8' } });
    const route = m[1].split('/').filter(Boolean);
    return onRequest({ request, env, params: { route } });
  },
};
