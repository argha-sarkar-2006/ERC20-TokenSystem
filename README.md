# 🔄 SimpleDEX — Decentralized Exchange on Ethereum

A simple DEX built with Solidity, deployed on Ethereum Sepolia testnet. Supports token swaps, adding/removing liquidity using the **constant product formula (x × y = k)**.

---

##  Project Structure

```
DEXsol/
├── contracts/
│   ├── Dex.sol           # Main DEX contract (swap, addLiquidity, removeLiquidity)
│   ├── ToKenA.sol        # ERC20 Token A (TKA)
│   └── TokenB.sol        # ERC20 Token B (TKB)
├── frontend/
│   └── index.html        # Web UI to interact with the DEX via MetaMask
├── scripts/
│   ├── deploy.js         # Deploys all 3 contracts to Sepolia
│   └── Interact.js       # Tests addLiquidity, swap, removeLiquidity
├── test/
│   └── Lock.js           # Hardhat test file
├── .env                  # Environment variables (RPC URL + Private Key)
├── .gitignore
├── hardhat.config.js     # Hardhat network configuration
├── package.json
└── README.md
```

---

##  How It Works

### Constant Product Formula
The DEX uses the **x × y = k** formula — the same algorithm used by Uniswap V1.

```
reserveA × reserveB = k  (always stays constant)
```

When a user swaps Token A for Token B:
- Token A goes **into** the pool → reserveA increases
- Token B comes **out** of the pool → reserveB decreases
- The product k stays the same (approximately — 0.3% fee slightly increases it)

### Swap Formula (with 0.3% fee)
```
amountOut = (amountIn × 997 × reserveOut) / (reserveIn × 1000 + amountIn × 997)
```

The `997/1000` trick applies a **0.3% fee** without using decimals (Solidity doesn't support floats).

---

## 📄 Smart Contracts

### TokenA.sol & TokenB.sol
Custom ERC20 tokens implementing the ERC20 interface from scratch.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

interface ERC20Interface {
    function totalSupply() external view returns (uint);
    function balanceOf(address account) external view returns (uint balance);
    function allowance(address owner, address spender) external view returns (uint remaining);
    function transfer(address recipient, uint amount) external returns (bool success);
    function approve(address spender, uint amount) external returns (bool success);
    function transferFrom(address sender, address recipient, uint amount) external returns (bool success);
    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}

contract TokenA is ERC20Interface {
    string public symbol;
    string public name;
    uint8 public decimals;
    uint public _totalSupply;

    mapping(address => uint) balances;
    mapping(address => mapping(address => uint)) allowed;

    constructor() {
        symbol = "TKA";
        name = "Token A";
        decimals = 18;
        _totalSupply = 1_000_000_000_000_000_000_000_000; // 1 million tokens
        balances[msg.sender] = _totalSupply;
        emit Transfer(address(0), msg.sender, _totalSupply);
    }

    function totalSupply() public view returns (uint) {
        return _totalSupply - balances[address(0)];
    }

    function balanceOf(address account) public view returns (uint balance) {
        return balances[account];
    }

    function transfer(address recipient, uint amount) public returns (bool success) {
        balances[msg.sender] = balances[msg.sender] - amount;
        balances[recipient] = balances[recipient] + amount;
        emit Transfer(msg.sender, recipient, amount);
        return true;
    }

    function approve(address spender, uint amount) public returns (bool success) {
        allowed[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint amount) public returns (bool success) {
        balances[sender] = balances[sender] - amount;
        allowed[sender][msg.sender] = allowed[sender][msg.sender] - amount;
        balances[recipient] = balances[recipient] + amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }

    function allowance(address owner, address spender) public view returns (uint remaining) {
        return allowed[owner][spender];
    }
}
```

---

### Dex.sol — Core DEX Contract

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SimpleDEX {
    IERC20 public tokenA;
    IERC20 public tokenB;

    uint256 public reserveA;
    uint256 public reserveB;

    mapping(address => uint256) public liquidity;
    uint256 public totalLiquidity;

    event LiquidityAdded(address indexed provider, uint256 amountA, uint256 amountB);
    event LiquidityRemoved(address indexed provider, uint256 amountA, uint256 amountB);
    event Swap(address indexed user, address tokenIn, uint256 amountIn, uint256 amountOut);

    constructor(address _tokenA, address _tokenB) {
        tokenA = IERC20(_tokenA);
        tokenB = IERC20(_tokenB);
    }

    // Add liquidity to the pool
    function addLiquidity(uint256 amountA, uint256 amountB) external {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        uint256 lpTokens;
        if (totalLiquidity == 0) {
            lpTokens = sqrt(amountA * amountB);
        } else {
            lpTokens = min(
                (amountA * totalLiquidity) / reserveA,
                (amountB * totalLiquidity) / reserveB
            );
        }

        liquidity[msg.sender] += lpTokens;
        totalLiquidity += lpTokens;
        reserveA += amountA;
        reserveB += amountB;

        emit LiquidityAdded(msg.sender, amountA, amountB);
    }

    // Remove liquidity from the pool
    function removeLiquidity(uint256 lpAmount) external {
        require(liquidity[msg.sender] >= lpAmount, "Insufficient LP tokens");

        uint256 amountA = (lpAmount * reserveA) / totalLiquidity;
        uint256 amountB = (lpAmount * reserveB) / totalLiquidity;

        liquidity[msg.sender] -= lpAmount;
        totalLiquidity -= lpAmount;
        reserveA -= amountA;
        reserveB -= amountB;

        tokenA.transfer(msg.sender, amountA);
        tokenB.transfer(msg.sender, amountB);

        emit LiquidityRemoved(msg.sender, amountA, amountB);
    }

    // Swap tokens using x*y=k formula with 0.3% fee
    function swap(address tokenIn, uint256 amountIn) external {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");

        bool isTokenA = tokenIn == address(tokenA);
        (uint256 reserveIn, uint256 reserveOut) = isTokenA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);

        uint256 amountInWithFee = amountIn * 997;
        uint256 amountOut = (amountInWithFee * reserveOut) /
            (reserveIn * 1000 + amountInWithFee);

        require(amountOut > 0, "Insufficient output");

        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        if (isTokenA) {
            reserveA += amountIn;
            reserveB -= amountOut;
            tokenB.transfer(msg.sender, amountOut);
        } else {
            reserveB += amountIn;
            reserveA -= amountOut;
            tokenA.transfer(msg.sender, amountOut);
        }

        emit Swap(msg.sender, tokenIn, amountIn, amountOut);
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) { z = x; x = (y / x + x) / 2; }
        } else if (y != 0) { z = 1; }
    }

    function min(uint256 a, uint256 b) internal pure returns (uint256) {
        return a < b ? a : b;
    }

    function getPrice(address token) external view returns (uint256) {
        if (token == address(tokenA)) return (reserveB * 1e18) / reserveA;
        return (reserveA * 1e18) / reserveB;
    }
}
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v16+
- MetaMask browser extension
- Sepolia testnet ETH (free from faucet)

### 1. Clone & Install

```bash
git clone https://github.com/yourusername/DEXsol.git
cd DEXsol
npm install
```

### 2. Install Dependencies

```bash
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox
npm install dotenv @openzeppelin/contracts
```

### 3. Configure Environment

Create a `.env` file in the root:

```
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
PRIVATE_KEY=your_metamask_private_key_here
```


### 4. Configure Hardhat

```javascript
// hardhat.config.js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

module.exports = {
  solidity: "0.8.20",
  networks: {
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL,
      accounts: [process.env.PRIVATE_KEY]
    }
  }
};
```

---

## 🚀 Deployment

### Compile Contracts

```bash
npx hardhat compile
```

### Deploy to Sepolia

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

You will see output like:

```
Deploying with: 0x26c53161B9076235da337eb270Ed83fAE0B9083b
TokenA deployed to: 0xABC...
TokenB deployed to: 0xDEF...
DEX deployed to:    0xGHI...
```

**Save these 3 addresses** — you'll need them for the frontend and interact script.

---

## 🧪 Testing the Functions

Paste your deployed addresses into `scripts/Interact.js`:

```javascript
const TOKENA_ADDRESS = "0xYourTokenAAddress";
const TOKENB_ADDRESS = "0xYourTokenBAddress";
const DEX_ADDRESS    = "0xYourDEXAddress";
```

Then run:

```bash
npx hardhat run scripts/Interact.js --network sepolia
```

### Expected Output

```
╔══════════════════════════════╗
║      1. ADD LIQUIDITY        ║
╚══════════════════════════════╝
TokenA approved ✅
TokenB approved ✅
Liquidity added ✅  TX: 0xabc123...

--- AFTER ADD LIQUIDITY ---
TokenA balance: 999500.0
Pool Reserve A: 500.0
Pool Reserve B: 500.0
Your LP tokens: 500.0

╔══════════════════════════════╗
║         2. SWAP              ║
╚══════════════════════════════╝
Expected TKB out (approx): 83.19...
Swap done ✅  TX: 0xdef456...

╔══════════════════════════════╗
║     3. REMOVE LIQUIDITY      ║
╚══════════════════════════════╝
Liquidity removed ✅  TX: 0xghi789...

✅ All 3 tests completed successfully!
```

---

## 🌐 Frontend (currently not in working phase)

The frontend is a single HTML file using **ethers.js v5** and **MetaMask**.

### Setup

1. Open `frontend/index.html`
2. Paste your deployed addresses at the top of the script:

```javascript
const TOKENA_ADDRESS = "0xYourTokenAAddress";
const TOKENB_ADDRESS = "0xYourTokenBAddress";
const DEX_ADDRESS    = "0xYourDEXAddress";
```

3. Open the file directly in your browser (no server needed)
4. Click **Connect Wallet** and approve MetaMask

### Features
- **Swap tab** — live price estimate + fee + price impact as you type
- **Add Liquidity tab** — deposit TKA + TKB to earn LP tokens
- **Remove tab** — burn LP tokens to get your tokens back
- Auto-refreshes balances and pool reserves after every transaction

---

##  Swap Math Example

Starting pool: **1000 TKA** and **1000 TKB**

You want to swap **100 TKA → TKB**:

```
Step 1 — Apply 0.3% fee:
  amountInWithFee = 100 × 997 = 99,700

Step 2 — Calculate output:
  numerator   = 99,700 × 1000 = 99,700,000
  denominator = 1000 × 1000 + 99,700 = 1,099,700
  amountOut   = 99,700,000 ÷ 1,099,700 = 90.66 TKB

Step 3 — Update reserves:
  reserveA: 1000 → 1100
  reserveB: 1000 → 909.34

Step 4 — Verify k stays constant:
  1100 × 909.34 ≈ 1,000,274 (slightly > 1M, the 0.3% fee earned!)
```

---

##  Deployed Contracts (Sepolia Testnet)

| Contract | Address |
|----------|---------|
| TokenA (TKA) | `0x — paste after deploy` |
| TokenB (TKB) | `0x — paste after deploy` |
| SimpleDEX    | `0x — paste after deploy` |

View on Etherscan: [sepolia.etherscan.io](https://sepolia.etherscan.io)

---

##  Tech Stack

| Tool | Purpose |
|------|---------|
| Solidity 0.8.20 | Smart contract language |
| Hardhat | Compile, test, deploy |
| Ethers.js v5 | Blockchain interaction |
| Alchemy | Sepolia RPC node provider |
| MetaMask | Wallet & transaction signing |
| HTML/CSS/JS | Frontend UI |

---

##  Security Notes

- Never share your `.env` or private key
- Use a **dedicated development wallet** — never your main wallet
- These contracts are for **educational purposes** only and are not audited
- Always test on testnet before mainnet

---

##  License

MIT