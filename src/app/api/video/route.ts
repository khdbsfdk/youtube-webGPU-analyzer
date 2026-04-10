import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url || !ytdl.validateURL(url)) {
    return NextResponse.json({ error: '유효하지 않은 YouTube URL입니다.' }, { status: 400 });
  }

  try {
    // 1. Get YouTube metadata (avoids spawning binary processes)
    const info = await ytdl.getInfo(url);
    
    // 2. Select the optimal combined audio/video format for browser playback
    const format = ytdl.chooseFormat(info.formats, { filter: 'videoandaudio', quality: 'highest' }) 
                   || ytdl.chooseFormat(info.formats, { filter: 'videoonly', quality: 'highest' });

    if (!format || !format.url) {
      return NextResponse.json({ error: '재생 가능한 포맷을 찾지 못했습니다.' }, { status: 404 });
    }

    const directUrl = format.url;

    // 3. Process Client Range Request
    const range = req.headers.get('range') || '';
    const fetchHeaders: Record<string, string> = {};
    if (range) {
      fetchHeaders['Range'] = range;
    }

    // 4. Proxy the video stream directly through the server to bypass browser CORS Canvas Taint
    const streamResponse = await fetch(directUrl, { headers: fetchHeaders });

    if (!streamResponse.ok || !streamResponse.body) {
      throw new Error(`유튜브 비디오 스트림 오류. 상태 코드: ${streamResponse.status}`);
    }

    // 5. Pipe down Response Headers (essential for seeking)
    const responseHeaders = new Headers();
    responseHeaders.set('Content-Type', format.mimeType || 'video/mp4');
    responseHeaders.set('Accept-Ranges', 'bytes');
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    
    if (streamResponse.headers.get('content-length')) {
        responseHeaders.set('Content-Length', streamResponse.headers.get('content-length') as string);
    }
    if (streamResponse.headers.get('content-range')) {
        responseHeaders.set('Content-Range', streamResponse.headers.get('content-range') as string);
    }

    return new NextResponse(streamResponse.body, {
      status: streamResponse.status,
      headers: responseHeaders,
    });

  } catch (error: any) {
    console.error('API Video Proxy Error:', error);
    return NextResponse.json({ 
        error: '비디오 프록시 스트리밍 중 오류가 발생했습니다: ' + (error.message || '알 수 없는 보호 에러')
    }, { status: 500 });
  }
}
