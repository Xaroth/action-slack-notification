export const isDebug = process.env['RUNNER_DEBUG'] === '1'

export const withDebug = (func: () => void): void => {
  if (isDebug) func()
}

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = (): void => {}

export const debug = isDebug ? console.log : noop
