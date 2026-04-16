# Node Coin (NDC) — ERC-20 Token Smart Contract

A simple, self-contained ERC-20 token deployed on the Ethereum blockchain using Solidity `^0.8.17`.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Token Details](#token-details)
- [Contract Architecture](#contract-architecture)
- [Interface: ERC20Interface](#interface-erc20interface)
- [Core Functions](#core-functions)
- [Events](#events)
- [Storage Layout](#storage-layout)
- [Constructor Behaviour](#constructor-behaviour)
- [Security Considerations](#security-considerations)
- [Deployment](#deployment)
- [License](#license)

---

## Overview

`Node_coin` is a manually implemented ERC-20 compliant token contract. It does **not** rely on OpenZeppelin or any external library — every function is written from scratch, making it an excellent reference for understanding how the ERC-20 standard works at the ground level.

The contract implements the [`ERC20Interface`](https://eips.ethereum.org/EIPS/eip-20) and supports the standard token operations: checking balances, transferring tokens, and delegating spending rights via the approval/allowance mechanism.

---

## Token Details

| Property       | Value                                      |
|----------------|--------------------------------------------|
| **Name**       | Node coin                                  |
| **Symbol**     | NDC                                        |
| **Decimals**   | 18                                         |
| **Total Supply** | 1,000,001 NDC (1 million + 1 whole coins) |
| **Raw Supply** | `1_000_001_000_000_000_000_000_000` (wei)  |

> **What do decimals mean?**  
> With `decimals = 18`, one whole NDC token is represented internally as `1 × 10^18` (i.e., `1000000000000000000`). This mirrors how ETH works — the smallest unit is called "wei".

---

## Contract Architecture

```
ERC20Interface (interface)
│
└── Node_coin (contract)
      ├── State Variables
      │     ├── symbol, name, decimals, _totalSupply
      │     ├── balances mapping
      │     └── allowed mapping
      │
      ├── constructor()
      ├── totalSupply()
      ├── balanceOf()
      ├── transfer()
      ├── approve()
      ├── transferFrom()
      └── allowance()
```

---

## Interface: ERC20Interface

The contract declares and satisfies the standard ERC-20 interface, which defines the minimum API any ERC-20 token must expose:

```solidity
interface ERC20Interface {
    function totalSupply()                                         external view returns (uint);
    function balanceOf(address account)                           external view returns (uint balance);
    function allowance(address owner, address spender)            external view returns (uint remaining);
    function transfer(address recipient, uint amount)             external returns (bool success);
    function approve(address spender, uint amount)                external returns (bool success);
    function transferFrom(address sender, address recipient, uint amount) external returns (bool success);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}
```

Any contract or wallet that supports ERC-20 can interact with `Node_coin` without knowing its internal implementation.

---

## Core Functions

### `totalSupply()`

```solidity
function totalSupply() public view returns (uint)
```

Returns the **circulating supply** of NDC tokens. It subtracts any tokens held by the zero address (`address(0)`) — a common pattern for representing "burned" tokens.

```
Circulating Supply = _totalSupply - balances[address(0)]
```

---

### `balanceOf(address account)`

```solidity
function balanceOf(address account) public view returns (uint balance)
```

Returns the NDC token balance of any given Ethereum address. This is a **read-only** (`view`) function and costs no gas when called off-chain.

---

### `transfer(address recipient, uint amount)`

```solidity
function transfer(address recipient, uint amount) public returns (bool success)
```

Moves `amount` of NDC from the **caller's** (`msg.sender`) account to the `recipient`.

**Flow:**
1. Deducts `amount` from `msg.sender`'s balance.
2. Adds `amount` to `recipient`'s balance.
3. Emits a `Transfer` event.
4. Returns `true` on success.

> ⚠️ **Note:** This implementation does not check for sufficient balance before subtracting. In Solidity `^0.8.x`, arithmetic underflow causes an automatic revert, so an overspend will revert the transaction — but there is no explicit require check or custom error message.

---

### `approve(address spender, uint amount)`

```solidity
function approve(address spender, uint amount) public returns (bool success)
```

Grants `spender` the right to spend up to `amount` of NDC tokens **on behalf of the caller**. This is the first step of a two-step delegation pattern.

**Flow:**
1. Sets `allowed[msg.sender][spender] = amount`.
2. Emits an `Approval` event.
3. Returns `true`.

---

### `transferFrom(address sender, address recipient, uint amount)`

```solidity
function transferFrom(address sender, address recipient, uint amount) public returns (bool success)
```

Allows a pre-approved `spender` (`msg.sender`) to move tokens **from** `sender` **to** `recipient`. This is the second step of the delegation pattern — typically used by DEXes or smart contract protocols.

**Flow:**
1. Deducts `amount` from `sender`'s balance.
2. Reduces the caller's allowance by `amount`.
3. Adds `amount` to `recipient`'s balance.
4. Emits a `Transfer` event.
5. Returns `true`.

> The caller must have a sufficient allowance granted by `sender` via `approve()` first.

---

### `allowance(address owner, address spender)`

```solidity
function allowance(address owner, address spender) public view returns (uint remaining)
```

Returns how many NDC tokens `spender` is still allowed to withdraw from `owner`'s account. This value decreases each time `transferFrom` is called.

---

## Events

| Event | When it fires | Parameters |
|-------|--------------|------------|
| `Transfer` | On every token movement | `from`, `to`, `value` |
| `Approval` | When an allowance is set | `owner`, `spender`, `value` |

Events are indexed by `from`/`to`/`owner`/`spender`, meaning off-chain apps (like Etherscan or a dApp frontend) can efficiently filter and listen for activity involving a specific address.

The constructor also fires a `Transfer` event from `address(0)` to the deployer wallet — this is the standard ERC-20 convention for signalling a **mint** event.

---

## Storage Layout

```solidity
// Simple balance lookup: address → token amount
mapping(address => uint) balances;

// Allowance lookup: owner → spender → approved amount
mapping(address => mapping(address => uint)) allowed;
```

Both mappings are `internal` (not `public`), so there are no auto-generated getter functions — access is only through `balanceOf()` and `allowance()`.

---

## Constructor Behaviour

```solidity
constructor() {
    symbol = "NDC";
    name = "Node coin";
    decimals = 18;
    _totalSupply = 1_000_001_000_000_000_000_000_000;

    balances[0x26c53161B9076235da337eb270Ed83fAE0B9083b] = _totalSupply;
    emit Transfer(address(0), 0x26c53161B9076235da337eb270Ed83fAE0B9083b, _totalSupply);
}
```

When the contract is deployed:

1. Token metadata (name, symbol, decimals) is set.
2. The entire supply (`1,000,001 NDC`) is minted directly into the hardcoded address `0x26c5...083b`.
3. A `Transfer` event from `address(0)` is emitted to signal the mint on-chain.

> 🔑 The address `0x26c53161B9076235da337eb270Ed83fAE0B9083b` is the **sole initial holder** of all tokens. Make sure you control the private key for that address before deploying.

---

## Security Considerations

| Issue | Description | Recommendation |
|-------|-------------|----------------|
| **No balance check in `transfer`** | Relies on Solidity 0.8 overflow revert instead of an explicit `require` | Add `require(balances[msg.sender] >= amount, "Insufficient balance")` for clearer error messages |
| **No allowance check in `transferFrom`** | Same as above — underflow reverts silently | Add `require(allowed[sender][msg.sender] >= amount, "Allowance exceeded")` |
| **Approve race condition** | Setting a new allowance while a previous one is unspent can be front-run | Use `increaseAllowance` / `decreaseAllowance` pattern (as in OpenZeppelin) |
| **Hardcoded receiver address** | The entire supply goes to a hardcoded address in the constructor | Consider using `msg.sender` so the deployer automatically receives the supply |
| **No zero-address guard** | Tokens can be sent to `address(0)` (effectively burned) without a check | Add `require(recipient != address(0))` in `transfer` and `transferFrom` |

---

## Deployment

This contract can be deployed using any standard Ethereum toolchain:

**Remix IDE (easiest for beginners):**
1. Paste the contract into [remix.ethereum.org](https://remix.ethereum.org).
2. Compile with Solidity `^0.8.17`.
3. Deploy using MetaMask on your target network (Sepolia testnet recommended for testing).


## License

This contract is licensed under the **MIT License**.

```
SPDX-License-Identifier: MIT
```

---

*Built with Solidity `^0.8.17` · ERC-20 Standard · No external dependencies*
