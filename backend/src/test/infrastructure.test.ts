import { describe, it, expect } from 'vitest'
import { AppError, NotFoundError, ForbiddenError, UnauthorizedError, ValidationError, ConflictError } from '../shared/errors'

describe('Error classes', () => {
  it('AppError has correct status code and message', () => {
    const err = new AppError('test', 418)
    expect(err.message).toBe('test')
    expect(err.statusCode).toBe(418)
    expect(err).toBeInstanceOf(Error)
  })

  it('NotFoundError returns 404', () => {
    const err = new NotFoundError('User')
    expect(err.statusCode).toBe(404)
    expect(err.message).toBe('User not found')
  })

  it('ForbiddenError returns 403', () => {
    const err = new ForbiddenError()
    expect(err.statusCode).toBe(403)
  })

  it('UnauthorizedError returns 401', () => {
    const err = new UnauthorizedError()
    expect(err.statusCode).toBe(401)
  })

  it('ValidationError returns 400', () => {
    const err = new ValidationError('bad input')
    expect(err.statusCode).toBe(400)
    expect(err.message).toBe('bad input')
  })

  it('ConflictError returns 409', () => {
    const err = new ConflictError('duplicate')
    expect(err.statusCode).toBe(409)
  })
})
