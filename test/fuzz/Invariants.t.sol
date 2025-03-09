// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {DecentralizedStableCoin} from "src/DecentralizedStableCoin.sol";
import {DSCEngine} from "src/DSCEngine.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {DeployDSC} from "script/DeployDSC.s.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Handler} from "test/fuzz/Handler.t.sol";

contract Invariants is StdInvariant, Test {
    DeployDSC deployer;
    DecentralizedStableCoin dsc;
    DSCEngine engine;
    HelperConfig config;
    Handler handler;

    address weth;
    address wbtc;

    function setUp() public {
        deployer = new DeployDSC();
        (dsc, engine, config) = deployer.run();
        (,, weth, wbtc,) = config.activeNetworkConfig();
        handler = new Handler(dsc, engine);
        targetContract(address(handler));
        // don't call redeemCollateral, unless there is collateral to redeem!
    }

    function invariant_protocolMustHaveMoreValueThanTotalSupply() public view {
        // get the value of all the collateral in the protocol
        // compare it to total debt (dsc)
        uint256 totalSupply = dsc.totalSupply();
        uint256 totalWethDeposited = IERC20(weth).balanceOf(address(engine));
        uint256 totalWbtcDeposited = IERC20(wbtc).balanceOf(address(engine));

        uint256 wethValue = engine.getUsdValue(weth, totalWethDeposited);
        uint256 wbtcValue = engine.getUsdValue(wbtc, totalWbtcDeposited);

        console.log("weth value: ", wethValue);
        console.log("wbtc value: ", wbtcValue);
        console.log("total supply: ", totalSupply);
        console.log("Times mint is called: ", handler.timesMintIsCalled());

        assert(wethValue + wbtcValue >= totalSupply);
    }

    function invariant_gettersShouldNotRevert() public view {
        // engine.getAccountCollateralValue(msg.sender);
        // engine.getAccountInformation(msg.sender);
        engine.getAdditionalFeedPrecision();
        // engine.getCollateralBalanceOfUser(msg.sender, weth);
        // engine.getCollateralBalanceOfUser(msg.sender, wbtc);
        // engine.getCollateralTokenPriceFeed(weth);
        // engine.getCollateralTokenPriceFeed(wbtc);
        engine.getCollateralTokens();
        engine.getDsc();
        // engine.getHealthFactor(msg.sender);
        engine.getLiquidationBonus();
        engine.getLiquidationPrecision();
        engine.getLiquidationThreshold();
        engine.getMinHealthFactor();
        engine.getPrecision();
        // engine.getTokenAmountFromUsd(weth, 1e18);
        // engine.getTokenAmountFromUsd(wbtc, 1e18);
        // engine.getUsdValue(weth, 1e18);
        // engine.getUsdValue(wbtc, 1e18);
        // engine.getUserToDscMinted(msg.sender);
    }
}