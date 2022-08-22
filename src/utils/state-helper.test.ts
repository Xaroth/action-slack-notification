import stateHelper, { EXPORT_VAR_PREFIX } from 'utils/state-helper'
import * as actionsCore from '@actions/core'

// We mock issueCommand as it will output to console (since we don't have access to the command file)
// This causes GitHub to error out on our tests because it doesn't trust it.
// Plus we don't actually want to output anything.
jest.mock('@actions/core/lib/command', () => {
  const original = jest.requireActual('@actions/core/lib/command')
  return {
    __esModule: true,
    ...original,
    issueCommand: jest.fn(),
  }
})

describe('state tests', () => {
  const name = 'TESTVALUE'
  const value = 'test'

  beforeAll(() => {
    process.env = {}
  })

  it('stateHelper picks up on process.env variables', () => {
    const [unset] = stateHelper(name)

    // This env variable was never set, so we should expect it to be undefined
    expect(unset).toBeUndefined()
    process.env[`${EXPORT_VAR_PREFIX}${name}`] = value

    // While we may have set it now, stateHelper has already done its thing
    // so this variable should still be undefined
    expect(unset).toBeUndefined()

    process.env[`${EXPORT_VAR_PREFIX}${name}`] = value
    const [withValue] = stateHelper(name)
    // Now that we called it after setting the env var, it should pick up on the value.
    expect(withValue).toEqual(value)
  })

  it('calls exportVariable when setting states', () => {
    const exportVariable = jest.spyOn(actionsCore, 'exportVariable').mockImplementation(jest.fn())

    const [, setValue] = stateHelper(name)
    setValue(value)
    expect(exportVariable).toHaveBeenCalled()
  })

  it('calls setOutput when setting states with output', () => {
    const setOutput = jest.spyOn(actionsCore, 'setOutput').mockImplementation(jest.fn())

    const [, setValue] = stateHelper(name, { output: true })
    setValue(value)
    expect(setOutput).toHaveBeenCalled()
  })

  it('marks secrets as secret', () => {
    const setSecret = jest.spyOn(actionsCore, 'setSecret').mockImplementation(jest.fn())

    const [, setValue] = stateHelper(name, { isSensitive: true })
    setValue(value)
    expect(setSecret).toHaveBeenCalled()
  })

  it('returns the default when one is specified', () => {
    delete process.env[`${EXPORT_VAR_PREFIX}${name}`]
    const defaultValue = 'this is a test'
    const [value] = stateHelper(name, { defaultValue })

    expect(value).toEqual(defaultValue)
  })

  it('ignores "null" values', () => {
    process.env[`${EXPORT_VAR_PREFIX}${name}`] = 'null'
    const [jsonValue] = stateHelper(name, {
      toValue: (val: string) => JSON.parse(val),
      fromValue: (val: Record<string, string>) => JSON.stringify(val),
      defaultValue: {},
    })
    expect(jsonValue).toEqual({})
  })

  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env[`${EXPORT_VAR_PREFIX}${name}`]
  })
})
