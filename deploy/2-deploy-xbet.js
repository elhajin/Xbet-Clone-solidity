const { network, ethers } = require("hardhat");
const { developmentChains, networks } = require("../hardhat-helper.js");
const { verify } = require("../utils/verify.js");
require("dotenv");
module.exports = async ({ getNamedAccounts, deployments }) => {
  // constructor args:
  const chainId = network.config.chainId;
  let cordinatorAddress;
  const minAmount = networks[chainId]["minAmount"];
  const keyHash = networks[11155111]["keyHash"];
  let subId;
  const callbackGas = networks[chainId]["callbackGas"];
  // if we're in a local network we ganna grep the address of the mock contract:

  if (developmentChains.includes(network.name)) {
    let mock = await ethers.getContract("VRFCoordinatorV2Mock");
    cordinatorAddress = mock.address;
    // here we gonna create a subscription in using the mock then get the subId from the even that will emit this id
    const tx = await mock.createSubscription();
    const txWait = await tx.wait(1);
    // here we gonna get the sub from the event
    subId = await txWait.events[0].args.subId;
    // fund our subscription id :
    await mock.fundSubscription(subId, ethers.utils.parseEther("30"));
  } else {
    cordinatorAddress = networks[chainId]["cordinator"]; //cordinator
    subId = networks[chainId]["subId"];
  }
  const constructorArgs = [
    cordinatorAddress,
    minAmount,
    keyHash,
    subId,
    callbackGas,
  ];

  // deploy the xbet contract with the hardhat-deploy-plugin
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const xbet = await deploy("Xbet", {
    from: deployer,
    args: constructorArgs,
    log: true,
    waitConfirmation: network.config.blockConfirmations || 1,
  });

  // Ensure the xbet contract is a valid consumer of the VRFCoordinatorV2Mock contract.
  if (developmentChains.includes(network.name)) {
    const vrfCoordinatorV2Mock = await ethers.getContract(
      "VRFCoordinatorV2Mock"
    );
    await vrfCoordinatorV2Mock.addConsumer(subId, xbet.address);
  }

  if (
    !developmentChains.includes(network.name) &&
    process.env.ETHERSCAN_API_KEY
  ) {
    log("Verifying...");
    await verify(xbet.address, constructorArgs);
  }
};
module.exports.tags = ["all", "xbet"];
