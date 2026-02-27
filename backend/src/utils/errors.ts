export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function assertOrThrow(condition: unknown, message: string, statusCode = 400): asserts condition {
  if (!condition) {
    throw new AppError(message, statusCode);
  }
}
