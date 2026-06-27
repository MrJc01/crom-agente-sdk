import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DaemonManager } from '../../../src/manager/DaemonManager.js';
import { BinaryDownloader } from '../../../src/manager/BinaryDownloader.js';

vi.mock('../../../src/manager/BinaryDownloader', () => {
  return {
    BinaryDownloader: vi.fn().mockImplementation(() => ({
      getOsInfo: vi.fn().mockResolvedValue({ platform: 'linux', arch: 'x64' })
    }))
  };
});

describe('DaemonManager', () => {
  let shellMock: any;
  let fsMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    shellMock = {
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: 'mocked', stderr: '' }),
      spawn: vi.fn().mockResolvedValue({ 
        pid: 100,
        onStdout: vi.fn(),
        onStderr: vi.fn()
      }),
      kill: vi.fn().mockResolvedValue(true),
      isProcessRunning: vi.fn().mockResolvedValue(true)
    };
    fsMock = {
      exists: vi.fn().mockResolvedValue(true)
    };
  });

  it('should check if installed successfully', async () => {
    const manager = new DaemonManager(fsMock, shellMock);
    const installed = await manager.isInstalled();
    expect(installed).toBe(true);
    expect(fsMock.exists).toHaveBeenCalled();
  });

  it('should start the daemon', async () => {
    shellMock.isProcessRunning.mockResolvedValue(false);
    const manager = new DaemonManager(fsMock, shellMock);
    await manager.start();
    expect(shellMock.spawn).toHaveBeenCalled();
  });

  it('should stop the daemon', async () => {
    shellMock.isProcessRunning.mockResolvedValue(true);
    const manager = new DaemonManager(fsMock, shellMock);
    await manager.stop();
    expect(shellMock.exec).toHaveBeenCalledWith('pkill', ['-x', 'crom-agente']);
  });
});
