import { setOutput, saveState, getInput } from '@actions/core'

export type StateHelper<T> = [currentState: T, setState: (value: T) => void]
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
  } = options || {}

  const setState = (value: T): void => {
    saveState(name, fromValue ? fromValue(value) : value)
    if (output) {
      setOutput(name, fromValue ? fromValue(value) : value)
    }
  }

  const value = process.env[`STATE_${name}`]
  let current: T = defaultValue as T
  if (value) {
    current = toValue ? (toValue(value) as T) : (value as unknown as T)
  } else if (useFromInput) {
    const fromInput = getInput(name, { required })
    if (fromInput) {
      current = toValue ? (toValue(fromInput) as T) : (fromInput as unknown as T)
      if (storeFromInput) setState(current)
    }
  }
  return [current, setState]
}

export default stateHelper
