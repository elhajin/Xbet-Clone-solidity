require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.18",
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      chainId: 31337,
    },
    sepolia: {
      url: process.env.sepolia_url,
      accounts: [process.env.private_key],

      saveDeployments: true,
      chainId: 11155111,
    },
  },
  namedAccounts: {
    deployer: {
      default: 0,
      11155111: 0,
    },
    player: {
      default: 1,
    },
  },
  gasReporter: {
    enabled: false,
  },
  etherscan: {
    // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
    apiKey: { sepolia: process.env.ETHERSCAN_API_KEY },
    // customChains: [
    //   {
    //     network: "sepolia",
    //     chainId: 11155111,
    //     urls: {
    //       apiURL:
    //         "api",
    //       browserURL: "https://sepolia.etherscan.io",
    //     },
    //   },
    // ],
  },
  mocha: {
    timeout: 500000,
  },
};
