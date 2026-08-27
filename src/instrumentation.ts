// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const dns = await import('dns');
    const net = await import('net');
    if (typeof dns.setDefaultResultOrder === 'function') {
      dns.setDefaultResultOrder('ipv4first');
    }
    if (typeof (net as any).setDefaultAutoSelectFamily === 'function') {
      (net as any).setDefaultAutoSelectFamily(false);
    }
  }
}
