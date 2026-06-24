import { Component, type ReactNode, useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/Navbar";
import Sidebar from "../components/Sidebar";

type ShellErrorBoundaryProps = {
  children: ReactNode;
  resetKey: string;
};

type ShellErrorBoundaryState = {
  error: Error | null;
};

class ShellErrorBoundary extends Component<
  ShellErrorBoundaryProps,
  ShellErrorBoundaryState
> {
  state: ShellErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ShellErrorBoundaryState {
    return { error };
  }

  componentDidUpdate(prevProps: ShellErrorBoundaryProps) {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <section className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-4xl items-center justify-center p-6 sm:p-8">
          <div className="w-full rounded-3xl border border-theme bg-card-theme p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-accent">
              Page Error
            </p>
            <h1 className="mt-3 text-2xl font-semibold text-theme">
              We could not render this page
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-theme">
              {this.state.error.message ||
                "Something went wrong while loading the current screen."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.handleRetry}
                className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white"
              >
                Try Again
              </button>
              <Link
                to="/dashboard"
                className="rounded-full border border-theme px-4 py-2 text-sm font-semibold text-theme"
              >
                Open Dashboard
              </Link>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

export default function RootLayout() {
  const { pathname } = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-theme text-theme">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="min-h-screen lg:pl-[14rem]">
        <Navbar onMenuOpen={() => setIsSidebarOpen(true)} />
        <main id="main-content" className="min-h-[calc(100vh-3.5rem)]">
          <ShellErrorBoundary resetKey={pathname}>
            <Outlet />
          </ShellErrorBoundary>
        </main>
      </div>
    </div>
  );
}
