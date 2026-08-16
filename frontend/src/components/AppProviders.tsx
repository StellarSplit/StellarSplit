import type { ReactNode } from "react";
import { ThemeProvider } from "./ThemeContext";
import { WalletProvider } from "../hooks/use-wallet";
import { CollaborationProvider } from "./Collaboration";
import InstallPrompt from "./InstallPrompt";
import { LiveRegion } from "./LiveRegion";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <WalletProvider>
        <CollaborationProvider>
          <LiveRegion />
          <InstallPrompt />
          {children}
        </CollaborationProvider>
      </WalletProvider>
    </ThemeProvider>
  );
}