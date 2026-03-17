import { NextRequest, NextResponse } from 'next/server';
import ytdl from '@distube/ytdl-core';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');

  if (!url || !ytdl.validateURL(url)) {
    return NextResponse.json({ error: 'Invalid or missing YouTube URL' }, { status: 400 });
  }

  try {
    const info = await ytdl.getInfo(url);
    
    // Select format with both audio and video, or just highest quality video
    const format = ytdl.chooseFormat(info.formats, { quality: 'highest', filter: 'audioandvideo' });
    
    if (!format) {
      return NextResponse.json({ error: 'No suitable format found' }, { status: 404 });
    }

    // Proxy the stream
    const stream = ytdl(url, { format });
    
    // Create a ReadableStream from the Node.js stream
    const readable = new ReadableStream({
      start(controller) {
        stream.on('data', (chunk) => {
          controller.enqueue(chunk);
        });
        stream.on('end', () => {
          controller.close();
        });
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
      },
    });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Failed to process YouTube request' }, { status: 500 });
  }
}
