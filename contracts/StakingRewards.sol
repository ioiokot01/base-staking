// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title StakingRewards
/// @notice Stake ETH and earn an ERC-20 reward token that accrues over time
///         (default: 1 reward token per ETH staked per day). Claim mints the
///         accrued rewards; unstake returns your ETH. Rewards keep accruing on
///         whatever stays staked.
/// @dev    Demonstrates time-based reward accrual (a simplified Synthetix-style
///         "settle on interaction" pattern) plus minting the reward token.
contract StakingRewards is ERC20 {
    /// @notice Reward tokens minted per 1 ETH staked per day (18 decimals).
    uint256 public constant REWARD_PER_ETH_PER_DAY = 1e18;
    uint256 private constant DAY = 1 days;

    /// @notice ETH currently staked by each account (wei).
    mapping(address => uint256) public staked;
    /// @notice Reward already settled but not yet claimed (token wei).
    mapping(address => uint256) public rewards;
    /// @notice Timestamp rewards were last settled for an account.
    mapping(address => uint256) public lastUpdate;
    /// @notice Total ETH staked across all accounts.
    uint256 public totalStaked;

    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 reward);

    constructor() ERC20("Base Stake Reward", "BSR") {}

    /// @dev Settle accrued rewards into `rewards[user]` and reset the clock.
    function _settle(address user) internal {
        rewards[user] = earned(user);
        lastUpdate[user] = block.timestamp;
    }

    /// @notice Total claimable reward for `user` (settled + still accruing).
    function earned(address user) public view returns (uint256) {
        uint256 pending = (staked[user] *
            (block.timestamp - lastUpdate[user]) *
            REWARD_PER_ETH_PER_DAY) / (1e18 * DAY);
        return rewards[user] + pending;
    }

    /// @notice Stake ETH.
    function stake() external payable {
        require(msg.value > 0, "Stake must be > 0");
        _settle(msg.sender);
        staked[msg.sender] += msg.value;
        totalStaked += msg.value;
        emit Staked(msg.sender, msg.value);
    }

    /// @notice Unstake part or all of your ETH (you keep what you earned).
    function unstake(uint256 amount) external {
        require(amount > 0, "Amount must be > 0");
        require(staked[msg.sender] >= amount, "Not enough staked");
        _settle(msg.sender);
        staked[msg.sender] -= amount;
        totalStaked -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "ETH transfer failed");
        emit Unstaked(msg.sender, amount);
    }

    /// @notice Claim accrued rewards (mints the reward token to you).
    function claim() external {
        _settle(msg.sender);
        uint256 reward = rewards[msg.sender];
        require(reward > 0, "No rewards");
        rewards[msg.sender] = 0;
        _mint(msg.sender, reward);
        emit Claimed(msg.sender, reward);
    }
}
