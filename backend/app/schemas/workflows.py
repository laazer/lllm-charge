"""
Pydantic schemas for workflow management
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, Any, List
from datetime import datetime
from app.database.models.workflows import WorkflowStatus, WorkflowType


class WorkflowNode(BaseModel):
    """Schema for workflow nodes"""
    id: str = Field(..., description="Node ID")
    type: str = Field(..., description="Node type")
    name: str = Field(..., description="Node name")
    position: Dict[str, float] = Field(..., description="Node position (x, y)")
    data: Dict[str, Any] = Field(default_factory=dict, description="Node data")


class WorkflowEdge(BaseModel):
    """Schema for workflow edges (connections)"""
    id: str = Field(..., description="Edge ID")
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Edge data")


class WorkflowTrigger(BaseModel):
    """Schema for workflow triggers"""
    type: str = Field(..., description="Trigger type")
    config: Dict[str, Any] = Field(default_factory=dict, description="Trigger configuration")


class WorkflowSettings(BaseModel):
    """Schema for workflow settings"""
    auto_start: bool = Field(default=False, description="Auto-start workflow")
    retry_policy: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Retry configuration")
    error_handling: str = Field(default="pause_and_notify", description="Error handling strategy")
    timeout: int = Field(default=3600, description="Timeout in seconds")
    concurrency: int = Field(default=1, description="Concurrent execution limit")


class WorkflowBase(BaseModel):
    """Base workflow schema"""
    name: str = Field(..., min_length=1, max_length=255, description="Workflow name")
    description: Optional[str] = Field(None, description="Workflow description")
    status: WorkflowStatus = Field(default=WorkflowStatus.DRAFT, description="Workflow status")
    workflow_type: WorkflowType = Field(default=WorkflowType.MANUAL, description="Workflow type")
    project_id: Optional[str] = Field(None, description="Associated project ID")
    nodes: Optional[List[WorkflowNode]] = Field(default_factory=list, description="Workflow nodes")
    edges: Optional[List[WorkflowEdge]] = Field(default_factory=list, description="Workflow connections")
    triggers: Optional[List[WorkflowTrigger]] = Field(default_factory=list, description="Workflow triggers")
    settings: Optional[WorkflowSettings] = Field(default_factory=WorkflowSettings, description="Workflow settings")
    is_enabled: bool = Field(default=True, description="Workflow enabled status")
    max_retries: int = Field(default=3, ge=0, description="Maximum retry attempts")
    timeout_seconds: int = Field(default=3600, ge=1, description="Execution timeout")


class WorkflowCreate(WorkflowBase):
    """Schema for creating workflows"""
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Workflow name cannot be empty')
        return v.strip()


class WorkflowUpdate(BaseModel):
    """Schema for updating workflows"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[WorkflowStatus] = None
    workflow_type: Optional[WorkflowType] = None
    nodes: Optional[List[WorkflowNode]] = None
    edges: Optional[List[WorkflowEdge]] = None
    triggers: Optional[List[WorkflowTrigger]] = None
    settings: Optional[WorkflowSettings] = None
    is_enabled: Optional[bool] = None
    max_retries: Optional[int] = Field(None, ge=0)
    timeout_seconds: Optional[int] = Field(None, ge=1)
    
    @validator('name')
    def name_must_not_be_empty(cls, v):
        if v and not v.strip():
            raise ValueError('Workflow name cannot be empty')
        return v.strip() if v else None


class WorkflowResponse(WorkflowBase):
    """Schema for workflow responses"""
    id: str
    execution_count: int = Field(default=0, description="Total executions")
    success_count: int = Field(default=0, description="Successful executions")
    failure_count: int = Field(default=0, description="Failed executions")
    last_execution: Optional[datetime] = Field(None, description="Last execution timestamp")
    average_duration: Optional[int] = Field(None, description="Average duration in seconds")
    created_at: datetime
    updated_at: datetime
    
    # Related entity names for display
    project_name: Optional[str] = None
    
    class Config:
        orm_mode = True
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Schema for paginated workflow list responses"""
    workflows: List[WorkflowResponse]
    total: int
    page: int
    page_size: int


class WorkflowExecutionCreate(BaseModel):
    """Schema for creating workflow executions"""
    input_data: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Execution input data")


class WorkflowExecutionResponse(BaseModel):
    """Schema for workflow execution responses"""
    id: str
    workflow_id: str
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    input_data: Dict[str, Any]
    output_data: Dict[str, Any]
    error_message: Optional[str] = None
    execution_log: List[Dict[str, Any]]
    current_node: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True
        from_attributes = True


class WorkflowMetrics(BaseModel):
    """Schema for workflow metrics"""
    total_workflows: int
    active_workflows: int
    draft_workflows: int
    completed_workflows: int
    total_executions: int
    successful_executions: int
    failed_executions: int
    avg_success_rate: float
    avg_execution_time: float
    
    class Config:
        orm_mode = True