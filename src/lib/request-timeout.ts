/** Limita a espera da UI mesmo se o navegador perder a conexão sem rejeitar a chamada. */
export async function withTimeout<T>(request: PromiseLike<T>, milliseconds = 12_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([
      request,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("request_timeout")), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer!);
  }
}
