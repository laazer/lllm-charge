export interface IWorkflowBase {
    id?: string;
    name: string;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    versionId?: string;
}
export interface IConnections {
    [key: string]: {
        [type: string]: Array<Array<{
            node: string;
            type: string;
            index: number;
        }>>;
    };
}
export interface INodeExecutionData {
    [key: string]: any;
}
export interface IWorkflowExecuteAdditionalData {
    credentials: any;
    hooks?: any;
    httpRequest?: any;
    httpResponse?: any;
    restApiUrl?: string;
    instanceBaseUrl?: string;
    formWaitingBaseUrl?: string;
    webhookBaseUrl?: string;
    webhookWaitingBaseUrl?: string;
    webhookTestBaseUrl?: string;
    currentNodeParameters?: any;
    executionTimeoutTimestamp?: number;
    userId?: string;
}
export interface IDataObject {
    [key: string]: any;
}
export interface INodeParameters extends IDataObject {
    [key: string]: any;
}
