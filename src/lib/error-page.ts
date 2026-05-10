export function renderErrorPage(errorId?: string) {
  return `
    <!doctype html>
    <html lang="mn">
      <head>
        <meta charset="utf-8" />
        <title>Алдаа гарлаа</title>
        <style>
          body {
            font-family: system-ui, sans-serif;
            display: grid;
            place-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f8fafc;
            color: #0f172a;
          }
          .card {
            max-width: 480px;
            padding: 32px;
            border-radius: 20px;
            background: white;
            box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08);
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Түр алдаа гарлаа</h1>
          <p>Системд алдаа гарсан байна. Дахин оролдоно уу.</p>
          ${errorId ? `<small>Error ID: ${errorId}</small>` : ""}
        </div>
      </body>
    </html>
  `;
}