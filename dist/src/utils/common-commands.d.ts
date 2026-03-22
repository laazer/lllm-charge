export interface CommandResult {
    success: boolean;
    output: string;
    command: string;
    executionTime: number;
    cost: number;
}
export interface CommandPattern {
    pattern: RegExp;
    handler: (match: RegExpMatchArray, cwd: string) => Promise<CommandResult>;
    description: string;
    examples: string[];
}
export declare class CommonCommandHandler {
    private patterns;
    constructor();
    handleCommand(input: string, cwd?: string): Promise<CommandResult | null>;
    getAvailableCommands(): Array<{
        pattern: string;
        description: string;
        examples: string[];
    }>;
    private initializePatterns;
    private handleGitCommitAndPush;
    private handleGitAddAll;
    private handleGitPush;
    private handleGitPull;
    private handleGitStatus;
    private handleCreateBranch;
    private handleNpmInstall;
    private handleNpmBuild;
    private handleNpmTest;
    private handleNpmDev;
    private handleListFiles;
    private handleCreateFileOrDir;
    private handleDeleteFile;
    private handleKillPort;
    private handleCheckPort;
    private handleDiskUsage;
    private handleFindFiles;
    private handleCurrentDirectory;
    private handleDockerCommand;
    private handleShowEnv;
    private handleNodeVersion;
    private handleNpmVersion;
    private handleMake;
    private handleGoTasks;
    private handleNpx;
    private handleGitHubCLI;
    private handleAWSCLI;
    private handleFileView;
    private handleGrep;
    private handleProcessCommands;
    private handleFileCopy;
    private handleFilePermissions;
    private handleDownload;
    private handleArchive;
    private handleShellInfo;
}
