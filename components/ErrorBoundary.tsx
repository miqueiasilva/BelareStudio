import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: unknown;
}

class ErrorBoundary extends Component<Props, State> {
  // Explicitly declare props to avoid TypeScript error about 'props' not existing
  public readonly props!: Readonly<Props>;

  public state: State = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("App crash capturado pelo ErrorBoundary:", error, errorInfo);

    const errorMsg = String(error ?? "");
    if (
      errorMsg.indexOf("ChunkLoadError") !== -1 ||
      errorMsg.indexOf("Loading chunk") !== -1 ||
      errorMsg.indexOf("Failed to fetch dynamically imported module") !== -1
    ) {
      console.warn("[ErrorBoundary] Erro de carregamento de chunk. Limpando cache e recarregando para o código mais recente...");
      if (typeof window !== "undefined") {
        try {
          const now = Date.now();
          const lastReload = sessionStorage.getItem('pwa_chunk_error_reload');
          if (lastReload && (now - parseInt(lastReload, 10) < 15000)) {
            console.warn("[ErrorBoundary] Evitando loop de recarregamento infinito. Último recarregamento foi há menos de 15s.");
            return;
          }
          sessionStorage.setItem('pwa_chunk_error_reload', String(now));
        } catch (err) {
          console.warn("[ErrorBoundary] Falha de depuração ao acessar sessionStorage", err);
        }

        if ("caches" in window) {
          caches.keys().then((keys) => {
            return Promise.all(keys.map((key) => caches.delete(key)));
          }).catch((err) => {
            console.error("[ErrorBoundary] Falha ao limpar caches:", err);
          }).finally(() => {
            window.location.reload();
          });
        } else {
          window.location.reload();
        }
      }
    }
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          style={{
            margin: 16,
            padding: 12,
            borderRadius: 12,
            border: "1px solid #FCA5A5",
            background: "#FEF2F2",
            color: "#991B1B",
            fontSize: 14,
          }}
        >
          <b>Ops!</b> O aplicativo encontrou um erro ao iniciar.
          <details style={{ whiteSpace: "pre-wrap", marginTop: 8 }}>
            {String(this.state.error ?? "")}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;