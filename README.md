███████╗███╗   ██╗ ██████╗██╗      █████╗ ██╗   ██╗███████╗
██╔════╝████╗  ██║██╔════╝██║     ██╔══██╗██║   ██║██╔════╝
█████╗  ██╔██╗ ██║██║     ██║     ███████║██║   ██║█████╗  
██╔══╝  ██║╚██╗██║██║     ██║     ██╔══██║╚██╗ ██╔╝██╔══╝  
███████╗██║ ╚████║╚██████╗███████╗██║  ██║ ╚████╔╝ ███████╗
╚══════╝╚═╝  ╚═══╝ ╚═════╝╚══════╝╚═╝  ╚═╝  ╚═══╝  ╚══════╝
                                                            
███╗   ███╗ ██████╗ ███╗   ██╗███████╗██╗   ██╗
████╗ ████║██╔═══██╗████╗  ██║██╔════╝╚██╗ ██╔╝
██╔████╔██║██║   ██║██╔██╗ ██║█████╗   ╚████╔╝ 
██║╚██╔╝██║██║   ██║██║╚██╗██║██╔══╝    ╚██╔╝  
██║ ╚═╝ ██║╚██████╔╝██║ ╚████║███████╗   ██║   
╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝╚══════╝   ╚═╝   

# Enclave Money + Privy Auth Chain-Abstracted Payments Demo

This is a template for integrating [**Privy Auth**](https://www.privy.io/) and [**Enclave**](https://www.enclave.money) into a [NextJS](https://nextjs.org/) project to enable seamless cross-chain payments. 

## Features
- Social and wallet login via Privy
- Automatic smart account creation via Enclave
- Send USDC cross-chain without bridging
- Gasless transactions supported

## Setup

1. Clone this repository and open it in your terminal. 
```sh
git clone https://github.com/privy-io/create-next-app
```

2. Install the necessary dependencies with `npm`.
```sh
npm i 
```

3. Initialize your environment variables by copying the `.env.example` file to `.env.local`. Then add your API keys:
```sh
# In your terminal, create .env.local from .env.example
cp .env.example .env.local

# Add your API keys to .env.local
NEXT_PUBLIC_PRIVY_APP_ID=<your-privy-app-id>
NEXT_PUBLIC_ENCLAVE_API_KEY=<your-enclave-api-key>
```

## Technical Implementation

Here's a step-by-step breakdown of the integration:

1. **Initialize Privy** - Set up the Privy provider in your app:
```typescript:pages/_app.tsx
function MyApp({ Component, pageProps }: AppProps) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || ""}
      config={{
        embeddedWallets: {
          createOnLogin: "all-users",
        },
      }}
    >
      <Component {...pageProps} />
    </PrivyProvider>
  );
}
```

2. **Initialize Enclave** - Create an Enclave instance:
```typescript
import { Enclave, SignMode } from 'enclavemoney';

const API_KEY = process.env.NEXT_PUBLIC_ENCLAVE_API_KEY as string;
const enclave = new Enclave(API_KEY);
```

3. **Implement Login** - Handle user authentication:
```typescript:pages/index.tsx
export default function LoginPage() {
  const router = useRouter();
  const { login } = useLogin({
    onComplete: () => router.push("/dashboard"),
  });
  // ... rest of login component
}
```

4. **Connect Enclave Account** - Create a smart account after authentication:
```typescript:pages/dashboard.tsx
useEffect(() => {
  async function setupSmartAccount() {
    if (ready && authenticated && wallet?.address) {
      try {
        setIsLoadingSmartAccount(true);
        const account = await enclave.createSmartAccount(wallet.address);
        setSmartAccount(account);

        // Fetch initial balance
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
```

5. **Check Balance** - Fetch the smart account's balance:
```typescript
const getBalance = async (smartAccountAddress: string) => {
  try {
    setIsLoadingBalance(true);
    const balance = await enclave.getSmartBalance(smartAccountAddress);
    setSmartBalance(balance.netBalance);
  } catch (error) {
    console.error("Error fetching balance:", error);
  } finally {
    setIsLoadingBalance(false);
  }
};
```

6. **Build Transaction** - Create a cross-chain USDC transfer:
```typescript:pages/dashboard.tsx
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
  10, // Target network (Optimism)
  smartAccount.wallet.scw_address,
  orderData,
  undefined,
  SignMode.ECDSA
);
```

7. **Sign Transaction** - Use Privy's signMessage to sign the transaction:
```typescript:pages/dashboard.tsx
const {signMessage} = usePrivy();

const signature = await signMessage({
  message: builtTxn.messageToSign
});
```

8. **Submit Transaction** - Send the signed transaction:
```typescript:pages/dashboard.tsx
const response = await enclave.submitTransaction(
  signature.signature,
  builtTxn.userOp,
  10, // Target network
  smartAccount.wallet.scw_address,
  SignMode.ECDSA
);
```

## Building locally

In your project directory, run `npm run dev`. You can now visit http://localhost:3000 to see your app and login with Privy!

## Check out:
- `pages/_app.tsx` for how to use the `PrivyProvider`
- `pages/index.tsx` for implementing the login flow
- `pages/dashboard.tsx` for the smart account creation, balance checking, and cross-chain USDC transfers



