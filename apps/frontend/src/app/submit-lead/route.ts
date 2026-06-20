import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Server-side only — not exposed to the browser bundle
const BACKEND_URL = process.env['RAILWAY_BACKEND_URL'] ?? '';

export async function POST(request: NextRequest) {
  if (!BACKEND_URL) {
    return NextResponse.json({ message: 'Service not configured' }, { status: 503 });
  }

  try {
    const body = (await request.json()) as unknown;

    const upstream = await fetch(`${BACKEND_URL}/api/v1/access`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = (await upstream.json().catch(() => ({}))) as unknown;
    return NextResponse.json(data, { status: upstream.status });
  } catch {
    return NextResponse.json(
      { message: 'Service temporarily unavailable. Please try again.' },
      { status: 503 },
    );
  }
}
