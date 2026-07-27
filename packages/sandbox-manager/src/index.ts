import {
  RawExecutionResult
} from '@omega-fuzz/canonical-model';

export interface SandboxRequest {
  targetId: string;
  sourceCode: string;
  harnessCode: string;
  timeoutMs: number;
  memoryLimitMb: number;
  language?: string;
}

export interface SandboxHandle {
  id: string;
  status: 'PREPARED' | 'RUNNING' | 'DESTROYED';
  language?: string;
}

export interface ExecutionRequest {
  inputData: string; // Serialized Canonical Input
}

export interface ExecutionBackend {
  readonly id: string;
  readonly securityLevel:
    | 'TRUSTED_LOCAL_ONLY'
    | 'PROCESS_ISOLATED'
    | 'CONTAINER_ISOLATED'
    | 'HARDENED_SANDBOX';

  isAvailable(): Promise<boolean>;
  prepare(request: SandboxRequest): Promise<SandboxHandle>;
  execute(sandbox: SandboxHandle, request: ExecutionRequest): Promise<RawExecutionResult>;
  destroy(sandbox: SandboxHandle): Promise<void>;
}

import { spawn } from 'child_process';

export class LocalProcessExecutionBackend implements ExecutionBackend {
  readonly id = 'local-process';
  readonly securityLevel = 'TRUSTED_LOCAL_ONLY';

  private activeProcesses = new Map<string, { harness: string, timeoutMs: number, sourceCode?: string, targetId?: string }>();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async prepare(request: SandboxRequest): Promise<SandboxHandle> {
    const id = Math.random().toString(36).substring(7);
    this.activeProcesses.set(id, { 
      harness: request.harnessCode, 
      timeoutMs: request.timeoutMs, 
      sourceCode: request.sourceCode,
      targetId: request.targetId
    });
    return { id, status: 'PREPARED', language: request.language };
  }

  async execute(sandbox: SandboxHandle, request: ExecutionRequest): Promise<RawExecutionResult> {
    const processData = this.activeProcesses.get(sandbox.id);
    if (!processData) throw new Error('Sandbox not found');

    if (sandbox.language === 'javascript') {
      return new Promise((resolve) => {
        const start = Date.now();
        try {
          const vm = require('vm');
          if (!processData.sourceCode) throw new Error("No source code available");
          
          const context = {
            console: { log: () => {} },
            Math, Date, JSON, String, Object, Array, Number, Error, TypeError, RangeError, SyntaxError, ReferenceError,
            require: (m: string) => { if(m==='crypto') return require('crypto'); return {}; }
          };
          vm.createContext(context);
          vm.runInContext(processData.sourceCode, context);
          
          const inputStr = request.inputData.trim();
          const targetName = processData.targetId || 'global';
          
          const harnessExec = `
            (function() {
               try {
                 const input = ${inputStr};
                 let result = null;
                 if (typeof ${targetName} === 'function') {
                    result = ${targetName}(input);
                 } else {
                    const keys = Object.keys(globalThis).filter(k => typeof globalThis[k] === 'function');
                    if(keys.length > 0) result = globalThis[keys[0]](input);
                 }
                 return JSON.stringify({ status: "success" });
               } catch(e) {
                 return JSON.stringify({ status: "error", type: e.name, message: e.message, trace: e.stack ? e.stack.split('\\n') : [] });
               }
            })()
          `;
          
          const result = vm.runInContext(harnessExec, context, { timeout: processData.timeoutMs });
          
          resolve({
             exitCode: 0,
             terminationSignal: null,
             stdout: result + '\\n',
             stderr: '',
             wallClockDurationMs: Date.now() - start,
             timeoutStatus: false,
             oomStatus: false,
             outputLimitStatus: false,
             sandboxPolicyViolation: false
          });
        } catch (e: any) {
          resolve({
             exitCode: 1,
             terminationSignal: null,
             stdout: '',
             stderr: e.message || String(e),
             wallClockDurationMs: Date.now() - start,
             timeoutStatus: e.message && e.message.includes('timeout'),
             oomStatus: false,
             outputLimitStatus: false,
             sandboxPolicyViolation: false
          });
        }
      });
    }

    return new Promise((resolve) => {
      const fs = require('fs');
      const path = require('path');
      const { spawnSync } = require('child_process');
      
      let ext = 'js';
      let cmd = 'node';
      let args: string[] = [];
      let binaryPath = '';

      if (sandbox.language === 'python') {
        ext = 'py';
        cmd = process.platform === 'win32' ? 'python' : 'python3';
      } else if (sandbox.language === 'javascript') {
        ext = 'js';
        cmd = 'node';
      } else if (sandbox.language === 'go') {
        ext = 'go';
        cmd = 'go';
        args = ['run'];
      } else if (sandbox.language === 'cpp') {
        ext = 'cpp';
        binaryPath = path.join(require('os').tmpdir(), `fuzz_${sandbox.id}.exe`);
        cmd = binaryPath;
      } else if (sandbox.language === 'swift') {
        ext = 'swift';
        binaryPath = path.join(require('os').tmpdir(), `fuzz_${sandbox.id}.exe`); // Windows swiftc produces .exe
        cmd = binaryPath;
      } else if (sandbox.language === 'sql') {
        // We wrap the SQL script inside a python script that uses the built-in sqlite3!
        ext = 'py';
        cmd = 'python';
        const rawSql = processData.harness.replace(/'/g, "''"); // Escape quotes for the python string
        processData.harness = `
import sqlite3, sys, json
try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    # Execute the raw harness SQL first (e.g. schema creation)
    script = """${rawSql}"""
    cursor.executescript(script)
    # The input will be the actual query we fuzz against the schema
    input_data = sys.argv[1] if len(sys.argv) > 1 else ""
    cursor.executescript(json.loads(input_data))
    print(json.dumps({"status": "success"}))
except Exception as e:
    print(json.dumps({"status": "error", "type": type(e).__name__, "message": str(e)}))
`;
      }
      
      const tempScriptPath = path.join(require('os').tmpdir(), `fuzz_${sandbox.id}.${ext}`);
      fs.writeFileSync(tempScriptPath, processData.harness);

      if (sandbox.language === 'cpp' || sandbox.language === 'swift') {
        let compileArgs: string[] = [];
        let compiler = '';
        if (sandbox.language === 'cpp') {
            compiler = 'g++';
            compileArgs = ['-o', binaryPath, tempScriptPath];
        } else {
            compiler = 'swiftc';
            compileArgs = ['-o', binaryPath, tempScriptPath];
        }
        
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess start: spawnSync(${compiler})`);
        const compileStart = Date.now();
        const compileResult = spawnSync(compiler, compileArgs, { timeout: 10000, encoding: 'utf-8' });
        const compileDuration = Date.now() - compileStart;

        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${compiler}) execution time: ${compileDuration}ms`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${compiler}) exit code: ${compileResult?.status ?? null}`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${compiler}) stdout: ${String(compileResult?.stdout || '').slice(0, 500)}`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${compiler}) stderr: ${String(compileResult?.stderr || compileResult?.error?.message || '').slice(0, 500)}`);

        if (compileResult?.error && (compileResult.error as any).code === 'ETIMEDOUT' || compileDuration >= 10000) {
           console.error(`[${new Date().toISOString()}] [ERROR] Subprocess (${compiler}) timed out after 10000ms`);
           return resolve({
             exitCode: null,
             terminationSignal: 'SIGKILL',
             stdout: String(compileResult?.stdout || ''),
             stderr: JSON.stringify({ error: `Subprocess (${compiler}) timed out after 10 seconds`, code: 'TIMEOUT_EXPIRED', timeoutMs: 10000 }),
             wallClockDurationMs: compileDuration,
             timeoutStatus: true,
             oomStatus: false,
             outputLimitStatus: false,
             sandboxPolicyViolation: false
           });
        }

        if (compileResult.status !== 0) {
           return resolve({
             exitCode: compileResult.status ?? 1,
             terminationSignal: null,
             stdout: String(compileResult.stdout || ''),
             stderr: 'Compilation failed: ' + String(compileResult.stderr || compileResult.error?.message || ''),
             wallClockDurationMs: compileDuration,
             timeoutStatus: false,
             oomStatus: false,
             outputLimitStatus: false,
             sandboxPolicyViolation: false
           });
        }
      }

      console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess start: spawn(${cmd})`);
      const startTime = Date.now();
      const spawnArgs = [...args];
      if (sandbox.language !== 'cpp') spawnArgs.push(tempScriptPath);
      const child = spawn(cmd, spawnArgs);
      
      let stdout = '';
      let stderr = '';

      if (child.stdin) {
          child.stdin.on('error', (err: any) => { /* ignore EPIPE */ });
          if (request.inputData && !child.stdin.destroyed) {
              try {
                  child.stdin.write(request.inputData);
              } catch(e) {}
          }
          try {
              child.stdin.end();
          } catch(e) {}
      }

      if (child.stdout) {
          child.stdout.on('data', (data: any) => stdout += data.toString());
      }
      if (child.stderr) {
          child.stderr.on('data', (data: any) => stderr += data.toString());
      }

      let finished = false;
      const timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true;
          const execDuration = Date.now() - startTime;
          try { child.kill('SIGKILL'); } catch(e) {}
          console.error(`[${new Date().toISOString()}] [ERROR] Subprocess (${cmd}) timed out after 10 seconds. Killed subprocess.`);
          console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) execution time: ${execDuration}ms`);
          console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) exit code: null (SIGKILL)`);
          console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stdout: ${stdout.slice(0, 500)}`);
          console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stderr: ${stderr.slice(0, 500)}`);

          resolve({
            exitCode: null,
            terminationSignal: 'SIGKILL',
            stdout,
            stderr: JSON.stringify({ error: `Subprocess (${cmd}) execution timed out after 10 seconds`, code: 'TIMEOUT_EXPIRED', timeoutMs: 10000 }),
            wallClockDurationMs: execDuration,
            timeoutStatus: true,
            oomStatus: false,
            outputLimitStatus: false,
            sandboxPolicyViolation: false
          });
        }
      }, 10000);

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        const execDuration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) finished - execution time: ${execDuration}ms`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) exit code: ${code}`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stdout: ${stdout.slice(0, 500)}`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stderr: ${stderr.slice(0, 500)}`);

        resolve({
          exitCode: code,
          terminationSignal: signal,
          stdout,
          stderr,
          wallClockDurationMs: execDuration,
          timeoutStatus: false,
          oomStatus: false,
          outputLimitStatus: false,
          sandboxPolicyViolation: false
        });
      });

      child.on('error', (err: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        const execDuration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) errored - execution time: ${execDuration}ms`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) exit code: null`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stdout: ${stdout.slice(0, 500)}`);
        console.log(`[${new Date().toISOString()}] [DEBUG] Subprocess (${cmd}) stderr: ${err.message}`);
        
        resolve({
          exitCode: null,
          terminationSignal: null,
          stdout,
          stderr: JSON.stringify({ error: err.message, code: 'SUBPROCESS_ERROR' }),
          wallClockDurationMs: execDuration,
          timeoutStatus: false,
          oomStatus: false,
          outputLimitStatus: false,
          sandboxPolicyViolation: false
        });
      });
    });
  }

  async destroy(sandbox: SandboxHandle): Promise<void> {
    this.activeProcesses.delete(sandbox.id);
    sandbox.status = 'DESTROYED';
  }
}

export class DockerExecutionBackend implements ExecutionBackend {
  readonly id = 'docker-process';
  readonly securityLevel = 'CONTAINER_ISOLATED';

  private activeContainers = new Map<string, { harness: string, timeoutMs: number, memoryLimitMb: number }>();

  async isAvailable(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('docker', ['--version']);
      child.on('close', (code) => resolve(code === 0));
      child.on('error', () => resolve(false));
    });
  }

  async prepare(request: SandboxRequest): Promise<SandboxHandle> {
    const id = Math.random().toString(36).substring(7);
    this.activeContainers.set(id, { 
       harness: request.harnessCode, 
       timeoutMs: request.timeoutMs,
       memoryLimitMb: request.memoryLimitMb
    });
    return { id, status: 'PREPARED' };
  }

  async execute(sandbox: SandboxHandle, request: ExecutionRequest): Promise<RawExecutionResult> {
    const containerData = this.activeContainers.get(sandbox.id);
    if (!containerData) throw new Error('Sandbox not found');

    // In a real implementation we would write the harness to a temp file and mount it, 
    // or pass it via base64. Here we simulate the secure execution call.
    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn('docker', [
        'run',
        '--rm',
        '-i',
        '--network', 'none',
        '--read-only',
        '--memory', `${containerData.memoryLimitMb}m`,
        '--pids-limit', '64',
        '--security-opt', 'no-new-privileges',
        'python:3.10-slim',
        'python', '-c', containerData.harness
      ]);
      
      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data: any) => stdout += data.toString());
      child.stderr.on('data', (data: any) => stderr += data.toString());

      let finished = false;
      const timeoutId = setTimeout(() => {
        if (!finished) {
          finished = true;
          child.kill('SIGKILL');
          resolve({
            exitCode: null,
            terminationSignal: 'SIGKILL',
            stdout,
            stderr,
            wallClockDurationMs: Date.now() - startTime,
            timeoutStatus: true,
            oomStatus: false, // We'd ideally check container exit status for OOM
            outputLimitStatus: false,
            sandboxPolicyViolation: false
          });
        }
      }, containerData.timeoutMs);

      child.on('close', (code: number | null, signal: NodeJS.Signals | null) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);

        resolve({
          exitCode: code,
          terminationSignal: signal,
          stdout,
          stderr,
          wallClockDurationMs: Date.now() - startTime,
          timeoutStatus: false,
          oomStatus: code === 137, // Typical OOM killer code
          outputLimitStatus: false,
          sandboxPolicyViolation: false
        });
      });

      child.on('error', (err: Error) => {
        if (finished) return;
        finished = true;
        clearTimeout(timeoutId);
        
        resolve({
          exitCode: null,
          terminationSignal: null,
          stdout,
          stderr: err.message,
          wallClockDurationMs: Date.now() - startTime,
          timeoutStatus: false,
          oomStatus: false,
          outputLimitStatus: false,
          sandboxPolicyViolation: false
        });
      });

      child.stdin.write(request.inputData);
      child.stdin.end();
    });
  }

  async destroy(sandbox: SandboxHandle): Promise<void> {
    this.activeContainers.delete(sandbox.id);
    sandbox.status = 'DESTROYED';
  }
}
