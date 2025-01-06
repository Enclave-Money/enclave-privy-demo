import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { getAccessToken, usePrivy } from "@privy-io/react-auth";
import Head from "next/head";
import { Enclave, SignMode } from 'enclavemoney';
import {ethers} from "ethers";

const API_KEY = process.env.NEXT_PUBLIC_ENCLAVE_API_KEY as string;
const enclave = new Enclave(API_KEY);

async function verifyToken() {
  const url = "/api/verify";
  const accessToken = await getAccessToken();
  const result = await fetch(url, {
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    },
  });

  return await result.json();
}

export default function DashboardPage() {
  const [verifyResult, setVerifyResult] = useState();
  const router = useRouter();
  const {
    ready,
    authenticated,
    user,
    logout,
    linkEmail,
    linkWallet,
    unlinkEmail,
    linkPhone,
    unlinkPhone,
    unlinkWallet,
    linkGoogle,
    unlinkGoogle,
    linkTwitter,
    unlinkTwitter,
    linkDiscord,
    unlinkDiscord,
    signMessage
  } = usePrivy();

  const [smartAccount, setSmartAccount] = useState<any>(null);
  const [isLoadingSmartAccount, setIsLoadingSmartAccount] = useState(false);
  const [smartBalance, setSmartBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [signedMessage, setSignedMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>('');
  const [recipientAddress, setRecipientAddress] = useState<string>('');

  const numAccounts = user?.linkedAccounts?.length || 0;
  const canRemoveAccount = numAccounts > 1;

  const email = user?.email;
  const phone = user?.phone;
  const wallet = user?.wallet;

  const googleSubject = user?.google?.subject || null;
  const twitterSubject = user?.twitter?.subject || null;
  const discordSubject = user?.discord?.subject || null;

  useEffect(() => {
    if (ready && !authenticated) {
      router.push("/");
    }
  }, [ready, authenticated, router]);

  useEffect(() => {
    async function setupSmartAccount() {
      if (ready && authenticated && wallet?.address) {
        try {
          setIsLoadingSmartAccount(true);
          const account = await enclave.createSmartAccount(wallet.address);
          setSmartAccount(account);

          // Fetch balance after creating smart account
          setIsLoadingBalance(true);
          const balance = await enclave.getSmartBalance(account.wallet.scw_address);
          setSmartBalance(balance.netBalance);
        } catch (error) {
          console.error("Error creating smart account:", error);
        } finally {
          setIsLoadingSmartAccount(false);
          setIsLoadingBalance(false);
        }
      }
    }

    setupSmartAccount();
  }, [ready, authenticated, wallet?.address]);

  const handleSignMessage = async () => {
    if (!wallet) return;
    
    try {
      const message = "Hello from Privy!";
      const signature = await signMessage({
        message: message
      });
      setSignedMessage(signature.signature);
    } catch (error) {
      console.error("Error signing message:", error);
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    // Allow empty string, digits, and one decimal point
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setAmount(value);
    }
  };

  const handleSubmitAmount = async () => {
    if (!smartAccount || !amount || !recipientAddress) return;

    try {
      // USDC contract on Optimism
      const usdcContractAddress = '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85';
      
      const amountInUSDC = ethers.utils.parseUnits(amount, 6);

      const erc20Interface = new ethers.utils.Interface([
        'function transfer(address to, uint256 amount)'
      ]);
      
      // Use the recipient address from state instead of hardcoded value
      const encodedData = erc20Interface.encodeFunctionData('transfer', [
        recipientAddress,
        amountInUSDC
      ]);

      // Build transaction details
      const transactionDetails = [{
        encodedData,
        targetContractAddress: usdcContractAddress,
        value: 0 // No ETH transfer, only USDC
      }];

      // Define order data
      const orderData = {
        amount: amountInUSDC.toString(),
        type: 'AMOUNT_OUT' // User needs exact amount on target network
      };

      // Build the transaction
      const builtTxn = await enclave.buildTransaction(
        transactionDetails,
        //@ts-ignore
        10, // Target network (Optimism)
        smartAccount.wallet.scw_address,
        orderData,
        undefined,
        SignMode.ECDSA
      );

      // TODO: Sign and submit transaction
      console.log('Transaction built:', builtTxn);

      const signature = await signMessage({
        message: builtTxn.messageToSign
      });

      // Submit the transaction
      const response = await enclave.submitTransaction(
          signature.signature,
          builtTxn.userOp,
          10, // Target network
          smartAccount.wallet.scw_address,
          //@ts-ignore
          SignMode.ECDSA// Signature type (Pass SignMode.SimpleSessionKey if the signature is being generated from a sessionKey instead of the user's default EOA)
      );

      console.log('Transaction submitted successfully:', response);
      
    } catch (error) {
      console.error('Error building transaction:', error);
    }
  };

  return (
    <>
      <Head>
        <title>Privy Auth Demo</title>
      </Head>

      <main className="flex flex-col min-h-screen px-4 sm:px-20 py-6 sm:py-10 bg-privy-light-blue">
        {ready && authenticated ? (
          <>
            <div className="flex flex-row justify-between">
              <h1 className="text-2xl font-semibold">Privy Auth Demo</h1>
              <button
                onClick={logout}
                className="text-sm bg-violet-200 hover:text-violet-900 py-2 px-4 rounded-md text-violet-700"
              >
                Logout
              </button>
            </div>
            <div className="mt-12 flex gap-4 flex-wrap">
              {googleSubject ? (
                <button
                  onClick={() => {
                    unlinkGoogle(googleSubject);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink Google
                </button>
              ) : (
                <button
                  onClick={() => {
                    linkGoogle();
                  }}
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                >
                  Link Google
                </button>
              )}

              {twitterSubject ? (
                <button
                  onClick={() => {
                    unlinkTwitter(twitterSubject);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink Twitter
                </button>
              ) : (
                <button
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                  onClick={() => {
                    linkTwitter();
                  }}
                >
                  Link Twitter
                </button>
              )}

              {discordSubject ? (
                <button
                  onClick={() => {
                    unlinkDiscord(discordSubject);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink Discord
                </button>
              ) : (
                <button
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                  onClick={() => {
                    linkDiscord();
                  }}
                >
                  Link Discord
                </button>
              )}

              {email ? (
                <button
                  onClick={() => {
                    unlinkEmail(email.address);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink email
                </button>
              ) : (
                <button
                  onClick={linkEmail}
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                >
                  Connect email
                </button>
              )}
              {wallet ? (
                <button
                  onClick={() => {
                    unlinkWallet(wallet.address);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink wallet
                </button>
              ) : (
                <button
                  onClick={linkWallet}
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
                >
                  Connect wallet
                </button>
              )}
              {phone ? (
                <button
                  onClick={() => {
                    unlinkPhone(phone.number);
                  }}
                  className="text-sm border border-violet-600 hover:border-violet-700 py-2 px-4 rounded-md text-violet-600 hover:text-violet-700 disabled:border-gray-500 disabled:text-gray-500 hover:disabled:text-gray-500"
                  disabled={!canRemoveAccount}
                >
                  Unlink phone
                </button>
              ) : (
                <button
                  onClick={linkPhone}
                  className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
                >
                  Connect phone
                </button>
              )}

              <button
                onClick={() => verifyToken().then(setVerifyResult)}
                className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white border-none"
              >
                Verify token on server
              </button>

              {Boolean(verifyResult) && (
                <details className="w-full">
                  <summary className="mt-6 font-bold uppercase text-sm text-gray-600">
                    Server verify result
                  </summary>
                  <pre className="max-w-4xl bg-slate-700 text-slate-50 font-mono p-4 text-xs sm:text-sm rounded-md mt-2">
                    {JSON.stringify(verifyResult, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {wallet && (
              <>
                {isLoadingSmartAccount ? (
                  <div className="w-full mt-6">
                    <p className="font-bold uppercase text-sm text-gray-600">
                      Fetching Smart Account...
                    </p>
                    <div className="bg-slate-100 p-4 rounded-md mt-2 flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-violet-600 rounded-full border-t-transparent"></div>
                      <span className="text-gray-600">Please wait</span>
                    </div>
                  </div>
                ) : smartAccount && (
                  <>
                    <div className="w-full mt-6">
                      <p className="font-bold uppercase text-sm text-gray-600">
                        Your Smart Account Address
                      </p>
                      <div className="flex items-center bg-slate-100 p-4 rounded-md mt-2 gap-2">
                        <p className="font-mono flex-1">{smartAccount.wallet.scw_address}</p>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(smartAccount.wallet.scw_address);
                          }}
                          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    <div className="w-full mt-6">
                      <p className="font-bold uppercase text-sm text-gray-600">
                        Smart Account Balance
                      </p>
                      <div className="bg-slate-100 p-4 rounded-md mt-2">
                        {isLoadingBalance ? (
                          <div className="flex items-center space-x-2">
                            <div className="animate-spin h-4 w-4 border-2 border-violet-600 rounded-full border-t-transparent"></div>
                            <span className="text-gray-600">Fetching balance...</span>
                          </div>
                        ) : (
                          <p className="font-mono">{ethers.utils.formatUnits(smartBalance ?? '0' as string, 6)} USDC</p>
                        )}
                      </div>
                    </div>

                    <div className="w-full mt-6">
                      <p className="font-bold uppercase text-sm text-gray-600">
                        Message Signing
                      </p>
                      <div className="bg-slate-100 p-4 rounded-md mt-2">
                        <button
                          onClick={handleSignMessage}
                          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                        >
                          Sign Message
                        </button>
                        {signedMessage && (
                          <div className="mt-4">
                            <p className="text-sm text-gray-600">Signed Message:</p>
                            <p className="font-mono text-sm break-all mt-2">{signedMessage}</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="w-full mt-6">
                      <p className="font-bold uppercase text-sm text-gray-600">
                        Send USDC
                      </p>
                      <div className="bg-slate-100 p-4 rounded-md mt-2 flex gap-2">
                        <input
                          type="text"
                          value={amount}
                          onChange={handleAmountChange}
                          placeholder="Enter amount"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-600"
                        />
                        <input
                          type="text"
                          value={recipientAddress}
                          onChange={(e) => setRecipientAddress(e.target.value)}
                          placeholder="Enter recipient address"
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-600"
                        />
                        <button
                          onClick={handleSubmitAmount}
                          className="text-sm bg-violet-600 hover:bg-violet-700 py-2 px-4 rounded-md text-white"
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}

            {/* <p className="mt-6 font-bold uppercase text-sm text-gray-600">
              User object
            </p>
            <pre className="max-w-4xl bg-slate-700 text-slate-50 font-mono p-4 text-xs sm:text-sm rounded-md mt-2">
              {JSON.stringify(user, null, 2)}
            </pre> */}
          </>
        ) : null}
      </main>
    </>
  );
}
