const { ethers } = require("hardhat");

// ── Paste your deployed addresses here ──
const TOKENA_ADDRESS = "0x8DBB0f4C61c8Ec57A226C1Bc1cD62292aC78B17b"
const TOKENB_ADDRESS = "0xF518F07ABeb7FEFaF405a236385f8aB06915e1D5";
const DEX_ADDRESS = "0xe4619cdfF80D81ffd14D1304Bc89A11f73b91F49";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Using wallet:", deployer.address);

    const tokenA = await ethers.getContractAt("TokenA", TOKENA_ADDRESS);
    const tokenB = await ethers.getContractAt("TokenB", TOKENB_ADDRESS);
    const dex = await ethers.getContractAt("SimpleDEX", DEX_ADDRESS);

    // ════════════════════════════════════════
    //           1. ADD LIQUIDITY
    // ════════════════════════════════════════
    console.log("\n╔══════════════════════════════╗");
    console.log("║      1. ADD LIQUIDITY        ║");
    console.log("╚══════════════════════════════╝");

    const amountA = ethers.utils.parseEther("20000");
    const amountB = ethers.utils.parseEther("10000");

    console.log("\n--- BEFORE ADD LIQUIDITY ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));

    // Approve DEX to spend tokens
    console.log("\nApproving TokenA...");
    await (await tokenA.approve(DEX_ADDRESS, amountA)).wait();
    console.log("TokenA approved ✅");

    console.log("Approving TokenB...");
    await (await tokenB.approve(DEX_ADDRESS, amountB)).wait();
    console.log("TokenB approved ✅");

    // Add liquidity
    console.log("\nAdding liquidity (20000 TKA + 10000 TKB)...");
    const addTx = await dex.addLiquidity(amountA, amountB);
    await addTx.wait();
    console.log("Liquidity added ✅  TX:", addTx.hash);

    console.log("\n--- AFTER ADD LIQUIDITY ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));
    console.log("Pool Reserve A:", ethers.utils.formatEther(await dex.reserveA()));
    console.log("Pool Reserve B:", ethers.utils.formatEther(await dex.reserveB()));
    console.log("Your LP tokens:", ethers.utils.formatEther(await dex.liquidity(deployer.address)));


    // ════════════════════════════════════════
    //                 2. SWAP
    // ════════════════════════════════════════
    console.log("\n╔══════════════════════════════╗");
    console.log("║         2. SWAP              ║");
    console.log("╚══════════════════════════════╝");

    const swapAmount = ethers.utils.parseEther("100"); // swap 100 TKA → TKB

    // Calculate expected output before swap
    const reserveA = await dex.reserveA();
    const reserveB = await dex.reserveB();
    const amountInWithFee = swapAmount.mul(997);
    const expectedOut = amountInWithFee.mul(reserveB).div(reserveA.mul(1000).add(amountInWithFee));
    console.log("\nSwapping 100 TKA → TKB");
    console.log("Expected TKB out (approx):", ethers.utils.formatEther(expectedOut));

    console.log("\n--- BEFORE SWAP ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));

    // Approve DEX to spend swapAmount of TokenA
    console.log("\nApproving TokenA for swap...");
    await (await tokenA.approve(DEX_ADDRESS, swapAmount)).wait();
    console.log("TokenA approved ✅");

    // Perform swap
    console.log("Swapping...");
    const swapTx = await dex.swap(TOKENA_ADDRESS, swapAmount);
    await swapTx.wait();
    console.log("Swap done ✅  TX:", swapTx.hash);

    console.log("\n--- AFTER SWAP ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));
    console.log("Pool Reserve A:", ethers.utils.formatEther(await dex.reserveA()));
    console.log("Pool Reserve B:", ethers.utils.formatEther(await dex.reserveB()));


    // ════════════════════════════════════════
    //           3. REMOVE LIQUIDITY
    // ════════════════════════════════════════
    console.log("\n╔══════════════════════════════╗");
    console.log("║     3. REMOVE LIQUIDITY      ║");
    console.log("╚══════════════════════════════╝");

    // Remove half of your LP tokens
    const myLP = await dex.liquidity(deployer.address);
    const removeAmount = myLP.div(2); // remove 50% of your liquidity
    console.log("\nYour total LP tokens:", ethers.utils.formatEther(myLP));
    console.log("Removing 50% of LP:", ethers.utils.formatEther(removeAmount));

    console.log("\n--- BEFORE REMOVE LIQUIDITY ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));

    // Remove liquidity
    console.log("\nRemoving liquidity...");
    const removeTx = await dex.removeLiquidity(removeAmount);
    await removeTx.wait();
    console.log("Liquidity removed ✅  TX:", removeTx.hash);

    console.log("\n--- AFTER REMOVE LIQUIDITY ---");
    console.log("TokenA balance:", ethers.utils.formatEther(await tokenA.balanceOf(deployer.address)));
    console.log("TokenB balance:", ethers.utils.formatEther(await tokenB.balanceOf(deployer.address)));
    console.log("Pool Reserve A:", ethers.utils.formatEther(await dex.reserveA()));
    console.log("Pool Reserve B:", ethers.utils.formatEther(await dex.reserveB()));
    console.log("Remaining LP  :", ethers.utils.formatEther(await dex.liquidity(deployer.address)));

    console.log("\n✅ All 3 tests completed successfully!");
}
main().catch(console.error);