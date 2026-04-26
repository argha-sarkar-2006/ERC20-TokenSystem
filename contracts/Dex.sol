// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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

    function addLiquidity(uint256 amountA, uint256 amountB) external {
        tokenA.transferFrom(msg.sender, address(this), amountA);
        tokenB.transferFrom(msg.sender, address(this), amountB);

        uint256 lpTokens;
        if (totalLiquidity == 0) {
            lpTokens = sqrt(amountA * amountB); // geometric mean
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

    // ✅ REMOVE LIQUIDITY
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

    // ✅ SWAP — uses x * y = k formula
    function swap(address tokenIn, uint256 amountIn) external {
        require(tokenIn == address(tokenA) || tokenIn == address(tokenB), "Invalid token");

        bool isTokenA = tokenIn == address(tokenA);
        (uint256 reserveIn, uint256 reserveOut) = isTokenA
            ? (reserveA, reserveB)
            : (reserveB, reserveA);

        // amountOut formula: (amountIn * reserveOut) / (reserveIn + amountIn)
        // With 0.3% fee: amountIn * 997
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

    // Helper functions
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