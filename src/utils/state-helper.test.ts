import stateHelper, { EXPORT_VAR_PREFIX } from 'utils/state-helper'
import * as coreCommand from '@actions/core/lib/command'
import { inspect } from 'util'

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

  it('calls issueCommand when setting states', () => {
    const issueCommand = jest.spyOn(coreCommand, 'issueCommand').mockImplementation(jest.fn())

    const [, setValue] = stateHelper(name)
    setValue(value)
    expect(issueCommand).toHaveBeenCalled()
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
