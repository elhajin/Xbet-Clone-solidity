const { network, ethers } = require("hardhat");

// here we gonna deploy a mock that gives us a random number and a keeper : this mock function takes two args:
// one is : baseFee == the fee that pays for the oracle to make one request (in our case 0.25 link)
// second is :
const baseFee = "250000000000000000";
const gasPriceFee = 1e9;
module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const args = [baseFee, gasPriceFee];
  const chainId = network.config.chainId;
  if (chainId == 31337) {
    console.log("starting deploying mock ");
    const VRFCoordinatorV2Mock = await deploy("VRFCoordinatorV2Mock", {
      from: deployer,
      args: args,
      log: true,
    });

    console.log("mokes get deployed................\n ");
  }
};
module.exports.tags = ["all", "mock"];
