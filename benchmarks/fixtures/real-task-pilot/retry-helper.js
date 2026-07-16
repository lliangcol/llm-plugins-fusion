export function retry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return operation();
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}
