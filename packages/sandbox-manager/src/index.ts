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

import { spawn, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

let cachedPythonCommand: string | null = null;
export function getPythonCommand(): string {
  if (cachedPythonCommand) return cachedPythonCommand;
  const cmds = process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'];
  for (const cmd of cmds) {
    try {
      const res = spawnSync(cmd, ['--version'], { encoding: 'utf-8', timeout: 2000 });
      if (res && (res.status === 0 || !res.error)) {
        cachedPythonCommand = cmd;
        return cmd;
      }
    } catch (e) {}
  }
  return process.platform === 'win32' ? 'python' : 'python3';
}

export function isCompilerAvailable(language: string): boolean {
  if (language === 'python' || language === 'javascript' || language === 'typescript' || language === 'sql') {
    return true;
  }
  let bin = '';
  if (language === 'go') bin = 'go';
  else if (language === 'cpp') bin = 'g++';
  else if (language === 'swift') bin = 'swiftc';
  if (!bin) return false;

  try {
    const res = spawnSync(bin, ['--version'], { encoding: 'utf-8', timeout: 2000 });
    return res.status === 0 || res.error === undefined;
  } catch (e) {
    return false;
  }
}

export class LocalProcessExecutionBackend implements ExecutionBackend {
  readonly id = 'local-process';
  readonly securityLevel = 'TRUSTED_LOCAL_ONLY';

  private activeProcesses = new Map<string, { harness: string, timeoutMs: number, sourceCode?: string, targetId?: string }>();
  private tempFiles = new Map<string, string[]>();

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
    this.tempFiles.set(id, []);
    return { id, status: 'PREPARED', language: request.language };
  }

  async execute(sandbox: SandboxHandle, request: ExecutionRequest): Promise<RawExecutionResult> {
    const processData = this.activeProcesses.get(sandbox.id);
    if (!processData) throw new Error('Sandbox not found');

    if (sandbox.language === 'javascript' || sandbox.language === 'typescript') {
      return new Promise((resolve) => {
        const start = Date.now();
        try {
          const vm = require('vm');
          if (!processData.sourceCode) throw new Error("No source code available");
          
          let codeToRun = processData.sourceCode;
          if (sandbox.language === 'typescript') {
            try {
              const ts = require('typescript');
              const transpiled = ts.transpileModule(codeToRun, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
              codeToRun = transpiled.outputText;
            } catch (e) {
              // Fallback if ts module failed
            }
          }

          const context = {
            console: { log: () => {} },
            Math, Date, JSON, String, Object, Array, Number, Error, TypeError, RangeError, SyntaxError, ReferenceError, Buffer,
            require: (m: string) => { if(m==='crypto') return require('crypto'); if(m==='buffer') return require('buffer'); return {}; }
          };
          vm.createContext(context);
          vm.runInContext(codeToRun, context);
          
          const inputStr = request.inputData.trim();
          const targetName = processData.targetId || 'global';
          
          const harnessExec = `
            (function() {
               function _omega_resolve_bytes(val) {
                 if (val && typeof val === 'object') {
                   if (val.__omega_bytes_hex) return Buffer.from(val.__omega_bytes_hex, 'hex');
                   if (val.__omega_bytes_base64) return Buffer.from(val.__omega_bytes_base64, 'base64');
                   if (Array.isArray(val)) return val.map(_omega_resolve_bytes);
                   for (const k of Object.keys(val)) {
                     val[k] = _omega_resolve_bytes(val[k]);
                   }
                 }
                 return val;
               }
               try {
                 let input = ${inputStr};
                 input = _omega_resolve_bytes(input);
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

    if (sandbox.language && !isCompilerAvailable(sandbox.language)) {
      return Promise.resolve({
        exitCode: 1,
        terminationSignal: null,
        stdout: '',
        stderr: JSON.stringify({ error: `Native compiler for language '${sandbox.language}' is not installed or not available in PATH on this runtime host.`, code: 'COMPILER_UNAVAILABLE' }),
        wallClockDurationMs: 0,
        timeoutStatus: false,
        oomStatus: false,
        outputLimitStatus: false,
        sandboxPolicyViolation: false
      });
    }

    return new Promise((resolve) => {
      let ext = 'js';
      let cmd = 'node';
      let args: string[] = [];
      let binaryPath = '';

      if (sandbox.language === 'python') {
        ext = 'py';
        cmd = getPythonCommand();
      } else if (sandbox.language === 'javascript') {
        ext = 'js';
        cmd = 'node';
      } else if (sandbox.language === 'go') {
        ext = 'go';
        cmd = 'go';
        args = ['run'];
      } else if (sandbox.language === 'cpp') {
        ext = 'cpp';
        binaryPath = path.join(os.tmpdir(), `fuzz_${sandbox.id}_${Math.random().toString(36).substring(7)}.exe`);
        cmd = binaryPath;
      } else if (sandbox.language === 'swift') {
        ext = 'swift';
        binaryPath = path.join(os.tmpdir(), `fuzz_${sandbox.id}_${Math.random().toString(36).substring(7)}.exe`);
        cmd = binaryPath;
      } else if (sandbox.language === 'sql') {
        ext = 'py';
        cmd = getPythonCommand();
        const rawSql = processData.harness.replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
        processData.harness = `
import sqlite3, sys, json
try:
    conn = sqlite3.connect(':memory:')
    cursor = conn.cursor()
    script = """${rawSql}"""
    try:
        cursor.executescript(script)
    except Exception:
        pass
    input_data = sys.stdin.read().strip()
    if input_data:
        try:
            payload = json.loads(input_data)
            query = payload.get("query", payload) if isinstance(payload, dict) else str(payload)
        except Exception:
            query = str(input_data)
        cursor.executescript(str(query))
    print(json.dumps({"status": "success"}))
except Exception as e:
    print(json.dumps({"status": "error", "type": type(e).__name__, "message": str(e)}))
`;
      }
      
      const tempScriptPath = path.join(os.tmpdir(), `fuzz_${sandbox.id}_${Math.random().toString(36).substring(7)}.${ext}`);
      fs.writeFileSync(tempScriptPath, processData.harness);

      const trackList = this.tempFiles.get(sandbox.id) || [];
      trackList.push(tempScriptPath);
      if (binaryPath) trackList.push(binaryPath);
      this.tempFiles.set(sandbox.id, trackList);

      const cleanup = () => {
        try { if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath); } catch(e) {}
        try { if (binaryPath && fs.existsSync(binaryPath)) fs.unlinkSync(binaryPath); } catch(e) {}
      };

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

        if (compileResult?.error && (compileResult.error as any).code === 'ETIMEDOUT' || compileDuration >= 10000) {
           cleanup();
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
           cleanup();
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
      if (sandbox.language !== 'cpp' && sandbox.language !== 'swift') spawnArgs.push(tempScriptPath);
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
          cleanup();
          console.error(`[${new Date().toISOString()}] [ERROR] Subprocess (${cmd}) timed out after 10 seconds. Killed subprocess.`);

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
        cleanup();

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
        cleanup();
        
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
    const files = this.tempFiles.get(sandbox.id) || [];
    files.forEach(f => {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch(e) {}
    });
    this.tempFiles.delete(sandbox.id);
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
      child.on('close', (code: number | null) => resolve(code === 0));
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
