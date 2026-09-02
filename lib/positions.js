const POSITIONS = {
  'senior-blockchain-protocol-engineer': 'Senior Blockchain / Protocol Engineer',
  'senior-solidity-evm-engineer': 'Senior Solidity / EVM Engineer',
  'senior-solana-rust-engineer': 'Senior Solana / Rust Engineer',
  'defi-protocol-engineer': 'DeFi / Protocol Engineer',
  'blockchain-backend-engineer': 'Blockchain Backend Engineer',
  'web3-frontend-engineer': 'Web3 Frontend Engineer',
  'blockchain-security-engineer': 'Blockchain Security Engineer',
  'blockchain-qa-test-engineer': 'Blockchain QA / Test Engineer',
  'blockchain-devops-infrastructure-engineer': 'Blockchain DevOps / Infrastructure Engineer',
  'web3-project-manager': 'Web3 Project Manager',
  'protocol-engineer': 'Senior Blockchain / Protocol Engineer',
  'solidity-evm': 'Senior Solidity / EVM Engineer',
  'solana-rust': 'Senior Solana / Rust Engineer',
  'defi-protocol': 'DeFi / Protocol Engineer',
  'backend': 'Blockchain Backend Engineer',
  'frontend': 'Web3 Frontend Engineer',
  'security': 'Blockchain Security Engineer',
  'qa': 'Blockchain QA / Test Engineer',
  'devops': 'Blockchain DevOps / Infrastructure Engineer',
  'project-manager': 'Web3 Project Manager'
};

const POSITION_TITLES = [
  'Senior Blockchain / Protocol Engineer',
  'Senior Solidity / EVM Engineer',
  'Senior Solana / Rust Engineer',
  'DeFi / Protocol Engineer',
  'Blockchain Backend Engineer',
  'Web3 Frontend Engineer',
  'Blockchain Security Engineer',
  'Blockchain QA / Test Engineer',
  'Blockchain DevOps / Infrastructure Engineer',
  'Web3 Project Manager'
];

const EMPLOYMENT_TYPES = ['Full-Time', 'Contract', 'Consulting'];

const STATUSES = [
  'new',
  'screening',
  'assessment',
  'interview',
  'offer',
  'hired',
  'rejected'
];

function officialTitle(key) {
  return POSITIONS[String(key || '').trim().toLowerCase()] || null;
}

module.exports = {
  POSITIONS: POSITIONS,
  POSITION_TITLES: POSITION_TITLES,
  EMPLOYMENT_TYPES: EMPLOYMENT_TYPES,
  STATUSES: STATUSES,
  officialTitle: officialTitle
};
