import assert from 'node:assert/strict'
import { dispatchAiRequest, buildImagePayload, imageFailure, outputFormatRejected } from './ai-http.mjs'
import {
  buildImagePayload as functionsPayload,
  imageFailure as functionsFailure,
} from '../functions/ai-http.mjs'

const PROMPT = 'un chien'
const MODELS = ['gpt-image-1', 'gpt-image-1-mini', 'gpt-image-1.5', 'GPT-Image-1']

for (const model of MODELS) {
  const payload = buildImagePayload(model, PROMPT)
  assert.equal(Object.hasOwn(payload, 'response_format'), false, `${model} must not send response_format`)
  assert.equal(payload.output_format, 'png', model)
  assert.equal(payload.size, '1024x1024', model)
  assert.equal(payload.prompt, PROMPT, model)
  assert.equal(JSON.stringify(payload).includes('response_format'), false, model)
  const retry = buildImagePayload(model, PROMPT, { outputFormat: false })
  assert.equal(Object.hasOwn(retry, 'response_format'), false, `${model} retry`)
  assert.equal(Object.hasOwn(retry, 'output_format'), false, `${model} retry output_format`)
  assert.deepEqual(functionsPayload(model, PROMPT), payload, `${model} functions copy`)
}

const dalle = buildImagePayload('dall-e-3', PROMPT)
assert.equal(dalle.response_format, 'b64_json')
assert.equal(dalle.n, 1)
assert.equal(Object.hasOwn(dalle, 'output_format'), false)
assert.deepEqual(functionsPayload('dall-e-3', PROMPT), dalle)

assert.equal(
  outputFormatRejected(400, { error: { message: "Unknown parameter: 'output_format'." } }),
  true,
)
assert.equal(
  outputFormatRejected(400, { error: { message: "Unknown parameter: 'response_format'." } }),
  false,
)
assert.equal(outputFormatRejected(400, { error: { param: 'output_format', message: 'bad' } }), true)
assert.equal(outputFormatRejected(500, { error: { message: "Unknown parameter: 'output_format'." } }), false)

const rawParam = JSON.stringify({ error: { message: "Unknown parameter: 'response_format'." } })
const fr = imageFailure('fr', 400, rawParam)
const en = imageFailure('en', 400, rawParam)
assert.equal(fr.includes('response_format'), false)
assert.equal(fr.includes('Unknown parameter'), false)
assert.match(fr, /Le service d’image a refusé la requête/)
assert.equal(en.includes('response_format'), false)
assert.match(en, /The image service refused the request/)
assert.equal(functionsFailure('fr', 400, rawParam), fr)

const afterRetry = imageFailure('fr', 400, 'Billing hard limit', { afterRetry: true })
assert.match(afterRetry, /refusé la requête/)
assert.equal(afterRetry.includes('Billing'), false)

const other = imageFailure('fr', 429, 'Too many requests')
assert.match(other, /Too many requests/)

function fakeRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value
    },
    end(payload) {
      this.body = payload
    },
  }
}

async function callImage(fetchImpl, body, env) {
  const prev = globalThis.fetch
  globalThis.fetch = fetchImpl
  try {
    const res = fakeRes()
    const req = { method: 'POST', headers: {}, body, on() {}, off() {} }
    await dispatchAiRequest(req, res, env, '/api/ai/image')
    return { status: res.statusCode, json: JSON.parse(res.body) }
  } finally {
    globalThis.fetch = prev
  }
}

function jsonResponse(status, body, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
}

const KEY = 'sk-test-image-not-real'
const env = { OPENAI_API_KEY: KEY }

const direct = await callImage(
  async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/images/generations')
    const payload = JSON.parse(options.body)
    assert.equal(payload.model, 'gpt-image-1')
    assert.equal(Object.hasOwn(payload, 'response_format'), false)
    assert.equal(payload.output_format, 'png')
    assert.equal(options.headers.Authorization, `Bearer ${KEY}`)
    return jsonResponse(200, { data: [{ b64_json: Buffer.from('chien').toString('base64') }] })
  },
  { prompt: PROMPT, language: 'fr' },
  env,
)
assert.equal(direct.json.ok, true)
assert.equal(direct.json.b64, Buffer.from('chien').toString('base64'))
assert.equal(Object.hasOwn(direct.json, 'url'), false)
assert.equal(JSON.stringify(direct.json).includes(KEY), false)

const calls = []
const retried = await callImage(
  async (url, options) => {
    calls.push({ url, body: options.body ? JSON.parse(options.body) : null })
    if (calls.length === 1) {
      return jsonResponse(400, { error: { message: "Unknown parameter: 'output_format'." } })
    }
    if (calls.length === 2) {
      return jsonResponse(200, { data: [{ url: 'https://images.example.com/dog.png' }] })
    }
    assert.equal(url, 'https://images.example.com/dog.png')
    return new Response(Buffer.from('PNG'), { status: 200, headers: { 'content-type': 'image/png' } })
  },
  { prompt: PROMPT, language: 'fr' },
  env,
)
assert.equal(calls.length, 3)
assert.equal(Object.hasOwn(calls[0].body, 'response_format'), false)
assert.equal(calls[0].body.output_format, 'png')
assert.equal(Object.hasOwn(calls[1].body, 'response_format'), false)
assert.equal(Object.hasOwn(calls[1].body, 'output_format'), false)
assert.equal(retried.json.ok, true)
assert.equal(retried.json.b64, Buffer.from('PNG').toString('base64'))
assert.equal(retried.json.mime, 'image/png')
assert.equal(Object.hasOwn(retried.json, 'url'), false)

const refused = await callImage(
  async (_url, options) => {
    const payload = JSON.parse(options.body)
    if (payload.model.startsWith('gpt-image')) {
      assert.equal(Object.hasOwn(payload, 'response_format'), false)
    }
    return jsonResponse(400, { error: { message: "Unknown parameter: 'response_format'." } })
  },
  { prompt: PROMPT, language: 'fr' },
  env,
)
assert.equal(refused.json.ok, false)
assert.equal(refused.json.error.includes('response_format'), false)
assert.equal(refused.json.error.includes('Unknown parameter'), false)
assert.match(refused.json.error, /Le service d’image a refusé la requête/)

const refusedEn = await callImage(
  async () => jsonResponse(400, { error: { message: "Unknown parameter: 'response_format'." } }),
  { prompt: PROMPT, language: 'en' },
  env,
)
assert.match(refusedEn.json.error, /The image service refused the request/)
assert.equal(refusedEn.json.error.includes('response_format'), false)

const expired = await callImage(
  async (url) => {
    if (String(url).includes('images/generations')) {
      return jsonResponse(200, { data: [{ url: 'https://cdn.example.com/expire.png' }] })
    }
    return new Response('no', { status: 403 })
  },
  { prompt: PROMPT, language: 'fr' },
  env,
)
assert.equal(expired.json.ok, false)
assert.equal(JSON.stringify(expired.json).includes('cdn.example.com'), false)
assert.match(expired.json.error, /fichier vide/)

console.log('image payload gpt-image-1', JSON.stringify(buildImagePayload('gpt-image-1', PROMPT)))
console.log('image payload retry', JSON.stringify(buildImagePayload('gpt-image-1', PROMPT, { outputFormat: false })))
console.log('image payload dall-e-3', JSON.stringify(buildImagePayload('dall-e-3', PROMPT)))
console.log('image-payload ok')
