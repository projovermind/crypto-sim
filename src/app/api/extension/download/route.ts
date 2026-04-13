import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { readFile } from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest) {
  // 인증 필수
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }

  const filePath = path.join(process.cwd(), 'public', 'extension.zip');

  try {
    const fileBuffer = await readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="teledit-extension.zip"',
        'Content-Length': fileBuffer.length.toString(),
      },
    });
  } catch {
    return NextResponse.json({ error: 'Extension file not found' }, { status: 404 });
  }
}
