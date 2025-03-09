// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DecentralizedStableCoin} from "src/DecentralizedStableCoin.sol";
import {DSCEngine} from "src/DSCEngine.sol";
import {DeployDSC} from "script/DeployDSC.s.sol";

contract DecentralizedStableCoinTest is Test {
    DeployDSC deployer;
    DecentralizedStableCoin dsc;
    DSCEngine engine;

    uint256 public MINT_AMOUNT = 10;
    uint256 public BURN_AMOUNT = 5;

    address USER = makeAddr("USER");

    function setUp() public {
        deployer = new DeployDSC();
        (dsc, engine,) = deployer.run();
    }

    function testTokenName() public view {
        string memory expectedName = "DecentralizedStableCoin";
        string memory tokenName = dsc.getTokenName();
        assert(keccak256(abi.encodePacked(expectedName)) == keccak256(abi.encodePacked(tokenName)));
    }

    function testTokenSymbol() public view {
        string memory expectedSymbol = "DSC";
        string memory tokenSymbol = dsc.getTokenSymbol();
        assert(keccak256(abi.encodePacked(expectedSymbol)) == keccak256(abi.encodePacked(tokenSymbol)));
    }

    function testMintWithOwner() public {
        uint256 initialBallance;
        uint256 currentBalance;

        initialBallance = dsc.getBalance(address(msg.sender));
        vm.prank(address(engine));
        bool result = dsc.mint(address(msg.sender), MINT_AMOUNT);
        currentBalance = dsc.getBalance(address(msg.sender));

        require(result);
        assert(initialBallance < currentBalance);
    }

    function testMintWithNoOwner() public {
        vm.prank(USER);
        vm.expectRevert();
        bool result = dsc.mint(address(msg.sender), MINT_AMOUNT);

        require(!result);
    }

    modifier minted() {
        vm.prank(address(engine));
        dsc.mint(address(engine), 10);
        _;
    }

    function testBurnWithOwner() public minted {
        uint256 initialBallance;
        uint256 currentBalance;

        initialBallance = dsc.getBalance(address(engine));
        vm.prank(address(engine));
        dsc.burn(BURN_AMOUNT);
        currentBalance = dsc.getBalance(address(engine));

        assert(initialBallance - currentBalance == BURN_AMOUNT);
    }

    function testBurnWithNoOwner() public minted {
        vm.prank(USER);
        vm.expectRevert();
        dsc.burn(BURN_AMOUNT);
    }
}
