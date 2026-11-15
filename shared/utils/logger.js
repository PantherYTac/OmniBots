/**
 * Production Console Logger with ANSI Colors and Timestamps
 */

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

function formatTimestamp() {
  const d = new Date();
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

const logger = {
  info: (msg, source = 'SYSTEM') => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.cyan}[${source}]${colors.reset} ${msg}`);
  },
  success: (msg, source = 'SYSTEM') => {
    console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.green}[${source}]${colors.reset} ${colors.bright}${colors.green}✓ ${msg}${colors.reset}`);
  },
  warn: (msg, source = 'SYSTEM') => {
    console.warn(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.yellow}[${source}]${colors.reset} ⚠ ${msg}`);
  },
  error: (msg, error = null, source = 'SYSTEM') => {
    console.error(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.red}[${source}]${colors.reset} ✖ ${msg}`);
    if (error && error.stack) {
      console.error(`${colors.dim}${error.stack}${colors.reset}`);
    } else if (error) {
      console.error(error);
    }
  },
  debug: (msg, source = 'DEBUG') => {
    if (process.env.DEBUG === 'true' || process.env.NODE_ENV !== 'production') {
      console.log(`${colors.gray}[${formatTimestamp()}]${colors.reset} ${colors.magenta}[${source}]${colors.reset} ${msg}`);
    }
  }
};

module.exports = logger;
