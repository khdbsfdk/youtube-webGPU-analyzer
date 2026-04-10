import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy YouTube thumbnail images to avoid CORS issues when drawing to Canvas.
 * Usage: /api/thumbnail?url=https://i.ytimg.com/vi/VIDEO_ID/hqdefault.jpg
 */
export async function GET(req: NextRequest) {
  const thumbUrl = req.nextUrl.searchParams.get('url');

  if (!thumbUrl || !thumbUrl.startsWith('https://i.ytimg.com/')) {
    return NextResponse.json({ error: 'Invalid thumbnail URL' }, { status: 400 });
  }

  try {
    const response = await fetch(thumbUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Referer': 'https://www.youtube.com/',
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });

    if (!response.ok) {
      return NextResponse.json({ error: `Thumbnail fetch failed: ${response.status}` }, { status: response.status });
    }

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.headers.get('content-type') || 'image/jpeg',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
