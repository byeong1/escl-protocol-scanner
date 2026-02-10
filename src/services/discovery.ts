/**
 * eSCL Scanner Discovery via Python Subprocess or Binary
 * Uses Python's zeroconf library for mDNS discovery
 * Prefers pre-built binary if available, falls back to Python script
 */

import { spawn, execSync, ChildProcess } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { IESCLScanner, TESCLCommand, IESCLResponse, IDiscoveryResponse, IESCLDiscoveryOptions } from "../types";

// Re-export for convenience
export type { IESCLDiscoveryOptions };

/**
 * eSCL Scanner Discovery Service
 * Spawns Python subprocess or binary to handle mDNS discovery using zeroconf
 */
export class ESCLDiscovery {
    private pythonProcess: ChildProcess | null = null;
    private discovered: Map<string, IESCLScanner> = new Map();
    private listeners: Set<(scanners: IESCLScanner[]) => void> = new Set();
    private timeout: number = 5000;
    private processReady: boolean = false;
    private pythonPath: string = "python3";
    private binaryPath: string | null = null;

    constructor(timeout?: number, options?: IESCLDiscoveryOptions) {
        if (timeout) {
            this.timeout = timeout;
        }
        this.pythonPath = options?.pythonPath || "python3";
        // pythonPath가 명시적으로 전달된 경우 바이너리보다 우선 사용
        this.binaryPath = options?.pythonPath ? null : this.getBinaryPath();
    }

    /**
     * Get path to pre-built binary if available
     * @returns Binary path or null if not found
     */
    private getBinaryPath(): string | null {
        const platform = process.platform; // 'win32', 'darwin', 'linux'
        const binDir = path.join(__dirname, "..", "..", "bin", platform);
        const binaryName = platform === "win32" ? "escl-scanner.exe" : "escl-scanner";
        const binaryPath = path.join(binDir, binaryName);

        if (fs.existsSync(binaryPath)) {
            return binaryPath;
        }
        return null;
    }

    /**
     * Validate Python path exists and is executable
     * Skipped if pre-built binary is available
     * @throws Error if Python path is invalid and no binary available
     */
    private validatePythonPath(): void {
        // Skip validation if binary is available
        if (this.binaryPath) {
            return;
        }

        // Absolute path → check file exists
        if (path.isAbsolute(this.pythonPath)) {
            if (!fs.existsSync(this.pythonPath)) {
                throw new Error(
                    `Python executable not found at: ${this.pythonPath}\n` +
                        `Please ensure the Python virtual environment exists or provide a valid python3 path.`,
                );
            }
            return;
        }

        // Relative path (contains separator) → resolve from cwd
        if (this.pythonPath.includes(path.sep) || this.pythonPath.includes("/")) {
            const resolvedPath = path.resolve(process.cwd(), this.pythonPath);
            if (!fs.existsSync(resolvedPath)) {
                throw new Error(
                    `Python executable not found at: ${resolvedPath}\n` +
                        `Current working directory: ${process.cwd()}\n` +
                        `Please ensure the Python virtual environment exists or provide a valid python3 path.`,
                );
            }
            return;
        }

        // Bare command name (e.g. 'python3') → resolve from PATH
        try {
            const cmd = process.platform === "win32" ? "where" : "which";
            execSync(`${cmd} ${this.pythonPath}`, { stdio: "ignore" });
        } catch {
            throw new Error(
                `Python command '${this.pythonPath}' not found in PATH.\n` +
                    `Set ESCL_PYTHON_PATH environment variable or provide pythonPath option.`,
            );
        }
    }

    /**
     * Start discovering scanners
     * @param timeout Optional timeout in milliseconds (default: 5000ms)
     * @returns Promise resolving with discovery response containing success status and scanner data
     */
    async startDiscovery(timeout?: number): Promise<IDiscoveryResponse> {
        const discoveryTimeout = timeout || this.timeout;

        return new Promise((resolve, reject) => {
            try {
                // Validate Python path before proceeding
                this.validatePythonPath();

                this.discovered.clear();
                let resolved = false;

                // Timeout fallback (in case Python doesn't respond)
                const timeoutHandle = setTimeout(() => {
                    if (!resolved) {
                        resolved = true;
                        this.stopDiscovery();
                        const scanners = Array.from(this.discovered.values());
                        resolve({
                            success: true,
                            data: scanners,
                        });
                    }
                }, discoveryTimeout);

                // Set up listener for Python response
                const responseHandler = (scanners: IESCLScanner[]) => {
                    if (!resolved) {
                        resolved = true;
                        clearTimeout(timeoutHandle);
                        this.offScannerDiscovered(responseHandler);
                        this.stopDiscovery();
                        resolve({
                            success: true,
                            data: scanners,
                        });
                    }
                };

                this.onScannerDiscovered(responseHandler);
                this.startPythonService();

                // Send list command to Python subprocess
                if (this.pythonProcess && this.pythonProcess.stdin) {
                    const command: TESCLCommand = { action: "list" };
                    this.pythonProcess.stdin.write(JSON.stringify(command) + "\n");
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
    getScanners(): IESCLScanner[] {
        return Array.from(this.discovered.values());
    }

    /**
     * Subscribe to scanner discovery updates
     */
    onScannerDiscovered(callback: (scanners: IESCLScanner[]) => void): void {
        this.listeners.add(callback);
    }

    /**
     * Unsubscribe from scanner discovery updates
     */
    offScannerDiscovered(callback: (scanners: IESCLScanner[]) => void): void {
        this.listeners.delete(callback);
    }

    /**
     * Start Python subprocess or binary for eSCL operations
     */
    private startPythonService(): void {
        if (this.pythonProcess) {
            return; // Already running
        }

        try {
            if (this.binaryPath) {
                // Use pre-built binary (production/package environment)
                console.log(`[eSCL] Using binary: ${this.binaryPath}`);
                this.pythonProcess = spawn(this.binaryPath, [], {
                    stdio: ["pipe", "pipe", "pipe"],
                    windowsHide: true,
                });
            } else {
                // Fall back to Python script (development environment)
                const pythonScriptPath = path.join(__dirname, "..", "..", "python", "__main__.py");
                console.log(`[eSCL] Using Python script: ${pythonScriptPath}`);
                this.pythonProcess = spawn(this.pythonPath, [pythonScriptPath], {
                    stdio: ["pipe", "pipe", "pipe"],
                    windowsHide: true,
                });
            }

            // Handle stdout - parse JSON responses
            if (this.pythonProcess.stdout) {
                this.pythonProcess.stdout.on("data", (data: Buffer) => {
                    try {
                        const lines = data.toString().split("\n");
                        for (const line of lines) {
                            if (line.trim()) {
                                const response: IESCLResponse = JSON.parse(line);
                                if (!response.success && response.error) {
                                    // Handle error response from Python
                                    console.error("[eSCL Error]", response.error);
                                } else if (response.success && response.scanners) {
                                    this.discovered.clear();
                                    for (const scanner of response.scanners) {
                                        this.discovered.set(scanner.name, scanner);
                                    }
                                    this.notifyListeners();
                                }
                            }
                        }
                    } catch (error) {
                        console.error("Error parsing Python response:", error);
                    }
                });
            }

            // Handle stderr - logging
            if (this.pythonProcess.stderr) {
                this.pythonProcess.stderr.on("data", (data: Buffer) => {
                    console.error("[eSCL Python]", data.toString());
                });
            }

            // Handle process exit
            this.pythonProcess.on("exit", (code) => {
                console.log(`[eSCL] Python subprocess exited with code ${code}`);
                this.pythonProcess = null;
                this.processReady = false;
            });

            this.processReady = true;
        } catch (error) {
            console.error("Failed to start Python service:", error);
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
                    const command: TESCLCommand = { action: "exit" };
                    this.pythonProcess.stdin.write(JSON.stringify(command) + "\n");
                }

                // Force kill after timeout
                setTimeout(() => {
                    if (this.pythonProcess) {
                        this.pythonProcess.kill();
                        this.pythonProcess = null;
                    }
                }, 1000);
            } catch (error) {
                console.error("Error during cleanup:", error);
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
 * @param options Discovery options including pythonPath
 * @returns Discovery response with success status and scanner data
 */
export async function discoverScanners(
    timeout: number = 5000,
    options?: IESCLDiscoveryOptions,
): Promise<IDiscoveryResponse> {
    const discovery = new ESCLDiscovery(timeout, options);
    return discovery.startDiscovery(timeout);
}
