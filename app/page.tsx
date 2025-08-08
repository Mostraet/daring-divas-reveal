'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useConnect, useDisconnect } from 'wagmi'
import { injected } from 'wagmi/connectors'
import { Alchemy, Network, Nft } from 'alchemy-sdk'

import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// --- CONFIGURATION ---
const APP_VERSION = "v1.1.6";
const DARING_DIVAS_CONTRACT = '0xD127d434266eBF4CB4F861071ebA50A799A23d9d'
const CENSORED_LIST_URL = 'https://gist.githubusercontent.com/Mostraet/3e4cc308c270f278499f1b03440ad2ab/raw/censored-list.json';

// --- TYPE DEFINITIONS ---
interface EnrichedNft extends Nft {
  liveMetadata?: any;
}

interface EnrichedNftWithScore extends EnrichedNft {
  pupScore?: number;
}

// --- SCORING LOGIC ---
const calculatePupScore = (nft: EnrichedNft, isConfirmedNSFW: boolean): number => {
  const attributes = nft.liveMetadata?.attributes || [];
  const rarityTrait = attributes.find((attr: any) => attr.trait_type === 'Rarity');
  const wearValueTrait = attributes.find((attr: any) => attr.trait_type === 'Wear Value');
  const foilTrait = attributes.find((attr: any) => attr.trait_type === 'Foil');
  const statusTrait = attributes.find((attr: any) => attr.trait_type === 'Status');

  if (statusTrait?.value !== 'Rarity Assigned') {
    return 0; // Unopened cards have no score
  }

  // 1. Rarity Multiplier
  let rarityMultiplier = 1.0;
  switch (rarityTrait?.value) {
    case 'Common': rarityMultiplier = 1.0; break;
    case 'Rare': rarityMultiplier = 3.28; break;
    case 'Epic': rarityMultiplier = 9.85; break;
    case 'Legendary': rarityMultiplier = 23.0; break;
    default: rarityMultiplier = 1.0;
  }

  // 2. Wear Multiplier (lower wear value is better)
  const wearValue = wearValueTrait?.value ?? 1.0;
  const wearMultiplier = 2.0 - wearValue;

  // 3. Foil Multiplier
  const foilMultiplier = foilTrait?.value !== 'None' ? 5.0 : 1.0;

  // 4. NSFW Multiplier
  const nsfwMultiplier = isConfirmedNSFW ? 3.0 : 1.0;

  // 5. Age Multiplier
  let ageMultiplier = 1.0;
  if (nft.mint?.timestamp) {
    const mintDate = new Date(nft.mint.timestamp);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - mintDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    ageMultiplier = 1 + (diffDays * 0.001);
  }

  // 6. Token ID Multiplier
  const tokenId = parseInt(nft.tokenId, 10);
  const tokenIdMultiplier = !isNaN(tokenId) ? (2 * Math.exp(-0.005 * (tokenId - 1)) + 1) : 1.0;

  const rawScore = rarityMultiplier * wearMultiplier * foilMultiplier * nsfwMultiplier * ageMultiplier * tokenIdMultiplier;
  
  return Math.sqrt(rawScore) * 10;
};

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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleReveal = (tokenId: string) => {
    setRevealedNfts((prev) => ({ ...prev, [tokenId]: !prev[tokenId] }))
  }

  useEffect(() => {
    const fetchCensoredList = async () => {
      try {
        const response = await fetch(`${CENSORED_LIST_URL}?t=${new Date().getTime()}`);
        const data = await response.json();
        setCensoredList(data);
      } catch (error) { console.error("Failed to fetch censored list:", error); }
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

  const nftsWithScores: EnrichedNftWithScore[] = useMemo(() => {
    return nfts.map(nft => ({
      ...nft,
      pupScore: calculatePupScore(nft, !!censoredList[nft.tokenId])
    }));
  }, [nfts, censoredList]);

  const totalPupScore = useMemo(() => {
    return nftsWithScores.reduce((total, nft) => total + (nft.pupScore || 0), 0);
  }, [nftsWithScores]);


  if (!isConnected) {
    return (
      <div className="flex min-h-screen flex-col p-4 text-center md:p-8">
        <header className="flex justify-end">
          <a href="https://daringdivas.art" target="_blank" rel="noopener noreferrer" className="rounded-md border border-gray-600 px-4 py-2 text-white transition-colors hover:border-[#ff55aa] hover:bg-[#ff55aa]">Back to Main Site</a>
        </header>
        <div className="flex flex-grow flex-col items-center justify-center">
          <h1 className="mb-4 text-4xl font-bold text-[#ff55aa]">Daring Divas App</h1>
          <p className="mb-8 max-w-md text-gray-300">View your collection and reveal any NSFW cards you hold.</p>
          <button onClick={() => connect({ connector: injected() })} className="rounded bg-blue-600 px-6 py-3 text-lg text-white" disabled={isConnecting}>
            {isConnecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        </div>
        <footer className="text-xs text-gray-600">{APP_VERSION}</footer>
      </div>
    )
  }

  const lightboxSlides = nfts.map(nft => {
    const isConfirmedNSFW = !!censoredList[nft.tokenId];
    const isRevealed = !!revealedNfts[nft.tokenId];
    let imageUrl = nft.liveMetadata?.image || nft.image.cachedUrl || '';
    if (isConfirmedNSFW && isRevealed) {
      imageUrl = `/uncensored/${nft.tokenId}.jpg`;
    }
    return { src: imageUrl };
  });

  const collectionData = nfts.length > 0 ? nfts[0] : null;
  const fullDescription = "Forged in unyielding steel and clad in black leather, Freya carves her mark of order in the neon-drenched underbelly of Neonopolis. Dive into the cyberpunk shadows with this exclusive teaser for Daring Divas' fierce Captain Freya. Pack includes 101 cards across four Rarities and five pinup Tiers. Unlock Freya's secrets through Canonical lore, Naughty reveals (censored here, unlockable for holders at daringdivas.art), Nice teases, Altered glitches, and the abundant Apocrypha.";
  const shortDescription = "Forged in unyielding steel and clad in black leather, Freya carves her mark of order in the neon-drenched underbelly of Neonopolis.";

  return (
    <main className="container mx-auto p-4 md:p-8">
      <header className="mb-8 flex justify-end">
        <a href="https://daringdivas.art" target="_blank" rel="noopener noreferrer" className="rounded-md border border-gray-600 px-4 py-2 text-white transition-colors hover:border-[#ff55aa] hover:bg-[#ff55aa]">Back to Main Site</a>
      </header>
      <div className="mb-8 flex items-center justify-between">
        <p className="truncate text-sm text-gray-400">Connected: {address}</p>
        <button onClick={() => disconnect()} className="rounded bg-gray-800 px-3 py-1 text-white transition-colors hover:bg-[#ff55aa]">Disconnect</button>
      </div>

      {collectionData && (
        <div className="mb-12 rounded-lg border border-gray-700 bg-gray-900/50 p-6">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h1 className="text-3xl font-bold text-white">{collectionData.collection?.name}</h1>
            <div className="text-right">
              <div className="group relative flex items-center justify-end gap-2">
                <p className="text-sm text-gray-400">Total Pin-Up Points</p>
                <div className="cursor-help">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-gray-500">
                    <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a1 1 0 0 0 0 2v3a1 1 0 0 0 1 1h1a1 1 0 1 0 0-2v-3a1 1 0 0 0-1-1H9Z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="absolute bottom-full mb-2 w-64 rounded-lg bg-gray-800 p-3 text-left text-xs text-gray-300 opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  Your collection's total score based on card rarity, condition, foil, age, Token ID, and NSFW status.
                </div>
              </div>
              <p className="text-3xl font-bold text-[#ff55aa]">{totalPupScore.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            </div>
          </div>
          <p className="mt-2 text-lg italic text-[#ff55aa]">"Pin Me Up, Honey!"</p>
          <p className="mt-4 text-gray-300">
            {isDescriptionExpanded ? fullDescription : `${shortDescription}... `}
            <button onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)} className="ml-1 inline-block text-blue-400 hover:text-blue-300">{isDescriptionExpanded ? 'less' : 'more'}</button>
          </p>
          <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-400">
            <span>Ticker: <span className="font-mono text-gray-200">{collectionData.contract.symbol}</span></span>
            <span>Type: <span className="font-mono text-gray-200">{collectionData.contract.tokenType}</span></span>
            <span className="truncate">Contract: <span className="font-mono text-gray-200">{collectionData.contract.address}</span></span>
          </div>
          <a href={collectionData.liveMetadata?.external_url} target="_blank" rel="noopener noreferrer" className="mt-6 inline-block text-blue-400 hover:text-blue-300">Trade on Vibe Market &rarr;</a>
        </div>
      )}

      {isLoadingNfts ? (
        <p className="text-white">Loading your collection...</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {nftsWithScores.length > 0 ? (
            nftsWithScores.map((nft, i) => {
              const attributes = nft.liveMetadata?.attributes || [];
              const rarityTrait = attributes.find((attr: any) => attr.trait_type === 'Rarity');
              const statusTrait = attributes.find((attr: any) => attr.trait_type === 'Status');
              const wearTrait = attributes.find((attr: any) => attr.trait_type === 'Wear');
              const foilTrait = attributes.find((attr: any) => attr.trait_type === 'Foil');
              const isOpened = statusTrait?.value === 'Rarity Assigned';
              const isConfirmedNSFW = !!censoredList[nft.tokenId];
              const isRevealed = !!revealedNfts[nft.tokenId];
              let imageUrl = nft.liveMetadata?.image || nft.image.cachedUrl || '';
              if (isConfirmedNSFW && isRevealed) {
                imageUrl = `/uncensored/${nft.tokenId}.jpg`;
              }
              let mintDate = 'N/A';
              if (nft.mint?.timestamp) {
                const date = new Date(nft.mint.timestamp);
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                mintDate = `${year}/${month}/${day}`;
              }

              return (
                <div key={nft.tokenId} className="flex flex-col rounded-lg border border-gray-700 bg-gray-900/50 p-3">
                  <button className="w-full cursor-pointer" onClick={() => { setActiveImageIndex(i); setIsLightboxOpen(true); }}>
                    <img src={imageUrl} alt={nft.name} className="aspect-[5/7] w-full rounded-md object-cover" />
                  </button>
                  <div className="mt-3 flex-grow">
                    <p className="font-bold text-white">{nft.name}</p>
                    {/* --- UPDATED: Logic for unopened card PUPs display --- */}
                    <div className="mt-2 rounded bg-[#ff55aa]/20 px-2 py-1 text-center">
                      {isOpened ? (
                        <p className="text-xs font-bold text-[#ff55aa]">PUPs: {nft.pupScore?.toFixed(2)}</p>
                      ) : (
                        <p className="text-xs font-bold text-[#ff55aa]/60">Open card to show PUPs</p>
                      )}
                    </div>
                    <div className="mt-2 space-y-1 text-xs text-gray-400">
                      <p>Status: <span className="font-semibold text-gray-200">{isOpened ? 'Opened' : 'Unopened'}</span></p>
                      <p>Rarity: <span className="font-semibold text-gray-200">{isOpened ? (rarityTrait?.value || 'N/A') : 'N/A'}</span></p>
                      <p>Wear: <span className="font-semibold text-gray-200">{wearTrait?.value || 'N/A'}</span></p>
                      <p>Foil: <span className="font-semibold text-gray-200">{foilTrait?.value || 'N/A'}</span></p>
                      <p>NSFW: <span className="font-semibold text-gray-200">{isOpened ? (isConfirmedNSFW ? 'Yes' : 'No') : 'N/A'}</span></p>
                      <p>Minted: <span className="font-semibold text-gray-200">{mintDate}</span></p>
                    </div>
                  </div>
                  {isConfirmedNSFW && (
                    <div className="mt-3">
                      <button onClick={() => handleReveal(nft.tokenId)} className={`w-full rounded px-3 py-1.5 text-white transition-colors ${isRevealed ? 'bg-[#872958] hover:bg-[#ff55aa]' : 'bg-[#ff55aa] hover:bg-[#872958]'}`}>
                        {isRevealed ? 'Censor' : 'De-censor'}
                      </button>
                      {!isRevealed && (<p className="mt-2 text-center text-xs text-gray-400">Temporary visual change only.</p>)}
                    </div>
                  )}
                </div>
              )
            })
          ) : (<p className="text-white">No Daring Divas found in this wallet.</p>)}
        </div>
      )}
      <Lightbox open={isLightboxOpen} close={() => setIsLightboxOpen(false)} slides={lightboxSlides} index={activeImageIndex} />
      <footer className="mt-12 text-center text-xs text-gray-600">{APP_VERSION}</footer>
    </main>
  )
}

