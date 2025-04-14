export default async function tryCatch<T>(
  promise: Promise<T>,
): Promise<{ data: T; error: undefined } | { data: undefined; error: Error }> {
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
