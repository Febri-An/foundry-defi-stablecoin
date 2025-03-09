// SPDX-License-Identifier: MIT

pragma solidity ^0.8.19;

import {Test, console} from "forge-std/Test.sol";
import {DecentralizedStableCoin} from "src/DecentralizedStableCoin.sol";
import {DSCEngine} from "src/DSCEngine.sol";
import {DeployDSC} from "script/DeployDSC.s.sol";
import {HelperConfig} from "script/HelperConfig.s.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/ERC20Mock.sol";
import {MockV3Aggregator} from "test/mocks/MockV3Aggregator.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DSCEngineTest is Test {
    DeployDSC deployer;
    DecentralizedStableCoin dsc;
    DSCEngine engine;
    HelperConfig config;

    address ethUsdPriceFeed;
    address btcUsdPriceFeed;
    address weth;

    address public USER = makeAddr("USER");
    address public LIQUIDATOR = makeAddr("LIQUIDATOR");
    
    uint256 public constant STARTING_USER_BALANCE = 10 ether;
    uint256 public constant COLLATERAL_TO_COVER = 20 ether;
    uint256 public constant AMOUNT_COLLATERAL = 10 ether;
    uint256 public constant AMOUNT_TO_MINT = 100 ether; // $100
    uint256 public constant AMOUNT_TO_BURN = 100 ether; // $100

    function setUp() public {
        deployer = new DeployDSC();
        (dsc, engine, config) = deployer.run();
        (ethUsdPriceFeed, btcUsdPriceFeed, weth,,) = config.activeNetworkConfig();
        ERC20Mock(weth).mint(USER, STARTING_USER_BALANCE);
    }

    /*//////////////////////////////////////////////////////////////
                            CONSTRUCTOR TEST
    //////////////////////////////////////////////////////////////*/
    address[] public tokenAddresses;
    address[] public priceFeedAddresses;

    function testREvertIfTokenLenghtDoesntMatchPriceFeeds() public {
        tokenAddresses.push(weth);
        priceFeedAddresses.push(ethUsdPriceFeed);
        priceFeedAddresses.push(btcUsdPriceFeed);

        vm.expectRevert(DSCEngine.DSCEngine__TokenAddressesAndPriceFeedAddressesMustBeSameLength.selector);
        new DSCEngine(tokenAddresses, priceFeedAddresses, address(dsc));
    }

    /*//////////////////////////////////////////////////////////////
                               PRICE FEED
    //////////////////////////////////////////////////////////////*/
    function testGetUsdValue() public view {
        uint256 ethAmount = 15 ether; // 15e18
        uint256 expectedUsd = 15000e18;
        // 15e18 * $1000/ETH = 15000e18
        uint256 actualUsd = engine.getUsdValue(weth, ethAmount);
        assertEq(actualUsd, expectedUsd);
    }

    function testGetTokenAmountFromUsd() public view {
        uint256 usdAmount = 100 ether; // 100e18
        // $1000 / ETH, $100
        uint256 expectedAmount = 0.1 ether;
        uint256 actualWeth = engine.getTokenAmountFromUsd(weth, usdAmount);
        assertEq(actualWeth, expectedAmount);
    }

    /*//////////////////////////////////////////////////////////////
                        DEPOSIT COLLATERAL TEST
    //////////////////////////////////////////////////////////////*/
    function testRevertsIfCollateralZero() public {
        address tokenCollateralAddress = weth;
        uint256 amountCollateral = 0;

        vm.expectRevert(DSCEngine.DSCEngine__NeedsMoreThanZero.selector);
        engine.depositCollateral(tokenCollateralAddress, amountCollateral);
    }

    function testRevertsWithUnapprovedCollateral() public {
        ERC20Mock ranToken = new ERC20Mock("RAN", "RAN", USER, AMOUNT_COLLATERAL);
        vm.startPrank(USER);
        vm.expectRevert(DSCEngine.DSCEngine__NotAllowedToken.selector);
        engine.depositCollateral(address(ranToken), AMOUNT_COLLATERAL);
        vm.stopPrank();
    }
    
    function testEmitsCollateralDepositedEvent() public {
        vm.startPrank(USER);
        ERC20Mock(weth).approve(address(engine), AMOUNT_COLLATERAL);

        vm.expectEmit(true, true, false, true);
        emit DSCEngine.CollateralDeposited(USER, weth, AMOUNT_COLLATERAL);
        engine.depositCollateral(weth, AMOUNT_COLLATERAL);
    }

    modifier depositedCollateral() {
        vm.startPrank(USER);
        ERC20Mock(weth).approve(address(engine), AMOUNT_COLLATERAL);
        engine.depositCollateral(weth, AMOUNT_COLLATERAL);
        vm.stopPrank();
        _;
    }
    
    function testCanDepositCollateralAndGetAccountInfo() public depositedCollateral {
        (uint256 totalDscMinted, uint256 collateralValueInUsd) = engine.getAccountInformation(USER);
        
        uint256 expectedTotalDscMinted = 0;
        uint256 expectedCollateralValueInUsd = engine.getAccountCollateralValue(USER);
        uint256 expectedDepositAmount = engine.getTokenAmountFromUsd(weth, collateralValueInUsd);

        assertEq(totalDscMinted, expectedTotalDscMinted);
        assertEq(collateralValueInUsd, expectedCollateralValueInUsd);
        assertEq(AMOUNT_COLLATERAL, expectedDepositAmount);
    }

    /*//////////////////////////////////////////////////////////////
                             MINT DSC TEST
    //////////////////////////////////////////////////////////////*/
    function testRevertIfDscToMintZero() public {
        uint256 amountToMint = 0;

        vm.expectRevert(DSCEngine.DSCEngine__NeedsMoreThanZero.selector);
        engine.mintDsc(amountToMint);
    }

    function testRevertMintIfHealthFactorBroken() public {
        uint256 dscAmount = 1 ether;
        uint256 expectedHealthFactor = 0;
        
        vm.prank(USER);
        vm.expectRevert(abi.encodeWithSelector(DSCEngine.DSCEngine__BreaksHealthFactor.selector, expectedHealthFactor));
        engine.mintDsc(dscAmount);
    }
    
    function testCanMintDsc() public depositedCollateral {
        uint256 amountToMint = 1 ether;

        vm.prank(USER);
        engine.mintDsc(amountToMint);
    }

    /*//////////////////////////////////////////////////////////////
                  DEPOSIT COLLATERAL AND MINT DSC TEST
    //////////////////////////////////////////////////////////////*/
    function testRevertIfDscToMintGreterThanCollateralValue() public {
        // amount * 1000e18
        uint256 collateralValueInUsd = engine.getUsdValue(weth, AMOUNT_COLLATERAL);
        uint256 collateralAdjustedForThreshold = 
            (collateralValueInUsd * engine.getLiquidationThreshold()) / engine.getLiquidationPrecision();
        uint256 expectedHealthFactor = (collateralAdjustedForThreshold * engine.getPrecision()) / 5001e18;
        
        vm.startPrank(USER);
        ERC20Mock(weth).approve(address(engine), AMOUNT_COLLATERAL);
        
        vm.expectRevert(abi.encodeWithSelector(DSCEngine.DSCEngine__BreaksHealthFactor.selector, expectedHealthFactor));
        engine.depositCollateralAndMintDsc(weth, AMOUNT_COLLATERAL, 5001 ether); // 5001 > 5000
        vm.stopPrank();
    }

    modifier depositedCollateralAndMintedDsc() {
        vm.startPrank(USER);
        ERC20Mock(weth).approve(address(engine), AMOUNT_COLLATERAL);
        engine.depositCollateralAndMintDsc(weth, AMOUNT_COLLATERAL, AMOUNT_TO_MINT);
        vm.stopPrank();
        _;
    }

    function testCanDepositMintAndGetAccountInfo() public depositedCollateralAndMintedDsc {
        uint256 expectedCollateralValueInUsd = engine.getAccountCollateralValue(USER);
        uint256 expectedDepositAmount = engine.getTokenAmountFromUsd(weth, expectedCollateralValueInUsd);
        (uint256 totalDscMinted, uint256 collateralValueInUsd) = engine.getAccountInformation(USER);

        assertEq(totalDscMinted, AMOUNT_TO_MINT);
        assertEq(collateralValueInUsd, expectedCollateralValueInUsd);
        assertEq(AMOUNT_COLLATERAL, expectedDepositAmount);
    }

    /*//////////////////////////////////////////////////////////////
                             BURN DSC TEST
    //////////////////////////////////////////////////////////////*/
    function testRevertIfDscToBurnZero() public {
        uint256 amountToBurn = 0;

        vm.expectRevert(DSCEngine.DSCEngine__NeedsMoreThanZero.selector);
        engine.burnDsc(amountToBurn);
    }

    function testCantBurnMoreThanUserHas() public {
        vm.prank(USER);
        vm.expectRevert();
        engine.burnDsc(AMOUNT_TO_BURN);
    }

    function testCanBurnDsc() public depositedCollateralAndMintedDsc {
        vm.startPrank(USER);
        dsc.approve(address(engine), AMOUNT_TO_BURN);
        engine.burnDsc(AMOUNT_TO_BURN);
        vm.stopPrank();

        uint256 expectedDscUserBalance = AMOUNT_TO_MINT - AMOUNT_TO_BURN;
        uint256 actualDscUserBalance = dsc.balanceOf(USER);
        assertEq(actualDscUserBalance, expectedDscUserBalance);
    }

    /*//////////////////////////////////////////////////////////////
                         REDEEM COLLATERAL TEST
    //////////////////////////////////////////////////////////////*/
    function testRefertIfCollateralToRedeemZero() public depositedCollateral {
        uint256 collateralToRedeem = 0;

        vm.expectRevert(DSCEngine.DSCEngine__NeedsMoreThanZero.selector);
        engine.redeemCollateral(weth, collateralToRedeem);
    }

    function testCanRedeemCollateralWithNoMintedDsc() public depositedCollateral {
        vm.startPrank(USER);
        uint256 userBalanceBefore = engine.getCollateralBalanceOfUser(USER, weth);
        assertEq(userBalanceBefore, AMOUNT_COLLATERAL);
        engine.redeemCollateral(weth, AMOUNT_COLLATERAL);
        uint256 userBalanceAfter = engine.getCollateralBalanceOfUser(USER, weth);
        assertEq(userBalanceAfter, 0);
        vm.stopPrank();
    }

    function testEmitsCollateralRedeemedEvent() public depositedCollateral {
        vm.startPrank(USER);
        vm.expectEmit(true, true, false, true);
        emit DSCEngine.CollateralRedeemed(USER, USER, weth, AMOUNT_COLLATERAL);
        engine.redeemCollateral(weth, AMOUNT_COLLATERAL);
        vm.stopPrank();
    }

    function testRevertRedeemIfHealthFactorBroken() public depositedCollateralAndMintedDsc {
        uint256 expectedHealthFactor = 0;

        vm.expectRevert(abi.encodeWithSelector(DSCEngine.DSCEngine__BreaksHealthFactor.selector, expectedHealthFactor));
        vm.prank(USER);
        engine.redeemCollateral(weth, AMOUNT_COLLATERAL);
    }

    /*//////////////////////////////////////////////////////////////
                     REDEEM COLLATERAL FOR DSC TEST
    //////////////////////////////////////////////////////////////*/
    function testRefertIfBrokeHealthFactor() public depositedCollateralAndMintedDsc {
        uint256 amountToBurn = 1 ether;
        uint256 expectedHealthFactor = 0;

        vm.startPrank(USER);
        dsc.approve(address(engine), amountToBurn);
        vm.expectRevert(abi.encodeWithSelector(DSCEngine.DSCEngine__BreaksHealthFactor.selector, expectedHealthFactor));
        engine.redeemCollateralForDsc(weth, AMOUNT_COLLATERAL, amountToBurn);
        vm.stopPrank();
    }   

    function testCanRedeemCollateralForDsc() public depositedCollateralAndMintedDsc {
        vm.startPrank(USER);
        dsc.approve(address(engine), AMOUNT_TO_BURN);
        engine.redeemCollateralForDsc(weth, AMOUNT_COLLATERAL, AMOUNT_TO_BURN);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                            LIQUIDATION TEST
    //////////////////////////////////////////////////////////////*/
    function testRevertIfDebtToCoverZero() public depositedCollateralAndMintedDsc {
        uint256 debtToCover = 0;

        vm.startPrank(LIQUIDATOR);
        vm.expectRevert(DSCEngine.DSCEngine__NeedsMoreThanZero.selector);
        engine.liquidate(weth, USER, debtToCover);
        vm.stopPrank();
    }

    function testRevertIfUserHealthFactorOk() public {
        vm.startPrank(LIQUIDATOR);
        vm.expectRevert(DSCEngine.DSCEngine__HealthFactorOk.selector);
        engine.liquidate(weth, USER, AMOUNT_TO_MINT);
        vm.stopPrank();
    }

    function testHealthFactorCanTurnToBroken() public depositedCollateralAndMintedDsc {
        int256 ethUsdUpdatedPrice = 15e8;
        MockV3Aggregator(ethUsdPriceFeed).updateAnswer(ethUsdUpdatedPrice);
        // $10e8 * 10 = $100e8
        uint256 healthFactor = engine.getHealthFactor(USER);
        assert(healthFactor < engine.getMinHealthFactor());
    }

    function testCanLiquidate() public depositedCollateralAndMintedDsc {
        // Arrange
        int256 ethUsdUpdatedPrice = 15e8;
        MockV3Aggregator(ethUsdPriceFeed).updateAnswer(ethUsdUpdatedPrice);
        ERC20Mock(weth).mint(LIQUIDATOR, COLLATERAL_TO_COVER);
        // Act
        vm.startPrank(LIQUIDATOR);
        ERC20Mock(weth).approve(address(engine), COLLATERAL_TO_COVER);
        engine.depositCollateralAndMintDsc(weth, COLLATERAL_TO_COVER, AMOUNT_TO_MINT);
        dsc.approve(address(engine), AMOUNT_TO_MINT);
        engine.liquidate(weth, USER, AMOUNT_TO_MINT); // covering whole their debt
        vm.stopPrank();
    }

    modifier liquidated() {
        vm.startPrank(USER);
        ERC20Mock(weth).approve(address(engine), AMOUNT_COLLATERAL);
        engine.depositCollateralAndMintDsc(weth, AMOUNT_COLLATERAL, AMOUNT_TO_MINT);
        vm.stopPrank();

        int256 ethUsdUpdatedPrice = 15e8;
        MockV3Aggregator(ethUsdPriceFeed).updateAnswer(ethUsdUpdatedPrice);
        
        ERC20Mock(weth).mint(LIQUIDATOR, COLLATERAL_TO_COVER);
        
        vm.startPrank(LIQUIDATOR);
        ERC20Mock(weth).approve(address(engine), COLLATERAL_TO_COVER);
        engine.depositCollateralAndMintDsc(weth, COLLATERAL_TO_COVER, AMOUNT_TO_MINT);
        dsc.approve(address(engine), AMOUNT_TO_MINT);
        engine.liquidate(weth, USER, AMOUNT_TO_MINT); // covering whole their debt
        vm.stopPrank();
        _;
    }

    function testLiquidatorTakesOnUsersDebt() public liquidated {
        (uint256 liquidatorDscMinted,) = engine.getAccountInformation(LIQUIDATOR);
        assertEq(liquidatorDscMinted, AMOUNT_TO_MINT);
    }

    function testUserHasNoMoreDebt() public liquidated {
        (uint256 userDscMinted,) = engine.getAccountInformation(USER);
        assertEq(userDscMinted, 0);
    }

    /*//////////////////////////////////////////////////////////////
                       VIEW & PURE FUNCTIONS TEST
    //////////////////////////////////////////////////////////////*/
    function testGetAccountCollateralValue() public depositedCollateral {
        uint256 expectedCollateralValue = engine.getUsdValue(weth, AMOUNT_COLLATERAL);
        uint256 totalCollateralValueInUsd = engine.getAccountCollateralValue(USER);
        assertEq(totalCollateralValueInUsd, expectedCollateralValue);
    }

    function testGetAccountInfo() public depositedCollateralAndMintedDsc {
        uint256 expectedTotalDscMinted = AMOUNT_TO_MINT;
        uint256 expectedCollateralValueInUsd = engine.getAccountCollateralValue(USER);

        (uint256 totalDscMinted, uint256 collateralValueInUsd) = engine.getAccountInformation(USER);
        assertEq(totalDscMinted, expectedTotalDscMinted);
        assertEq(collateralValueInUsd, expectedCollateralValueInUsd);
    }

    function testGetDscAddress() public view {
        address dscAddress = engine.getDsc();
        assertEq(dscAddress, address(dsc));
    }

    function testGetCollateralTokenPriceFeed() public view {
        address priceFeed = engine.getCollateralTokenPriceFeed(weth);
        assertEq(priceFeed, ethUsdPriceFeed);
    }

    // Get health factor
    function testGethealthFactorBeforeDepositAndMint() public view {
        uint256 healthFactor = engine.getHealthFactor(USER);
        assertEq(healthFactor, type(uint256).max);
    }

    function testGetHealthFactorAfterDepositAndMint() public depositedCollateralAndMintedDsc {
        (uint256 totalDscMinted, uint256 collateralValueInUsd) = engine.getAccountInformation(USER);
        uint256 collateralAdjustedForThreshold = 
            (collateralValueInUsd * engine.getLiquidationThreshold()) / engine.getLiquidationPrecision();
        uint256 expectedHealthFactor = (collateralAdjustedForThreshold * engine.getPrecision()) / totalDscMinted;

        uint256 healthFactor = engine.getHealthFactor(USER);
        assertEq(healthFactor, expectedHealthFactor);
    }

    function getPrecision() public view {
        uint256 expectedPrecision = 1e18;
        uint256 precision = engine.getPrecision();
        assertEq(precision, expectedPrecision);
    }

    function getAdditionalFeedPrecision() public view {
        uint256 expectedAdditionalFeedPrecision = 1e10;
        uint256 additionalFeedPrecision = engine.getAdditionalFeedPrecision();
        assertEq(additionalFeedPrecision, expectedAdditionalFeedPrecision);
    }

    function testGetLiquidationThreshold() public view {
        uint256 expectedLiquidationThreshold = 50;
        uint256 liquidationThreshold = engine.getLiquidationThreshold();
        assertEq(liquidationThreshold, expectedLiquidationThreshold);
    }

    function testGetLiquidationPrecision() public view {
        uint256 expectedLiquidationPrecision = 100;
        uint256 liquidationPrecision = engine.getLiquidationPrecision();
        assertEq(liquidationPrecision, expectedLiquidationPrecision);
    }

    function testGetLiquidationBonus() public view {
        uint256 expectedLiquidationBonus = 10;
        uint256 liquidationBonus = engine.getLiquidationBonus();
        assertEq(liquidationBonus, expectedLiquidationBonus);
    }

    function testGetMinHealthFactor() public view {
        uint256 expectedHealthFactor = 1 ether;
        uint256 minHealthFactor = engine.getMinHealthFactor();
        assertEq(minHealthFactor, expectedHealthFactor);
    }
    
    // Get user collateral balance
    function testGetUserCollateralBalanceBeforeDeposit() public view {
        uint256 expectedUserCollateralBalance = 0;
        uint256 userCollateralBalance = engine.getCollateralBalanceOfUser(USER, weth);
        assertEq(userCollateralBalance, expectedUserCollateralBalance);
    }

    function testGetUserCollateralBalanceAfterDeposit() public depositedCollateral {
        uint256 expectedUserCollateralBalance = AMOUNT_COLLATERAL;
        uint256 userCollateralBalance = engine.getCollateralBalanceOfUser(USER, weth);
        assertEq(userCollateralBalance, expectedUserCollateralBalance);
    }
}