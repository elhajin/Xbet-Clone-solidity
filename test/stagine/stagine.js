const { expect, assert } = require("chai");

const { ethers, network, deployments, getNamedAccounts } = require("hardhat");
const { developmentChains, networks } = require("../../hardhat-helper.js");

// check the network:
developmentChains.includes(network.name)
  ? describe.skip
  : describe("unit test for Xbet contract", () => {
      // Global variables:
      let xbet;

      let deployer;

      const chainId = network.config.chainId;
      beforeEach(async () => {
        deployer = (await getNamedAccounts()).deployer;

        xbet = await ethers.getContract("Xbet", deployer);
      });

      describe("testing on sepolia testnet !!", function () {
        it("check All process possible..", async () => {
          const lastTime = await xbet.getLastTimestamp();
          console.log("just get the lastTime", lastTime);
          await new Promise(async (resolve, reject) => {
            // listen to events :
            xbet.once("pickedWinner", async () => {
              console.log("the event just fired/////");
              try {
                const newTimestamp = await xbet.getLastTimestamp();
                const state = await xbet.getXbetState();
                const xbetBalance = await xbet.getBalance();
                const players = await xbet.getNumberOfPlayers();
                // const balanceWinner = await ethers.provider.getBalance(

                // );
                const reccentWinner = await xbet.getRecentWinner();
                assert.isAbove(parseFloat(newTimestamp), parseFloat(lastTime));
                assert.equal(state.toString(), "0");
                assert.equal(players.toString(), "0");
                assert.equal(xbetBalance.toString(), "0");
                // assert.isAbove(
                //   parseFloat(balanceWinner),
                //   parseFloat(newBalance)
                // );
                // assert.equal(reccentWinner, deployer.address);
                resolve();
              } catch (e) {
                console.log(e);
                reject(e);
              }
            });
            //inter the game :
            console.log("entring xbet game  ");
            const tx = await xbet.entryGame({
              value: ethers.utils.parseEther("0.3"),
            });
            console.log("waiting transaction after inter");
            await tx.wait(1);
            const newBalance = await ethers.provider.getBalance(
              deployer.address
            );
          });
        });
      });
    });
