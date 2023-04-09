//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
// this is a chainlink contract for automation the call of a function (that pick the winner)
import "@chainlink/contracts/src/v0.8/interfaces/AutomationCompatibleInterface.sol";

// declare errors:
error Xbet__noNeedForUpKeeper(uint balance, uint lastCall, uint state);
error Xbet__LessThanMinAmount();
error Xbet__TransactionFaill();
error Xbet__XbetIsClosed();

contract Xbet is VRFConsumerBaseV2, AutomationCompatibleInterface {
    /*events*/

    event Enter(address indexed AddressEntered, uint EnterTime);
    event requestedWinner(uint requestedId);
    event pickedWinner(address indexed winner);

    /* enum is a new type of data that you can use to spicify somethings than call them by index of (enumName.parm)*/
    enum XbetState {
        OPEN,
        CLOSE
    }

    VRFCoordinatorV2Interface private immutable i_COORDINATOR;
    uint private immutable enterAmount;
    address payable[] private players;
    XbetState private state;
    uint private recentTime;

    // the winner:
    address payable private recentWinner;

    // the requestRandomWords() argements:
    bytes32 private immutable keyhash;
    uint64 private subscriptionId;
    uint16 private constant requesVtConfirmations = 3;
    uint32 private immutable callbackGasLimit;
    uint32 private constant numWords = 1;

    // in the constructor we need to pass the address of the contract that will gives us the random namber as
    // a param for our constructor , and the VRF contract also take an args constructor is that address
    constructor(
        address cordinator,
        uint minAmount,
        bytes32 _keyhash,
        uint64 _subscriptionId,
        uint32 _callbackGasLimit
    ) VRFConsumerBaseV2(cordinator) {
        enterAmount = minAmount;
        i_COORDINATOR = VRFCoordinatorV2Interface(cordinator);
        keyhash = _keyhash;
        subscriptionId = _subscriptionId;
        callbackGasLimit = _callbackGasLimit;
        state = XbetState.OPEN; // we can use the syntax XbetState(0) and it gonna be the same
        recentTime = block.timestamp;
    }

    // function to inter to the game
    function entryGame() public payable {
        if (msg.value < enterAmount) {
            revert Xbet__LessThanMinAmount();
        }
        if (state != XbetState(0)) {
            revert Xbet__XbetIsClosed();
        }
        players.push(payable(msg.sender));
        emit Enter(msg.sender, block.timestamp);
    }

    /**
     * @dev here we gonna override the function checkUpKeep from the interface automation, this function call a
     * nother function (in our case it call the check winner function)if the condution that we add to it being confirmed
     * 1-check if the Xbet is open
     * 2-call it after spicified time
     * 3- there is at least 2 players
     * and also we need to fund our subscription with link cause this function take some link tokens while it's
     * excute off-chain
     */
    function checkUpkeep(
        bytes memory /* checkData */
    )
        public
        view
        override
        returns (bool upkeepNeeded, bytes memory /* performData */)
    {
        bool isOpen = (state == XbetState.OPEN);
        bool timePassed = block.timestamp - recentTime > 10;
        bool enoughPlayers = players.length > 0;
        bool haveBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && enoughPlayers && haveBalance);
    }

    /** @dev this function will call the function requestRandomWords() that returns a random word (number)
     * @dev requestRandomWords function takes some args and we will set this args as a variables state
     * @dev this call of requestRandomWords will make a transaction from our subscription account
     */
    function performUpkeep(bytes calldata /*performData*/) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Xbet__noNeedForUpKeeper(
                address(this).balance,
                recentTime,
                uint(state)
            );
        }
        uint requestId = i_COORDINATOR.requestRandomWords(
            keyhash,
            subscriptionId,
            requesVtConfirmations,
            callbackGasLimit,
            numWords
        );
        state = XbetState.CLOSE;
        emit requestedWinner(requestId);
    }

    /** @dev this function takes 2 params , but we just need one that return the array that returns the random
     * words ,
     * @dev than we will use the modulo method to pick the index of the winner in the array players;
     * @dev than we send the fund from contract to the winner , and fire an event that return the address of
     * the winner in this game
     */
    function fulfillRandomWords(
        uint /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        uint winnerId = randomWords[0] % players.length;
        address payable winner = players[winnerId];
        recentWinner = winner;
        // we need to reset the players array :
        players = new address payable[](0);
        // send the funds to the winner
        (bool success, ) = recentWinner.call{value: address(this).balance}("");
        if (!success) {
            revert Xbet__TransactionFaill();
        }

        recentTime = block.timestamp;
        state = XbetState(0);
        emit pickedWinner(recentWinner);
    }

    /* view functions*/
    // function to see the min amount to inter a game:
    function getEnterAmount() public view returns (uint) {
        return enterAmount;
    }

    // function to get player:
    function getPlayer(uint index) public view returns (address) {
        return players[index];
    }

    // function to get the recent winner of the lottery  :
    function getRecentWinner() public view returns (address) {
        return recentWinner;
    }

    // state returns the index of the state in the enum ;
    function getXbetState() public view returns (XbetState) {
        return state;
    }

    function getNumWords() public pure returns (uint) {
        return numWords;
    }

    function getNumberOfPlayers() public view returns (uint) {
        return players.length;
    }

    function getLastTimestamp() public view returns (uint) {
        return recentTime;
    }

    function getSubId() public view returns (uint) {
        return subscriptionId;
    }

    function getBalance() public view returns (uint) {
        return address(this).balance;
    }
}
