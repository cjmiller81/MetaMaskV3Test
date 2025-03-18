'use client';

import {
  Card,
  CardContent,
  Typography,
  Select,
  MenuItem,
  Box,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Checkbox,
  Alert,
  Snackbar
} from '@mui/material';
import { useState, useEffect } from 'react';
import { connectMetaMask, isMetaMaskInstalled, setupAccountChangeListener, getAccountHoldings, type Account, type TokenHolding } from '@/lib/metamask';
import Web3, { EIP6963ProviderDetail } from 'web3'

export interface holding {
  id: number;
  symbol: string;
  chain: string;
  quantity: string;
  selected: boolean;
}

export interface chainModel {
  chainId: number;
  chainName: string;
  symbol: string;
}

export default function CurrentPosition() {
  const [walletService, setWalletService] = useState('');
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [holdings, setHoldings] = useState<TokenHolding[]>([]);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const [userAccounts, setUserAccounts] = useState<string[]>()
  const [userAccount, setUserAccount] = useState<string>('')
  const [selectedPositions, setSelectedPositions] = useState<holding[]>([]);
  const [currentPositions, setCurrentPositions] = useState<holding[]>([]);
  const [web3Enabled, setWeb3Enabled] = useState(false);
  const [providers, setProviders] = useState<EIP6963ProviderDetail[]>([]);
  const [isSelectAll, setSelectAll] = useState(false);

  const metamaskChainIds: chainModel[] = [
    { chainId: 1, chainName: "Ethereum", symbol: "ETH" },
    { chainId: 59144, chainName: "Linea", symbol: "ETH" },
    { chainId: 56, chainName: "BNB", symbol: "BNB" },
    { chainId: 137, chainName: "POLYGON", symbol: "POL" },
    { chainId: 42161, chainName: "ARBITRUM", symbol: "ETH" },
    { chainId: 43114, chainName: "Avalanche", symbol: "AVAX" },
    { chainId: 8453, chainName: "Base Mainnet", symbol: "ETH" },
    { chainId: 10, chainName: "OP Mainnet", symbol: "ETH" },
    { chainId: 324, chainName: "zkSync Era Mainnet", symbol: "ETH" }]


  let web3: Web3 = new Web3()
  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const ethEnabled = async () => {
    if (typeof window.ethereum !== 'undefined') {
      // Instance web3 with the provided information from the MetaMask provider information
      web3 = new Web3(window.ethereum);
      try {
        // Request account access
        await window.ethereum.enable();

        return true
      } catch (e) {
        // User denied access
        return false
      }
    }
  }

  useEffect(() => {
    const web3Connect = async () => {
      // Following will subscribe to event that will be triggered when providers map is updated.

      // Call the function and wait for the promise to resolve
      let listOfProviders = await Web3.requestEIP6963Providers();
      let providersArray: EIP6963ProviderDetail[] = [];
      listOfProviders.forEach((provider, key) => {
        providersArray.push(provider);
        setProviders(providersArray);
      })
    }
    web3Connect().catch(console.error);
  }, [])

  useEffect(() => {
    setCurrentPositions([])
    if (userAccount !== '') {
      setWeb3Enabled(true)
      const getAcc = async () => {
        if (await !ethEnabled()) {
          alert("Please install MetaMask to use this dApp!");
        }
        await web3.currentProvider?.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: web3.utils.toHex(1) }]
        }).catch(console.error)

        for (let index = 0; index < metamaskChainIds.length; index++) {
          let chain = metamaskChainIds[index];
          await web3.currentProvider?.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: web3.utils.toHex(chain.chainId) }]
          }).catch(console.error)
          const nativeBalance = await web3.eth.getBalance("0xda32721c5e54805e7605ae77030f7f9df43e302a");
          const nativeBalanceNumber = web3.utils.fromWei(nativeBalance, 'ether')
          if (Number.parseFloat(nativeBalanceNumber) !== 0) {
            let hld: holding = { chain: chain.chainName, id: index, symbol: chain.symbol, quantity: nativeBalanceNumber, selected: false };
            console.log(hld)
            setCurrentPositions(curArray => [...curArray, hld])
          }
        }
      }
      getAcc().catch(console.error);
    }
  }, [userAccount])

  const handleConnect = async (providerWithInfo: EIP6963ProviderDetail) => {
    const accounts: string[] | undefined =
      await (
        providerWithInfo.provider
          .request({ method: 'eth_requestAccounts' })
          .catch(console.error)
      ) as string[] | undefined;
    if (accounts?.length != 0) {
      setUserAccounts(accounts)
      console.log(accounts)
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSelectClick = (position: holding) => {
    if (!position.selected) {
      setSelectedPositions(cs => [...cs, position]);
      position.selected = true;
    } else {
      setSelectedPositions(cs => cs.filter(p => p.id != position.id))
      position.selected = false;
    }
  }

  useEffect(() => {
    if (currentPositions.length == selectedPositions.length && currentPositions.length != 0) {
      setSelectAll(true);
    } else {
      setSelectAll(false);
    }
  }, [selectedPositions])

  const handleSelectAllClick = (event: any) => {
    if (event.target.checked) {
      currentPositions.map(c => c.selected = true)
      setSelectedPositions(currentPositions);
      setSelectAll(true);
      return;
    }

    currentPositions.map(c => c.selected = false)
    setSelectedPositions([]);
    setSelectAll(false);
  };

  return (
    <Card sx={{
      bgcolor: 'grey.900',
      color: 'common.white',
      minWidth: 800,
      p: 2
    }}>
      <CardContent>
        <Typography variant="h6" component="h2" gutterBottom>
          Current Position
        </Typography>

        <Box sx={{ display: 'flex', gap: 4 }}>
          {/* Left side - Wallet controls */}
          <Box sx={{ width: '300px' }}>
            <Typography variant="subtitle1" gutterBottom>
              Web3 Wallets
            </Typography>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <Select
                value={walletService}
                //onChange={(e) => handleWalletServiceChange(e.target.value)}
                displayEmpty
                renderValue={(selected) => {
                  if (selected === '') {
                    return 'Connect Wallet Service';
                  }
                  return 'MetaMask';
                }}
                sx={{
                  bgcolor: '#0091EA',
                  color: 'common.white',
                  '& .MuiSelect-icon': {
                    color: 'common.white',
                  },
                  '&:hover': {
                    bgcolor: '#0277BD',
                  },
                  height: '45px',
                }}
              >
                {
                  providers?.length > 0 ? providers.map((provider: EIP6963ProviderDetail) => (
                    <MenuItem key={provider.info.uuid} value={provider.info.name} onClick={() => handleConnect(provider)}>{provider.info.name}</MenuItem>
                  )) :
                    <div>
                      No Announced Wallet Providers
                    </div>
                }
              </Select>
            </FormControl>

            <Typography variant="subtitle1" gutterBottom>
              Connected Wallet
            </Typography>
            <FormControl fullWidth>
              <Select
                value={userAccount}
                onChange={(e) => setUserAccount(e.target.value)}
                displayEmpty
                disabled={!userAccounts?.length}
                sx={{
                  bgcolor: 'common.white',
                  color: 'black',
                  '& .MuiSelect-icon': {
                    color: 'black',
                  },
                }}
              >
                {userAccounts?.map((account) => (
                  <MenuItem key={account} value={account}>
                    <span>{formatAddress(account)}</span>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          {/* Right side - Table */}
          <Box sx={{ flex: 1 }}>
            <TableContainer component={Paper} sx={{ bgcolor: 'grey.900', color: 'common.white' }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox" sx={{ color: 'common.white' }}>
                      <Checkbox
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&.Mui-checked': {
                            color: 'white',
                          },
                        }}
                        checked={isSelectAll || false}
                        onClick={handleSelectAllClick}
                      />
                    </TableCell>
                    <TableCell sx={{ color: 'common.white' }}>Symbol</TableCell>
                    <TableCell sx={{ color: 'common.white' }}>Chain</TableCell>
                    <TableCell sx={{ color: 'common.white' }}>Qty</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {currentPositions.length > 0 ? (
                    currentPositions
                      .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                      .map((holding, index) => (
                        <TableRow key={`${holding.symbol}-${holding.chain}`}>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={holding.selected || false}
                              onChange={() => handleSelectClick(holding)}
                              sx={{ color: 'common.white' }}
                            />
                          </TableCell>
                          <TableCell sx={{ color: 'common.white' }}>{holding.symbol}</TableCell>
                          <TableCell sx={{ color: 'common.white' }}>{holding.chain}</TableCell>
                          <TableCell sx={{ color: 'common.white' }}>{holding.quantity}</TableCell>
                        </TableRow>
                      ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ color: 'common.white' }}>
                        No rows
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <TablePagination
                component="div"
                count={holdings.length}
                page={page}
                onPageChange={handleChangePage}
                rowsPerPage={rowsPerPage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                sx={{
                  color: 'common.white',
                  '.MuiTablePagination-selectIcon': {
                    color: 'common.white',
                  },
                  '.MuiTablePagination-select': {
                    color: 'common.white',
                  },
                }}
              />
            </TableContainer>
          </Box>
        </Box>

        <Snackbar
          open={!!error}
          autoHideDuration={6000}
          onClose={() => setError(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert
            onClose={() => setError(null)}
            severity="error"
            sx={{ width: '100%' }}
          >
            {error}
          </Alert>
        </Snackbar>
      </CardContent>
    </Card>
  );
}