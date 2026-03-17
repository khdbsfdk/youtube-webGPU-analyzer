import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url || !ytdl.validateURL(url)) {
    return NextResponse.json({ error: '유효하지 않은 YouTube URL입니다.' }, { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(url);
    
    // 오디오/비디오 모두 포함된 포맷을 찾거나 비디오 전용 포맷으로 폴백하여 스트리밍 에러 방지
    let format = ytdl.chooseFormat(info.formats, { filter: 'videoandaudio', quality: 'highest' });
    if (!format || !format.url) {
      format = ytdl.chooseFormat(info.formats, { filter: 'videoonly', quality: 'highest' });
    }

    if (!format) {
      return NextResponse.json({ error: '재생 가능한 포맷을 찾을 수 없습니다.' }, { status: 404 });
    }

    const stream = ytdl(url, { format });
    
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => controller.enqueue(chunk));
        stream.on('end', () => controller.close());
        stream.on('error', (err) => {
          console.error("Stream error:", err);
          controller.error(err);
        });
      },
      cancel() {
        stream.destroy();
      }
    });

    return new NextResponse(readable, {
      headers: {
        'Content-Type': format.mimeType || 'video/mp4',
        'Content-Disposition': 'inline',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Access-Control-Allow-Origin': '*', // Canvas CORS 에러 방지를 위한 헤더
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: '프록시 스트리밍 처리 중 에러가 발생했습니다.' }, { status: 500 });
  }
}
