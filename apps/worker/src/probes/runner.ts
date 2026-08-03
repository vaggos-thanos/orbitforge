import { execa } from 'execa'

export interface CommandOutput {
  readonly stdout: string
  readonly stderr: string
}

export interface CommandOptions {
  readonly timeoutMs?: number
  readonly maxOutputBytes?: number
}

export interface CommandRunner {
  run(
    command: string,
    args?: readonly string[],
    options?: CommandOptions,
  ): Promise<CommandOutput>
}

export type CommandExecutor = (
  command: string,
  args: readonly string[],
  options: Required<CommandOptions>,
) => Promise<CommandOutput>

export class CommandRunnerError extends Error {
  constructor(
    readonly code: string,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'CommandRunnerError'
  }
}

const exactCommands = new Map<string, readonly (readonly string[])[]>([
  ['uname', [['-m']]],
  ['lscpu', [[]]],
  ['free', [['--bytes']]],
  [
    'timedatectl',
    [['show', '--property=NTPSynchronized', '--property=NTP', '--value']],
  ],
  ['lsusb', [[]]],
  ['ss', [['-lntup']]],
])

function sameArguments(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((value, index) => value === expected[index])
  )
}

function argumentsAllowed(command: string, args: readonly string[]): boolean {
  const exact = exactCommands.get(command)
  if (exact !== undefined)
    return exact.some((entry) => sameArguments(args, entry))

  if (command === 'df') {
    return (
      args.length === 3 &&
      args[0] === '--block-size=1' &&
      args[1] === '--output=size,avail' &&
      args[2]?.startsWith('/') === true
    )
  }

  if (command === 'stat') {
    return (
      args.length === 2 &&
      args[0] === '--format=%U|%G|%a|%s' &&
      args[1]?.startsWith('/') === true
    )
  }

  if (command === 'systemctl') {
    return (
      args[0] === 'show' &&
      args[1]?.endsWith('.service') === true &&
      args.slice(2).every((argument) => argument.startsWith('--property='))
    )
  }

  return false
}

export function createSafeCommandRunner(
  executor: CommandExecutor,
): CommandRunner {
  return {
    async run(command, args = [], options = {}): Promise<CommandOutput> {
      if (
        !exactCommands.has(command) &&
        !['df', 'stat', 'systemctl'].includes(command)
      ) {
        throw new CommandRunnerError(
          'command.not-allowed',
          `Command is not on the read-only allowlist: ${command}`,
        )
      }
      if (!argumentsAllowed(command, args)) {
        throw new CommandRunnerError(
          'command.arguments-not-allowed',
          `Arguments are not allowed for ${command}`,
        )
      }

      const resolvedOptions = {
        timeoutMs: options.timeoutMs ?? 5_000,
        maxOutputBytes: options.maxOutputBytes ?? 256 * 1024,
      }
      const output = await executor(command, args, resolvedOptions)
      if (
        Buffer.byteLength(output.stdout) + Buffer.byteLength(output.stderr) >
        resolvedOptions.maxOutputBytes
      ) {
        throw new CommandRunnerError(
          'command.output-limit',
          `Command output exceeded ${resolvedOptions.maxOutputBytes} bytes`,
        )
      }
      return output
    },
  }
}

export function createDefaultCommandRunner(): CommandRunner {
  return createSafeCommandRunner(async (command, args, options) => {
    try {
      const result = await execa(command, [...args], {
        maxBuffer: options.maxOutputBytes,
        timeout: options.timeoutMs,
      })
      return { stdout: result.stdout, stderr: result.stderr }
    } catch (cause) {
      const timedOut =
        typeof cause === 'object' &&
        cause !== null &&
        'timedOut' in cause &&
        cause.timedOut === true
      throw new CommandRunnerError(
        timedOut ? 'command.timeout' : 'command.failed',
        `${command} did not complete successfully`,
        { cause },
      )
    }
  })
}
