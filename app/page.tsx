'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { Alchemy, Network, Nft } from 'alchemy-sdk'

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// --- CONFIGURATION ---
const DARING_DIVAS_CONTRACT = '0xD127d434266eBF4CB4F861071ebA50A799A23d9d'
const CENSORED_LIST_URL = 'https://gist.githubusercontent.com/Mostraet/3e4cc308c270f278499f1b03440ad2ab/raw/censored-list.json';

interface EnrichedNft extends Nft {
  uniqueImageUrl?: string;
}

export default function Home() {
  const { address, isConnected } = useAccount()
  const { connect, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const [nfts, setNfts] = useState<EnrichedNft[]>([])
  const [isLoadingNfts, setIsLoadingNfts] = useState(false)
  const [revealedNfts, setRevealedNfts] = useState<{ [tokenId: string]: boolean }>({})
  const [censoredList, setCensoredList] = useState<{ [key: string]: boolean }>({});

  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);

  useEffect(() => {
    const fetchCensoredList = async () => {
      try {
        const response = await fetch(`${CENSORED_LIST_URL}?t=${new Date().getTime()}`);
        const data = await response.json();
        setCensoredList(data);
        console.log("Successfully fetched censored list:", data);
      } catch (error) {
        console.error("Failed to fetch censored list:", error);
      }
    };
    fetchCensoredList();
  }, []);

  useEffect(() => {
    const fetchAndEnrichNfts = async () => {
      if (!isConnected || !address) return
      setIsLoadingNfts(true)
      try {
        const alchemy = new Alchemy({ apiKey: process.env.NEXT_PUBLIC_ALCHEMY_API_KEY, network: Network.BASE_MAINNET });
        const response = await alchemy.nft.getNftsForOwner(address, { contractAddresses: [DARING_DIVAS_CONTRACT] });
        const enrichedNfts = await Promise.all(
          response.ownedNfts.map(async (nft) => {
            try {
              const metadataResponse = await fetch(nft.tokenUri!);
              const metadata = await metadataResponse.json();
              return { ...nft, uniqueImageUrl: metadata.image };
            } catch (e) { return nft; }
          })
        );
        setNfts(enrichedNfts);
        console.log("NFT METADATA FOR ONE NFT:", JSON.stringify(enrichedNfts[0], null, 2));
      } catch (error) { console.error('Failed to fetch NFTs:', error) }
      finally { setIsLoadingNfts(false) }
    }
    fetchAndEnrichNfts()
  }, [isConnected, address])

  const handleReveal = (tokenId: string) => {
    setRevealedNfts((prev) => ({ ...prev, [tokenId]: !prev[tokenId] }))
  }

  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col p-4 md:p-8">
        <header className="flex justify-end">
          <a
            href="https://daringdivas.art"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border border-gray-600 px-4 py-2 text-white transition-colors hover:border-[#ff55aa] hover:bg-[#ff55aa]"
          >
            Back to Main Site
          </a>
        </header>
        <div className="flex flex-grow items-center justify-center">
          <button onClick={() => connect({ connector: injected() })} className="rounded bg-blue-600 px-4 py-2 text-white" disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
      </div>
    )
  }

  const lightboxSlides = nfts.map(nft => {
    const isCensored = !!censoredList[nft.tokenId];
    const isRevealed = !!revealedNfts[nft.tokenId];
    let imageUrl = nft.uniqueImageUrl || nft.image.cachedUrl || '';

    if (isCensored && isRevealed) {
      imageUrl = `/uncensored/${nft.tokenId}.jpg`;
    }
    
    return { src: imageUrl };
  });

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8 flex justify-end">
        <a
          href="https://daringdivas.art"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-gray-600 px-4 py-2 text-white transition-colors hover:border-[#ff55aa] hover:bg-[#ff55aa]"
        >
          Back to Main Site
        </a>
      </header>

      <div className="mb-8 flex items-center justify-between">
        <p className="truncate text-sm text-gray-400">Connected: {address}</p>
        <button onClick={() => disconnect()} className="rounded bg-gray-800 px-3 py-1 text-white">
          Disconnect
        </button>
      </div>
      <h1 className="mb-6 text-2xl font-bold text-white md:text-3xl">Your Daring Divas Collection</h1>
      {isLoadingNfts ? (
        <p className="text-white">Loading your collection...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          {nfts.length > 0 ? (
            nfts.map((nft, i) => {
              const isCensored = !!censoredList[nft.tokenId];
              const isRevealed = !!revealedNfts[nft.tokenId];
              
              let imageUrl = nft.uniqueImageUrl || nft.image.cachedUrl || '';

              if (isCensored && isRevealed) {
                imageUrl = `/uncensored/${nft.tokenId}.jpg`;
              }

              return (
                <div key={nft.tokenId} className="rounded border border-gray-700 p-2">
                  <button
                    className="w-full cursor-pointer"
                    onClick={() => {
                      setActiveImageIndex(i);
                      setIsLightboxOpen(true);
                    }}
                  >
                    <img src={imageUrl} alt={nft.name} className="aspect-square w-full object-cover" />
                  </button>
                  
                  <p className="mt-2 font-bold text-white">{nft.name}</p>
                  
                  {isCensored && (
                    <>
                      <button
                        onClick={() => handleReveal(nft.tokenId)}
                        className={`mt-2 w-full rounded px-3 py-1 text-white transition-colors ${
                          isRevealed
                            ? 'bg-[#872958] hover:bg-[#ff55aa]'
                            : 'bg-[#ff55aa] hover:bg-[#872958]'
                        }`}
                      >
                        {isRevealed ? 'Censor' : 'De-censor'}
                      </button>
                      
                      {!isRevealed && (
                        <p className="mt-2 text-center text-xs text-gray-400">
                          This is a visual change only and does not affect your NFT.
                        </p>
                      )}
                    </>
                  )}
                </div>
              )
            })
          ) : (
            <p className="text-white">No Daring Divas found in this wallet.</p>
          )}
        </div>
      )}

      <Lightbox
        open={isLightboxOpen}
        close={() => setIsLightboxOpen(false)}
        slides={lightboxSlides}
        index={activeImageIndex}
      />
    </main>
  )
}

