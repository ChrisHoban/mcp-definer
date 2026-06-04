export interface ValidationIssue {
  path: string;
  message: string;
  code: string;
}

export interface ValidationResult {
  valid: boolean;
  errors?: ValidationIssue[];
  warnings?: ValidationIssue[];
}

export type ValidateManifestResult = ValidationResult;
export type ValidateIrResult = ValidationResult;
export type ValidateCurationProfileResult = ValidationResult;
