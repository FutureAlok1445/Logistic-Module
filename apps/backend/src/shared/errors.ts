export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class BusinessRuleError extends AppError {
  constructor(rule: string, message: string) {
    super(message, 422, rule);
    this.name = 'BusinessRuleError';
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(`${entity} not found`, 404, 'NOT_FOUND');
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN');
  }
}