import { type MetaMaskInpageProvider } from '@metamask/providers';
import { ethers } from 'ethers';

declare global {
  interface Window {
    ethereum?: MetaMaskInpageProvider;
  }
}

export class MetaMaskError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MetaMaskError';
  }
}

export interface TokenHolding {
  symbol: string;
  chain: string;
  quantity: string;
  selected?: boolean;
}

export interface Account {
  address: string;
  holdings: TokenHolding[];
}

const SUPPORTED_CHAINS = {
  ETH_MAINNET: {
    chainId: '0x1',
    name: 'ETHEREUM',
    rpc: 'https://eth-mainnet.g.alchemy.com/v2/demo',
    nativeCurrency: {
      symbol: 'ETH',
      decimals: 18
    }
  },
  BSC: {
    chainId: '0x38',
    name: 'BNB CHAIN',
    rpc: 'https://bsc-dataseed1.binance.org',
    nativeCurrency: {
      symbol: 'BNB',
      decimals: 18
    }
  },
  POLYGON: {
    chainId: '0x89',
    name: 'POLYGON',
    rpc: 'https://polygon-rpc.com',
    nativeCurrency: {
      symbol: 'MATIC',
      decimals: 18
    }
  },
  ARBITRUM: {
    chainId: '0xa4b1',
    name: 'ARBITRUM',
    rpc: 'https://arb1.arbitrum.io/rpc',
    nativeCurrency: {
      symbol: 'ETH',
      decimals: 18
    }
  }
};

const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)'
];

const waitForNetworkChange = async (targetChainId: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Network change timeout'));
    }, 1500);

    const handleNetworkChange = (networkId: unknown) => {
      if (typeof networkId === 'string' && networkId === targetChainId) {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timeout);
      window.ethereum?.removeListener('chainChanged', handleNetworkChange as (...args: unknown[]) => void);
    };

    window.ethereum?.on('chainChanged', handleNetworkChange as (...args: unknown[]) => void);
  });
};

async function switchChain(chainId: string): Promise<ethers.providers.Web3Provider> {
  try {
    await window.ethereum?.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId }],
    });

    await waitForNetworkChange(chainId);
    const provider = new ethers.providers.Web3Provider(window.ethereum as any);
    await provider.ready; // Ensure provider is fully initialized
    return provider;
  } catch (error: any) {
    if (error.code === 4902) {
      const chain = Object.values(SUPPORTED_CHAINS).find(c => c.chainId === chainId);
      if (chain) {
        try {
          await window.ethereum?.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chain.chainId,
              chainName: chain.name,
              rpcUrls: [chain.rpc],
              nativeCurrency: chain.nativeCurrency
            }],
          });
          await waitForNetworkChange(chainId);
          const provider = new ethers.providers.Web3Provider(window.ethereum as any);
          await provider.ready;
          return provider;
        } catch (addChainError) {
          console.error('Error adding chain:', addChainError);
          throw new Error(`Failed to add chain ${chain.name}`);
        }
      }
    }
    console.error('Error switching chain:', error);
    throw new Error(`Failed to switch to chain ${chainId}`);
  }
}

async function getNativeTokenBalance(
  provider: ethers.providers.Web3Provider,
  address: string,
  chain: typeof SUPPORTED_CHAINS[keyof typeof SUPPORTED_CHAINS]
): Promise<TokenHolding | null> {
  try {
    const balance = await provider.getBalance(address);
    if (!balance.isZero()) {
      return {
        symbol: chain.nativeCurrency.symbol,
        chain: chain.name,
        quantity: ethers.utils.formatUnits(balance, chain.nativeCurrency.decimals),
        selected: false
      };
    }
  } catch (error) {
    console.error(`Error fetching native balance for ${chain.name}:`, error);
  }
  return null;
}

async function getTokenBalance(
  provider: ethers.providers.Web3Provider,
  tokenAddress: string,
  walletAddress: string,
  chainName: string
): Promise<TokenHolding | null> {
  try {
    const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
    const [balance, symbol, decimals] = await Promise.all([
      contract.balanceOf(walletAddress),
      contract.symbol(),
      contract.decimals()
    ]);
    
    if (!balance.isZero()) {
      return {
        symbol,
        chain: chainName,
        quantity: ethers.utils.formatUnits(balance, decimals),
        selected: false
      };
    }
  } catch (error) {
    console.error(`Error checking token ${tokenAddress}:`, error);
  }
  return null;
}

export async function getAccountHoldings(address: string): Promise<TokenHolding[]> {
  if (!window.ethereum) throw new MetaMaskError('MetaMask not installed');

  const holdings: TokenHolding[] = [];
  const chains = Object.values(SUPPORTED_CHAINS);
  
  // Process chains sequentially to avoid network switching conflicts
  for (const chain of chains) {
    try {
      console.log(`Fetching holdings for ${chain.name}...`);
      const provider = await switchChain(chain.chainId);
      
      // Verify we're on the correct network
      const network = await provider.getNetwork();
      if (network.chainId !== parseInt(chain.chainId, 16)) {
        console.error(`Network mismatch for ${chain.name}`);
        continue;
      }

      const [nativeBalance, commonTokens] = await Promise.all([
        getNativeTokenBalance(provider, address, chain),
        Promise.all(
          getCommonTokensForChain(chain.chainId).map(token =>
            getTokenBalance(provider, token.address, address, chain.name)
          )
        )
      ]);

      if (nativeBalance) {
        holdings.push(nativeBalance);
      }

      holdings.push(...commonTokens.filter((b): b is TokenHolding => b !== null));
      console.log(`Successfully fetched ${chain.name} holdings`);
    } catch (error) {
      console.error(`Error fetching ${chain.name} holdings:`, error);
    }
  }

  return holdings;
}

function getCommonTokensForChain(chainId: string): { address: string; symbol: string }[] {
  switch (chainId) {
    case '0x1': // Ethereum
      return [
        { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC' },
        { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT' },
        { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC' }
      ];
    case '0x38': // BSC
      return [
        { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC' },
        { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT' }
      ];
    default:
      return [];
  }
}

export async function connectMetaMask(): Promise<Account[]> {
  if (typeof window === 'undefined') {
    throw new MetaMaskError('MetaMask cannot be accessed server-side');
  }

  if (!window.ethereum) {
    throw new MetaMaskError('MetaMask is not installed');
  }

  try {
    const accounts = await window.ethereum.request({
      method: 'eth_requestAccounts',
    }) as string[];

    if (!accounts.length) {
      throw new MetaMaskError('No accounts found');
    }

    const accountsWithHoldings = await Promise.all(
      accounts.map(async (address) => {
        const holdings = await getAccountHoldings(address);
        return { address, holdings };
      })
    );

    return accountsWithHoldings;
  } catch (error: any) {
    if (error.code === 4001) {
      throw new MetaMaskError('User rejected the connection request');
    }
    throw new MetaMaskError(error.message || 'Failed to connect to MetaMask');
  }
}

export function isMetaMaskInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.ethereum);
}

export function setupAccountChangeListener(callback: (accounts: string[]) => void): void {
  if (typeof window !== 'undefined' && window.ethereum) {
    window.ethereum.on('accountsChanged', callback as (...args: unknown[]) => void);
  }
}