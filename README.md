# Staking Rewards

[![CI](https://github.com/ioiokot01/base-staking/actions/workflows/ci.yml/badge.svg)](https://github.com/ioiokot01/base-staking/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636.svg)
![Chain](https://img.shields.io/badge/Base-Sepolia-0052ff.svg)

A **staking rewards** dApp for the [Base](https://base.org) ecosystem. Stake ETH
and earn an ERC-20 reward token (**BSR**) that accrues over time — by default
1 token per ETH staked per day. Claim mints your rewards; unstake returns your
ETH while keeping what you've earned.

Project 9 in a learning series. New concepts: **time-based reward accrual** (a
simplified Synthetix-style "settle on interaction" pattern) and **minting** the
reward token on claim.

## Stack

- [Hardhat 2](https://hardhat.org) — compile, test, deploy
- [OpenZeppelin Contracts 5](https://docs.openzeppelin.com/contracts/5.x/) — ERC20
- Solidity `0.8.24`
- Target chain: Base Sepolia (testnet)

## Getting started

```bash
npm install
npx hardhat compile
npx hardhat test
```

## Contract

`contracts/StakingRewards.sol` (the contract **is** the ERC-20 reward token)

| Function | Description |
| --- | --- |
| `stake()` *(payable)* | Stake ETH |
| `unstake(uint256 amount)` | Withdraw staked ETH (keep earned rewards) |
| `claim()` | Mint your accrued reward tokens |
| `earned(address)` | Claimable reward right now |
| `staked(address)` / `totalStaked()` | Stake bookkeeping |

Reward rate: `REWARD_PER_ETH_PER_DAY = 1e18` (1 BSR per ETH per day). Emits
`Staked`, `Unstaked`, `Claimed`.

## Deploy

```bash
cp .env.example .env   # then fill in PRIVATE_KEY (testnet wallet only)
npm run deploy
```

## Roadmap

- [x] StakingRewards contract + tests
- [x] Deploy to Base Sepolia
- [x] Frontend (stake, earn, claim, unstake)

## Deployments

| Network | Address |
| --- | --- |
| Base Sepolia | [`0xC27C2631DBf0817b9B1EF14459eBA07EABbBBc53`](https://sepolia.basescan.org/address/0xC27C2631DBf0817b9B1EF14459eBA07EABbBBc53) |

## Security notes

- Rewards are settled before every balance change (stake/unstake/claim).
- Unstake uses the `call` pattern with a success check.
- The reward token is only minted through `claim()`, scaled to time staked.
- Secrets (`.env`, private keys) are git-ignored and never committed.
- All development targets a **testnet** — no real funds.

## License

MIT
