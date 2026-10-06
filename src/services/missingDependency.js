// Only known missing business dependencies are retryable. Protocol errors,
// invalid amounts and accounting contradictions must still fail closed.
export class MissingDependencyError extends Error {
  constructor(message) { super(message); this.name = 'MissingDependencyError'; this.code = 'MISSING_DEPENDENCY'; }
}
