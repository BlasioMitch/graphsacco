import fetch from 'node-fetch';

export async function pingRestService() {
  const url = `${process.env.REST_API_URL}/health`;

  try {
    const res = await fetch(url as string);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const body = await res.text(); // or .json() if it's JSON
    console.log(`[OK] REST API is up: ${body}`);
    return { status: 'ok', message: body };
  } catch (err: any) {
    console.error(`[FAIL] REST API down: ${err.message}`);
    return { status: 'fail', message: err.message };
  }
}
