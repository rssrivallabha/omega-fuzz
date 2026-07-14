import {
  RawExecutionResult
} from '@omega-fuzz/canonical-model';

export interface SandboxRequest {
  targetId: string;
  sourceCode: string;
  harnessCode: string;
  timeoutMs: number;
  memoryLimitMb: number;
}

export interface SandboxHandle {
  id: string;
  status: 'PREPARED' | 'RUNNING' | 'DESTROYED';
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

  private activeProcesses = new Map<string, { harness: string, timeoutMs: number }>();

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async prepare(request: SandboxRequest): Promise<SandboxHandle> {
    const id = Math.random().toString(36).substring(7);
    this.activeProcesses.set(id, { harness: request.harnessCode, timeoutMs: request.timeoutMs });
    return { id, status: 'PREPARED' };
  }

  async execute(sandbox: SandboxHandle, request: ExecutionRequest): Promise<RawExecutionResult> {
    const processData = this.activeProcesses.get(sandbox.id);
    if (!processData) throw new Error('Sandbox not found');

    return new Promise((resolve) => {
      const startTime = Date.now();
      const child = spawn('python', ['-c', processData.harness]);
      
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
            oomStatus: false,
            outputLimitStatus: false,
            sandboxPolicyViolation: false
          });
        }
      }, processData.timeoutMs);

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
          oomStatus: false,
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
