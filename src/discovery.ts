/**
 * eSCL Scanner Discovery via Python Subprocess
 * Uses Python's zeroconf library for mDNS discovery
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import { ESCLScanner, ESCLCommand, ESCLResponse } from './types';

/**
 * eSCL Scanner Discovery Service
 * Spawns Python subprocess to handle mDNS discovery using zeroconf
 */
export class ESCLDiscovery {
  private pythonProcess: ChildProcess | null = null;
  private discovered: Map<string, ESCLScanner> = new Map();
  private listeners: Set<(scanners: ESCLScanner[]) => void> = new Set();
  private timeout: number = 5000;
  private processReady: boolean = false;

  constructor(timeout?: number) {
    if (timeout) {
      this.timeout = timeout;
    }
  }

  /**
   * Start discovering scanners
   * @returns Promise resolving when discovery timeout completes
   */
  async startDiscovery(): Promise<ESCLScanner[]> {
    return new Promise((resolve, reject) => {
      try {
        this.discovered.clear();
        this.startPythonService();

        // Send discovery command after short delay to ensure process is ready
        const discoveryTimeout = setTimeout(() => {
          this.stopDiscovery();
          resolve(Array.from(this.discovered.values()));
        }, this.timeout);

        // Send list command to Python subprocess
        if (this.pythonProcess && this.pythonProcess.stdin) {
          const command: ESCLCommand = { action: 'list' };
          this.pythonProcess.stdin.write(JSON.stringify(command) + '\n');
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop active discovery and cleanup subprocess
   */
  stopDiscovery(): void {
    this.cleanup();
  }

  /**
   * Get currently discovered scanners
   */
  getScanners(): ESCLScanner[] {
    return Array.from(this.discovered.values());
  }

  /**
   * Subscribe to scanner discovery updates
   */
  onScannerDiscovered(callback: (scanners: ESCLScanner[]) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Unsubscribe from scanner discovery updates
   */
  offScannerDiscovered(callback: (scanners: ESCLScanner[]) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Start Python subprocess for eSCL operations
   */
  private startPythonService(): void {
    if (this.pythonProcess) {
      return; // Already running
    }

    try {
      // Get path to Python script relative to this module
      const pythonScriptPath = path.join(__dirname, '..', 'python', 'escl_main.py');

      this.pythonProcess = spawn('python3', [pythonScriptPath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      });

      // Handle stdout - parse JSON responses
      if (this.pythonProcess.stdout) {
        this.pythonProcess.stdout.on('data', (data: Buffer) => {
          try {
            const lines = data.toString().split('\n');
            for (const line of lines) {
              if (line.trim()) {
                const response: ESCLResponse = JSON.parse(line);
                if (response.success && response.scanners) {
                  this.discovered.clear();
                  for (const scanner of response.scanners) {
                    this.discovered.set(scanner.name, scanner);
                  }
                  this.notifyListeners();
                }
              }
            }
          } catch (error) {
            console.error('Error parsing Python response:', error);
          }
        });
      }

      // Handle stderr - logging
      if (this.pythonProcess.stderr) {
        this.pythonProcess.stderr.on('data', (data: Buffer) => {
          console.error('[eSCL Python]', data.toString());
        });
      }

      // Handle process exit
      this.pythonProcess.on('exit', (code) => {
        console.log(`[eSCL] Python subprocess exited with code ${code}`);
        this.pythonProcess = null;
        this.processReady = false;
      });

      this.processReady = true;
    } catch (error) {
      console.error('Failed to start Python service:', error);
      this.pythonProcess = null;
    }
  }

  /**
   * Cleanup Python subprocess
   */
  private cleanup(): void {
    if (this.pythonProcess) {
      try {
        // Send exit command
        if (this.pythonProcess.stdin) {
          const command: ESCLCommand = { action: 'exit' };
          this.pythonProcess.stdin.write(JSON.stringify(command) + '\n');
        }

        // Force kill after timeout
        setTimeout(() => {
          if (this.pythonProcess) {
            this.pythonProcess.kill();
            this.pythonProcess = null;
          }
        }, 1000);
      } catch (error) {
        console.error('Error during cleanup:', error);
        if (this.pythonProcess) {
          this.pythonProcess.kill();
          this.pythonProcess = null;
        }
      }
    }
    this.processReady = false;
  }

  /**
   * Notify all listeners of scanner changes
   */
  private notifyListeners(): void {
    const scanners = Array.from(this.discovered.values());
    this.listeners.forEach((callback) => {
      callback(scanners);
    });
  }
}

/**
 * Convenience function for quick scanner discovery
 * @param timeout Discovery timeout in milliseconds (default: 5000)
 * @returns Array of discovered scanners
 */
export async function discoverScanners(timeout: number = 5000): Promise<ESCLScanner[]> {
  const discovery = new ESCLDiscovery(timeout);
  return discovery.startDiscovery();
}
