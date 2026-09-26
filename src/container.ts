// ──────────────────────────────────────────────────────────────
// Lightweight Dependency Injection Container
//
// No framework needed — this simple container supports:
// - Transient bindings (new instance per resolve)
// - Singleton bindings (shared instance)
// - Direct instance registration
//
// Consumers swap implementations by re-binding tokens before
// resolving services.
// ──────────────────────────────────────────────────────────────

export const TOKENS = {
  Tokenizer: Symbol.for('ITokenizer'),
  InputAnalyzer: Symbol.for('IInputAnalyzer'),
  ModelRegistry: Symbol.for('IModelRegistry'),
  CostEngine: Symbol.for('ICostEngine'),
  EvaluationEngine: Symbol.for('IEvaluationEngine'),
  QualificationService: Symbol.for('IQualificationService'),
  Allocator: Symbol.for('IAllocator'),
  TraceStore: Symbol.for('ITraceStore'),
  EvidenceStore: Symbol.for('IEvidenceStore'),
  StorageAdapter: Symbol.for('IStorageAdapter'),
  AdaptationEngine: Symbol.for('IAdaptationEngine'),
  ShadowSimulator: Symbol.for('IShadowSimulator'),
  CanarySimulator: Symbol.for('ICanarySimulator'),
} as const;

export class Container {
  private factories = new Map<symbol, () => unknown>();
  private singletons = new Map<symbol, unknown>();
  private singletonTokens = new Set<symbol>();

  /**
   * Register a factory that creates a new instance each time.
   */
  bind<T>(token: symbol, factory: () => T): this {
    this.factories.set(token, factory);
    this.singletonTokens.delete(token);
    return this;
  }

  /**
   * Register a factory whose result is cached after first resolution.
   */
  singleton<T>(token: symbol, factory: () => T): this {
    this.factories.set(token, factory);
    this.singletonTokens.add(token);
    return this;
  }

  /**
   * Register a pre-built instance directly.
   */
  instance<T>(token: symbol, value: T): this {
    this.singletons.set(token, value);
    this.factories.set(token, () => value);
    this.singletonTokens.add(token);
    return this;
  }

  /**
   * Resolve a dependency by token.
   */
  get<T>(token: symbol): T {
    if (this.singletonTokens.has(token) && this.singletons.has(token)) {
      return this.singletons.get(token) as T;
    }

    const factory = this.factories.get(token);
    if (!factory) {
      throw new Error(`[Container] No binding for: ${token.toString()}`);
    }

    const instance = factory() as T;

    if (this.singletonTokens.has(token)) {
      this.singletons.set(token, instance);
    }

    return instance;
  }

  /**
   * Check whether a binding exists.
   */
  has(token: symbol): boolean {
    return this.factories.has(token);
  }

  /**
   * Remove all bindings and cached instances.
   */
  reset(): void {
    this.factories.clear();
    this.singletons.clear();
    this.singletonTokens.clear();
  }
}
