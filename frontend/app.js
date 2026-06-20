// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// Deployed StakingRewards on Base Sepolia (chainId 84532).
// https://sepolia.basescan.org/address/0xC27C2631DBf0817b9B1EF14459eBA07EABbBBc53
const CONTRACT_ADDRESS = "0xC27C2631DBf0817b9B1EF14459eBA07EABbBBc53";

const ABI = [
  "function stake() external payable",
  "function unstake(uint256 amount) external",
  "function claim() external",
  "function earned(address user) view returns (uint256)",
  "function staked(address) view returns (uint256)",
  "function totalStaked() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function REWARD_PER_ETH_PER_DAY() view returns (uint256)",
  "event Staked(address indexed user, uint256 amount)",
  "event Unstaked(address indexed user, uint256 amount)",
  "event Claimed(address indexed user, uint256 reward)",
];

const DAY = 86400;

// ---------------------------------------------------------------------------
// State + refs
// ---------------------------------------------------------------------------

let provider, signer, contract, account;
let myStaked = 0n; // wei staked, for the live earned ticker
let earnedAtRefresh = 0n; // earned (wei tokens) at last on-chain read
let refreshedAt = 0; // ms timestamp of last read
let ticker = null;

const els = {
  connectBtn: document.getElementById("connectBtn"),
  account: document.getElementById("account"),
  dash: document.getElementById("dash"),
  actions: document.getElementById("actions"),
  earned: document.getElementById("earned"),
  claimBtn: document.getElementById("claimBtn"),
  staked: document.getElementById("staked"),
  bsr: document.getElementById("bsr"),
  totalStaked: document.getElementById("totalStaked"),
  stakeInput: document.getElementById("stakeInput"),
  stakeBtn: document.getElementById("stakeBtn"),
  unstakeInput: document.getElementById("unstakeInput"),
  unstakeBtn: document.getElementById("unstakeBtn"),
  status: document.getElementById("status"),
  watchBtn: document.getElementById("watchBtn"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setStatus(text, kind = "") {
  els.status.textContent = text;
  els.status.className = "status" + (kind ? " " + kind : "");
}

function short(a) {
  return a.slice(0, 6) + "…" + a.slice(-4);
}

function fmtEth(wei) {
  return parseFloat(ethers.formatEther(wei)).toLocaleString(undefined, {
    maximumFractionDigits: 4,
  });
}

// ---------------------------------------------------------------------------
// Wallet
// ---------------------------------------------------------------------------

async function connect() {
  if (!window.ethereum) {
    setStatus("No wallet found. Install MetaMask or Coinbase Wallet.", "error");
    return;
  }
  if (!CONTRACT_ADDRESS) {
    setStatus("Set CONTRACT_ADDRESS in app.js after deploying.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = (await signer.getAddress()).toLowerCase();

    els.account.textContent = "Connected: " + short(account);
    els.account.classList.remove("hidden");
    els.connectBtn.textContent = "Connected";

    contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
    els.dash.classList.remove("hidden");
    els.actions.classList.remove("hidden");
    els.watchBtn.classList.remove("hidden");

    await refresh();
    ["Staked", "Unstaked", "Claimed"].forEach((e) =>
      contract.on(e, () => refresh())
    );
    startTicker();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to connect.", "error");
  }
}

// ---------------------------------------------------------------------------
// Read + render
// ---------------------------------------------------------------------------

async function refresh() {
  if (!contract) return;
  try {
    const [stakedAmt, earned, total, bsr] = await Promise.all([
      contract.staked(account),
      contract.earned(account),
      contract.totalStaked(),
      contract.balanceOf(account),
    ]);

    myStaked = stakedAmt;
    earnedAtRefresh = earned;
    refreshedAt = Date.now();

    els.staked.textContent = fmtEth(stakedAmt) + " ETH";
    els.totalStaked.textContent = fmtEth(total) + " ETH";
    els.bsr.textContent = fmtEth(bsr) + " BSR";
    els.claimBtn.disabled = earned === 0n;
    renderEarned();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Failed to load.", "error");
  }
}

// Show earned rewards, extrapolating between on-chain reads for a live feel.
function renderEarned() {
  const elapsedSec = (Date.now() - refreshedAt) / 1000;
  // pending = staked * elapsed * 1 token/ETH/day  (REWARD_PER_ETH_PER_DAY = 1e18)
  // => extra (token wei) = staked(wei) * elapsed / DAY
  const extra =
    myStaked > 0n
      ? (myStaked * BigInt(Math.floor(elapsedSec))) / BigInt(DAY)
      : 0n;
  const live = earnedAtRefresh + extra;
  els.earned.textContent =
    parseFloat(ethers.formatEther(live)).toFixed(6) + " BSR";
}

function startTicker() {
  if (ticker) clearInterval(ticker);
  ticker = setInterval(renderEarned, 1000);
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

async function stake() {
  let value;
  try {
    value = ethers.parseEther((els.stakeInput.value || "").trim() || "0");
  } catch {
    return setStatus("Enter a valid amount.", "error");
  }
  if (value <= 0n) return setStatus("Amount must be greater than 0.", "error");
  await send(() => contract.stake({ value }), "Staking");
  els.stakeInput.value = "";
}

async function unstake() {
  let amount;
  try {
    amount = ethers.parseEther((els.unstakeInput.value || "").trim() || "0");
  } catch {
    return setStatus("Enter a valid amount.", "error");
  }
  if (amount <= 0n) return setStatus("Amount must be greater than 0.", "error");
  await send(() => contract.unstake(amount), "Unstaking");
  els.unstakeInput.value = "";
}

async function claim() {
  await send(() => contract.claim(), "Claiming");
}

async function send(action, label) {
  try {
    setStatus("Confirm in your wallet…");
    const tx = await action();
    setStatus(label + "…");
    await tx.wait();
    setStatus("Done ✅", "ok");
    await refresh();
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Transaction failed.", "error");
  }
}

// ---------------------------------------------------------------------------
// UI wiring
// ---------------------------------------------------------------------------

// Ask the wallet to track the BSR reward token so it shows in the asset list.
async function watchAsset() {
  if (!window.ethereum) return;
  try {
    await window.ethereum.request({
      method: "wallet_watchAsset",
      params: {
        type: "ERC20",
        options: { address: CONTRACT_ADDRESS, symbol: "BSR", decimals: 18 },
      },
    });
    setStatus("BSR added to your wallet.", "ok");
  } catch (err) {
    setStatus(err.shortMessage || err.message || "Could not add token.", "error");
  }
}

els.connectBtn.addEventListener("click", connect);
els.stakeBtn.addEventListener("click", stake);
els.unstakeBtn.addEventListener("click", unstake);
els.claimBtn.addEventListener("click", claim);
els.watchBtn.addEventListener("click", watchAsset);

if (window.ethereum) {
  window.ethereum.on?.("accountsChanged", () => window.location.reload());
  window.ethereum.on?.("chainChanged", () => window.location.reload());
}
