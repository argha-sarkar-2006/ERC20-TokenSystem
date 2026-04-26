const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with: private key");

  // Deploy TokenA
  const TokenA = await ethers.getContractFactory("TokenA");
  const tokenA = await TokenA.deploy();
  await tokenA.deployed();  // older syntax
  console.log("TokenA deployed to:", tokenA.address);

  // Deploy TokenB
  const TokenB = await ethers.getContractFactory("TokenB");
  const tokenB = await TokenB.deploy();
  await tokenB.deployed();  // older syntax
  console.log("TokenB deployed to:", tokenB.address);

  // Deploy DEX
  const DEX = await ethers.getContractFactory("SimpleDEX");
  const dex = await DEX.deploy(tokenA.address, tokenB.address);
  await dex.deployed();  // older syntax
  console.log("DEX deployed to:", dex.address);
}

main().catch(console.error);