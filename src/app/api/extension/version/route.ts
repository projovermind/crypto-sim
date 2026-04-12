import { NextResponse } from 'next/server';

const EXTENSION_VERSION = '0.1.3';
const BASE_URL = 'https://crypto-sim-nu.vercel.app';

export async function GET() {
  return NextResponse.json({
    version: EXTENSION_VERSION,
    downloadUrl: `${BASE_URL}/api/extension/download`,
  });
}
