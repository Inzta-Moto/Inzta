import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const imageUrl = searchParams.get('url');

  if (!imageUrl) {
    return new NextResponse('URL is required', { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }

    // Get the content type from the original response, default to jpeg if unknown
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    // Get content length if available to help crawlers
    const contentLength = response.headers.get('content-length');

    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, s-maxage=86400', // Cache for 1 day
      'Access-Control-Allow-Origin': '*', // Allow cross-origin requests
    };

    if (contentLength) {
      headers['Content-Length'] = contentLength;
    }

    // Stream the response body directly
    return new NextResponse(response.body, { headers });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
