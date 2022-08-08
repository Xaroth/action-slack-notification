import { setOutput, getInput, exportVariable } from '@actions/core'

export type StateHelper<T> = [currentState: T, setState: (value: T) => void, hasValue: boolean]
export interface StateHelperOptions<T> {
  /**
   * If set, use this value as default
   */
  defaultValue?: T

  /**
   * If set, use this function to convert the saved-state value from its string representation
   */
  toValue?: (value: string) => T

  /**
   * If set, use this function to convert the value to a string for state-saving
   */
  fromValue?: (value: T) => string

  /**
   * If set to true, output the variable as well
   */
  output?: boolean

  /**
   * If set to true, this is a required input.
   */
  required?: boolean

  /**
   * Use the data from inputs if not available as state
   */
  useFromInput?: boolean

  /**
   * Store input to state if available
   */
  storeFromInput?: boolean

  /**
   * The function to get saved state data
   */
  getState?: (name: string) => string | undefined

  /**
   * The function to save state data
   */
  saveState?: (name: string, value: string) => void
}

export const EXPORT_VAR_PREFIX = 'SLACK_NOTIFICATION_'

// We set this state in `state.ts`, but we want to have the value here to avoid exporting during post processing
const IS_POST_PROCESSING = !!process.env[`STATE_is-post`]

const _getName = (name: string): string => `${name.replace(/ /g, '_').toUpperCase()}`
const getStateBase = (name: string): string | undefined => process.env[`${EXPORT_VAR_PREFIX}${_getName(name)}`]
const saveStateBase = (name: string, value: string) => {
  if (!IS_POST_PROCESSING) exportVariable(`${EXPORT_VAR_PREFIX}${_getName(name)}`, value)
}

const stateHelper = <T = string>(name: string, options?: StateHelperOptions<T>): StateHelper<T> => {
  const {
    defaultValue = undefined,
    toValue,
    fromValue,
    required,
    output = false,
    useFromInput = true,
    storeFromInput = true,
    saveState = saveStateBase,
    getState = getStateBase,
  } = options || {}

  const setState = (value: T): void => {
    saveState(name, (fromValue ? fromValue(value) : value) as string)
    if (output) {
      setOutput(name, fromValue ? fromValue(value) : value)
    }
  }
  let current: T = defaultValue as T

  let found = false
  if (useFromInput) {
    const fromInput = getInput(name, { required })
    if (fromInput) {
      const parsed = toValue ? (toValue(fromInput) as T) : (fromInput as unknown as T)
      if (parsed) {
        current = parsed
        found = true
        if (storeFromInput) setState(parsed)
      }
    }
  }
  // If we're post-processing, we will always try to load from state to ensure the latest saved data is used
  if (!found || IS_POST_PROCESSING) {
    const value = getState(name)
    if (value) {
      const parsed = toValue ? (toValue(value) as T) : (value as unknown as T)
      if (parsed) {
        current = parsed
        found = true
      }
    }
  }
  return [current, setState, found]
}

export default stateHelper
