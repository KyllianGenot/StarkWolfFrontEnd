// WalletConnector.tsx
import React, { useState, useEffect } from 'react';
import { connect, disconnect, StarknetWindowObject } from "starknetkit";
import { InjectedConnector } from "starknetkit/injected";
import { WebWalletConnector } from "starknetkit/webwallet";
import { Wallet } from 'lucide-react';

interface WalletConnectorProps {
  onConnect: (wallet?: StarknetWindowObject, address?: string) => void;
}

const WalletConnector: React.FC<WalletConnectorProps> = ({ onConnect }) => {
  const [connection, setConnection] = useState<StarknetWindowObject | undefined>();
  const [address, setAddress] = useState<string | undefined>();

  useEffect(() => {
    const connectToStarknet = async () => {
      const { wallet } = await connect({
        connectors: [
          new InjectedConnector({ options: { id: "argentX" } }),
          new InjectedConnector({ options: { id: "braavos" } }),
        ],
        modalMode: "neverAsk",
      });
      if (wallet?.isConnected) {
        setConnection(wallet);
        setAddress(wallet.selectedAddress);
        onConnect(wallet, wallet.selectedAddress);
      }
    };
    connectToStarknet();
  }, [onConnect]);

  const connectWallet = async () => {
    const { wallet } = await connect({
      connectors: [
        new InjectedConnector({ options: { id: "argentX" } }),
        new InjectedConnector({ options: { id: "braavos" } }),
        new WebWalletConnector({ url: "https://web.argent.xyz" }),
      ],
      modalMode: "alwaysAsk",
      modalTheme: "dark",
    });
    if (wallet?.isConnected) {
      setConnection(wallet);
      setAddress(wallet.selectedAddress);
      onConnect(wallet, wallet.selectedAddress);
    }
  };

  const disconnectWallet = async () => {
    await disconnect();
    setConnection(undefined);
    setAddress(undefined);
    onConnect(undefined, undefined);
  };

  useEffect(() => {
    const handleAccountsChange = (accounts?: string[]) => {
      if (accounts?.length) {
        setAddress(accounts[0]);
        onConnect(connection, accounts[0]);
      } else {
        setAddress(undefined);
        onConnect(undefined, undefined);
      }
    };
    connection?.on("accountsChanged", handleAccountsChange);
    return () => connection?.off("accountsChanged", handleAccountsChange);
  }, [connection, onConnect]);

  return (
    <button
      onClick={address ? disconnectWallet : connectWallet}
      className="bg-gradient-to-r from-red-900 to-red-800 hover:from-red-800 hover:to-red-700 text-gray-100 font-semibold rounded-lg px-6 py-2 flex items-center gap-2 transition-all shadow-lg shadow-red-900/50"
    >
      <Wallet size={20} />
      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect Wallet'}
    </button>
  );
};

export default WalletConnector;