interface Window {
  ready: boolean;
  startupError: string | null;
  store: import('../src/services/atomicStore.js').AtomicStore;
  app: ReturnType<typeof import('../src/store/useAppStore.js').useAppStore>;
  attachConflictPreconditions: typeof import('../src/services/syncConflictPolicy.js').attachConflictPreconditions;
}
