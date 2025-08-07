'use client'

import { WagmiProvider, createConfig, http } from 'wagmi'
import { base } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Setup the query client
const queryClient = new QueryClient()

// Create the wagmi config
const config = createConfig({
  chains: [base],
  transports: {
    [base.id]: (window as any).ethereum ? undefined : http(),
  },
})

// Create the provider component
export function Web3Provider({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  )
}

