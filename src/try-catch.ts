export default async function tryCatch<T>(promise: Promise<T>): Promise<{
  data: T | undefined;
  error: Error | undefined;
}> {
  return promise
    .then((data) => ({
      data,
      error: undefined,
    }))
    .catch((error) => {
      return {
        data: undefined,
        error,
      };
    });
}
