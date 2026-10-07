// Cloudflare Pages Function: Health Check & System Info
export async function onRequestGet(context) {
  const { env } = context;
  
  const hasDb = !!env.DB;
  
  return new Response(JSON.stringify({
    status: 'ok',
    system: 'زقيرت - كاشير ومحاسبة التبغ والجملة',
    edge: 'Cloudflare Pages & Workers',
    d1Connected: hasDb,
    version: '2.6.14',
    timestamp: new Date().toISOString()
  }, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    }
  });
}


