/**
 * Standalone headless runner factory
 *
 * Creates a fully loaded WASM runner without needing a server or WebSocket connection.
 * Detects the WASM type automatically from the binary magic bytes.
 *
 * Usage:
 *   import { createRunner } from './server/runner/standalone.js';
 *   const runner = await createRunner('./path/to/wasm.wasm');
 *   const result = await runner.callFullFlow('https://example.com', 'GET', {}, '', {}, '', 200, 'OK', {}, true);
 */

import { readFile } from "fs/promises";
import type { IWasmRunner, RunnerConfig } from "./IWasmRunner.js";
import { ProxyWasmRunner } from "./ProxyWasmRunner.js";
import { HttpWasmRunner } from "./HttpWasmRunner.js";
import { PortManager } from "./PortManager.js";

/**
 * Detect WASM type from binary content.
 *
 * HTTP-WASM (component model) binaries start with the component magic:
 *   0x00 0x61 0x73 0x6D 0x0A 0x00 0x01 0x00
 * Standard WASM (proxy-wasm) binaries start with the core magic:
 *   0x00 0x61 0x73 0x6D 0x01 0x00 0x00 0x00
 */
function detectWasmType(buffer: Buffer): "proxy-wasm" | "http-wasm" {
  if (buffer.length < 8) {
    return "proxy-wasm";
  }
  // Component model magic: version bytes are 0x0a 0x00 0x01 0x00
  const isComponent =
    buffer[4] === 0x0a &&
    buffer[5] === 0x00 &&
    buffer[6] === 0x01 &&
    buffer[7] === 0x00;
  return isComponent ? "http-wasm" : "proxy-wasm";
}

/**
 * Create a headless runner from a file path.
 * Detects the WASM type automatically.
 */
export async function createRunner(
  wasmPath: string,
  config?: RunnerConfig,
): Promise<IWasmRunner> {
  const buffer = await readFile(wasmPath);
  return createRunnerFromBuffer(buffer, config);
}

/**
 * Create a headless runner from an in-memory buffer.
 * Detects the WASM type automatically.
 */
export async function createRunnerFromBuffer(
  buffer: Buffer,
  config?: RunnerConfig,
): Promise<IWasmRunner> {
  const wasmType = detectWasmType(buffer);

  let runner: IWasmRunner;
  if (wasmType === "http-wasm") {
    runner = new HttpWasmRunner(new PortManager(), config?.dotenvEnabled ?? false);
  } else {
    runner = new ProxyWasmRunner(undefined, config?.dotenvEnabled ?? false);
  }

  await runner.load(buffer, config);
  return runner;
}
