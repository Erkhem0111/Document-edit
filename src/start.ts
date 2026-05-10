const errorMiddleware = createMiddleware().server(async ({ next, request }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }

    const errorId = crypto.randomUUID();

    console.error("[SERVER_ERROR]", {
      errorId,
      url: request.url,
      method: request.method,
      error,
    });

    return new Response(renderErrorPage(errorId), {
      status: 500,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  }
});