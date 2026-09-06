// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title TempoAuctionVault
 * @author Rohan Rooswelt P (TEMPO Protocol)
 * @notice Decentralized Liquidity Vault for DreamDEX Event Contracts Opening Auctions.
 * @dev Accepts collateral (tUSDC / USDso), issues yield-bearing vTEMPO shares, and non-custodially
 *      allocates liquidity to the GENESIS autonomous agent to anchor opening auctions on DreamDEX.
 */

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 value) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function decimals() external view returns (uint8);
}

contract TempoAuctionVault {
    // --- ERC-20 Share Metadata ---
    string public constant name = "TEMPO Genesis Vault Shares";
    string public constant symbol = "vTEMPO";
    uint8 public immutable decimals;

    // --- State Variables ---
    IERC20 public immutable asset;
    address public owner;
    address public genesisOperator;
    bool public paused;

    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    // --- Auction Allocation Tracking ---
    uint256 public allocatedCollateral;
    uint256 public maxAllocationPercent = 85; // Max 85% can be active in auction windows
    mapping(address => bool) public isWhitelistedVenue;

    // --- Reentrancy Guard ---
    uint256 private _locked = 1;

    // --- Events ---
    event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares);
    event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event AuctionAllocated(address indexed venue, uint256 amount, uint256 totalActiveAllocated);
    event AuctionSettled(uint256 amountReturned, int256 netProfit, uint256 totalActiveAllocated);
    event OperatorUpdated(address indexed previousOperator, address indexed newOperator);
    event VenueWhitelistUpdated(address indexed venue, bool status);
    event Paused(bool isPaused);

    // --- Modifiers ---
    modifier onlyOwner() {
        require(msg.sender == owner, "TempoVault: caller is not owner");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == genesisOperator || msg.sender == owner, "TempoVault: caller is not genesis operator");
        _;
    }

    modifier notPaused() {
        require(!paused, "TempoVault: vault is paused");
        _;
    }

    modifier nonReentrant() {
        require(_locked == 1, "TempoVault: reentrancy guard");
        _locked = 2;
        _;
        _locked = 1;
    }

    constructor(address _asset, address _genesisOperator) {
        require(_asset != address(0), "TempoVault: invalid asset");
        require(_genesisOperator != address(0), "TempoVault: invalid operator");
        
        asset = IERC20(_asset);
        decimals = IERC20(_asset).decimals();
        owner = msg.sender;
        genesisOperator = _genesisOperator;

        // Default whitelist for DreamDEX Core Protocol Addresses on Somnia
        // BinaryMarketsModule, MarketsCore, BinarySettlement, CollateralRouter
        isWhitelistedVenue[0x3ecC694Cef705358864a646142ac17A90E29e388] = true;
        isWhitelistedVenue[0x2802504314685D89bF6C992CA5a8e7cC78bc0294] = true;
        isWhitelistedVenue[0xbF4a49e0Dfd092e5FBE8E5761064C49533e6Ed23] = true;
        isWhitelistedVenue[0xbC0C9834B15ACE38bB50dDaa7d7f7C7CC4DC183C] = true;
    }

    // =========================================================================
    // VAULT ASSET & SHARE ACCOUNTING (ERC-4626 PRINCIPLES)
    // =========================================================================

    /**
     * @notice Total assets controlled by the vault (liquid balance + actively allocated auction collateral).
     */
    function totalAssets() public view returns (uint256) {
        return asset.balanceOf(address(this)) + allocatedCollateral;
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        uint256 supply = totalSupply;
        uint256 total = totalAssets();
        return (supply == 0 || total == 0) ? assets : (assets * supply) / total;
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        uint256 supply = totalSupply;
        return supply == 0 ? shares : (shares * totalAssets()) / supply;
    }

    /**
     * @notice Deposit collateral into the vault to back GENESIS opening auctions and earn yield.
     */
    function deposit(uint256 assets, address receiver) external notPaused nonReentrant returns (uint256 shares) {
        require(assets > 0, "TempoVault: zero assets");
        require(receiver != address(0), "TempoVault: zero receiver");

        shares = convertToShares(assets);
        require(shares > 0, "TempoVault: zero shares");

        // Mint shares
        totalSupply += shares;
        balanceOf[receiver] += shares;
        emit Transfer(address(0), receiver, shares);

        // Pull collateral
        bool success = asset.transferFrom(msg.sender, address(this), assets);
        require(success, "TempoVault: transferFrom failed");

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /**
     * @notice Withdraw collateral from the vault by burning shares.
     */
    function withdraw(uint256 assets, address receiver, address shareOwner) external nonReentrant returns (uint256 shares) {
        require(assets > 0, "TempoVault: zero assets");
        require(receiver != address(0), "TempoVault: zero receiver");
        
        uint256 liquidBalance = asset.balanceOf(address(this));
        require(assets <= liquidBalance, "TempoVault: insufficient liquid assets in vault");

        shares = convertToShares(assets);
        require(shares > 0, "TempoVault: zero shares");

        if (msg.sender != shareOwner) {
            uint256 allowed = allowance[shareOwner][msg.sender];
            require(allowed >= shares, "TempoVault: insufficient allowance");
            if (allowed != type(uint256).max) {
                allowance[shareOwner][msg.sender] = allowed - shares;
                emit Approval(shareOwner, msg.sender, allowed - shares);
            }
        }

        require(balanceOf[shareOwner] >= shares, "TempoVault: insufficient balance");
        balanceOf[shareOwner] -= shares;
        totalSupply -= shares;
        emit Transfer(shareOwner, address(0), shares);

        bool success = asset.transfer(receiver, assets);
        require(success, "TempoVault: transfer failed");

        emit Withdraw(msg.sender, receiver, shareOwner, assets, shares);
    }

    // =========================================================================
    // GENESIS OPERATOR AUCTION ALLOCATION (FAIL-CLOSED WHITESLIST)
    // =========================================================================

    /**
     * @notice Allocates collateral to an approved DreamDEX venue contract to mint complete sets or quote.
     * @dev Enforces strict non-custodial destination whitelisting and total allocation caps.
     */
    function allocateAuctionCollateral(address venue, uint256 amount) external onlyOperator notPaused nonReentrant {
        require(isWhitelistedVenue[venue], "TempoVault: venue destination not whitelisted");
        require(amount > 0, "TempoVault: zero amount");
        
        uint256 total = totalAssets();
        uint256 newAllocation = allocatedCollateral + amount;
        require((newAllocation * 100) / total <= maxAllocationPercent, "TempoVault: exceeds max allocation ratio");
        require(amount <= asset.balanceOf(address(this)), "TempoVault: insufficient liquid reserves");

        allocatedCollateral = newAllocation;

        // Approve and transfer to the verified DreamDEX venue contract
        bool success = asset.transfer(venue, amount);
        require(success, "TempoVault: allocation transfer failed");

        emit AuctionAllocated(venue, amount, allocatedCollateral);
    }

    /**
     * @notice Records the return of collateral + trading fee profits from resolved DreamDEX event windows.
     */
    function settleAuctionReturns(uint256 principalReturned, int256 netProfit) external onlyOperator nonReentrant {
        require(principalReturned <= allocatedCollateral, "TempoVault: returned principal exceeds active allocation");
        
        allocatedCollateral -= principalReturned;
        emit AuctionSettled(principalReturned, netProfit, allocatedCollateral);
    }

    // =========================================================================
    // ERC-20 STANDARD METHODS
    // =========================================================================

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        allowance[msg.sender][spender] = value;
        emit Approval(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= value, "TempoVault: insufficient allowance");
            allowance[from][msg.sender] = allowed - value;
            emit Approval(from, msg.sender, allowed - value);
        }
        _transfer(from, to, value);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "TempoVault: transfer from zero");
        require(to != address(0), "TempoVault: transfer to zero");
        require(balanceOf[from] >= value, "TempoVault: insufficient balance");
        balanceOf[from] -= value;
        balanceOf[to] += value;
        emit Transfer(from, to, value);
    }

    // =========================================================================
    // ADMIN & GOVERNANCE
    // =========================================================================

    function setGenesisOperator(address newOperator) external onlyOwner {
        require(newOperator != address(0), "TempoVault: zero operator");
        emit OperatorUpdated(genesisOperator, newOperator);
        genesisOperator = newOperator;
    }

    function setVenueWhitelist(address venue, bool status) external onlyOwner {
        require(venue != address(0), "TempoVault: zero venue");
        isWhitelistedVenue[venue] = status;
        emit VenueWhitelistUpdated(venue, status);
    }

    function setMaxAllocationPercent(uint256 newPercent) external onlyOwner {
        require(newPercent <= 95, "TempoVault: cap too high");
        maxAllocationPercent = newPercent;
    }

    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
        emit Paused(_paused);
    }
}
