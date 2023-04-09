const { expect, assert } = require("chai");

const { ethers, network, deployments, getNamedAccounts } = require("hardhat");
const { developmentChains, networks } = require("../../hardhat-helper.js");

// check the network:
!developmentChains.includes(network.name)
  ? describe.skip
  : describe("unit test for Xbet contract", () => {
      // nedded variables:
      let xbet;
      let players;
      let Deployer;
      let mock;
      const chainId = network.config.chainId;
      beforeEach(async () => {
        const singers = await ethers.getSigners();
        const [deployer, player1, player2, player3, player4, player5, player6] =
          singers;
        players = [player1, player2, player3, player4, player5, player6];
        Deployer = deployer;
        await deployments.fixture(["all"]);
        xbet = await ethers.getContract("Xbet", deployer);
        mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer);
      });

      // testing the constructor :
      describe("constructor", () => {
        console.log("testing the constractor");
        it("check args of constructor ", async () => {
          const enterAmount = await xbet.getEnterAmount();
          assert.equal(enterAmount.toString(), networks[chainId]["minAmount"]);
          console.log("the minimum amount to enter a game checked....");
          // get create a subid from the mock contract
          const subId = await mock.getSubId(); // we've add a view function in mock contract to see the current subId
          const SubId = await xbet.getSubId();

          assert.equal(subId.toString(), SubId.toString());
          console.log("the subscription ID get checked........");
        });
      });

      // test the entryGame function :
      describe("entryGame function ", () => {
        // check minAmount :
        it("it revert when you do not pay enough!", async () => {
          const tryToEnterGame = xbet.connect(players[2]).entryGame({
            value: ethers.utils.parseEther("0.5"),
          });
          await expect(tryToEnterGame).to.be.reverted;
        });
        // record the players;
        it("check if it's record players when they enter!", async () => {
          await xbet.connect(players[2]).entryGame({
            value: ethers.utils.parseEther("2"),
          });
          const playersNumber = await xbet.getNumberOfPlayers();
          const getPlayer = await xbet.getPlayer(0);
          assert.equal(playersNumber.toString(), "1");
          assert.equal(getPlayer, players[2].address);
        });
        //events:
        it("should fired the event when ever an address getIn", async () => {
          const eventEnter = xbet.connect(players[1]).entryGame({
            value: ethers.utils.parseEther("2"),
          });
          //check if the event is emmited : the .emit takes to args (contractObject,"eventName")
          // you can check for more then one event by using the syntax .and.to.emmit(contract, "event")
          // also you can check the args by adding the expect value of args : .emit().withArgs(arg1,arg2)
          await expect(eventEnter).to.emit(xbet, "Enter");
        });
        // can't enter when xbet Close:

        describe("checkUpKeep", () => {
          it("checkUpNeeded is true when all conditions valid", async () => {
            await xbet
              .connect(players[1])
              .entryGame({ value: ethers.utils.parseEther("2") });
            await network.provider.send("evm_increaseTime", [11]);
            await network.provider.send("evm_mine", []);
            const { upkeepNeeded } = await xbet.callStatic.checkUpkeep([]); // checkUpKeep("0x")
            assert(upkeepNeeded);
          });
        });
        // check that it close when ever it caluculating :
        describe("performUpKeep function", () => {
          it("revert when the checkUpkeep is false", async () => {
            const fund = await xbet.entryGame({
              value: networks[chainId]["minAmount"],
            });
            const perform = xbet.performUpkeep("0x");
            await expect(perform).to.be.reverted;
          });
          //with checkUpKeep returns true bool
          it("it should pass normally when checkUpKeep is true", async () => {
            await xbet.entryGame({ value: networks[chainId]["minAmount"] });
            await expect(xbet.performUpkeep("0x")).to.be.revertedWith("Xbet");
            await network.provider.send("evm_increaseTime", [12]);
            await network.provider.send("evm_mine", []);
            const perform = await xbet.performUpkeep([]);
            assert(perform);
          });
          it("update the Xbet state to be closed!", async () => {
            await xbet.entryGame({ value: networks[chainId]["minAmount"] });
            await network.provider.send("evm_increaseTime", [12]);
            await network.provider.send("evm_mine", []);
            await xbet.performUpkeep("0x");
            await expect(
              xbet.entryGame({ value: ethers.utils.parseEther("2") })
            ).to.be.revertedWith("Xbet__XbetIsClosed");
          });
          it("should emit an event of the random used number!", async () => {
            await xbet.entryGame({ value: networks[chainId]["minAmount"] });
            await network.provider.send("evm_increaseTime", [12]);
            await network.provider.send("evm_mine", []);
            const perform = await xbet.performUpkeep("0x");
            const tx = await perform.wait();
            const requestId = tx.events[1].args.requestedId;
            console.log(requestId.toString());
            assert(requestId.toNumber() > 0);
            await expect(perform)
              .to.emit(xbet, "requestedWinner")
              .withArgs(requestId);
          });
        });

        // test the fullfill function () :
        describe("fullfillRandomWords functioln", () => {
          beforeEach(async () => {
            await xbet.connect(players[2]).entryGame({
              value: ethers.utils.parseEther("1"),
            });
            await xbet.connect(players[1]).entryGame({
              value: ethers.utils.parseEther("1"),
            });
            await network.provider.send("evm_increaseTime", [11]);
            await network.provider.send("evm_mine", []);
          });
          it("it's only can be called after perform function", async () => {
            await expect(mock.fulfillRandomWords(0, xbet.address)).to.be
              .reverted;
            await xbet.performUpkeep([]);
            expect(async () => {
              await mock.fulfillRandomWords(1, xbet.address);
            }).to.not.throw();
          });

          // here the real test is comming :
          it("pick a winner, reset the xbet , and send money to the winner", async () => {
            //first fund the xbet:
            const currentTime = await xbet.getLastTimestamp();
            const vlaueToSend = ethers.utils.parseEther("1.5");
            for (i = 1; i < 6; i++) {
              await xbet.connect(players[i]).entryGame({ value: vlaueToSend });
            }
            //speed the time and mine a block :
            await network.provider.send("evm_increaseTime", [11]);
            await network.provider.send("evm_mine", []);
            // call the perform and check if checkUpKeep is true:
            const { upkeepNeeded } = await xbet.callStatic.checkUpkeep([]);
            assert.isTrue(upkeepNeeded);

            /** here we need a promise and we gonna mock the chainlink keeper(call the functions) */
            await new Promise(async (resolve, reject) => {
              // first we wanna listen to event when evet it fired
              xbet.once("pickedWinner", async () => {
                // creat a try and catch func in case any of the code did not work or take too long
                try {
                  // here we gonna check the update after the winner is picked:
                  const resetPlayers = await xbet.getNumberOfPlayers();
                  const timestamp = await xbet.getLastTimestamp();
                  const State = await xbet.getXbetState();
                  const balance = await xbet.getBalance();
                  assert.equal(resetPlayers.toString(), "0");
                  assert.isAbove(timestamp, currentTime);
                  assert.equal(State, 0);
                  assert.equal(balance, 0);

                  console.log("check if the ether got send to the winner");
                  const winner = await xbet.getRecentWinner();
                  const Balance = await ethers.provider.getBalance(winner);
                  const newBalance = ethers.utils.formatEther(
                    Balance.toString()
                  );
                  console.log(newBalance);
                  assert.isAbove(parseFloat(newBalance), 1000);
                } catch (e) {
                  reject(e);
                }
                resolve();
              });

              // here we gonna mock the chainlink keepr and call the functions needed:
              const perform = await xbet.performUpkeep([]);
              const tx = await perform.wait();
              // get the requestId from the event that fired when we called the performUpKeep()
              const event = tx.events[1].args.requestedId;
              // call the fulfillRandomWords from the mock contract as a chainlink keeper:
              await mock.fulfillRandomWords(event, xbet.address);
            });
          });
        });
      });

      //
    });
