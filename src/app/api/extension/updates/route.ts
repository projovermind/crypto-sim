import { NextResponse } from 'next/server';

const EXTENSION_VERSION = '0.1.1';
const BASE_URL = 'https://crypto-sim-nu.vercel.app';
const EXT_ID = '__EXT_ID__';

export async function GET() {
  const xml = `<?xml version='1.0' encoding='UTF-8'?><gupdate xmlns='http://www.google.com/update2/response' protocol='2.0'><app appid='${EXT_ID}'><updatecheck codebase='${BASE_URL}/api/extension/download' version='${EXTENSION_VERSION}' /></app></gupdate>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'text/xml; charset=UTF-8',
    },
  });
}
