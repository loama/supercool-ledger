const videoPath = 'video/out/supercool-ledger.mp4';
const port = Number(process.env.VIDEO_PREVIEW_PORT ?? 3013);

const html = `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>SuperCool Ledger, recorrido en español</title>
    <style>
      html,
      body {
        margin: 0;
        min-height: 100%;
        background: #0b0b0b;
        color: #ffffff;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }

      main {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 32px;
        box-sizing: border-box;
      }

      .frame {
        width: min(1200px, 100%);
      }

      h1 {
        margin: 0 0 14px;
        font-size: 18px;
        font-weight: 600;
      }

      video {
        display: block;
        width: 100%;
        aspect-ratio: 16 / 9;
        border-radius: 14px;
        background: #000000;
      }
    </style>
  </head>
  <body>
    <main>
      <div class="frame">
        <h1>SuperCool Ledger, recorrido en español</h1>
        <video controls preload="metadata" playsinline src="/supercool-ledger.mp4"></video>
      </div>
    </main>
  </body>
</html>`;

const server = Bun.serve({
  hostname: '127.0.0.1',
  port,
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response(html, {
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/html; charset=utf-8',
        },
      });
    }

    if (url.pathname !== '/supercool-ledger.mp4') {
      return new Response('Not found', { status: 404 });
    }

    const video = Bun.file(videoPath);
    if (!(await video.exists())) {
      return new Response('Render the video first', { status: 404 });
    }

    const range = request.headers.get('range');
    if (!range) {
      return new Response(video, {
        headers: {
          'accept-ranges': 'bytes',
          'content-length': String(video.size),
          'content-type': 'video/mp4',
        },
      });
    }

    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${video.size}` },
      });
    }

    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), video.size - 1) : video.size - 1;
    if (start > end || start >= video.size) {
      return new Response(null, {
        status: 416,
        headers: { 'content-range': `bytes */${video.size}` },
      });
    }

    return new Response(video.slice(start, end + 1), {
      status: 206,
      headers: {
        'accept-ranges': 'bytes',
        'content-length': String(end - start + 1),
        'content-range': `bytes ${start}-${end}/${video.size}`,
        'content-type': 'video/mp4',
      },
    });
  },
});

process.stdout.write(`Video preview: ${server.url}\n`);
