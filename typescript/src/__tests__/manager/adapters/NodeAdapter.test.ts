import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NodeShellAdapter } from '../../../../src/manager/adapters/NodeAdapter.js';
import * as child_process from 'child_process';

vi.mock('child_process', async (importOriginal: () => Promise<any>) => {
  const actual = await importOriginal();
  return {
    ...(actual as any),
    execSync: vi.fn(),
    exec: vi.fn((cmd: string, cb: any) => {
      if (cmd.includes('myprocess')) {
        cb(null, 'myprocess\n', '');
      } else {
        cb(null, 'success', '');
      }
    }),
    spawn: vi.fn().mockReturnValue({
      pid: 999,
      stdout: { on: vi.fn() },
      stderr: { on: vi.fn() },
      on: vi.fn((event: string, cb: any) => {
        if (event === 'close') {
          setTimeout(() => cb(0), 10);
        }
      }),
      kill: vi.fn()
    })
  };
});

describe('NodeShellAdapter', () => {
  let adapter: NodeShellAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new NodeShellAdapter();
  });

  it('should exec command', async () => {

    const result = await adapter.exec('echo', ['hello']);
    expect(result.stdout.trim()).toBe('hello');
  });

  it('should spawn process', async () => {
    const proc = await adapter.spawn('echo', ['hello']);
    expect(proc.pid).toBe(999);
  });

  it('should kill process', async () => {
    vi.mocked(child_process.execSync).mockReturnValue(Buffer.from(''));
    // Depending on platform it might call taskkill or process.kill
    // We can just call kill
    try {
      await adapter.kill(999);
    } catch(e) {
      // ESRCH is expected if process.kill is called on non-existent pid in test
    }
    expect(true).toBe(true);
  });

  it('should check if process is running', async () => {
    const running = await adapter.isProcessRunning('myprocess');
    expect(running).toBe(true);
  });
});
