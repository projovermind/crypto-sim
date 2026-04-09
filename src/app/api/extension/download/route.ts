import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET() {
  const filePath = path.join(process.cwd(), 'public', 'extension.zip');

  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="extension.zip"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Extension file not found' }, { status: 404 });
  }
}
