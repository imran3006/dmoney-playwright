import 'dotenv/config';

/** Read an env var, falling back to a default. Values live in `.env` (see `.env.example`). */
function env(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

export const ENV = {
  baseUrl: env('BASE_URL', 'https://dmoneyportal.roadtocareer.net'),
  apiUrl: env('API_URL', 'https://dmoney.roadtocareer.net'),

  admin: {
    email: env('ADMIN_EMAIL', 'admin@dmoney.com'),
    password: env('ADMIN_PASSWORD', '1234'),
  },
  system: {
    email: env('SYSTEM_EMAIL', 'system@dmoney.com'),
    password: env('SYSTEM_PASSWORD', '1234'),
  },

  /**
   * Your own Gmail address. The test registers `<name>+agent<timestamp>@gmail.com`, so
   * the login OTP and the password-reset link land in your normal inbox.
   */
  gmail: env('AGENT_GMAIL', 'dmoney.tester@gmail.com'),
  agentPassword: env('AGENT_PASSWORD', '1234'),
  agentNewPassword: env('AGENT_NEW_PASSWORD', '5678'),

  /** An existing, ACTIVE Customer's phone number (receiver of the agent's 500 Tk cash-in). */
  customerPhone: env('CUSTOMER_PHONE', '01711314167'),
} as const;
