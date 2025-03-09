// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DecentralizedStableCoin} from "src/DecentralizedStableCoin.sol";
import {DSCEngine} from "src/DSCEngine.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import {MockV3Aggregator} from "test/mocks/MockV3Aggregator.sol";

contract Handler is Test {
    DecentralizedStableCoin dsc;
    DSCEngine engine;

    ERC20Mock weth;
    ERC20Mock wbtc;

    MockV3Aggregator public ethUsdPriceFeed;
    MockV3Aggregator public btcUsdPriceFeed;

    uint256 MAX_DEPOSIT_SIZE = type(uint96).max;
    uint256 public timesMintIsCalled;
    address[] userCollateralDeposited;

    constructor(DecentralizedStableCoin _dsc, DSCEngine _engine) {
        dsc = _dsc;
        engine = _engine;

        address[] memory collateralAddresses = engine.getCollateralTokens();
        weth = ERC20Mock(collateralAddresses[0]);
        wbtc = ERC20Mock(collateralAddresses[1]);

        ethUsdPriceFeed = MockV3Aggregator(engine.getCollateralTokenPriceFeed(address(weth)));
        btcUsdPriceFeed = MockV3Aggregator(engine.getCollateralTokenPriceFeed(address(wbtc)));
    }
    
    // redeem collateral
    function depositCollateral(uint256 collateralSeed, uint256 amountCollateral) public {
        ERC20Mock collateral = _getCollateralFromSeed(collateralSeed);
        // make sure the 1 < amount < MAX_DEPOSIT_SIZE 
        amountCollateral = bound(amountCollateral, 1, MAX_DEPOSIT_SIZE);

        vm.startPrank(msg.sender);
        collateral.mint(msg.sender, amountCollateral);
        collateral.approve(address(engine), amountCollateral);
        engine.depositCollateral(address(collateral), amountCollateral);
        vm.stopPrank();
        // 🟠 double push potentially
        userCollateralDeposited.push(msg.sender);
    }

    function redeemCollateral(uint256 collateralSeed, uint256 amountCollateral) public {
        ERC20Mock collateral = _getCollateralFromSeed(collateralSeed);
        uint256 maxCollatealToRedeem = engine.getCollateralBalanceOfUser(msg.sender, address(collateral));
        amountCollateral = bound(amountCollateral, 0, maxCollatealToRedeem);
        if (amountCollateral == 0) {
            return;
        }
        // avoid breaks health factor
        (uint256 totalDscMinted, uint256 totalCollateralValue) = engine.getAccountInformation(msg.sender);
        uint256 collateralValueInUsd = engine.getUsdValue(address(collateral), amountCollateral);
        uint256 healthFactor = engine.calculateHealthFactor(totalDscMinted, totalCollateralValue - collateralValueInUsd);
        if (healthFactor < engine.getMinHealthFactor()) {
            return;
        }
        vm.prank(msg.sender);
        engine.redeemCollateral(address(collateral), amountCollateral);
    }

    function mintDsc(uint256 addressSeed, uint256 amountToMint) public {
        if (userCollateralDeposited.length == 0) {
            return;
        }
        address sender = userCollateralDeposited[addressSeed % userCollateralDeposited.length];
        (uint256 totalDscMinted, uint256 collateralValueInUsd) = engine.getAccountInformation(sender);
        uint256 maxAmountToMint = (collateralValueInUsd / 2) - totalDscMinted;
        amountToMint = bound(amountToMint, 0, maxAmountToMint);
        if (amountToMint == 0) {
            return;
        }
        vm.prank(sender);
        engine.mintDsc(amountToMint);
        timesMintIsCalled++;
    }

    // function updateCollateralPrice(int256 newPrice) public {
    //     ethUsdPriceFeed.updateAnswer(newPrice);
    // }


    // helper function
    function _getCollateralFromSeed(uint256 collateralSeed) private view returns (ERC20Mock) {
        if (collateralSeed % 2 == 0) {
            return weth;
        }
        return wbtc;
    }
}