import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BinaryDownloader } from '../../../src/manager/BinaryDownloader.js';

// Polyfill fetch for tests
global.fetch = vi.fn();

describe('BinaryDownloader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch latest release from GitHub', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        tag_name: 'v1.2.3',
        assets: [
          { name: 'crom-agente-linux-amd64', browser_download_url: 'http://example.com/linux' }
        ]
      })
    });

    const downloader = new BinaryDownloader();
    const release = await downloader.fetchLatestGithubRelease();

    expect(release.tag_name).toBe('v1.2.3');
    expect(global.fetch).toHaveBeenCalledWith('https://api.github.com/repos/MrJc01/crom-agente/releases/latest');
  });

  it('should fail gracefully if github api fails', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      statusText: 'API error'
    });

    const downloader = new BinaryDownloader();
    await expect(downloader.fetchLatestGithubRelease()).rejects.toThrow('API error');
  });
});
