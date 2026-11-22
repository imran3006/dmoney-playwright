import { ENV } from './env';

export interface AgentData {
  name: string;
  email: string;
  password: string;
  newPassword: string;
  phone: string;
  nid: string;
}

/** Amounts used in the scenario. */
export const AMOUNTS = {
  systemDeposit: 2000,
  customerDeposit: 500,
  /** The agent earns 2.5% commission on every cash-in (seen in existing agents' statements). */
  agentCommissionRate: 0.025,
} as const;

/** Build a unique Agent for this run (unique email + phone, so no HTTP 208 "already exists"). */
export function createAgentData(): AgentData {
  const stamp = Date.now().toString(); // 13 digits
  const [user, domain] = ENV.gmail.split('@');
  return {
    name: `Agent ${stamp.slice(-6)}`,
    email: `${user.split('+')[0]}+agent${stamp}@${domain}`,
    password: ENV.agentPassword,
    newPassword: ENV.agentNewPassword,
    // 11 digits starting with 01: "015" + last 8 digits of the timestamp
    phone: `015${stamp.slice(-8)}`,
    nid: stamp.slice(-10),
  };
}

/** Today's date as YYYY-MM-DD in the machine's local time zone. */
export function todayLocal(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "BDT 1,512.50" / "৳ 1512.50" / "1512.5" → 1512.5 */
export function parseAmount(text: string): number {
  const match = text.replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`No number found in "${text}"`);
  return Number(match[0]);
}

/**
 * Timeout for waits that depend on the shared backend (save, deposit, search, register).
 * The public server sometimes takes 15–45 s to answer a request.
 */
export const SERVER_TIMEOUT = 60_000;
