/**
 * eSCL Scanner Application
 * 애플리케이션 핵심 로직을 통합하는 클래스
 */

import { ESCLDiscovery } from "../services/discovery";
import { ESCLClient } from "../services/client";
import {
    IESCLScanner,
    IESCLCapabilities,
    IDiscoveryResponse,
    IApplicationConfig,
    IQuickScanParams,
    IESCLDiscoveryOptions,
} from "../types";

// Re-export types for convenience
export type { IApplicationConfig, IQuickScanParams };

/**
 * eSCL Scanner Application 클래스
 *
 * 스캐너 탐색, 기능 조회, 스캔 실행 등 핵심 기능을 통합 제공
 */
export class Application {
    private config: IApplicationConfig;
    private client: ESCLClient;
    private initialized: boolean = false;

    constructor(config: IApplicationConfig = {}) {
        this.config = {
            timeout: config.timeout || 15000,
            pythonPath: config.pythonPath,
            debug: config.debug || false,
        };

        this.client = new ESCLClient(this.config.timeout);
    }

    /**
     * 애플리케이션 초기화
     */
    async initialize(): Promise<void> {
        if (this.initialized) {
            return;
        }

        if (this.config.debug) {
            console.log("[eSCL] Application initializing...");
        }

        this.initialized = true;

        if (this.config.debug) {
            console.log("[eSCL] Application initialized");
        }
    }

    /**
     * 애플리케이션 종료
     */
    async shutdown(): Promise<void> {
        if (!this.initialized) {
            return;
        }

        if (this.config.debug) {
            console.log("[eSCL] Application shutting down...");
        }

        this.initialized = false;

        if (this.config.debug) {
            console.log("[eSCL] Application shutdown complete");
        }
    }

    /**
     * 네트워크에서 eSCL 스캐너 탐색
     * @param timeout 탐색 타임아웃 (ms)
     * @returns 발견된 스캐너 목록
     */
    async discoverScanners(timeout?: number): Promise<IDiscoveryResponse> {
        const discoveryTimeout = timeout || this.config.timeout;
        const options: IESCLDiscoveryOptions = {};

        if (this.config.pythonPath) {
            options.pythonPath = this.config.pythonPath;
        }

        const discovery = new ESCLDiscovery(discoveryTimeout, options);
        return discovery.startDiscovery(discoveryTimeout);
    }

    /**
     * 스캐너 기능 조회
     * @param scanner 대상 스캐너
     * @returns 스캐너 기능 정보
     */
    async getCapabilities(scanner: IESCLScanner): Promise<IESCLCapabilities | null> {
        return this.client.getCapabilities(scanner, this.config.debug);
    }

    /**
     * 스캔 작업 생성
     * @param scanner 대상 스캐너
     * @param dpi 해상도
     * @param colorMode 컬러 모드
     * @param source 스캔 소스
     * @param documentFormat 문서 포맷
     * @param width 너비 (mm)
     * @param height 높이 (mm)
     * @returns 스캔 작업 ID
     */
    async createScanJob(
        scanner: IESCLScanner,
        dpi: number,
        colorMode: string,
        source: string,
        documentFormat: string,
        width?: number,
        height?: number,
    ): Promise<string | null> {
        return this.client.createScanJob(scanner, dpi, colorMode, source, documentFormat, width, height);
    }

    /**
     * 스캔 작업 상태 조회
     * @param scanner 대상 스캐너
     * @param jobId 작업 ID
     * @returns 작업 상태
     */
    async getScanJobStatus(scanner: IESCLScanner, jobId: string) {
        return this.client.getScanJobStatus(scanner, jobId);
    }

    /**
     * 스캔 이미지 다운로드
     * @param scanner 대상 스캐너
     * @param imageUrl 이미지 URL
     * @returns 이미지 데이터
     */
    async downloadImage(scanner: IESCLScanner, imageUrl: string): Promise<Buffer | null> {
        return this.client.downloadImage(scanner, imageUrl);
    }

    /**
     * 간편 스캔 - 스캔 작업 생성부터 이미지 저장까지 한 번에 처리
     * @param params 스캔 파라미터
     * @returns 저장된 파일 경로 목록
     */
    async quickScan(params: IQuickScanParams): Promise<string[] | null> {
        const { scanner, dpi, mode, source, documentFormat, savePath, width, height, timeout } = params;

        const scanTimeout = timeout || this.config.timeout;

        // 컬러 모드 매핑
        const colorModeMap: Record<string, string> = {
            bw: "BlackAndWhite1",
            gray: "Grayscale8",
            color: "RGB24",
        };

        const colorMode = colorModeMap[mode];
        if (!colorMode) {
            throw new Error(`Invalid color mode: ${mode}`);
        }

        // 저장 경로 기본값
        const targetPath = savePath || process.cwd();

        try {
            // 1. 스캔 작업 생성
            const jobId = await this.createScanJob(scanner, dpi, colorMode, source, documentFormat, width, height);
            if (!jobId) {
                throw new Error("[SCAN_JOB_FAILED] 스캔 작업을 생성할 수 없습니다.");
            }

            const jobUrl = `http://${scanner.host}:${scanner.port}/eSCL/ScanJobs/${jobId}`;

            if (this.config.debug) {
                console.log(`[eSCL] Scan job created: ${jobUrl}`);
            }

            // 2. 스캔 완료 대기
            await this.delay(5000);

            // 3. 이미지 다운로드
            const filePaths: string[] = [];
            let pageNum = 1;
            const isAdf = source === "Feeder";

            while (true) {
                if (this.config.debug) {
                    console.log(`[eSCL] Downloading page ${pageNum}...`);
                }

                const imageBuffer = await this.downloadNextDocument(jobUrl, 30, 1000, isAdf);

                if (!imageBuffer) {
                    if (pageNum === 1) {
                        throw new Error("Failed to download scan result.");
                    }
                    break;
                }

                // 이미지 저장
                const filePath = await this.saveImage(targetPath, imageBuffer, pageNum, documentFormat);
                filePaths.push(filePath);

                if (!isAdf) {
                    break;
                }

                pageNum++;
            }

            // 4. 스캔 작업 삭제
            await this.deleteScanJob(jobUrl);

            return filePaths.length > 0 ? filePaths : null;
        } catch (error) {
            if (this.config.debug) {
                console.error("[eSCL] Quick scan failed:", error);
            }
            throw error;
        }
    }

    /**
     * 다음 문서 다운로드 (재시도 포함)
     */
    private async downloadNextDocument(
        jobUrl: string,
        maxRetries: number = 30,
        retryDelay: number = 1000,
        isAdf: boolean = false,
    ): Promise<Buffer | null> {
        const nextDocUrl = `${jobUrl}/NextDocument`;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                return await this.httpGetBinary(nextDocUrl);
            } catch (error: any) {
                const statusCode = error.code || parseInt(error.message?.match(/HTTP (\d+)/)?.[1]);

                if (statusCode === 404) {
                    return null;
                }

                if (statusCode === 409) {
                    if (this.config.debug) {
                        console.log(`[eSCL] Scanner busy, waiting... (${attempt}/${maxRetries})`);
                    }
                    await this.delay(retryDelay);
                    continue;
                }

                if (statusCode === 500 && isAdf) {
                    throw new Error("[ADF_NO_DOCUMENT] 문서가 급지기(ADF)에 올려져 있지 않습니다.");
                }

                return null;
            }
        }

        throw new Error("[SCANNER_BUSY] 스캐너가 다른 작업을 처리 중입니다.");
    }

    /**
     * 스캔 작업 삭제
     */
    private async deleteScanJob(jobUrl: string): Promise<void> {
        try {
            await this.httpDelete(jobUrl);
            if (this.config.debug) {
                console.log("[eSCL] Scan job deleted");
            }
        } catch {
            // 삭제 실패는 무시
        }
    }

    /**
     * 이미지 파일 저장
     */
    private async saveImage(
        folderPath: string,
        imageBuffer: Buffer,
        pageNum: number,
        documentFormat: string,
    ): Promise<string> {
        const fs = require("fs");
        const path = require("path");

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        let ext = documentFormat.split("/").pop()!;
        if (ext === "jpeg") ext = "jpg";

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, -5);
        const fileName = `scan_${timestamp}_page${pageNum}.${ext}`;
        const filePath = path.join(folderPath, fileName);

        fs.writeFileSync(filePath, imageBuffer);

        if (this.config.debug) {
            console.log(`[eSCL] Image saved: ${filePath}`);
        }

        return filePath;
    }

    /**
     * HTTP GET (바이너리)
     */
    private httpGetBinary(url: string): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            const http = require("http");
            const req = http.get(url, { timeout: this.config.timeout }, (res: any) => {
                const chunks: Buffer[] = [];
                res.on("data", (chunk: Buffer) => chunks.push(chunk));
                res.on("end", () => {
                    if (res.statusCode === 200) {
                        resolve(Buffer.concat(chunks));
                    } else {
                        const error: any = new Error(`HTTP ${res.statusCode}`);
                        error.code = res.statusCode;
                        reject(error);
                    }
                });
            });

            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });

            req.on("error", reject);
        });
    }

    /**
     * HTTP DELETE
     */
    private httpDelete(url: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const http = require("http");
            const req = http.request(url, { method: "DELETE", timeout: this.config.timeout }, (res: any) => {
                res.on("data", () => {});
                res.on("end", () => resolve());
            });

            req.on("timeout", () => {
                req.destroy();
                reject(new Error("Request timeout"));
            });

            req.on("error", reject);
            req.end();
        });
    }

    /**
     * 지연
     */
    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
