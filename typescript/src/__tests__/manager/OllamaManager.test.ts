import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OllamaManager } from '../../../src/manager/OllamaManager.js';

vi.mock('../../../src/manager/BinaryDownloader', () => {
  return {
    BinaryDownloader: vi.fn().mockImplementation(() => ({
      getOsInfo: vi.fn().mockResolvedValue({ platform: 'linux', arch: 'x64' })
    }))
  };
});

describe('OllamaManager', () => {
  let shellMock: any;
  let fsMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    shellMock = {
      exec: vi.fn().mockResolvedValue({ code: 0, stdout: 'ollama version is 0.0.1', stderr: '' }),
      spawn: vi.fn().mockResolvedValue({ pid: 200 }),
      kill: vi.fn().mockResolvedValue(true),
      isProcessRunning: vi.fn().mockResolvedValue(true)
    };
    fsMock = {
      exists: vi.fn().mockResolvedValue(true)
    };
  });

  it('should check if installed', async () => {
    const manager = new OllamaManager(fsMock, shellMock);
    const installed = await manager.isInstalled();
    expect(installed).toBe(true);
    expect(shellMock.exec).toHaveBeenCalled();
  });

  it('should start ollama', async () => {
    shellMock.isProcessRunning.mockResolvedValue(false);
    const manager = new OllamaManager(fsMock, shellMock);
    await manager.start();
    expect(shellMock.spawn).toHaveBeenCalled();
  });

  it('should stop ollama', async () => {
    shellMock.isProcessRunning.mockResolvedValue(true);
    const manager = new OllamaManager(fsMock, shellMock);
    await manager.stop();
    expect(shellMock.exec).toHaveBeenCalledWith('pkill', ['-x', 'ollama']);
  });
});
