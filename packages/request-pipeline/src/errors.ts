export class ToolValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'ToolValidationError';
  }
}

export class EgressBlockedError extends Error {
  constructor(
    message: string,
    public readonly host: string,
    public readonly allowlist: string[],
  ) {
    super(message);
    this.name = 'EgressBlockedError';
  }
}

export class UpstreamHttpError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'UpstreamHttpError';
  }
}

export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineError';
  }
}
