'use client'

import { useState, useEffect } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { Alchemy, Network, Nft } from 'alchemy-sdk'

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// --- CONFIGURATION ---
const APP_VERSION = "v1.0.0";
const DARING_DIVAS_CONTRACT = '0xD127d434266eBF4CB4F861071ebA50A799A23d9d'
const CENSORED_LIST_URL = 'https://gist.githubusercontent.com/Mostraet/3e4cc308c270f278499f1b03440ad2ab/raw/censored-list.json';

interface EnrichedNft extends Nft {
  liveMetadata?: any;
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
              const liveMetadata = await metadataResponse.json();
              return { ...nft, liveMetadata: liveMetadata };
            } catch (e) { return nft; }
          })
        );
        setNfts(enrichedNfts);

      } catch (error) { console.error('Failed to fetch NFTs:', error) }
      finally { setIsLoadingNfts(false) }
    }
    fetchAndEnrichNfts()
  }, [isConnected, address])

  const handleReveal = (tokenId: string) => {
    setRevealedNfts((prev) => ({ ...prev, [tokenId]: !prev[tokenId] }))
  }

  // --- UPDATED "NOT CONNECTED" PAGE ---
  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col p-4 text-center md:p-8">
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
        <div className="flex flex-grow flex-col items-center justify-center">
          <h1 className="mb-4 text-4xl font-bold text-[#ff55aa]">Daring Divas App</h1>
          <p className="mb-8 max-w-md text-gray-300">
            Connect your wallet to view your collection and reveal any NSFW cards you hold.
          </p>
          <button onClick={() => connect({ connector: injected() })} className="rounded bg-blue-600 px-6 py-3 text-lg text-white" disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
        <footer className="text-xs text-gray-600">{APP_VERSION}</footer>
      </div>
    )
  }

  const lightboxSlides = nfts.map(nft => {
    const isCensored = !!censoredList[nft.tokenId];
    const isRevealed = !!revealedNfts[nft.tokenId];
    let imageUrl = nft.liveMetadata?.image || nft.image.cachedUrl || '';

    if (isCensored && isRevealed) {
      imageUrl = `/uncensored/${nft.tokenId}.jpg`;
    }
    
    return { src: imageUrl };
  });

  // --- NEW: Get collection data from the first NFT ---
  const collectionData = nfts.length > 0 ? nfts[0] : null;

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
        {/* --- UPDATED: Disconnect button hover style --- */}
        <button onClick={() => disconnect()} className="rounded bg-gray-800 px-3 py-1 text-white transition-colors hover:bg-[#ff55aa]">
          Disconnect
        </button>
      </div>

      {/* --- NEW: Collection Info Section --- */}
      {collectionData && (
        <div className="mb-12 rounded-lg border border-gray-700 bg-gray-900/50 p-6">
          <h1 className="text-3xl font-bold text-white">{collectionData.collection?.name}</h1>
          <p className="mt-2 text-lg italic text-[#ff55aa]">"Pin Me Up, Honey!"</p>
          <p className="mt-4 text-gray-300">{collectionData.description}</p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
            <span>Ticker: <span className="font-mono text-gray-200">{collectionData.contract.symbol}</span></span>
            <span>Type: <span className="font-mono text-gray-200">{collectionData.contract.tokenType}</span></span>
            <span className="truncate">Contract: <span className="font-mono text-gray-200">{collectionData.contract.address}</span></span>
          </div>
          <a 
            href={collectionData.liveMetadata?.external_url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="mt-6 inline-block text-blue-400 hover:text-blue-300"
          >
            Trade collection on Vibe Market &rarr;
          </a>
        </div>
      )}

      {isLoadingNfts ? (
        <p className="text-white">Loading your collection...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {nfts.length > 0 ? (
            nfts.map((nft, i) => {
              const isCensored = !!censoredList[nft.tokenId];
              const isRevealed = !!revealedNfts[nft.tokenId];
              let imageUrl = nft.liveMetadata?.image || nft.image.cachedUrl || '';

              if (isCensored && isRevealed) {
                imageUrl = `/uncensored/${nft.tokenId}.jpg`;
              }

              // --- NEW: Extract all traits from live metadata ---
              const attributes = nft.liveMetadata?.attributes || [];
              const rarityTrait = attributes.find((attr: any) => attr.trait_type === 'Rarity');
              const statusTrait = attributes.find((attr: any) => attr.trait_type === 'Status');
              const wearTrait = attributes.find((attr: any) => attr.trait_type === 'Wear');
              const wearValueTrait = attributes.find((attr: any) => attr.trait_type === 'Wear Value');
              const foilTrait = attributes.find((attr: any) => attr.trait_type === 'Foil');
              const mintDate = nft.mint?.timestamp ? new Date(nft.mint.timestamp).toLocaleDateString() : 'N/A';

              return (
                <div key={nft.tokenId} className="flex flex-col rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                  <button
                    className="w-full cursor-pointer"
                    onClick={() => { setActiveImageIndex(i); setIsLightboxOpen(true); }}
                  >
                    <img src={imageUrl} alt={nft.name} className="aspect-square w-full rounded-md object-cover" />
                  </button>
                  
                  <div className="mt-3 flex-grow">
                    <p className="font-bold text-white">{nft.name}</p>
                    
                    {/* --- NEW: Detailed card info --- */}
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      <p>Status: <span className="font-semibold text-gray-200">{statusTrait?.value === 'Rarity Assigned' ? 'Opened' : 'Unopened'}</span></p>
                      <p>Rarity: <span className="font-semibold text-gray-200">{rarityTrait?.value || 'N/A'}</span></p>
                      <p>Wear: <span className="font-semibold text-gray-200">{wearTrait?.value || 'N/A'} {wearValueTrait ? `(${(wearValueTrait.value * 100).toFixed(1)}%)` : ''}</span></p>
                      <p>Foil: <span className="font-semibold text-gray-200">{foilTrait?.value || 'N/A'}</span></p>
                      <p>NSFW: <span className="font-semibold text-gray-200">{isCensored ? 'Yes' : 'No'}</span></p>
                      <p>Minted: <span className="font-semibold text-gray-200">{mintDate}</span></p>
                    </div>
                  </div>
                  
                  {isCensored && (
                    <div className="mt-3">
                      <button
                        onClick={() => handleReveal(nft.tokenId)}
                        className={`w-full rounded px-3 py-1.5 text-white transition-colors ${
                          isRevealed ? 'bg-[#872958] hover:bg-[#ff55aa]' : 'bg-[#ff55aa] hover:bg-[#872958]'
                        }`}
                      >
                        {isRevealed ? 'Censor' : 'De-censor'}
                      </button>
                      {!isRevealed && (
                        <p className="mt-2 text-center text-xs text-gray-400">
                          Visual change only.
                        </p>
                      )}
                    </div>
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
      <footer className="mt-12 text-center text-xs text-gray-600">{APP_VERSION}</footer>
    </main>
  )
}

