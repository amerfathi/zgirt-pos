/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    readonly isElectron: true;
    readonly platform: string;
    minimize(): void;
    maximize(): void;
    close(): void;
    isMaximized(): Promise<boolean>;
    downloadUpdate(url: string): Promise<{success: boolean; filePath?: string; error?: string}>;
    cancelDownloadUpdate(): void;
    installUpdate(): Promise<{success: boolean; error?: string}>;
    onDownloadProgress(callback: (data: {receivedBytes: number; totalBytes: number; percent: number}) => void): () => void;
  };
  Capacitor?: {
    platform?: string;
    getPlatform?(): string;
    isNativePlatform?(): boolean;
  };
}
