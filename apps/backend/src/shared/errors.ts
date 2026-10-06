export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "AppError";
    // Ensure prototype chain is maintained for instanceof checks
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class BusinessRuleError extends AppError {
  constructor(rule: string, message: string) {
    super(422, rule, message);
    this.name = "BusinessRuleError";
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string) {
    super(404, "NOT_FOUND", `${entity} not found`);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions") {
    super(403, "FORBIDDEN", message);
  }
}
