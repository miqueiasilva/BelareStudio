import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: unknown;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: undefined,
  };

  public static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: unknown, errorInfo: ErrorInfo) {
    console.error("App crash capturado pelo ErrorBoundary:", error, errorInfo);
  }

  public render() {
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