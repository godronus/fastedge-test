/**
 * Phase 2: Runner Isolation — Standalone API Tests
 *
 * Verifies that createRunner / createRunnerFromBuffer work headlessly:
 * no server, no WebSocket, no state manager required.
 */

import { describe, it, expect } from 'vitest';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { createRunner, createRunnerFromBuffer } from '../../../runner/standalone';
import { NullStateManager } from '../../../runner/NullStateManager';
import type { IStateManager } from '../../../runner/IStateManager';

const PROXY_WASM = resolve(__dirname, '../../../../wasm/cdn-apps/headers/headers-change.wasm');

describe('NullStateManager', () => {
  it('satisfies the IStateManager interface', () => {
    const manager: IStateManager = new NullStateManager();
    // All methods are no-ops — calling them should not throw
    expect(() => manager.emitRequestStarted('https://example.com', 'GET', {})).not.toThrow();
    expect(() => manager.emitHookExecuted('onRequestHeaders', 0, 0,
      { request: { headers: {}, body: '' }, response: { headers: {}, body: '' } },
      { request: { headers: {}, body: '' }, response: { headers: {}, body: '' } }
    )).not.toThrow();
    expect(() => manager.emitRequestCompleted({}, { status: 200, statusText: 'OK', headers: {}, body: '', contentType: 'text/plain' })).not.toThrow();
    expect(() => manager.emitRequestFailed('error')).not.toThrow();
    expect(() => manager.emitWasmLoaded('test.wasm', 1024)).not.toThrow();
    expect(() => manager.emitPropertiesUpdated({})).not.toThrow();
    expect(() => manager.emitHttpWasmRequestCompleted(
      { status: 200, statusText: 'OK', headers: {}, body: '', contentType: null }, []
    )).not.toThrow();
    expect(() => manager.emitReloadWorkspaceWasm('/path/to/wasm')).not.toThrow();
  });
});

describe('createRunnerFromBuffer', () => {
  it('creates a proxy-wasm runner from a buffer without a state manager', async () => {
    const buffer = await readFile(PROXY_WASM);
    const runner = await createRunnerFromBuffer(buffer);
    expect(runner.getType()).toBe('proxy-wasm');
    await runner.cleanup();
  });

  it('runner can execute a callHook without a state manager attached', async () => {
    const buffer = await readFile(PROXY_WASM);
    const runner = await createRunnerFromBuffer(buffer);

    const result = await runner.callHook({
      hook: 'onRequestHeaders',
      request: { headers: { host: 'example.com' }, body: '', method: 'GET' },
      response: { headers: {}, body: '' },
      properties: {},
    });

    expect(result.returnCode).not.toBeNull();
    await runner.cleanup();
  });

  it('runner works with a NullStateManager explicitly set', async () => {
    const buffer = await readFile(PROXY_WASM);
    const runner = await createRunnerFromBuffer(buffer);
    runner.setStateManager(new NullStateManager());

    const result = await runner.callHook({
      hook: 'onRequestHeaders',
      request: { headers: { host: 'example.com' }, body: '', method: 'GET' },
      response: { headers: {}, body: '' },
      properties: {},
    });

    expect(result.returnCode).not.toBeNull();
    await runner.cleanup();
  });
});

describe('createRunner (from file path)', () => {
  it('creates a proxy-wasm runner from a file path', async () => {
    const runner = await createRunner(PROXY_WASM);
    expect(runner.getType()).toBe('proxy-wasm');
    await runner.cleanup();
  });

  it('runner executes callFullFlow without a server running', async () => {
    const runner = await createRunner(PROXY_WASM);

    const result = await runner.callFullFlow(
      'https://example.com',
      'GET',
      { host: 'example.com' },
      '',   // request body
      {},   // response headers
      '',   // response body
      200,
      'OK',
      {},   // properties
      true, // enforce production rules
    );

    expect(result.hookResults).toHaveProperty('onRequestHeaders');
    expect(result.hookResults).toHaveProperty('onRequestBody');
    await runner.cleanup();
  });
});

describe('WASM type auto-detection', () => {
  it('detects proxy-wasm from core module magic bytes', async () => {
    const buffer = await readFile(PROXY_WASM);
    // Core WASM magic: 0x00 0x61 0x73 0x6D + version 0x01 0x00 0x00 0x00
    expect(buffer[4]).toBe(0x01);
    const runner = await createRunnerFromBuffer(buffer);
    expect(runner.getType()).toBe('proxy-wasm');
    await runner.cleanup();
  });
});
