'use client'

// 1. Import QueryClient and QueryClientProvider
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { wagmiConfig } from '@/lib/wagmiConfig'

// 2. Create a client instance
const queryClient = new QueryClient()

export default function Providers({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // 3. Wrap WagmiProvider with QueryClientProvider
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>{children}</WagmiProvider>
    </QueryClientProvider>
  )
}

